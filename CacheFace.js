'use strict';

var _clone = require( 'lodash/lang/clone' );
var _extend = require( 'lodash/object/extend' );
var NativeIface = require( './NativeIface' );
var common = require( './lib/common' );

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
 */
function CacheFace()
{
    _extend( this, CacheFaceProto );
    NativeIface.apply( this, arguments );
}

/**
 * Cache Native interface registration helper
 * @alias CacheFace.register
 */
CacheFace.register = function( as, ccm, name, endpoint, credentials, options )
{
    var iface = CacheFace.ifacespec;

    options = options || {};
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
};

/**
 * CacheFace prototype
 * @ignore
 */
var CacheFaceProto = _clone( NativeIface.prototype );
CacheFace.prototype = CacheFaceProto;

/**
 * Get or Set cached value
 *
 * NOTE: the actual cache key is formed with concatenation of *key_prefix* and join
 *   of *params* values
 *
 * @param {AsyncSteps} as
 * @param {string} key_prefix - unique key prefix
 * @param {Function} callable - func( as, params.. ) - a callable
 *      which is called to generated value on cache miss
 * @param {Array?} params - parameters to be passed to *callable*
 * @param {integer?} ttl_ms - time to live in ms to use, if value is set on cache miss
 *
 * @alias CacheFace#getOrSet
 */
CacheFaceProto.getOrSet = function( as, key_prefix, callable, params, ttl_ms )
{
    params = params || [];
    ttl_ms = ttl_ms || 0;

    var key = key_prefix + params.join( '_' );
    var _this = this;

    as.add(
        function( as )
        {
            _this.call( as, 'get', { key : key } );
        },
        function( as, err )
        {
            if ( err === 'CacheMiss' )
            {
                as.success();
            }
        }
    ).add(
        function( as, res )
        {
            if ( res )
            {
                as.success( res.value );
            }
            else
            {
                // TODO: implement cache hammering protection
                var p = [ as ].concat( params ); // avoid side-effect
                callable.apply( null, p );

                as.add( function( as, value )
                {
                    _this.call( as, 'set', { key : key, value : value, ttl : ttl_ms } );

                    as.add( function( as )
                    {
                        as.success( value );
                    } );
                } );
            }
        }
    );
};

module.exports = CacheFace;

/**
 * Embedded spec for FutoIn CacheFace
 * @alias CacheFace.ifacespec
 */
CacheFace.ifacespec =
        {
            "iface" : "futoin.cache",
            "version" : "1.0",
            "ftn3rev" : "1.1",
            "funcs" : {
                "get" : {
                    "params" : {
                        "key" : {
                            "type" : "string",
                            "desc" : "Unique cache key"
                        }
                    },
                    "result" : {
                        "value" : {
                            "type" : "any",
                            "desc" : "Any previously cached value"
                        }
                    },
                    "throws" : [
                        "CacheMiss"
                    ],
                    "desc" : "Trivial cached value retrieval"
                },
                "set" : {
                    "params" : {
                        "key" : {
                            "type" : "string",
                            "desc" : "Unique cache key"
                        },
                        "value" : {
                            "type" : "any",
                            "desc" : "arbitrary value to cache"
                        },
                        "ttl" : {
                            "type" : "integer",
                            "desc" : "Time to live in milliseconds"
                        }
                    },
                    "desc" : "Trivial cached value storing"
                },
                "custom" : {
                    "params" : {
                        "cmd" : {
                            "type" : "string",
                            "desc" : "Implementation-defined custom command"
                        },
                        "prm" : {
                            "type" : "any",
                            "desc" : "Implementation-defined custom command parameters"
                        }
                    }
                }
            },
            "requires" : [
                "SecureChannel"
            ],
            "desc" : "Cache interface"
        };
