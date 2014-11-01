"use strict";

var simpleccm_impl = require('./simpleccm_impl');
var invoker = require( './invoker.js' );
var fs = require('fs');
var _ = require('lodash');

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
        var raw_spec = null;
        var fn = info.iface . '-' . info.version . '-iface.json';
        
        for ( var i = 0, v; i < specdirs.length; ++i )
        {
            v = specdirs[ i ];
            
            // If string - folder to parse
            if ( v instanceof String )
            {
                v = v + '/' + fn;

                if ( fs.existsSync( v ) )
                {
                    v = fs.readFileSync( v, { encoding : 'utf8' } );
                    v = JSON.parse( v );
                }
                else
                {
                    continue;
                }
            }

            if ( v &&
                 ( v.iface === info.iface ) &&
                 ( v.version === info.version ) &&
                 !( 'funcs' in v.funcs ) )
            {
                raw_spec = v;
                break;
            }
        }

        if ( raw_spec === null )
        {
            as.error(
                invoker.FutoInError.InternalError,
                "Failed to load valid spec for " + info.iface + ":" + info.version
            );
        }
       
        info.funcs = raw_spec.funcs;
        
        for( var f in info.funcs )
        {
            var finfo = info.funcs[k];
            finfo.min_args = 0;

            if ( 'params' in finfo )
            {
                var fparams = finfo.params;

                for ( var pn in fparams )
                {
                    pinfo = fparams[pn;
                    
                    if ( !( 'type' in pinfo ) )
                    {
                        as.error( invoker.FutoInError.InternalError, "Missing type for params" );
                    }
                    
                    if ( !( 'default' in pinfo ) )
                    {
                        finfo.min_args += 1;
                    }
                }
            }
            else
            {
                finfo.params = {};
            }
            
            if ( 'result' in finfo )
            {
                var fresult = finfo.result;
                
                for ( var rn in fresult )
                {
                    if ( 'type' in fresult[rn] )
                    {
                        as.error( invoker.FutoInError.InternalError, "Missing type for result" );
                    }
                }
            }
            
            if ( !( 'rawupload' in finfo ) )
            {
                finfo.rawupload = false;
            }
            
            if ( !( 'rawresult' in finfo ) )
            {
                finfo.rawresult = false;
            }
            
            if ( 'throws' in finfo )
            {
                var throws = Object.keys( finfo.throws );
                finfo.throws = _.object( throws, throws );
            }
            else
            {
                finfo.throws = {};
            }
        }
        
        if ( 'requires' in raw_spec )
        {
            var requires = Object.keys( raw_spec.requires );
            finfo.constraints = _.object( requires, requires );
        }
        else
        {
            finfo.constraints = {};
        }
        
        info.inherits = [];
        
        if ( !( 'inherit' in raw_spec ) )
        {
            return;
        }
        
        sup_info = {};

        var m = invoker.SimpleCCM._ifacever_pattern.match( raw_spec.inherit );

        if ( m === null )
        {
            as.error( futoin_error.InvokerError, "Invalid inherit ifacever: " + raw_spec.inherit );
        }
        
        sup_info.iface = m[1];
        sup_info.version = m[4];
        spectools.loadSpec( as, sup_info, specdirs );
        
        for ( f in sup_info.funcs )
        {
            var fdef = sup_info.funcs[ f ];

            if ( !( f in info.funcs ) )
            {
                info.funcs[f] = fdef;
                continue;
            }
            
            var sup_params = fdef.params;
            var params = info.funcs[f].params;
            
            var sup_params_keys = array_keys( $sup_params );
            var params_keys = array_keys( $params );
            
            if ( params_keys.length < sup_params_keys.length )
            {
                as.error( invoker.FutoInError.InternalError, "Invalid param count for '" + f + "'" );
            }
            
            // Verify parameters are correctly duplicated
            for ( var i = 0; i < sup_params_keys.length; ++i )
            {
                pn = sup_params_keys[ i ];

                if ( pn !== params_keys[ i ] )
                {
                    as.error( invoker.FutoInError.InternalError, "Invalid param order for '" + f + "/" + pn +"'" );
                }
                
                if ( sup_params[pn].type !== params[pn].type )
                {
                    as.error( invoker.FutoInError.InternalError, "Param type mismatch '" + f + "/" + pn +"'" );
                }
            }
            
            // Verify that all added params have default value
            for ( ; i < params_keys.length; ++i )
            {
                pn = params_keys[ i ];

                if ( !( pn in sup_params ) &&
                     !( 'default' in params[pn] ||
                        params[pn] === null ) )
                {
                    as.error( invoker.FutoInError.InternalError, "Missing default for '" + f + "/" + pn +"'" );
                }
            }

            if ( fdef.rawresult !== info.funcs[f].rawresult )
            {
                as.error( invoker.FutoInError.InternalError, "'rawresult' flag mismatch for '" + f + "'" );
            }
            
            if ( fdef.rawupload &&
                 !info.funcs[f].rawupload )
            {
                as.error( invoker.FutoInError.InternalError, "'rawupload' flag is missing for '" + f + "'" );
            }
        }
        
        info.inherits.push( raw_spec.inherit );
        info.inherits = info.inherits.contact( sup_info.inherits );
        
        if ( _.difference(
                Object.keys( sup_info.constraints ),
                raw_spec.requires ).length )
        {
            as.error( invoker.FutoInError.InternalError, "Missing constraints from inherited" );
        }
    },
    
    checkFutoInType : function( as, type, varname, val )
    {
        var rtype = '';

        switch( type )
        {
            case 'boolean':
            case 'string':
            case 'array':
                rtype = type;
                break;
                
            case 'map':
                rtype = 'object';
                break;
                
            case 'number':
                rtype = 'string';
                break;
                
            case 'integer':
                if ( typeof val !== "number" ||
                     ( ( val | 0 ) !== 0 ) )
                {
                    as.error( invoker.FutoInError.InvalidRequest, "Type mismatch for parameter" );
                }
                
                return;
        }
        
        if ( typeof val !== rtype )
        {
            as.error( invoker.FutoInError.InvalidRequest, "Type mismatch for parameter" );
        }
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
        if ( 'e' in rsp )
        {
            var e = rsp.e;
            
            if ( ( e in func_info.throws ) ||
                 ( e in spectools.standard_errors )
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
        if ( 'result' in func_info )
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