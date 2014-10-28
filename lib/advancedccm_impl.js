"use strict";

var simpleccm_impl = require('./simpleccm_impl');

exports = module.exports = function()
{
    return new module.exports.AdvancedCCMImpl();
}

function AdvancedCCMImpl( options )
{
    this.options = options;
}

AdvancedCCMImpl.prototype =
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
    }
};

AdvancedCCMImpl.prototype.prototype = simpleccm_impl.SimpleCCMImpl;
exports.AdvancedCCMImpl = AdvancedCCMImpl;