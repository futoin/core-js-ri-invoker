"use strict";

var common = require( './common' );
var FutoInError = common.FutoInError;
var optname = common.Options;

var simpleccm_impl = require( './simpleccm_impl' );

var fs = require( 'fs' );
var _ = require( 'lodash' );

exports = module.exports = function( options )
{
    return new module.exports.AdvancedCCMImpl( options );
};

/**
 * SpecTools
 * @class
 */
var spectools =
{
    standard_errors : {
        UnknownInterface : true,
        NotSupportedVersion : true,
        NotImplemented : true,
        Unauthorized : true,
        InternalError : true,
        InvalidRequest : true,
        DefenseRejected : true,
        PleaseReauth : true,
        SecurityError : true
    },

    loadSpec : function( as, info, specdirs )
    {
        var raw_spec = null;
        var fn = info.iface + '-' + info.version + '-iface.json';

        for ( var i = 0, v; i < specdirs.length; ++i )
        {
            v = specdirs[ i ];

            // If string - folder to parse
            if ( typeof v === 'string' )
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

            if ( ( typeof v === 'object' ) &&
                 ( v.iface === info.iface ) &&
                 ( v.version === info.version ) &&
                 ( 'funcs' in v ) )
            {
                raw_spec = v;
                break;
            }
        }

        if ( raw_spec === null )
        {
            as.error(
                FutoInError.InternalError,
                "Failed to load valid spec for " + info.iface + ":" + info.version
            );
        }

        info.funcs = _.cloneDeep( raw_spec.funcs );

        var finfo;
        var pn;

        for ( var f in info.funcs )
        {
            finfo = info.funcs[f];
            finfo.min_args = 0;

            if ( 'params' in finfo )
            {
                var fparams = finfo.params;

                if ( typeof fparams !== 'object' )
                {
                    as.error( FutoInError.InternalError, "Invalid params object" );
                }

                for ( pn in fparams )
                {
                    var pinfo = fparams[ pn ];

                    if ( typeof pinfo !== 'object' )
                    {
                        as.error( FutoInError.InternalError, "Invalid param object" );
                    }

                    if ( !( 'type' in pinfo ) )
                    {
                        as.error( FutoInError.InternalError, "Missing type for params" );
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

            finfo.expect_result = false;

            if ( 'result' in finfo )
            {
                var fresult = finfo.result;

                if ( typeof fresult !== 'object' )
                {
                    as.error( FutoInError.InternalError, "Invalid result object" );
                }

                for ( var rn in fresult )
                {
                    var rinfo = fresult[rn];

                    if ( typeof rinfo !== 'object' )
                    {
                        as.error( FutoInError.InternalError, "Invalid resultvar object" );
                    }

                    if ( !( 'type' in rinfo ) )
                    {
                        as.error( FutoInError.InternalError, "Missing type for result" );
                    }

                    finfo.expect_result = true;
                }
            }
            else
            {
                finfo.result = {};
            }

            if ( !( 'rawupload' in finfo ) )
            {
                finfo.rawupload = false;
            }

            if ( !( 'rawresult' in finfo ) )
            {
                finfo.rawresult = false;
            }

            if ( finfo.rawresult )
            {
                finfo.expect_result = true;
            }

            if ( 'throws' in finfo )
            {
                if ( !finfo.expect_result )
                {
                    as.error( FutoInError.InternalError, '"throws" without result' );
                }

                var throws = finfo.throws;

                if ( !Array.isArray( throws ) )
                {
                    as.error( FutoInError.InternalError, '"throws" is not array' );
                }

                finfo.throws = _.object( throws, throws );
            }
            else
            {
                finfo.throws = {};
            }
        }

        if ( 'requires' in raw_spec )
        {
            var requires = raw_spec.requires;

            if ( !Array.isArray( requires ) )
            {
                as.error( FutoInError.InternalError, '"requires" is not array' );
            }

            info.constraints = _.object( requires, requires );
        }
        else
        {
            info.constraints = {};
        }

        info.inherits = [];

        if ( !( 'inherit' in raw_spec ) )
        {
            return;
        }

        var sup_info = {};

        var m = raw_spec.inherit.match( common._ifacever_pattern );

        if ( m === null )
        {
            as.error( FutoInError.InvokerError, "Invalid inherit ifacever: " + raw_spec.inherit );
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

            var sup_params_keys = Object.keys( sup_params );
            var params_keys = Object.keys( params );

            if ( params_keys.length < sup_params_keys.length )
            {
                as.error( FutoInError.InternalError, "Invalid param count for '" + f + "'" );
            }

            // Verify parameters are correctly duplicated
            for ( i = 0; i < sup_params_keys.length; ++i )
            {
                pn = sup_params_keys[ i ];

                if ( pn !== params_keys[ i ] )
                {
                    as.error( FutoInError.InternalError, "Invalid param order for '" + f + "/" + pn + "'" );
                }

                if ( sup_params[pn].type !== params[pn].type )
                {
                    as.error( FutoInError.InternalError, "Param type mismatch '" + f + "/" + pn + "'" );
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
                    as.error( FutoInError.InternalError, "Missing default for '" + f + "/" + pn + "'" );
                }
            }

            if ( fdef.rawresult !== info.funcs[f].rawresult )
            {
                as.error( FutoInError.InternalError, "'rawresult' flag mismatch for '" + f + "'" );
            }

            if ( fdef.rawupload &&
                 !info.funcs[f].rawupload )
            {
                as.error( FutoInError.InternalError, "'rawupload' flag is missing for '" + f + "'" );
            }
        }

        info.inherits.push( raw_spec.inherit );
        info.inherits = info.inherits.concat( sup_info.inherits );

        if ( _.difference(
                Object.keys( sup_info.constraints ),
                raw_spec.requires ).length )
        {
            as.error( FutoInError.InternalError, "Missing constraints from inherited" );
        }
    },

    checkFutoInType : function( as, type, varname, val )
    {
        var rtype = '';

        switch ( type )
        {
            case 'boolean':
            case 'string':
                rtype = type;
                break;

            case 'map':
                rtype = 'object';
                break;

            case 'number':
                rtype = 'number';
                break;

            case 'integer':
                if ( typeof val !== "number" ||
                     ( ( val | 0 ) !== val ) )
                {
                    as.error( FutoInError.InvalidRequest, "Type mismatch for parameter: " + varname );
                }

                return;

            case 'array':
                if ( !( val instanceof Array ) )
                {
                    as.error( FutoInError.InvalidRequest, "Type mismatch for parameter: " + varname );
                }

                return;
        }

        if ( typeof val !== rtype )
        {
            as.error( FutoInError.InvalidRequest, "Type mismatch for parameter: " + varname );
        }
    }
};

exports.SpecTools = spectools;

/**
 * @ignore
 */
function AdvancedCCMImpl( options )
{
    options = options || {};

    // spec search dirs
    var spec_dirs = options[ optname.OPT_SPEC_DIRS ] || [];

    if ( !( spec_dirs instanceof Array ) )
    {
        spec_dirs = [ spec_dirs ];
    }

    options[ optname.OPT_SPEC_DIRS ] = spec_dirs;

    simpleccm_impl.SimpleCCMImpl.call( this, options );
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

        if ( ( 'SecureChannel' in info.constraints ) &&
             !info.secure_channel )
        {
            as.error( FutoInError.SecurityError, "Requires secure channel" );
        }

        if ( !( 'AllowAnonymous' in info.constraints ) &&
             !info.creds )
        {
            as.error( FutoInError.SecurityError, "Requires authenticated user" );
        }

        if ( !( name in info.funcs ) )
        {
            as.error( FutoInError.InvokerError, "Unknown interface function" );
        }

        var finfo = info.funcs[name];

        if ( ctx.upload_data &&
             !finfo.rawupload )
        {
            as.error( FutoInError.InvokerError, "Raw upload is not allowed" );
        }

        if ( !Object.keys( finfo.params ).length &&
             Object.keys( params ).length )
        {
            as.error( FutoInError.InvokerError, "No params are defined" );
        }

        // Check params
        for ( k in params )
        {
            if ( !finfo.params.hasOwnProperty( k ) )
            {
                as.error( FutoInError.InvokerError, "Unknown parameter " + k );
            }

            spectools.checkFutoInType( as, finfo.params[k].type, k, params[k] );
        }

        // Check missing params
        for ( k in finfo.params )
        {
             if ( !params.hasOwnProperty( k ) &&
                  !finfo.params[k].hasOwnProperty( "default" ) )
             {
                as.error( FutoInError.InvokerError, "Missing parameter " + k );
             }
        }
    },

    createMessage : function( as, ctx, params )
    {
        if ( !this.options[ optname.OPT_PROD_MODE ] )
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

        ctx.expect_response = info.funcs[ ctx.name ].expect_result;
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
                 ( e in spectools.standard_errors ) )
            {
                as.error( e, rsp.edesc );
            }
            else
            {
                as.error( FutoInError.InternalError, "Not expected exception from Executor" );
            }
        }

        // Check raw result
        if ( func_info.rawresult )
        {
            as.error( FutoInError.InternalError, "Raw result is expected" );
        }

        // Check signature
        if ( info.creds === 'master' )
        {
            // TODO: check signature
        }

        // check result variables
        var resvars = func_info.result;
        var rescount = Object.keys( resvars ).length;

        // NOTE: by forward compatibility and inheritance requirements, unknown result variables are allowed
        for ( var k in rsp.r )
        {
            if ( resvars.hasOwnProperty( k ) )
            {
                spectools.checkFutoInType( as, resvars[k].type, k, rsp.r[k] );
                --rescount;
            }
        }

        if ( rescount > 0 )
        {
            as.error( FutoInError.InternalError, "Missing result variables" );
        }

        // Success
        as.success( rsp.r );
    },

    onDataResponse : function( as, ctx, rsp )
    {
        if ( ctx.info.funcs[ctx.name].rawresult )
        {
            as.success( rsp );
        }
        else
        {
            as.error( FutoInError.InternalError, "Raw result is not expected" );
        }
    },

    perfomHTTP : simpleccm_impl.SimpleCCMImpl.prototype.perfomHTTP,

    perfomWebSocket : simpleccm_impl.SimpleCCMImpl.prototype.perfomWebSocket,

    perfomUNIX : simpleccm_impl.SimpleCCMImpl.prototype.perfomUNIX
};

exports.AdvancedCCMImpl = AdvancedCCMImpl;
