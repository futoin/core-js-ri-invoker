"use strict";

exports = module.exports = function()
{
    return new module.exports.SimpleCCMImpl();
}

function SimpleCCMImpl( options )
{
    this.options = options;
}

SimpleCCMImpl.prototype =
{
    onRegister : function( as, info )
    {
    },
    
    createMessage : function( as, ctx, params )
    {
    },
    
    onMessageResponse : function( as, ctx, rsp )
    {
    },
    
    onDataResponse : function( as, ctx )
    {
    },
    
    perfomHTTP : function( as, ctx, req )
    {
    },
    
    perfomWebSocket : function( as, ctx, req )
    {
    },
    
    perfomLocal : function( as, ctx, req )
    {
    },
};

exports.SimpleCCMImpl = SimpleCCMImpl;