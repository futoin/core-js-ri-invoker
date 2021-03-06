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
const { InvokerError, SecurityError, InternalError } = common.FutoInError;
const SimpleCCMImpl = require( './SimpleCCMImpl' );
const SpecTools = require( '../SpecTools' );
const MessageCoder = require( '../MessageCoder' );
const _defaults = require( 'lodash/defaults' );
const MasterAuth = require( '../MasterAuth' );

const {
    STANDARD_ERRORS,
    checkRequestMessage,
    checkResponseMessage,
    genHMAC,
    globalLoadCache,
} = SpecTools;

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

Object.freeze( AdvancedCCMOptions );

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
    }

    onRegister( as, info ) {
        if ( ( info.creds_master || info.creds_mac ) &&
            !SpecTools.checkHMAC ) {
            as.error( InvokerError,
                "Master/HMAC is not supported in this environment yet" );
        }

        const { options, creds } = info;
        const { masterAuth, macAlgo } = options;

        if ( masterAuth && !( masterAuth instanceof MasterAuth ) ) {
            as.error( InvokerError,
                'options.masterAuth is not instance of MasterAuth' );
        }

        SpecTools.loadIface( as, info, options.specDirs, globalLoadCache() );

        as.add( ( as ) => {
            info.coder = MessageCoder.get(
                options.coder ||
                ( ( 'BinaryData' in info.constraints ) && options.binaryCoder ) ||
                options.defaultCoder
            );
        } );


        // ---
        const on_behalf_of = ( options.sendOnBehalfOf )
            ? ( as, req ) => {
                const { reqinfo } = as.state;

                if ( reqinfo && !req.obf ) {
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
            : () => {};

        // ---
        if ( creds !== null ) {
            info.signMessage = ( () => {
                if ( info.creds_master ) {
                    return ( as, ctx, req ) => {
                        on_behalf_of( as, req );
                        masterAuth.signMessage( ctx, req );
                    };
                } else if ( info.creds_mac ) {
                    return ( as, _ctx, req ) => {
                        on_behalf_of( as, req );
                        const hmac = genHMAC( as, options, req ).toString( 'base64' );
                        req.sec = `${creds}:${macAlgo}:${hmac}`;
                    };
                } else {
                    return ( as, _ctx, req ) => {
                        on_behalf_of( as, req );
                        req.sec = creds;
                    };
                }
            } )();

            const gen_rsp_mac = ( () => {
                if ( info.creds_master ) {
                    return ( as, ctx, rsp ) => masterAuth.genMAC( ctx, rsp );
                } else if ( info.creds_mac ) {
                    return ( as, _ctx, rsp ) => genHMAC( as, options, rsp );
                } else {
                    return null;
                }
            } )();

            info.verifyResponse = gen_rsp_mac
                ? ( ( as, ctx, rsp ) => {
                    let { sec } = rsp;

                    if ( !sec ) {
                        const { e } = rsp;

                        if ( e && ( e in STANDARD_ERRORS ) ) {
                            as.error( e, rsp.edesc );
                        }

                        as.error( SecurityError,
                            `Missing response MAC: ${ctx.name}()` );
                    }

                    try {
                        sec = Buffer.from( sec, 'base64' );
                    } catch ( _ ) {
                        as.error( SecurityError,
                            `Invalid response MAC format: ${ctx.name}()` );
                    }

                    const required_sec = gen_rsp_mac( as, ctx, rsp );

                    if ( !SpecTools.checkHMAC( sec, required_sec ) ) {
                        as.error( SecurityError,
                            `Response MAC mismatch: ${ctx.name}()` );
                    }
                } )
                : () => {};
        } else {
            info.signMessage = on_behalf_of;
            info.verifyResponse = () => {};
        }
    }

    createMessage( as, ctx, params ) {
        const { info, name } = ctx;
        const options = info.options;

        // ---
        const req =
        {
            f : `${info.iface}:${info.version}:${name}`,
            p : params,
        };

        // ---
        if ( !options.prodMode ) {
            checkRequestMessage( as, info, name, req );
        }

        // ---
        const finfo = info.funcs[ name ];
        ctx.max_rsp_size = finfo._max_rsp_size;
        ctx.max_req_size = finfo._max_req_size;
        ctx.expect_response = finfo.expect_result;

        // ---
        if ( ctx.upload_data && !finfo.rawupload ) {
            as.error( InvokerError,
                `Raw upload is not allowed: ${name}()` );
        }


        // ---
        return req;
    }

    onMessageResponse( as, ctx, rsp ) {
        const { info, name } = ctx;

        // Check signature
        info.verifyResponse( as, ctx, rsp );

        // Verify response message
        checkResponseMessage( as, info, name, rsp );

        // Success
        as.success( rsp.r );
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
