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

var common = require( './lib/common' );
var futoin_error = common.FutoInError;
var _zipObject = require( 'lodash/zipObject' );
var ee = require( 'event-emitter' );
var InterfaceInfo = require( './InterfaceInfo' );
var Options = common.Options;
var FUTOIN_CONTENT_TYPE = Options.FUTOIN_CONTENT_TYPE;

/**
 * Native Interface for FutoIn ifaces
 * @class
 * @param {AdvancedCCMImpl} ccmimpl - CCM instance
 * @param {InterfaceInfo} info - interface info
 * @alias NativeIface
 */
function NativeIface( ccmimpl, info ) {
    this._ccmimpl = ccmimpl;
    this._raw_info = info;
    this._iface_info = null;
    this._comms = {};

    ee( this );

    for ( var fn in this._raw_info.funcs ) {
        var finfo = this._raw_info.funcs[ fn ];

        // Not allowed
        if ( finfo.rawupload ) {
            continue;
        }

        if ( fn in this ) {
            continue;
        }

        this[ fn ] = this._member_call_generate( fn, finfo );
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

/**
 * Get hardcoded iface definition, if available.
 * @param {string} version - iface version
 * @returns {object} interface spec of required version
 * @alias NativeIface.spec
 * @note this helper is designed for derived native interfaces
 *      which define _specs or _specs_module_prefix static members.
 */
NativeIface.spec = function( version ) {
    var iface;

    if ( this._specs ) {
        iface = this._specs[version];
    }

    if ( !iface && this._specs_module_prefix ) {
        var mod = this._specs_module_prefix + version.replace( '.', '_' );

        iface = module.require( mod );
    }

    return iface;
};

var NativeIfaceProto = {};

NativeIface.prototype = NativeIfaceProto;

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
NativeIfaceProto.call = function( as, name, params, upload_data, download_stream, timeout ) {
    params = params || {};
    var raw_info = this._raw_info;

    var ctx = {
        ccmimpl : this._ccmimpl,
        name : name,
        info : raw_info,
        upload_data : upload_data,
        download_stream : download_stream,
        rsp_content_type : null,
        native_iface : this,
        options : raw_info.options,
        endpoint : raw_info.endpoint,
        expect_response : true,
        signMessage : this._signMessageDummy,
        max_rsp_size: Options.SAFE_PAYLOAD_LIMIT,
        max_req_size: Options.SAFE_PAYLOAD_LIMIT,
    };

    var ccmimpl = this._ccmimpl;

    // Create message
    // ---
    as.add(
        function( as ) {
            ccmimpl.createMessage( as, ctx, params );
        }
    );

    // Perform request
    // ---
    as.add(
        function( as, req ) {
            if ( ctx.expect_response ) {
                if ( typeof timeout !== 'number' ) {
                    timeout = ctx.info.options.callTimeoutMS;
                }

                if ( timeout > 0 ) {
                    as.setTimeout( timeout );
                }
            }

            var scheme = raw_info.endpoint_scheme;

            if ( scheme === '#internal#' ) {
                ctx.endpoint.onInternalRequest( as, raw_info, req, upload_data, download_stream );
            } else if ( ( scheme === 'http' ) ||
                        ( scheme === 'https' ) ) {
                ccmimpl.perfomHTTP( as, ctx, req );
            } else if ( ( scheme === 'ws' ) ||
                        ( scheme === 'wss' ) ) {
                var finfo;
                var rawresult = ctx.download_stream || ( ctx.info.funcs &&
                        ( finfo = ctx.info.funcs[ name ] ) &&
                        finfo.rawresult );

                if ( ctx.upload_data ||
                        rawresult ) {
                    ctx.endpoint = ctx.endpoint.replace( 'ws', 'http' );
                    ctx.rawresult = rawresult;
                    ccmimpl.perfomHTTP( as, ctx, req );
                } else {
                    ccmimpl.perfomWebSocket( as, ctx, req );
                }
            } else if ( ctx.upload_data ) {
                as.error(
                    futoin_error.InvokerError,
                    'Upload data is allowed only for HTTP/WS endpoints' );
            } else if ( ctx.download_stream ) {
                as.error(
                    futoin_error.InvokerError,
                    'Download stream is allowed only for HTTP/WS endpoints' );
            } else if ( scheme === 'browser' ) {
                ccmimpl.perfomBrowser( as, ctx, req );
            } else if ( scheme === 'unix' ) {
                ccmimpl.perfomUNIX( as, ctx, req );
            } else if ( scheme === 'callback' ) {
                ctx.endpoint( as, ctx, req );
            } else {
                as.error( futoin_error.InvokerError, 'Unknown endpoint scheme' );
            }

            if ( ctx.expect_response ) {
                as.add(
                    function( as, rsp, content_type ) {
                        if ( ctx.download_stream ) {
                            as.success( true );
                        } else if ( ( content_type === FUTOIN_CONTENT_TYPE ) ||
                                    ( content_type === true ) ) {
                            if ( typeof rsp === 'string' ) {
                                try {
                                    rsp = JSON.parse( rsp );
                                } catch ( e ) {
                                    as.error( futoin_error.CommError, "JSON:" + e.message );
                                }
                            }

                            ccmimpl.onMessageResponse( as, ctx, rsp );
                        } else {
                            ccmimpl.onDataResponse( as, ctx, rsp );
                        }
                    }
                );
            }
        }
    );
};

/**
 * @ignore
 * @param {AsyncSteps} as - _
 * @param {string} name - _
 * @param {object} finfo - _
 * @param {array} args - _
 */
NativeIfaceProto._member_call_intercept = function( as, name, finfo, args ) {
    var arginfo = finfo.params;
    var keys = Object.keys( arginfo );

    if ( args.length > keys.length ) {
        as.error( futoin_error.InvokerError, "Unknown parameters" );
    } else if ( args.length < finfo.min_args ) {
        as.error( futoin_error.InvokerError, "Missing parameters" );
    } else if ( args.length < keys.length ) {
        keys = keys.splice( 0, args.length );
    }

    var params = _zipObject( keys, args );

    this.call( as, name, params );
};

/**
 * @ignore
 * @param {string} name - member name
 * @param {InterfaceInfo} finfo - interface info
 * @returns {function} call generator with bound parameters
 */
NativeIfaceProto._member_call_generate = function( name, finfo ) {
    return function( as ) {
        this._member_call_intercept(
            as,
            name,
            finfo,
            Array.prototype.slice.call( arguments, 1 )
        );
    };
};

/**
 * Get interface info
 * @returns {InterfaceInfo} - interface info
 * @alias NativeIface#ifaceInfo
 */
NativeIfaceProto.ifaceInfo = function() {
    if ( !this._iface_info ) {
        this._iface_info = new InterfaceInfo( this._raw_info );
    }

    return this._iface_info;
};

/**
 * Results with DerivedKeyAccessor through as.success()
 * @param {AsyncSteps} as - step interface
 * @alias NativeIface#bindDerivedKey
 */
NativeIfaceProto.bindDerivedKey = function( as ) {
    void as;
    throw new Error( futoin_error.InvokerError, "Not Implemented" );
};

/**
 * Shutdow interface
 * @private
 */
NativeIfaceProto._close = function() {
    var comms = this._comms;

    for ( var k in comms ) {
        comms[ k ].close();
    }

    this.emit( 'close' );
};

/**
 * Dummy sign function
 * @private
 */
NativeIfaceProto._signMessageDummy = function() {};

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
