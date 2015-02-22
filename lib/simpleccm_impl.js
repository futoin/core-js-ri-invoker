"use strict";

var common = require( './common' );
var FutoInError = common.FutoInError;

var isNode = require( 'detect-node' );
var _defaults = require( 'lodash/object/defaults' );
var comms_impl;

if ( isNode )
{
    var hidereq = require;
    comms_impl = hidereq( './node_comms' );
}
else
{
    comms_impl = require( './browser_comms' );
}

exports = module.exports = function( options )
{
    return new module.exports.SimpleCCMImpl( options );
};

var defopts = {
    callTimeoutMS : 3e4,
    prodMode : false,
    commConfigCallback : null,
    retryCount : 1,
    messageSniffer : function()
    {},
    disconnectSniffer : function()
    {}
};

function SimpleCCMImpl( options )
{
    options = options || {};
    _defaults( options, defopts );

    this.options = options;
    this.comms = {};
}

SimpleCCMImpl.prototype =
{
    onRegister : function( as, info )
    {
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
            forcersp : true
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
    }
};

exports.SimpleCCMImpl = SimpleCCMImpl;
