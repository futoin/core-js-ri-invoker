"use strict";

var common = require( './common' );
var FutoInError = common.FutoInError;
var optname = common.Options;

var isNode = require( 'detect-node' );
var _ = require( 'lodash' );
var comms;

if ( isNode )
{
    var hidereq = require;
    comms = hidereq( './node_comms' );
}
else
{
    comms = require( './browser_comms' );
}

exports = module.exports = function( options )
{
    return new module.exports.SimpleCCMImpl( options );
};

function SimpleCCMImpl( options )
{
    options = options || {};

    var defopts = {};
    defopts[ optname.OPT_CALL_TIMEOUT ] = 30000;
    defopts[ optname.OPT_X509_VERIFY ] = true;
    defopts[ optname.OPT_PROD_MODE ] = false;
    defopts[ optname.OPT_COMM_CONFIG_CB ] = null;
    defopts[ optname.OPT_RETRY_COUNT ] = 1;
    defopts[ optname.OPT_MSG_SNIFFER ] = function()
    {};
    defopts[ optname.OPT_DISCONNECT_SNIFFER ] = function()
    {};

    _.defaults( options, defopts );

    this.options = options;
}

SimpleCCMImpl.prototype =
{
    onRegister : function( as, info )
    {
        info.funcs = {};
        info.inherits = [];
        info.constraints = {};
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

    performCommon : function( as, ctx, req, comm )
    {
        var msg;
        var content_type;

        as.repeat( ctx.options.retryCount + 1, function( as )
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
                        as.continue();
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
        var native_iface = ctx.native_iface;

        if ( !( '_httpcomms' in native_iface ) )
        {
            native_iface._httpcomms = new comms.HTTPComms();
        }

        this.performCommon( as, ctx, req, native_iface._httpcomms );
    },

    perfomWebSocket : function( as, ctx, req )
    {
        var native_iface = ctx.native_iface;

        if ( !( '_wscomms' in native_iface ) )
        {
            native_iface._wscomms = new comms.WSComms();
        }

        this.performCommon( as, ctx, req, native_iface._wscomms );
    },

    perfomUNIX : function( as, ctx, req )
    {
        void ctx;
        void req;
        as.error( FutoInError.InvokerError, "Not implemented unix:// scheme" );
    },

    perfomBrowser : function( as, ctx, req )
    {
        var native_iface = ctx.native_iface;

        if ( !( '_browser_comms' in native_iface ) )
        {
            if ( !( 'BrowserComms' in comms ) )
            {
                as.error( FutoInError.InvokerError, "Not implemented browser:// scheme" );
            }

            native_iface._browser_comms = new comms.BrowserComms();
        }

        native_iface._browser_comms.perform( as, ctx, req );
    }
};

exports.SimpleCCMImpl = SimpleCCMImpl;
