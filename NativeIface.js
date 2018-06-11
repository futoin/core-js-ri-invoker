"use strict";

/**
 * @file
 *
 * Copyright 2014-2017 FutoIn Project (https://futoin.org)
 * Copyright 2014-2017 Andrey Galkin <andrey@futoin.org>
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

const $asyncevent = require( 'futoin-asyncevent' );
const $as = require( 'futoin-asyncsteps' );

const common = require( './lib/common' );
const { InvokerError, CommError } = common.FutoInError;
const InterfaceInfo = require( './InterfaceInfo' );
const Options = common.Options;

/**
 * Native Interface for FutoIn ifaces
 * @class
 * @param {AdvancedCCMImpl} ccmimpl - CCM instance
 * @param {InterfaceInfo} info - interface info
 * @alias NativeIface
 */
class NativeIface {
    constructor( ccmimpl, info ) {
        $asyncevent( this, [
            'connect',
            'disconnect',
            'close',
            'commError',
        ] );

        this._ccmimpl = ccmimpl;
        this._raw_info = info;
        this._iface_info = null;
        this._comms = {};

        // Create Native interceptors for FutoIn interface functions
        //---
        for ( let fn in this._raw_info.funcs ) {
            const finfo = this._raw_info.funcs[ fn ];

            // Not allowed
            if ( finfo.rawupload ) {
                continue;
            }

            if ( fn in this ) {
                continue;
            }

            Object.defineProperty( this, fn, {
                value: this._member_call_generate_eval( fn, finfo ),
                configurable: false,
                enumerable: false,
                writeable: false,
            } );
        }
    }

    /**
    * Get hardcoded iface definition, if available.
    * @param {string} version - iface version
    * @returns {object} interface spec of required version
    * @alias NativeIface.spec
    * @note this helper is designed for derived native interfaces
    *      which define _specs or _specs_module_prefix static members.
    */
    static spec( version ) {
        let iface;

        if ( this._specs ) {
            iface = this._specs[version];
        }

        if ( !iface && this._specs_module_prefix ) {
            const mod = this._specs_module_prefix + version.replace( '.', '_' );

            iface = module.require( mod );
        }

        return iface;
    }

    /**
    * Generic FutoIn function call interface
    * Result is passed through AsyncSteps.success() as a map.
    * @param {AsyncSteps} as - AsyncSteps object
    * @param {string} name - FutoIn iface function name
    * @param {object} params - map of func parameters
    * @param {string|stream.Readable=} upload_data - raw upload data or input stram
    * @param {stream.Writable=} download_stream - output stream for raw download data
    * @param {int=} timeout - if provided, overrides the default. <=0 - disables timeout
    * @alias NativeIface#call
    */
    call( as, name, params, upload_data, download_stream, timeout ) {
        $as.assertAS( as );

        params = params || {};
        const raw_info = this._raw_info;

        const ctx = {
            ccmimpl : this._ccmimpl,
            name : name,
            info : raw_info,
            upload_data : upload_data,
            download_stream : download_stream,
            rawresult : false,
            rsp_content_type : null,
            native_iface : this,
            options : raw_info.options,
            endpoint : raw_info.endpoint,
            msg_coder : raw_info.coder,
            expect_response : true,
            signMessage : this._signMessageDummy,
            max_rsp_size: Options.SAFE_PAYLOAD_LIMIT,
            max_req_size: Options.SAFE_PAYLOAD_LIMIT,
        };
        Object.seal( ctx );

        const ccmimpl = this._ccmimpl;

        // Create message
        // ---
        as.add( ( as ) => ccmimpl.createMessage( as, ctx, params ) );

        // Perform request
        // ---
        as.sync(
            ccmimpl.limiters[raw_info.limitZone],
            ( as, req ) => {
                if ( ctx.expect_response ) {
                    if ( typeof timeout !== 'number' ) {
                        timeout = ctx.info.options.callTimeoutMS;
                    }

                    if ( timeout > 0 ) {
                        as.setTimeout( timeout );
                    }
                }

                const scheme = raw_info.endpoint_scheme;

                if ( scheme === '#internal#' ) {
                    ctx.endpoint.onInternalRequest( as, raw_info, req, upload_data, download_stream );
                } else if ( ( scheme === 'http' ) ||
                            ( scheme === 'https' ) ) {
                    ccmimpl.perfomHTTP( as, ctx, req );
                } else if ( ( scheme === 'ws' ) ||
                            ( scheme === 'wss' ) ) {
                    let finfo;
                    const rawresult = ctx.download_stream || ( ctx.info.funcs &&
                            ( finfo = ctx.info.funcs[ name ] ) &&
                            finfo.rawresult );

                    if ( ctx.upload_data || rawresult ) {
                        ctx.endpoint = ctx.endpoint.replace( 'ws', 'http' );
                        ctx.rawresult = rawresult;
                        ccmimpl.perfomHTTP( as, ctx, req );
                    } else {
                        ccmimpl.perfomWebSocket( as, ctx, req );
                    }
                } else if ( ctx.upload_data ) {
                    as.error(
                        InvokerError,
                        'Upload data is allowed only for HTTP/WS endpoints' );
                } else if ( ctx.download_stream ) {
                    as.error(
                        InvokerError,
                        'Download stream is allowed only for HTTP/WS endpoints' );
                } else if ( scheme === 'browser' ) {
                    ccmimpl.perfomBrowser( as, ctx, req );
                } else if ( scheme === 'unix' ) {
                    ccmimpl.perfomUNIX( as, ctx, req );
                } else if ( scheme === 'callback' ) {
                    ctx.endpoint( as, ctx, req );
                } else {
                    as.error( InvokerError, 'Unknown endpoint scheme' );
                }

                if ( ctx.expect_response ) {
                    as.add( ( as, rsp, is_futoin_message ) => {
                        if ( ctx.download_stream ) {
                            as.success( true );
                        } else if ( is_futoin_message ) {
                            if ( ( rsp instanceof Uint8Array ) ||
                                 ( typeof rsp === 'string' )
                            ) {
                                try {
                                    rsp = ctx.msg_coder.decode( rsp );
                                } catch ( e ) {
                                    as.error( CommError, "Decode: " + e.message );
                                }
                            }

                            ccmimpl.onMessageResponse( as, ctx, rsp );
                        } else {
                            ccmimpl.onDataResponse( as, ctx, rsp );
                        }
                    } );
                }
            }
        );
    }

    /**
    * @ignore
    * @param {string} name - member name
    * @param {InterfaceInfo} finfo - interface info
    * @returns {function} call generator with bound parameters
    */
    _member_call_generate_eval( name, finfo ) {
        const src = [];
        const { params } = finfo;

        const plist = Object.keys( params );
        const pmap = [];

        for ( let p of plist ) {
            if ( params[p].default === undefined ) {
                pmap.push( `${p}:${p}` );
            }
        }

        const args = [ 'as' ].concat( plist );

        src.push( `(function (${args.join( ',' )}) {` );
        src.push( `'use strict';` );
        src.push( `var params = {${pmap.join( ',' )}};` );

        for ( let p of plist ) {
            if ( params[p].default !== undefined ) {
                src.push( `if (${p} !== undefined) params.${p} = ${p};` );
            }
        }

        src.push( `return this.call(as, "${name}", params);` );
        src.push( '})' );

        return eval( src.join( '' ) );
    }

    /**
    * Get interface info
    * @returns {InterfaceInfo} - interface info
    * @alias NativeIface#ifaceInfo
    */
    ifaceInfo() {
        if ( !this._iface_info ) {
            this._iface_info = new InterfaceInfo( this._raw_info );
        }

        return this._iface_info;
    }

    /**
    * Results with DerivedKeyAccessor through as.success()
    * @param {AsyncSteps} as - step interface
    * @alias NativeIface#bindDerivedKey
    */
    bindDerivedKey( as ) {
        throw new Error( InvokerError, "Not Implemented" );
    }

    /**
    * Shutdow interface
    * @private
    */
    _close() {
        const comms = this._comms;

        for ( let k in comms ) {
            comms[ k ].close();
        }

        this.emit( 'close' );
    }

    /**
    * Dummy sign function
    * @private
    */
    _signMessageDummy() {}
}

/**
* Must be object with version => spec pairs in child class, if set.
*
* @alias NativeIface._specs
*/
NativeIface._specs = null;

/**
* Must be module name prefix, example: 'MyModule/specs/name_'.
*
* If version 1.0 is requested then spec is loaded from
* 'MyModule/specs/name_1_0'
*
* @alias NativeIface._specs_module_prefix
*/
NativeIface._specs_module_prefix = null;


module.exports = NativeIface;

/**
 * Fired when interface establishes connection.
 * @event NativeIface#connect
 */

/**
 * Fired when interface connection is closed.
 * @event NativeIface#disconnect
 */

/**
 * Interface close event. Fired on interface unregistration.
 * @event NativeIface#close
 */

/**
 * Interface communication error. Fired during call processing.
 * ( error_info, rawreq )
 * @event NativeIface#commError
 */
