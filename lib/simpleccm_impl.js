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

    perfomHTTP : function( as, ctx, req )
    {
        var native_iface = ctx.native_iface;

        if ( !( '_httpcomms' in native_iface ) )
        {
            native_iface._httpcomms = new comms.HTTPComms();
        }

        native_iface._httpcomms.perform( as, ctx, req );
    },

    perfomWebSocket : function( as, ctx, req )
    {
        var native_iface = ctx.native_iface;

        if ( !( '_wscomms' in native_iface ) )
        {
            native_iface._wscomms = new comms.WSComms();
        }

        native_iface._wscomms.perform( as, ctx, req );
    },

    perfomUNIX : function( as, ctx, req )
    {
        void ctx;
        void req;
        as.error( FutoInError.InvokerError, "Not Implemented" );
    },
};

exports.SimpleCCMImpl = SimpleCCMImpl;
