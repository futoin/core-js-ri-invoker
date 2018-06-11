"use strict";

/**
 * @file
 *
 * Copyright 2014-2018 FutoIn Project (https://futoin.org)
 * Copyright 2014-2018 Andrey Galkin <andrey@futoin.org>
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

const crypto = require( 'crypto' );

const fs = module.require( 'fs' );
const request = module.require( 'request' );

module.exports = ( spectools ) => {
    const ST = spectools;

    //=================================
    // Node.js extensions
    //=================================

    const _loadURL = ( as, base_url, file_name ) => {
        as.add( ( read_as ) => {
            const uri = `${base_url}/${file_name}`;

            const on_read = ( data, err ) => {
                if ( !read_as ) {
                    return;
                }

                if ( !err ) {
                    try {
                        const res = JSON.parse( data );
                        read_as.success( res );
                        return;
                    } catch ( e ) {
                        spectools.emit(
                            'error',
                            `Invalid JSON for '${uri}": ${e}`
                        );

                        try {
                            as.break();
                        } catch ( _ ) {
                            // pass
                        }
                    }
                }

                try {
                    read_as.continue();
                } catch ( e ) {
                    // ignore
                }
            };

            if ( uri.substr( 0, 4 ) === 'http' ) {
                request( uri, ( error, _response, body ) => {
                    on_read( body, error );
                } );
            } else {
                fs.readFile(
                    uri,
                    { encoding : 'utf8' },
                    ( err, data ) => {
                        on_read( data, err );
                    }
                );
            }

            read_as.setCancel( ( as ) => {
                read_as = null; // see readFile above
            } );
        } );
    };

    /**
     * Secure compare to cover time-based side-channels for attacks
     * @param {Buffer} a - first buffer
     * @param {Buffer} b - second buffer
     * @returns {boolean} true, if match
     * @alias SpecTools.secureEqualBuffer
     */
    const secureEqualBuffer = ( a, b ) => {
        const alen = a.length;
        const blen = b.length;
        const len = Math.min( alen, blen );

        // data view
        const av = a.slice( 0, len );
        const bv = b.slice( 0, len );

        // always compare length AFTER
        return crypto.timingSafeEqual( av, bv ) && ( ( alen - blen ) === 0 );
    };


    //=================================
    Object.assign( ST, {
        _loadURL,
        secureEqualBuffer,
    } );
};
