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

const _cloneDeep = require( 'lodash/cloneDeep' );
const _extend = require( 'lodash/extend' );

const common = require( './lib/common' );
const { InternalError, InvalidRequest } = common.FutoInError;

const $asyncevent = require( 'futoin-asyncevent' );

const STANDARD_ERRORS = {
    UnknownInterface : true,
    NotSupportedVersion : true,
    NotImplemented : true,
    Unauthorized : true,
    InternalError : true,
    InvalidRequest : true,
    DefenseRejected : true,
    PleaseReauth : true,
    SecurityError : true,
};
Object.freeze( STANDARD_ERRORS );

const g_load_cache = {};

/**
 * SpecTools
 * @class
 * @alias SpecTools
 */
const spectools =
{
    /**
     * Enumeration of standard errors
     * @const
     * @alias SpecTools.STANDARD_ERRORS
     */
    STANDARD_ERRORS,

    /**
     * Enumeration of standard errors
     * @const
     * @alias SpecTools.standard_errors
     * @deprecated
     */
    standard_errors : STANDARD_ERRORS,

    /**
     * Load FutoIn iface definition.
     *
     * NOTE: Browser uses XHR to load specs, Node.js searches in local fs.
     * @param {AsyncSteps} as - step interface
     * @param {Object} info - destination object with "iface" and "version" fields already set
     * @param {Array} specdirs - each element - search path/url (string) or raw iface (object)
     * @param {Object=} load_cache - arbitrary object to use for caching
     * @alias SpecTools.loadIface
     */
    loadIface : ( as, info, specdirs, load_cache ) => {
        let raw_spec = null;
        const fn = `${info.iface}-${info.version}-iface.json`;
        let cached_info;
        let cache_key;

        if ( load_cache ) {
            cache_key = `${info.iface}:${info.version}`;

            if ( info._import_use ) {
                cache_key += ':r';
            } else if ( info._invoker_use ) {
                cache_key += ':i';
            } else {
                cache_key += ':e';
            }

            cached_info = load_cache[ cache_key ];

            if ( cached_info ) {
                _extend( info, cached_info );
                return;
            }

            cached_info = {
                _import_use : info._import_use,
                _invoker_use : info._invoker_use,
                _lazy_compile : info._lazy_compile,
            };
        } else {
            cached_info = info;
        }

        as.forEach( specdirs, ( as, _k, v ) => {
            if ( typeof v === 'string' ) {
                spectools._loadURL( as, v, fn );
            }

            // Check object spec
            as.add( ( as, res = v ) => {
                if ( ( typeof res === 'object' ) &&
                    ( res.iface === info.iface ) &&
                    ( res.version === info.version )
                ) {
                    if ( res === v ) {
                        raw_spec = _cloneDeep( res );
                    } else {
                        raw_spec = res;
                    }

                    as.break();
                }
            } );
        } );
        as.add( ( as ) => {
            if ( raw_spec === null ) {
                as.error(
                    InternalError,
                    `Failed to load valid spec for ${info.iface}:${info.version}`
                );
            }

            spectools.parseIface( as, cached_info, specdirs, raw_spec, load_cache );
        } );

        if ( load_cache ) {
            as.add( ( as ) => {
                load_cache[ cache_key ] = cached_info;
                _extend( info, cached_info );
            } );
        }
    },

    /**
     * Generate HMAC
     *
     * NOTE: for simplicity, 'sec' field must not be present
     * @param {AsyncSteps} as - step interface
     * @param {object} info - Interface raw info object
     * @param {object} ftnreq - Request Object
     * @returns {Buffer} Binary HMAC signature
     * @throws {FutoInError}
     */
    genHMAC : ( as, info, ftnreq ) => {
        void as;
        void info;
        void ftnreq;
        as.error( InvalidRequest, "HMAC generation is supported only for server environment" );
        return {}; // suppress eslint
    },

    /**
     * Secure compare to cover time-based side-channels for attacks
     * @note Pure JS is used in browser and crypto-based in Node.js
     * @param {string} a - first string
     * @param {string} b - second String
     * @returns {boolean} true, if match
     */
    secureEquals : ( a, b ) => {
        let res = a.length - b.length;

        for ( let i = Math.min( a.length, b.length ) - 1; i >= 0; --i ) {
            res |= a.charCodeAt( i ) ^ b.charCodeAt( i );
        }

        return ( res === 0 );
    },

    /**
     * Call after loading all depedency modules.
     *
     * Mitigates CVE-2018-3721 and similar.
     */
    secureObjectPrototype : () => {
        // CVE-2018-3721
        Object.freeze( Object.prototype );
    },

    /**
     * Get process-wide load cache.
     * @returns {object} Global load cache instance.
     */
    globalLoadCache : () => g_load_cache,
};

// Common extensions
require( './lib/spectools_types' )( spectools );
require( './lib/spectools_compile' )( spectools );
require( './lib/spectools_parse' )( spectools );
require( './lib/spectools_deprecated' )( spectools );

// Node.js extensions
if ( common._isNode ) {
    const mod = module;
    mod.require( './lib/node/spectools' )( spectools );
    mod.require( './lib/node/spectools_hmac' )( spectools );
// Browser extensions
} else {
    require( './lib/browser/spectools' )( spectools );
}

$asyncevent( spectools, [ 'error' ] );

/**
 * On error message for details in debugging.
 * @event SpecTools.error
 */

Object.freeze( spectools );

module.exports = spectools;
