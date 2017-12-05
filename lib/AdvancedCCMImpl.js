"use strict";

/**
 * @file
 *
 * Copyright 2014-2017 FutoIn Project (https://futoin.org)
 * Copyright 2014-2017 Andrey Galkin <andrey@futoin.org>
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

var common = require( './common' );
var FutoInError = common.FutoInError;
var SimpleCCMImpl = require( './SimpleCCMImpl' );
var SpecTools = require( '../SpecTools' );
var _defaults = require( 'lodash/defaults' );

/**
 * This is a pseudo-class for documentation purposes
 *
 * NOTE: Each option can be set on global level and overriden per interface.
 * @class
 * @augments SimpleCCMOptions
 */
var AdvancedCCMOptions =
{
    /**
     * Search dirs for spec definition or spec instance directly. It can
     * be single value or array of values. Each value is either path/URL (string) or
     * iface spec instance (object).
     * @default
     */
    specDirs : [],

    /**
     * Base64 encoded key for HMAC generation. See FTN6/FTN7
     */
    hmacKey : null,

    /**
     * Hash algorithm for HMAC generation:
     * MD5(default), SHA224, SHA256, SHA384, SHA256
     * @default
     */
    hmacAlgo : 'MD5',

    /**
     * Send "obf" (On Behalf Of) user information as defined in FTN3 v1.3
     * when invoked from Executor's request processing task
     * @default
     */
    sendOnBehalfOf : true,
};

/**
 * @private
 * @constructor
 * @param {object} [options] CCM options
 * @see AdvancedCCMOptions
 */
function AdvancedCCMImpl( options )
{
    options = options || {};
    _defaults( options, AdvancedCCMOptions );

    // spec search dirs
    var spec_dirs = options.specDirs || [];

    if ( !( spec_dirs instanceof Array ) )
    {
        spec_dirs = [ spec_dirs ];
    }

    options.specDirs = spec_dirs;

    SimpleCCMImpl.call( this, options );

    this._load_cache = {};
}

// "Monkey inheritance"
var SCCMImpProto = SimpleCCMImpl.prototype;

AdvancedCCMImpl.prototype =
{
    onRegister : function( as, info )
    {
        if ( ( info.creds_master || info.creds_hmac ) &&
            !SpecTools.checkHMAC )
        {
            as.error( FutoInError.InvokerError, "Master/HMAC is not supported in this environment yet" );
        }

        SpecTools.loadIface( as, info, info.options.specDirs, this._load_cache );

        if ( !info.options.prodMode )
        {
            SpecTools.checkConsistency( as, info );
        }
    },

    checkParams : function( as, ctx, params )
    {
        var info = ctx.info;
        var name = ctx.name;
        var k;

        if ( !( name in info.funcs ) )
        {
            as.error( FutoInError.InvokerError, "Unknown interface function: " + name );
        }

        var finfo = info.funcs[ name ];

        ctx.max_rsp_size = finfo._max_rsp_size;
        ctx.max_req_size = finfo._max_req_size;

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
                as.error( FutoInError.InvokerError, "Unknown parameter: " + k );
            }

            if ( !SpecTools.checkParameterType( info, name, k, params[ k ] ) )
            {
                as.error( FutoInError.InvalidRequest,
                    "Type mismatch for parameter: " + k +
                          " (" + params[ k ] + ")" );
            }
        }

        // Check missing params
        for ( k in finfo.params )
        {
            if ( !params.hasOwnProperty( k ) &&
                  !finfo.params[ k ].hasOwnProperty( "default" ) )
            {
                as.error( FutoInError.InvokerError, "Missing parameter " + k );
            }
        }
    },

    createMessage : function( as, ctx, params )
    {
        var info = ctx.info;
        var options = info.options;

        if ( !options.prodMode )
        {
            this.checkParams( as, ctx, params );
        }

        // ---
        var req =
        {
            f : info.iface + ':' + info.version + ':' + ctx.name,
            p : params,
        };

        // ---
        if ( options.sendOnBehalfOf )
        {
            var reqinfo = as.state.reqinfo;

            if ( reqinfo )
            {
                var reqinfo_info = reqinfo.info;
                var user_info = reqinfo_info.USER_INFO;

                if ( user_info )
                {
                    req.obf = {
                        lid : user_info.localID(),
                        gid : user_info.globalID(),
                        slvl : reqinfo_info.SECURITY_LEVEL,
                    };
                }
                else
                {
                    req.obf = { slvl : 'Anonymous' };
                }
            }
        }

        // ---
        ctx.expect_response = info.funcs[ ctx.name ].expect_result;

        // ---
        if ( info.creds !== null )
        {
            if ( info.creds_master )
            {
                as.error( FutoInError.InvokerError, 'MasterService support is not implemented' );

                ctx.signMessage = function( req )
                {
                    void req;
                    // TODO: Add HMAC signature from Master service
                };
            }
            else if ( info.creds_hmac )
            {
                ctx.signMessage = function( req )
                {
                    req.sec = info.creds + ':' + options.hmacAlgo + ':' +
                            SpecTools.genHMAC( as, info.options, req ).toString( 'base64' );
                };
            }
            else
            {
                req.sec = info.creds;
            }
        }

        // ---
        as.success( req );
    },

    onMessageResponse : function( as, ctx, rsp )
    {
        var info = ctx.info;
        var name = ctx.name;
        var func_info = info.funcs[ name ];

        // Check signature
        if ( info.creds_master )
        {
            as.error( FutoInError.InvokerError, 'MasterService support is not implemented' );
            // TODO: check signature
        }
        else if ( info.creds_hmac )
        {
            var rsp_sec;

            try
            {
                rsp_sec = new Buffer( rsp.sec, 'base64' );
            }
            catch ( e )
            {
                as.error( FutoInError.SecurityError, "Missing response HMAC" );
            }

            delete rsp.sec;
            var required_sec = SpecTools.genHMAC( as, info.options, rsp );

            if ( !SpecTools.checkHMAC( rsp_sec, required_sec ) )
            {
                as.error( FutoInError.SecurityError, "Response HMAC mismatch" );
            }
        }

        // Check for exception
        if ( 'e' in rsp )
        {
            var e = rsp.e;

            if ( ( e in func_info.throws ) ||
                 ( e in SpecTools.standard_errors ) )
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

        if ( info.creds === 'master' )
        {
            // TODO: check signature
        }

        // check result variables
        var resvars = func_info.result;
        var result = rsp.r;

        if ( typeof resvars === 'string' )
        {
            // New feature since FTN3 1.7
            if ( !SpecTools.checkType( info, resvars, result ) )
            {
                as.error( FutoInError.InternalError, "Result type mismatch" );
            }
        }
        else
        {
            var rescount = Object.keys( resvars ).length;

            // NOTE: by forward compatibility and inheritance requirements, unknown result variables are allowed
            for ( var k in result )
            {
                if ( resvars.hasOwnProperty( k ) )
                {
                    SpecTools.checkResultType( as, info, name, k, result[ k ] );
                    --rescount;
                }
            }

            if ( rescount > 0 )
            {
                as.error( FutoInError.InternalError, "Missing result variables" );
            }
        }

        // Success
        as.success( result );
    },

    onDataResponse : function( as, ctx, rsp )
    {
        if ( ctx.info.funcs[ ctx.name ].rawresult )
        {
            as.success( rsp );
        }
        else
        {
            as.error( FutoInError.InternalError, "Raw result is not expected" );
        }
    },

    getComms : SCCMImpProto.getComms,
    performCommon : SCCMImpProto.performCommon,
    perfomHTTP : SCCMImpProto.perfomHTTP,
    perfomWebSocket : SCCMImpProto.perfomWebSocket,
    perfomUNIX : SCCMImpProto.perfomUNIX,
    perfomBrowser : SCCMImpProto.perfomBrowser,
};

module.exports = AdvancedCCMImpl;
