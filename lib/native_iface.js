"use strict";


var futoin_error = require( 'futoin-asyncsteps' ).FutoInError;
var invoker = require( './invoker' );


exports = module.exports = function( ccmimpl, info )
{
    return new module.exports.NativeIface( ccmimpl, info );
}

/**
 * FutoIn interface info
 * @class
 */
function InterfaceInfo( raw_info )
{
    this._raw_info = raw_info;
}

InterfaceInfo.prototype =
{
    /**
     * Get FutoIn interface type
     * @returns {string}
     */
    name : function()
    {
        return this._raw_info->iface;
    },
    
    /**
     * Get FutoIn interface version
     * @returns {string}
     */
    version : function()
    {
        return this._raw_info->version;
    },
    
    /**
     * Get list of inherited interfaces starting from the most derived, may be null
     * @returns {object}
     */
    inherits : function()
    {
        return this._raw_info->inherits;
    },
    
    /**
     * Get list of available functions, may be null
     * @returns {object}
     */
    funcs : function()
    {
        return this._raw_info->funcs;
    },
    
    /**
     * Get list of interface constraints, may be null
     * @returns {object}
     */
    constraints : function()
    {
        return this._raw_info->constraints;
    }
};


/**
 * Native Interface for FutoIn ifaces
 * @class
 */
function NativeIface( ccmimpl, info )
{
    this._ccmimpl = ccmimpl;
    this._raw_info = info;
    this._iface_info = null;
}

NativeIface.prototype =
{
    /**
     * Generic FutoIn function call interface
     * Result is passed through AsyncSteps.success() as a map.
     * @param {AsyncSteps} as - AsyncSteps object
     * @param {string} name - FutoIn iface function name
     * @param {string|stream.Readable=} upload_data - raw upload data or input stram
     * @param {stream.Writable=} download_stream - output stream for raw download data
     * @param {int=} timeout - if provided, overrides the default. <=0 - disables timeout
     */
    call : function( as, name, params, upload_data, download_stream, timeout )
    {
        var ctx = {
            name : name,
            info : this._raw_info,
            upload_data : upload_data,
            download_stream : download_stream,
            rsp_content_type : null
        };
        
        var ccmimpl = this._ccmimpl;
        
        // Create message
        //---
        as.add(
            function( as )
            {
                ccmimpl.createMessage( as, ctx, params );
            }
        );
        
        // Perform request
        //---
        as.add(
            function( as, req )
            {
                if ( timeout === undefined )
                {
                    timeout = ccmimpl.options[ invoker.SimpleCCM.OPT_CALL_TIMEOUT_MS ];
                }
                
                if ( timeout > 0 )
                {
                    as.setTimeout( timeout );
                }
                
                var schema = ctx.info.endpoint.splin(':')[0];

                if ( ( schema === 'http' ) &&
                     ( schema === 'https' ) )
                {
                    ccmimpl.perfomHTTP( as, ctx, req );
                }
                else if ( ctx.upload_data )
                {
                    as.error( futoin_error.InvokerError, 'Upload data is allowed only for HTTP endpoints' );
                }
                else if ( ctx.download_stream )
                {
                    as.error( futoin_error.InvokerError, 'Download stream is allowed only for HTTP endpoints' );
                }
                else if ( ( schema === 'ws' ) &&
                          ( schema === 'wss' ) )
                {
                    ccmimpl.perfomWebSocket( as, ctx, req );
                }
                else if ( schema === 'unix' )
                {
                    ccmimpl.perfomUNIX( as, ctx, req );
                }
                else
                {
                    as.error( futoin_error.InvokerError, 'Unknown endpoint schema' );
                }
                
                as.add(
                    function( as, rsp )
                    {
                        if ( ctx.download_stream )
                        {
                            as.success( true );
                        }
                        else if ( ctx.rsp_content_type === 'application/futoin+json'  )
                        {
                            try
                            {
                                rsp = JSON.parse( rsp );
                                ccmimpl.onMessageResponse( as, ctx, rsp );
                            }
                            catch( e )
                            {
                                as.error( futoin_error.CommError, "JSON:" + e.message );
                            }
                        }
                        else
                        {
                            ccmimpl.onDataResponse( as, ctx, rsp );
                        }
                    }
                );
            }
        );
    },
    
    /**
     * Get interface info
     * @returns {object}
     */
    ifaceInfo : function()
    {
        if ( this._iface_info )
        {
            this._iface_info = new InterfaceInfo( this._raw_info );
        }
        
        return this._iface_info;
    },
    
    /**
     * Returns extended API interface as defined in [FTN10 Burst Calls][]
     * @returns {object}
     */
    burst : function()
    {
        throw new Error( futoin_error.InvokerError, "Not Implemented" );
    },

    /**
     * Results with DerivedKeyAccessor through as.success()
     */
    bindDerivedKey : function( as )
    {
        throw new Error( futoin_error.InvokerError, "Not Implemented" );
    }
};

exports.NativeIface = NativeIface;
