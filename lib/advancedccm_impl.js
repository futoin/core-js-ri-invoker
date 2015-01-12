"use strict";

var spectools = require( './spectools' );

var common = require( './common' );
var FutoInError = common.FutoInError;
var optname = common.Options;

var simpleccm_impl = require( './simpleccm_impl' );

exports = module.exports = function( options )
{
    return new module.exports.AdvancedCCMImpl( options );
};

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
        spectools.loadIface( as, info, info.options[ optname.OPT_SPEC_DIRS ] );

        if ( !info.options[ optname.OPT_PROD_MODE ] )
        {
            spectools.checkConsistency( as, info );
        }
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

            spectools.checkParameterType( as, info, name, k, params[k] );
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
        if ( !ctx.info.options[ optname.OPT_PROD_MODE ] )
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
        var name = ctx.name;
        var func_info = info.funcs[ name ];

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
                spectools.checkResultType( as, info, name, k, rsp.r[k] );
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

    performCommon : simpleccm_impl.SimpleCCMImpl.prototype.performCommon,
    perfomHTTP : simpleccm_impl.SimpleCCMImpl.prototype.perfomHTTP,
    perfomWebSocket : simpleccm_impl.SimpleCCMImpl.prototype.perfomWebSocket,
    perfomUNIX : simpleccm_impl.SimpleCCMImpl.prototype.perfomUNIX,
    perfomBrowser : simpleccm_impl.SimpleCCMImpl.prototype.perfomBrowser
};

exports.AdvancedCCMImpl = AdvancedCCMImpl;
