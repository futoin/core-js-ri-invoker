"use strict";

var invoker = require( './invoker.js' );

exports = module.exports = function()
{
    return new module.exports.SimpleCCMImpl();
}

function SimpleCCMImpl( options )
{
    var optname = invoker.SimpleCCM;
    options[ optname.OPT_CONNECT_TIMEOUT ] = options[ optname.OPT_CONNECT_TIMEOUT ] || 1000;
    options[ optname.OPT_CALL_TIMEOUT ] = options[ optname.OPT_CALL_TIMEOUT ] || 30000;
    options[ optname.OPT_X509_VERIFY ] = options[ optname.OPT_X509_VERIFY ] || true;
    options[ optname.OPT_PROD_MODE ] = options[ optname.OPT_PROD_MODE ] || false;

    this.options = options;
}

SimpleCCMImpl.prototype =
{
    onRegister : function( as, info )
    {
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
        throw new Error( invoker.FutoInError.InvokerError, "Not Implemented" );
    },
    
    perfomWebSocket : function( as, ctx, req )
    {
        throw new Error( invoker.FutoInError.InvokerError, "Not Implemented" );
    },
    
    perfomUNIX : function( as, ctx, req )
    {
        throw new Error( invoker.FutoInError.InvokerError, "Not Implemented" );
    },
};

exports.SimpleCCMImpl = SimpleCCMImpl;