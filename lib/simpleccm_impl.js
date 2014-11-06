"use strict";

var invoker = require( './invoker.js' );
var isNode = require( 'detect-node' );
var comms;

if ( isNode )
{
    comms = require( './node_comms' );
}
else
{
    comms = require( './browser_comms' );
}

exports = module.exports = function()
{
    return new module.exports.SimpleCCMImpl();
};

function SimpleCCMImpl( options )
{
    var optname = invoker.SimpleCCM;
    options[ optname.OPT_CALL_TIMEOUT ] = options[ optname.OPT_CALL_TIMEOUT ] || 30000;
    options[ optname.OPT_X509_VERIFY ] = options[ optname.OPT_X509_VERIFY ] || true;
    options[ optname.OPT_PROD_MODE ] = options[ optname.OPT_PROD_MODE ] || false;
    options[ optname.OPT_COMM_CONFIG_CB ] = options[ optname.OPT_COMM_CONFIG_CB ] || null;

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
            as.error( rsp.e );
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

    perfomHTTP : function( as, ctx, req )
    {
        var native_iface = ctx.native_iface;

        if ( !( '_comms' in ctx ) )
        {
            native_iface._comms = new comms.HTTPComms();
        }

        native_iface._comms.perform( as, ctx, req );
    },

    perfomWebSocket : function( as, ctx, req )
    {
        var native_iface = ctx.native_iface;

        if ( !( '_comms' in ctx ) )
        {
            native_iface._comms = new comms.WSComms();
        }

        native_iface._comms.perform( as, ctx, req );
    },

    perfomUNIX : function( /*as, ctx, req*/ )
    {
        throw new Error( invoker.FutoInError.InvokerError, "Not Implemented" );
    },
};

exports.SimpleCCMImpl = SimpleCCMImpl;
