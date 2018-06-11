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

const common = require( './common' );
const { InvokerError, CommError } = common.FutoInError;

const MessageCoder = require( '../MessageCoder' );

const isNode = common._isNode;
const _defaults = require( 'lodash/defaults' );
let comms_impl;

if ( isNode ) {
    comms_impl = module.require( './node/comms' );
} else {
    comms_impl = require( './browser/comms' );
}

/**
 * This is a pseudo-class for documentation purposes.
 *
 * NOTE: Each option can be set on global level and overriden per interface.
 * @class
 */
const SimpleCCMOptions =
{
    /**
     * Overall call timeout (int)
     * @default 3000
     */
    callTimeoutMS : 3e4,

    /**
     * Production mode - disables some checks without compomising security
     * @default NODE_ENV === 'production'
     */
    prodMode :
        ( typeof process === 'object' ) &&
        ( process.env.NODE_ENV === 'production' ),

    /**
     * Communication configuration callback( type, specific-args )
     * @default
     */
    commConfigCallback : null,

    /**
     * Message sniffer callback( iface_info, msg, is_incomming ).
     * Useful for audit logging.
     * @default dummy
     */
    messageSniffer : function() {},

    /**
     * Bi-directional channel disconnect sniffer callback( iface_info ).
     * Useful for audit logging.
     * @default dummy
     */
    disconnectSniffer : function() {},

    /**
     * Client-side executor for bi-directional communication channels
     */
    executor : null,

    /**
     * *browser-only.* Origin of target for *window.postMessage()*
     */
    targetOrigin : null,

    /**
     * How many times to retry the call on CommError.
     * NOTE: actual attempt count is retryCount + 1
     * @default
     */
    retryCount : 1,

    /**
     * Which message coder to use by default.
     * @default
     */
    defaultCoder : 'JSON',

    /**
     * Which message coder to use for BinaryData interfaces.
     * @default
     */
    binaryCoder : 'MPCK',

    /**
     * Enables marking as SecureChannel through options.
     * @default
     */
    secureChannel : false,
};

/**
 * @private
 * @constructor
 * @param {object} [options] CCM options
 * @see SimpleCCMOptions
 */
class SimpleCCMImpl {
    constructor( options ) {
        options = options || {};
        _defaults( options, SimpleCCMOptions );

        this.options = options;
        this.comms = {};
        this.limiters = {
            unlimited: {
                sync( as, a, b ) {
                    as.add( a, b );
                },
            },
        };

        this._globalHTTPSecureAgent = null;
        this._globalHTTPAgent = null;
        this._load_cache = {};

        Object.seal( this );
    }

    onRegister( as, info ) {
        if ( info.creds_master || info.creds_mac ) {
            as.error( InvokerError,
                "Master/HMAC is supported only in AdvancedCCM" );
        }

        info.funcs = {};
        info.inherits = [];
        info.constraints = {};
        info.simple_req = true;
        info.coder = MessageCoder.get( info.options.coder || this.options.defaultCoder );
    }

    createMessage( as, ctx, params ) {
        const info = ctx.info;

        const req =
        {
            f : `${info.iface}:${info.version}:${ctx.name}`,
            p : params,
            forcersp : true,
        };

        if ( ( info.creds !== null ) &&
             ( info.creds !== 'master' )
        ) {
            req.sec = info.creds;
        }

        as.success( req );
    }

    onMessageResponse( as, _ctx, rsp ) {
        const { e } = rsp;

        if ( e ) {
            as.error( e, rsp.edesc );
        } else {
            as.success( rsp.r );
        }
    }

    onDataResponse( as, _ctx, rsp ) {
        as.success( rsp );
    }

    getComms( as, ctx, CommImpl, extra_key ) {
        let comms;
        let key;
        const ctxopts = ctx.options;
        const globalopts = this.options;

        if ( ( ctxopts.executor !== globalopts.executor ) ||
             ( ctxopts.messageSniffer !== globalopts.messageSniffer ) ||
             ( ctxopts.disconnectSniffer !== globalopts.disconnectSniffer ) ||
             ( ctxopts.commConfigCallback !== globalopts.commConfigCallback ) ) {
            comms = ctx.native_iface._comms;
            key = ctx.info.endpoint_scheme;
        } else {
            comms = this.comms;
            key = ctx.endpoint + '##' + ( ctx.credentials || '' ) + '##' + ( extra_key || '' );
        }

        let c = comms[ key ];

        if ( !c ) {
            if ( !CommImpl ) {
                as.error(
                    InvokerError,
                    "Not implemented " + ctx.info.endpoint_scheme + " scheme" );
            }

            c = new CommImpl();
            comms[ key ] = c;
        }

        return c;
    }

    performCommon( as, ctx, req, comm ) {
        let msg;
        let content_type;
        const retries = ctx.options.retryCount;

        as.repeat( retries + 1, function( as, attempt ) {
            as.add(
                function( as ) {
                    comm.perform( as, ctx, req );
                    as.add( function( as, m, c ) {
                        msg = m;
                        content_type = c;
                        as.break();
                    } );
                },
                function( as, err ) {
                    if ( err === CommError ) {
                        ctx.native_iface.emit( 'commError', as.state.error_info, req );

                        if ( attempt < retries ) {
                            as.continue();
                        }
                    }
                }
            );
        } );
        as.add( function( as ) {
            as.success( msg, content_type );
        } );
    }

    perfomHTTP( as, ctx, req ) {
        const comms = this.getComms( as, ctx, comms_impl.HTTPComms );

        this.performCommon( as, ctx, req, comms );
    }

    perfomWebSocket( as, ctx, req ) {
        const comms = this.getComms( as, ctx, comms_impl.WSComms );

        this.performCommon( as, ctx, req, comms );
    }

    perfomUNIX( as, _ctx, _req ) {
        as.error( InvokerError, "Not implemented unix:// scheme" );
    }

    perfomBrowser( as, ctx, req ) {
        const comms = this.getComms( as, ctx, comms_impl.BrowserComms, ctx.options.targetOrigin );

        comms.perform( as, ctx, req );
    }
}

module.exports = SimpleCCMImpl;
