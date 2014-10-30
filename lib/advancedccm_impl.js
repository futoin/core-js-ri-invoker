"use strict";

var simpleccm_impl = require('./simpleccm_impl');
var invoker = require( './invoker.js' );

exports = module.exports = function()
{
    return new module.exports.AdvancedCCMImpl();
}

/**
 * SpecTools
 * @class
 */
var spectools =
{
    loadSpec : function( as, info, specdirs )
    {
    },
    
    checkFutoInType : function( as, type, varname, val )
    {
    }
}

exports.SpecTools = spectools;

/**
 * @ignore
 */
function AdvancedCCMImpl( options )
{
    var optname = invoker.AdvancedCCM;
    
    // spec search dirs
    var spec_dirs = options[ optname.OPT_SPEC_DIRS ] || [];
    
    if ( !( spec_dirs instanceof Array ) )
    {
        spec_dirs = [ spec_dirs ];
    }

    options[ optname.OPT_SPEC_DIRS ] = spec_dirs;
    
    simpleccm_impl.SimpleCCMImpl.apply( this, options );
}

AdvancedCCMImpl.prototype =
{
    onRegister : function( as, info )
    {
        spectools.loadSpec( as, info, this.options[ optname.OPT_SPEC_DIRS ] );
    },
    
    checkParams : function( as, ctx, params )
    {
        var info = ctx.info;
        var name = ctx.name;
        var k;
        
        if ( ( info.constraints['SecureChannel'] !== undefined ) &&
             !info.secure_channel )
        {
            as.error( invoker.FutoInError.SecurityError, "Requires secure channel" );
        }
        
        if ( ( info.constraints['AllowAnonymous'] === undefined ) &&
             !info.creds )
        {
            as.error( invoker.FutoInError.SecurityError, "Requires authenticated user" );
        }
        
        if ( !isset( info.funcs[name] ) )
        {
            as.error( invoker.FutoInError.InvokerError, "Unknown interface function" );
        }
        
        f = info.funcs[name];
        
        if ( ctx.upload_data &&
             !f.rawupload )
        {
            as.error( invoker.FutoInError.InvokerError, "Raw upload is not allowed" );
        }
        
        if ( empty( f.params ) &&
             Object.keys( params ).length )
        {
            as.error( invoker.FutoInError.InvokerError, "No params are defined" );
        }
        
        // Check params
        for ( k in params )
        {
            if ( !f.params.hasOwnProperty( k ) )
            {
                as.error( invoker.FutoInError.InvokerError, "Unknown parameter " + k );
            }
            
            SpecTools::checkFutoInType( $as, $f->params[$k]->type, $k, $v );
        }
        
        // Check missing params
        for ( k in f.params )
        {
             if ( !params.hasOwnProperty( k ) &&
                  !f.params[k].hasOwnProperty( "default" ) )
             {
                as.error( invoker.FutoInError.InvokerError, "Missing parameter " + k );
             }
        }
    },
    
    createMessage : function( as, ctx, params )
    {
        if ( ! this.options[ optname.OPT_PROD_MODE ] )
        {
            this.checkParams( as, ctx, params );
        }
        
        var info = ctx.info;
        var req =
        {
            f : info.iface + ':' + info.version + ':' + ctx.name,
            p : params
        };
        
        if ( info.creds !== null )
        {
            if ( info.creds === 'master' )
            {
                // TODO: Add signature
            }
            else
            {
                req.sec = info.creds;
            }
        }
        
        as.success( req );
    },
    
    onMessageResponse : function( as, ctx, rsp )
    {
        var info = ctx.info;
        var func_info = info.funcs[ ctx.name ];
        
        // Check for exception
        if ( rsp.e !== undefined )
        {
            var e = rsp.e;
            
            if ( ( func_info.throws[e] !== undefined ) ||
                 ( spectools.standard_errors[ e ] !== undefined ) )
            {
                as.error( e, "Executor-generated error" );
            }
            else
            {
                as.error( invoker.FutoInError.InternalError, "Not expected exception from Executor" );
            }
        }
        
        // Check raw result
        if ( func_info.rawresult )
        {
            as.error( invoker.FutoInError.InternalError, "Raw result is expected" );
        }
    
        // Check signature
        if ( info.creds === 'master' )
        {
            // TODO: check signature
        }
        
        // check result variables
        if ( func_info.result !== undefined )
        {
            var resvars = func_info.result;
            var rescount = Object.keys( resvars ).length;
            
            // NOTE: by forward compatibility and inheritance requirements, unknown result variables are allowed
            for( var k in rsp.r )
            {
                if ( resvars.hasOwnProperty( k ) )
                {
                    SpecTools::checkFutoInType( as, resvars[k].type, k, rsp.r[k] );
                    --rescount;
                }
            }
            
            if ( rescount > 0 )
            {
                as.error( invoker.FutoInError.InternalError, "Missing result variables" );
            }
        
            // Success
            as.success( rsp.r );
        }
        else
        {
            as.success();
        }
    },
    
    onDataResponse : function( as, ctx, rsp )
    {
        if ( ctx.info.funcs[ctx.name].rawresult )
        {
            as.success( rsp );
        }
        else
        {
            throw new Error( invoker.FutoInError.InternalError, "Raw result is not expected" );
        }
    }
};

AdvancedCCMImpl.prototype.prototype = simpleccm_impl.SimpleCCMImpl;
exports.AdvancedCCMImpl = AdvancedCCMImpl;