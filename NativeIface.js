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

const { SAFE_PAYLOAD_LIMIT } = Options;

const assertAS = Options.prodMode
    ? () => {}
    : $as.assertAS;

/**
 * Native Interface for FutoIn ifaces
 * @class
 * @param {AdvancedCCMImpl} ccmimpl - CCM instance
 * @param {InterfaceInfo} info - interface info
 * @alias NativeIface
 */
class NativeIface {
    constructor( _ccmimpl, _info ) {
        $asyncevent( this, [
            'connect',
            'disconnect',
            'close',
            'commError',
        ] );

        const ccmimpl = _ccmimpl;
        const info = _info;
        this._ccmimpl = ccmimpl;
        this._raw_info = info;
        this._iface_info = null;
        this._comms = {};

        //---
        const {
            limitZone,
            options,
            endpoint,
            endpoint_scheme,
            coder,
            funcs,
            signMessage,
        } = info;

        const {
            callTimeoutMS,
        } = options;

        //---
        let custom_create_ctx;
        let custom_perform;

        switch ( endpoint_scheme ) {
        case '#internal#':
            custom_create_ctx = ( name, upload_data, download_stream ) => {
                return {
                    ccmimpl,
                    name,
                    info,
                    upload_data,
                    download_stream,
                    options,
                    endpoint,
                    expect_response : true,
                    max_rsp_size: 0,
                    max_req_size: 0,
                };
            };
            custom_perform = ( as, ctx, req ) => {
                signMessage( as, ctx, req );
                endpoint.onInternalRequest( as, info, req, ctx.upload_data, ctx.download_stream );
            };
            break;
        case 'http':
        case 'https':
            custom_perform = ( as, ctx, req ) => {
                ccmimpl.perfomHTTP( as, ctx, req );
            };
            break;
        case 'ws':
        case 'wss':
            custom_perform = ( as, ctx, req ) => {
                let finfo;
                const rawresult = (
                    ctx.download_stream ||
                    ( funcs && ( finfo = funcs[ ctx.name ] ) && finfo.rawresult )
                );

                if ( rawresult || ctx.upload_data ) {
                    ctx.endpoint = endpoint.replace( 'ws', 'http' );
                    ctx.rawresult = rawresult;
                    ccmimpl.perfomHTTP( as, ctx, req );
                } else {
                    ccmimpl.perfomWebSocket( as, ctx, req );
                }
            };
            break;
        case 'browser':
            custom_perform = ( as, ctx, req ) => {
                forbid_rawdata( as, ctx );
                ccmimpl.perfomBrowser( as, ctx, req );
            };
            break;
        case 'unix':
            custom_perform = ( as, ctx, req ) => {
                forbid_rawdata( as, ctx );
                ccmimpl.perfomUNIX( as, ctx, req );
            };
            break;
        case 'callback':
            custom_perform = ( as, ctx, req ) => {
                forbid_rawdata( as, ctx );
                endpoint( as, ctx, req );
            };
            break;
        default:
            custom_perform = ( as ) => {
                as.error( InvokerError, `Unknown endpoint scheme: ${endpoint_scheme}` );
            };
        }

        //---
        const create_ctx = custom_create_ctx || ( ( name, upload_data, download_stream ) => {
            return {
                ccmimpl,
                name,
                info,
                upload_data,
                download_stream,
                rawresult : false,
                rsp_content_type : null,
                native_iface : this,
                options,
                endpoint,
                msg_coder : coder,
                expect_response : true,
                signMessage,
                max_rsp_size: SAFE_PAYLOAD_LIMIT,
                max_req_size: SAFE_PAYLOAD_LIMIT,
            };
        } );
        const perform = custom_perform;
        const handle_timeout = ( as, timeout ) => {
            if ( typeof timeout !== 'number' ) {
                timeout = callTimeoutMS;
            }

            if ( timeout > 0 ) {
                as.setTimeout( timeout );
            }
        };
        const forbid_rawdata = ( as, ctx ) => {
            if ( ctx.upload_data ) {
                as.error(
                    InvokerError,
                    'Upload data is allowed only for HTTP/WS endpoints' );
            } else if ( ctx.download_stream ) {
                as.error(
                    InvokerError,
                    'Download stream is allowed only for HTTP/WS endpoints' );
            }
        };

        //---
        const { limiters } = ccmimpl;
        const sync_limit = ( () => {
            if ( limitZone === 'unlimited' ) {
                const unlim_timeout_handler = ( as, handler, ctx, req, timeout ) => {
                    as.add( ( as ) => {
                        handle_timeout( as, timeout );
                        handler( as, ctx, req );
                    } );
                };

                if ( endpoint_scheme === '#internal#' ) {
                    return ( as, handler, ctx, req, timeout ) => {
                        if ( timeout ) {
                            unlim_timeout_handler( as, handler, ctx, req, timeout );
                        } else {
                            handler( as, ctx, req );
                        }
                    };
                } else {
                    return unlim_timeout_handler;
                }
            }

            return ( as, handler, ctx, req, timeout ) => {
                as.sync( limiters[limitZone], ( as ) => {
                    handle_timeout( as, timeout );
                    handler( as, ctx, req );
                } );
            };
        } )();

        //---
        const handle_response = ( as, ctx, rsp, is_futoin_message ) => {
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
        };

        //---
        const call = ( as, name, params, upload_data=null, download_stream=null, timeout=null ) => {
            assertAS( as );

            params = params || {}; // null or undefined may still be passed by caller

            // Create context
            // ---
            const ctx = create_ctx( name, upload_data, download_stream );
            Object.seal( ctx );

            // Create message
            // ---
            const req = ccmimpl.createMessage( as, ctx, params );

            // Perform request
            // ---
            sync_limit( as, perform, ctx, req, timeout );

            // Handle response
            // ---
            if ( ctx.expect_response ) {
                as.add( ( as, rsp, is_futoin_message ) =>
                    handle_response( as, ctx, rsp, is_futoin_message ) );
            }
        };
        Object.defineProperty( this, 'call', {
            value: call,
            configurable: false,
            enumerable: false,
            writeable: false,
        } );


        // Create Native interceptors for FutoIn interface functions
        //---
        const member_call_generate_eval = ( name, finfo ) => {
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

            src.push( `return call(as, "${name}", params);` );
            src.push( '})' );

            return eval( src.join( '' ) );
        };

        for ( let fn in funcs ) {
            const finfo = funcs[ fn ];

            // Not allowed
            if ( finfo.rawupload ) {
                continue;
            }

            if ( fn in this ) {
                continue;
            }

            Object.defineProperty( this, fn, {
                value: member_call_generate_eval( fn, finfo ),
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
            const this_mod = module;
            iface = this_mod.require( mod );
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

    /**
    * Get interface info
    * @returns {InterfaceInfo} - interface info
    * @alias NativeIface#ifaceInfo
    */
    ifaceInfo() {
        const info = this._iface_info;

        if ( info ) {
            return info;
        }

        return ( this._iface_info = new InterfaceInfo( this._raw_info ) );
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
