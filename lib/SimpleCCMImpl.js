"use strict";

var common = require( './common' );
var FutoInError = common.FutoInError;

var isNode = common._isNode;
var _defaults = require( 'lodash/defaults' );
var comms_impl;

if ( isNode )
{
    comms_impl = common._nodeRequire( './node/comms' );
}
else
{
    comms_impl = require( './browser/comms' );
}

/**
 * This is a pseudo-class for documentation purposes.
 *
 * NOTE: Each option can be set on global level and overriden per interface.
 * @class
 */
var SimpleCCMOptions =
{
    /**
     * Overall call timeout (int)
     * @default 3000
     */
    callTimeoutMS : 3e4,

    /**
     * Production mode - disables some checks without compomising security
     * @default
     */
    prodMode : false,

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
    messageSniffer : function()
    {},

    /**
     * Bi-directional channel disconnect sniffer callback( iface_info ).
     * Useful for audit logging.
     * @default dummy
     */
    disconnectSniffer : function()
    {},

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
};

/**
 * @private
 * @constructor
 * @param {object} [options] CCM options
 * @see SimpleCCMOptions
 */
function SimpleCCMImpl( options )
{
    options = options || {};
    _defaults( options, SimpleCCMOptions );

    this.options = options;
    this.comms = {};
}

SimpleCCMImpl.prototype =
{
    onRegister : function( as, info )
    {
        if ( info.creds_master || info.creds_hmac )
        {
            as.error( FutoInError.InvokerError, "Master/HMAC is supported only in AdvancedCCM" );
        }

        info.funcs = {};
        info.inherits = [];
        info.constraints = {};
        info.simple_req = true;
    },

    createMessage : function( as, ctx, params )
    {
        var info = ctx.info;

        var req =
        {
            f : info.iface + ':' + info.version + ':' + ctx.name,
            p : params,
            forcersp : true,
        };

        if ( ( info.creds !== null ) &&
             ( info.creds !== 'master' ) )
        {
            req.sec = info.creds;
        }

        as.success( req );
    },

    onMessageResponse : function( as, ctx, rsp )
    {
        if ( 'e' in rsp )
        {
            as.error( rsp.e, rsp.edesc );
        }
        else
        {
            as.success( rsp.r );
        }
    },

    onDataResponse : function( as, ctx, rsp )
    {
        as.success( rsp );
    },

    getComms : function( as, ctx, CommImpl, extra_key )
    {
        var comms;
        var key;
        var ctxopts = ctx.options;
        var globalopts = this.options;

        if ( ( ctxopts.executor !== globalopts.executor ) ||
             ( ctxopts.messageSniffer !== globalopts.messageSniffer ) ||
             ( ctxopts.disconnectSniffer !== globalopts.disconnectSniffer ) ||
             ( ctxopts.commConfigCallback !== globalopts.commConfigCallback ) )
        {
            comms = ctx.native_iface._comms;
            key = ctx.info.endpoint_scheme;
        }
        else
        {
            comms = this.comms;
            key = ctx.endpoint + '##' + ( ctx.credentials || '' ) + '##' + ( extra_key || '' );
        }

        var c = comms[ key ];

        if ( !c )
        {
            if ( !CommImpl )
            {
                as.error(
                    FutoInError.InvokerError,
                    "Not implemented " + ctx.info.endpoint_scheme + " scheme" );
            }

            c = new CommImpl();
            comms[ key ] = c;
        }

        return c;
    },

    performCommon : function( as, ctx, req, comm )
    {
        var msg;
        var content_type;
        var retries = ctx.options.retryCount;

        as.repeat( retries + 1, function( as, attempt )
        {
            as.add(
                function( as )
                {
                    comm.perform( as, ctx, req );
                    as.add( function( as, m, c )
                    {
                        msg = m;
                        content_type = c;
                        as.break();
                    } );
                },
                function( as, err )
                {
                    if ( err === FutoInError.CommError )
                    {
                        ctx.native_iface.emit( 'commError', as.state.error_info, req );

                        if ( attempt < retries )
                        {
                            as.continue();
                        }
                    }
                }
            );
        } )
            .add( function( as )
            {
                as.success( msg, content_type );
            } );
    },

    perfomHTTP : function( as, ctx, req )
    {
        var comms = this.getComms( as, ctx, comms_impl.HTTPComms );

        this.performCommon( as, ctx, req, comms );
    },

    perfomWebSocket : function( as, ctx, req )
    {
        var comms = this.getComms( as, ctx, comms_impl.WSComms );

        this.performCommon( as, ctx, req, comms );
    },

    perfomUNIX : function( as, ctx, req )
    {
        void ctx;
        void req;
        as.error( FutoInError.InvokerError, "Not implemented unix:// scheme" );
    },

    perfomBrowser : function( as, ctx, req )
    {
        var comms = this.getComms( as, ctx, comms_impl.BrowserComms, ctx.options.targetOrigin );

        comms.perform( as, ctx, req );
    },
};

module.exports = SimpleCCMImpl;
