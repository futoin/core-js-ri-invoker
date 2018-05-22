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
    const genHMAC = ( as, options, ftnreq ) => {
        let hmacKeyRaw = options[ SYM_KEY_RAW ];
        let hmacAlgoRaw = options[ SYM_ALGO_RAW ];

        // --
        if ( !hmacKeyRaw ) {
            hmacKeyRaw = Buffer.from( options.macKey, 'base64' );
            options[ SYM_KEY_RAW ] = hmacKeyRaw;
        }

        // --
        if ( !hmacAlgoRaw ) {
            hmacAlgoRaw = getRawAlgo( as, options.macAlgo );
            options[ SYM_ALGO_RAW ] = hmacAlgoRaw;
        }

        return spectools.genHMACRaw( hmacAlgoRaw, hmacKeyRaw, ftnreq );
    };

    const getRawAlgo = ( as, algo ) => {
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
    const _genHMACU = function( hmacAlgoRaw, hmacKeyRaw, ftnreq ) {
        // this.hmacbase = '';
        const hmac = crypto.createHmac( hmacAlgoRaw, hmacKeyRaw );

        _hmacUpdate( hmac, ftnreq, 'sec' );
        return hmac.digest();
    };

    const _hmacUpdate = ( hmac, o, skip=null ) => {
        const keys = Object.keys( o ).sort();

        for ( let i = 0, c = keys.length; i < c; ++i ) {
            const k = keys[ i ];

            if ( k === skip ) {
                continue;
            }

            let v = o[ k ];

            hmac.update( k );
            hmac.update( ':' );
            // this.hmacbase += k + ':';

            if ( Buffer.isBuffer( v ) ) {
                // FTN3 v1.9
                hmac.update( v );
            } else if ( typeof v === 'object' ) {
                _hmacUpdate( hmac, v );
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
    const _genHMACJ = ( hmacAlgoRaw, hmacKeyRaw, ftnreq ) => {
        const hmac = crypto.createHmac( hmacAlgoRaw, hmacKeyRaw );
        const hmac_base = [];

        _hmacBaseJ( hmac, hmac_base, ftnreq, 'sec' );
        hmac.update( hmac_base.join( '' ) );
        return hmac.digest();
    };

    const _hmacBaseJ = ( hmac, hmac_base, o, skip=null ) => {
        const keys = Object.keys( o ).sort();

        for ( let i = 0, c = keys.length; i < c; ++i ) {
            const k = keys[ i ];

            if ( k === skip ) {
                continue;
            }

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
                _hmacBaseJ( hmac, hmac_base, v );
            } else {
                if ( typeof v !== 'string' ) {
                    v = JSON.stringify( v );
                }

                hmac_base.push( v );
            }

            hmac_base.push( ';' );
        }
    };

    // MAC base
    // ----
    const macBaseB = ( msg ) => {
        const parts = [];
        _macBaseB( parts, msg, 'sec' );
        return Buffer.concat( parts );
    };

    const mac_semicolon_buf = Buffer.from( ';' );

    const _macBaseB = ( parts, o, skip=null ) => {
        const keys = Object.keys( o ).sort();
        const key_count = keys.length;

        for ( let i = 0; i < key_count; ++i ) {
            const k = keys[ i ];

            if ( k === skip ) {
                continue;
            }

            let v = o[ k ];
            parts.push( Buffer.from( k + ':' ) );

            if ( Buffer.isBuffer( v ) ) {
                parts.push( v );
            } else if ( typeof v === 'object' ) {
                _macBaseB( parts, v );
            } else {
                if ( typeof v !== 'string' ) {
                    v = JSON.stringify( v );
                }

                parts.push( Buffer.from( v ) );
            }

            parts.push( mac_semicolon_buf );
        }
    };

    // ---
    const macBaseBS = ( msg ) => {
        const bparts = [];
        const sparts = _macBaseBS( bparts, [], msg, 'sec' );

        if ( sparts.length ) {
            bparts.push( Buffer.from( sparts.join( '' ) ) );
        }

        if ( bparts.length === 1 ) {
            return bparts[0];
        }

        return Buffer.concat( bparts );
    };

    const _macBaseBS = ( bparts, sparts, o, skip=null ) => {
        const keys = Object.keys( o ).sort();
        const key_count = keys.length;

        for ( let i = 0; i < key_count; ++i ) {
            const k = keys[ i ];

            if ( k === skip ) {
                continue;
            }

            let v = o[ k ];
            sparts.push( k + ':' );

            if ( Buffer.isBuffer( v ) ) {
                if ( sparts.length ) {
                    bparts.push( Buffer.from( sparts.join( '' ) ) );
                    sparts = [];
                }

                bparts.push( v );
            } else if ( typeof v === 'object' ) {
                sparts = _macBaseBS( bparts, sparts, v );
            } else {
                if ( typeof v !== 'string' ) {
                    v = JSON.stringify( v );
                }

                sparts.push( v );
            }

            sparts.push( ';' );
        }

        return sparts;
    };

    // ---

    Object.assign( spectools, {
        genHMAC,
        getRawAlgo,
        _genHMACU,
        _genHMACJ,
        macBaseB,
        macBaseBS,
    } );


    // Based on benchmark
    // ----
    spectools.genHMACRaw = _genHMACJ;
    spectools.macBase = macBaseBS;

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
