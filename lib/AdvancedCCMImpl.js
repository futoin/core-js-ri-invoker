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

const common = require( './common' );
const { InvokerError, InvalidRequest, SecurityError, InternalError } = common.FutoInError;
const SimpleCCMImpl = require( './SimpleCCMImpl' );
const SpecTools = require( '../SpecTools' );
const MessageCoder = require( '../MessageCoder' );
const _defaults = require( 'lodash/defaults' );
const MasterAuth = require( '../MasterAuth' );

/**
 * This is a pseudo-class for documentation purposes
 *
 * NOTE: Each option can be set on global level and overriden per interface.
 * @class
 * @augments SimpleCCMOptions
 */
const AdvancedCCMOptions =
{
    /**
     * Search dirs for spec definition or spec instance directly. It can
     * be single value or array of values. Each value is either path/URL (string) or
     * iface spec instance (object).
     * @default
     */
    specDirs : [],

    /**
     * Base64 encoded key for MAC generation. See FTN8
     */
    macKey : null,

    /**
     * Hash algorithm for HMAC generation:
     * HMD5, HS256 (default), HS384, HS512
     */
    macAlgo : 'HS256',

    /**
     * Base64 encoded key for **legacy** HMAC generation. See FTN6/FTN7
     * @deprecated
     */
    hmacKey : null,

    /**
     * Hash algorithm for **legacy** HMAC generation:
     * MD5(default), SHA224, SHA256, SHA384, SHA512
     * @deprecated
     */
    hmacAlgo : 'MD5',

    /**
     * Send "obf" (On Behalf Of) user information as defined in FTN3 v1.3
     * when invoked from Executor's request processing task
     * @default
     */
    sendOnBehalfOf : true,

    /**
     * Instance implementing MasterAuth interface
     */
    masterAuth: null,
};

/**
 * @private
 * @constructor
 * @param {object} [options] CCM options
 * @see AdvancedCCMOptions
 */
class AdvancedCCMImpl extends SimpleCCMImpl {
    constructor( options ) {
        options = options || {};
        _defaults( options, AdvancedCCMOptions );

        // spec search dirs
        let spec_dirs = options.specDirs || [];

        if ( !( spec_dirs instanceof Array ) ) {
            spec_dirs = [ spec_dirs ];
        }

        options.specDirs = spec_dirs;

        super( options );

        this._load_cache = {};
    }

    onRegister( as, info ) {
        if ( ( info.creds_master || info.creds_mac ) &&
            !SpecTools.checkHMAC ) {
            as.error( InvokerError,
                "Master/HMAC is not supported in this environment yet" );
        }

        const { options } = info;
        const { masterAuth } = options;

        if ( masterAuth && !( masterAuth instanceof MasterAuth ) ) {
            as.error( InvokerError,
                'options.masterAuth is not instance of MasterAuth' );
        }

        SpecTools.loadIface( as, info, options.specDirs, this._load_cache );

        as.add( ( as ) => {
            info.coder = MessageCoder.get(
                options.coder ||
                ( ( 'BinaryData' in info.constraints ) && options.binaryCoder ) ||
                options.defaultCoder
            );
        } );
    }

    checkParams( as, ctx, params ) {
        const info = ctx.info;
        const name = ctx.name;

        if ( !( name in info.funcs ) ) {
            as.error( InvokerError,
                `Unknown interface function: ${name}()` );
        }

        const finfo = info.funcs[ name ];

        ctx.max_rsp_size = finfo._max_rsp_size;
        ctx.max_req_size = finfo._max_req_size;

        if ( ctx.upload_data && !finfo.rawupload ) {
            as.error( InvokerError,
                `Raw upload is not allowed: ${name}()` );
        }

        if ( !Object.keys( finfo.params ).length &&
             Object.keys( params ).length ) {
            as.error( InvokerError,
                `No params are defined: ${name}()` );
        }

        // Check params
        for ( let k in params ) {
            if ( !finfo.params.hasOwnProperty( k ) ) {
                as.error( InvokerError,
                    `Unknown parameter: ${name}(${k})` );
            }

            if ( !SpecTools.checkParameterType( info, name, k, params[ k ] ) ) {
                as.error( InvalidRequest,
                    `Type mismatch for parameter: ${name}(${k}) = ${params[ k ]}` );
            }
        }

        // Check missing params
        for ( let k in finfo.params ) {
            if ( !params.hasOwnProperty( k ) &&
                 ( finfo.params[ k ].default === undefined )
            ) {
                as.error( InvokerError,
                    `Missing parameter: ${name}(${k})` );
            }
        }
    }

    createMessage( as, ctx, params ) {
        const info = ctx.info;
        const options = info.options;

        if ( !options.prodMode ) {
            this.checkParams( as, ctx, params );
        }

        // ---
        var req =
        {
            f : `${info.iface}:${info.version}:${ctx.name}`,
            p : params,
        };

        // ---
        if ( options.sendOnBehalfOf ) {
            const reqinfo = as.state.reqinfo;

            if ( reqinfo ) {
                const reqinfo_info = reqinfo.info;
                const user_info = reqinfo_info.USER_INFO;

                if ( user_info ) {
                    req.obf = {
                        lid : user_info.localID(),
                        gid : user_info.globalID(),
                        slvl : reqinfo_info.SECURITY_LEVEL,
                    };
                } else {
                    req.obf = { slvl : 'Anonymous' };
                }
            }
        }

        // ---
        ctx.expect_response = info.funcs[ ctx.name ].expect_result;

        // ---
        if ( info.creds !== null ) {
            if ( info.creds_master ) {
                ctx.signMessage = ( req ) => options.masterAuth.signMessage( ctx, req );
            } else if ( info.creds_mac ) {
                ctx.signMessage = ( req ) => {
                    req.sec = info.creds + ':' + options.macAlgo + ':' +
                            SpecTools.genHMAC( as, options, req ).toString( 'base64' );
                };
            } else {
                req.sec = info.creds;
            }
        }

        // ---
        as.success( req );
    }

    onMessageResponse( as, ctx, rsp ) {
        const { info, name } = ctx;
        const func_info = info.funcs[ name ];

        // Check signature
        const { creds_master } = info;
        const { e } = rsp;

        if ( creds_master || info.creds_mac ) {
            let { sec } = rsp;

            if ( !sec ) {
                if ( e && ( e in SpecTools.standard_errors ) ) {
                    as.error( e, rsp.edesc );
                }

                as.error( SecurityError,
                    `Missing response MAC: ${name}()` );
            }

            try {
                sec = Buffer.from( sec, 'base64' );
            } catch ( _ ) {
                as.error( SecurityError,
                    `Invalid response MAC format: ${name}()` );
            }

            const { options } = ctx;
            const required_sec = creds_master
                ? options.masterAuth.genMAC( ctx, rsp )
                : SpecTools.genHMAC( as, options, rsp );

            if ( !SpecTools.checkHMAC( sec, required_sec ) ) {
                as.error( SecurityError,
                    `Response MAC mismatch: ${name}()` );
            }
        }

        // Check for exception
        if ( e ) {
            if ( ( e in func_info.throws ) ||
                 ( e in SpecTools.standard_errors )
            ) {
                as.error( e, rsp.edesc );
            } else {
                as.error( InternalError,
                    `Not expected exception from Executor: ${name}()` );
            }
        }

        // Check raw result
        if ( func_info.rawresult ) {
            as.error( InternalError,
                `Raw result is expected: ${name}()` );
        }

        // check result variables
        const resvars = func_info.result;
        const result = rsp.r;

        if ( typeof resvars === 'string' ) {
            // New feature since FTN3 1.7
            if ( !SpecTools.checkType( info, resvars, result ) ) {
                as.error( InternalError,
                    `Result type mismatch: ${name}()` );
            }
        } else {
            let rescount = Object.keys( resvars ).length;

            // NOTE: by forward compatibility and inheritance requirements,
            //       unknown result variables are allowed
            for ( var k in result ) {
                if ( resvars.hasOwnProperty( k ) ) {
                    SpecTools.checkResultType( as, info, name, k, result[ k ] );
                    --rescount;
                }
            }

            if ( rescount > 0 ) {
                as.error( InternalError,
                    `Missing result variables: ${name}()` );
            }
        }

        // Success
        as.success( result );
    }

    onDataResponse( as, ctx, rsp ) {
        if ( ctx.info.funcs[ ctx.name ].rawresult ) {
            as.success( rsp );
        } else {
            as.error( InternalError,
                `Raw result is not expected: ${ctx.name}()` );
        }
    }
}

module.exports = AdvancedCCMImpl;
