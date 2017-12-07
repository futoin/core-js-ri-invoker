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

const NativeIface = require( './NativeIface' );
const common = require( './lib/common' );

/**
 * Cache Native interface
 *
 * Register with CacheFace.register()
 *
 * NOTE: it is not directly available in Invoker module
 * interface, include separately
 * @class
 * @alias CacheFace
 * @augments NativeIface
 * @param {SimpleCCM} _ccm - CCM instance
 * @param {object} info - internal info
 */
class CacheFace extends NativeIface {
    constructor( ccm, info ) {
        super( ccm, info );
        this._ttl_ms = info.options.ttl_ms || 1000;
    }

    /**
    * Cache Native interface registration helper
    * @param {AsyncSteps} as - step interface
    * @param {AdvancedCCM} ccm - CCM instance
    * @param {string} name - registration name for CCM
    * @param {string} endpoint - endpoint URL
    * @param {*} [credentials=null] - see CCM register()
    * @param {object} [options={}] - registration options
    * @param {string} [options.version=1.0] - iface version
    * @param {integer} [options.ttl_ms=1000] - default TTL
    * @alias CacheFace.register
    */
    static register( as, ccm, name, endpoint, credentials, options ) {
        options = options || {};
        const ifacever = options.version || '1.0';
        const iface = this.spec( ifacever );

        options.nativeImpl = this;
        options.specDirs = [ iface ];

        ccm.register(
            as,
            common.Options.SVC_CACHE_ + name,
            iface.iface + ':' + iface.version,
            endpoint,
            credentials,
            options
        );
    }

    /**
    * Get or Set cached value
    *
    * NOTE: the actual cache key is formed with concatenation of *key_prefix* and join
    *   of *params* values
    *
    * @param {AsyncSteps} as - step interface
    * @param {string} key_prefix - unique key prefix
    * @param {Function} callable - func( as, params.. ) - a callable
    *      which is called to generated value on cache miss
    * @param {Array?} params - parameters to be passed to *callable*
    * @param {integer?} ttl_ms - time to live in ms to use, if value is set on cache miss
    *
    * @alias CacheFace#getOrSet
    */
    getOrSet( as, key_prefix, callable, params, ttl_ms ) {
        params = params || [];
        ttl_ms = ttl_ms || this._ttl_ms;

        const key = key_prefix + params.join( '_' );

        as.add(
            ( as ) => {
                this.call( as, 'get', { key : key } );
            },
            ( as, err ) => {
                if ( err === 'CacheMiss' ) {
                    as.success();
                }
            }
        ).add(
            ( as, res ) => {
                if ( res ) {
                    as.success( res.value );
                } else {
                    // TODO: implement cache hammering protection
                    const p = [ as ].concat( params ); // avoid side-effect

                    callable.apply( null, p );

                    as.add( ( as, value ) => {
                        this.call( as, 'set', {
                            key : key,
                            value : value,
                            ttl : ttl_ms,
                        } );

                        as.add( ( as ) => as.success( value ) );
                    } );
                }
            }
        );
    }
}

module.exports = CacheFace;

const specs = {};

CacheFace._specs = specs;

/**
 * Embedded spec for FutoIn CacheFace
 * @ignore
 */
specs['1.0'] =
        {
            iface : "futoin.cache",
            version : "1.0",
            ftn3rev : "1.1",
            funcs : {
                get : {
                    params : {
                        key : {
                            type : "string",
                            desc : "Unique cache key",
                        },
                    },
                    result : {
                        value : {
                            type : "any",
                            desc : "Any previously cached value",
                        },
                    },
                    throws : [ "CacheMiss" ],
                    desc : "Trivial cached value retrieval",
                },
                set : {
                    params : {
                        key : {
                            type : "string",
                            desc : "Unique cache key",
                        },
                        value : {
                            type : "any",
                            desc : "arbitrary value to cache",
                        },
                        ttl : {
                            type : "integer",
                            desc : "Time to live in milliseconds",
                        },
                    },
                    desc : "Trivial cached value storing",
                },
                custom : {
                    params : {
                        cmd : {
                            type : "string",
                            desc : "Implementation-defined custom command",
                        },
                        prm : {
                            type : "any",
                            desc : "Implementation-defined custom command parameters",
                        },
                    },
                },
            },
            requires : [ "SecureChannel" ],
            desc : "Cache interface",
        };
