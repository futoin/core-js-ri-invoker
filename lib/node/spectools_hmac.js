'use strict';

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

const common = require( '../common' );
const FutoInError = common.FutoInError;
const crypto = require( 'crypto' );

const SYM_KEY_RAW = Symbol( 'MAC_KEY_RAW' );
const SYM_ALGO_RAW = Symbol( 'MAC_ALGO_RAW' );

module.exports = function( spectools ) {
    spectools.genHMAC = function( as, options, ftnreq ) {
        let hmacKeyRaw = options[ SYM_KEY_RAW ];
        let hmacAlgoRaw = options[ SYM_ALGO_RAW ];

        // --
        if ( !hmacKeyRaw ) {
            hmacKeyRaw = Buffer.from( options.macKey, 'base64' );
            options[ SYM_KEY_RAW ] = hmacKeyRaw;
        }

        // --
        if ( !hmacAlgoRaw ) {
            hmacAlgoRaw = this.getRawAlgo( as, options.macAlgo );
            options[ SYM_ALGO_RAW ] = hmacAlgoRaw;
        }

        return this.genHMACRaw( hmacAlgoRaw, hmacKeyRaw, ftnreq );
    };

    spectools.getRawAlgo = function( as, algo ) {
        switch ( algo ) {
        // Legacy modes
        case 'MD5':
        case 'SHA224':
        case 'SHA256':
        case 'SHA384':
        case 'SHA512':
            return algo.toLowerCase();

        // FTN8 modes
        case 'HMD5': return 'md5';
        case 'HS256': return 'sha256';
        case 'HS384': return 'sha384';
        case 'HS512': return 'sha512';

        default:
            as.error( FutoInError.InvalidRequest,
                `Not supported MAC algo: ${algo}` );
        }
    };

    // Gen HMAC through .update()
    // ----
    spectools._genHMACU = function( hmacAlgoRaw, hmacKeyRaw, ftnreq ) {
        // this.hmacbase = '';
        const hmac = crypto.createHmac( hmacAlgoRaw, hmacKeyRaw );

        this._hmacUpdate( hmac, ftnreq );
        return hmac.digest();
    };

    spectools._hmacUpdate = function( hmac, o ) {
        const keys = Object.keys( o ).sort();

        for ( let i = 0, c = keys.length; i < c; ++i ) {
            const k = keys[ i ];
            let v = o[ k ];

            hmac.update( k );
            hmac.update( ':' );
            // this.hmacbase += k + ':';

            if ( Buffer.isBuffer( v ) ) {
                // FTN3 v1.9
                hmac.update( v );
            } else if ( typeof v === 'object' ) {
                this._hmacUpdate( hmac, v );
            } else {
                if ( typeof v !== 'string' ) {
                    v = JSON.stringify( v );
                }

                hmac.update( v );
                // this.hmacbase += v;
            }

            hmac.update( ';' );
            // this.hmacbase += ';';
        }
    };

    // Gen HMAC through .join()
    // ----
    spectools._genHMACJ = function( hmacAlgoRaw, hmacKeyRaw, ftnreq ) {
        const hmac = crypto.createHmac( hmacAlgoRaw, hmacKeyRaw );
        const hmac_base = [];

        this._hmacBase( hmac, hmac_base, ftnreq );
        hmac.update( hmac_base.join( '' ) );
        // this.hmacbase = hmac_base.join( '' );
        return hmac.digest();
    };

    spectools._hmacBase = function( hmac, hmac_base, o ) {
        const keys = Object.keys( o ).sort();

        for ( let i = 0, c = keys.length; i < c; ++i ) {
            const k = keys[ i ];
            let v = o[ k ];

            hmac_base.push( k + ':' );

            if ( Buffer.isBuffer( v ) ) {
                // FTN3 v1.9

                if ( hmac_base.length ) {
                    hmac.update( hmac_base.join( '' ) );
                    hmac_base.length = 0;
                }

                hmac.update( v );
            } else if ( typeof v === 'object' ) {
                this._hmacBase( hmac, hmac_base, v );
            } else {
                if ( typeof v !== 'string' ) {
                    v = JSON.stringify( v );
                }

                hmac_base.push( v );
            }

            hmac_base.push( ';' );
        }
    };


    // Based on benchmark
    // ----
    spectools.genHMACRaw = spectools._genHMACJ;

    // Raw buffer comparison solutions
    // ----
    spectools.checkHMAC = ( a, b ) => spectools.secureEqualBuffer( a, b );

    //---

    /**
     * Secure compare to cover time-based side-channels for attacks
     * @param {Buffer} a - first buffer
     * @param {Buffer} b - second buffer
     * @returns {boolean} true, if match
     * @alias SpecTools.secureEqualBuffer
     */
    spectools.secureEqualBuffer = ( a, b ) => {
        const alen = a.length;
        const blen = b.length;
        const len = Math.min( alen, blen );

        // data view
        const av = a.slice( 0, len );
        const bv = b.slice( 0, len );

        // always compare length AFTER
        return crypto.timingSafeEqual( av, bv ) && ( ( alen - blen ) === 0 );
    };

    // TODO: check, if really gains anything compared to plain JS version
    spectools.secureEquals = ( a, b ) => spectools.secureEqualBuffer(
        Buffer.from( a ), Buffer.from( b ) );
};
