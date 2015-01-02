"use strict";

/**
 * @module futoin-invoker
 */

var common = require( './common' );
var futoin_error = common.FutoInError;
var native_iface = require( './native_iface' );
var _ = require( 'lodash' );
var simple_ccm = require( './simpleccm_impl' );
var advanced_ccm = require( './advancedccm_impl' );
var spectools = require( './spectools' );

/**
 * SimpleCCM public properties
 * @ignore
 */
var SimpleCCMPublic =
{
    /** Runtime iface resolution v1.x */
    SVC_RESOLVER : '#resolver',
    /** AuthService v1.x */
    SVC_AUTH : '#auth',
    /** Defense system v1.x */
    SVC_DEFENSE : '#defense',
    /** Access Control system v1.x */
    SVC_ACL : '#acl',
    /** Audit Logging v1.x */
    SVC_LOG : '#log',
    /** cache v1.x (fast local, but small) */
    SVC_CACHE_L1 : "#cachel1",
    /** cache v1.x (slower local, but large) */
    SVC_CACHE_L2 : "#cachel2",
    /** cache v1.x (much slower and much larger) */
    SVC_CACHE_L3 : "#cachel3",
};

_.extend( SimpleCCMPublic, common.Options );

/**
 * Simple CCM - Reference Implementation
 * @link http://specs.futoin.org/final/preview/ftn7_iface_invoker_concept-1.html
 * @alias module:futoin-invoker.SimpleCCM
 * @class
 * @param {object=} options - map of OPT_* named variables
 */
function SimpleCCM( options )
{
    this._iface_info = {};
    this._iface_impl = {};
    this._impl = simple_ccm( options );
}

_.extend( SimpleCCM, SimpleCCMPublic );

/**
 * SimpleCCM proto
 * @ignore
 */
var SimpleCCMProto =
{
    /** Runtime iface resolution v1.x */
    SVC_RESOLVER : '#resolver',
    /** AuthService v1.x */
    SVC_AUTH : '#auth',
    /** Defense system v1.x */
    SVC_DEFENSE : '#defense',
    /** Access Control system v1.x */
    SVC_ACL : '#acl',
    /** Audit Logging v1.x */
    SVC_LOG : '#log',
    /** cache v1.x (fast local, but small) */
    SVC_CACHE_L1 : "#cachel1",
    /** cache v1.x (slower local, but large) */
    SVC_CACHE_L2 : "#cachel2",
    /** cache v1.x (much slower and much larger) */
    SVC_CACHE_L3 : "#cachel3",

    /** @ignore */
    _secure_replace : /^secure\+/,
    /** @ignore */
    _secure_test : /^(https|wss|unix):\/\//,

    /** @ignore */
    _native_iface_builder : function( ccmimpl, info )
    {
        return native_iface( ccmimpl, info );
    }
};

_.extend( SimpleCCMProto, SimpleCCMPublic );

/**
 * Register standard MasterService end-point (adds steps to *as*)
 * @param {AsyncSteps} as - AsyncSteps instance as registration may be waiting for external resources
 * @param {string} name - unique identifier in scope of CCM instance
 * @param {string} ifacever - interface identifier and its version separated by colon
 * @param {string} endpoint - URI or any other resource identifier of iface implementing peer, accepted by CCM implementation
 * @param {string=} credentials - optional, authentication credentials:
 * @param {object=} options - NOT STANDARD feature, fine tune global CCM options per endpoint
 * 'master' - enable MasterService authentication logic (Advanced CCM only)
 * '{user}:{clear-text-password}' - send as is in the 'sec' section
 * NOTE: some more reserved words and/or patterns can appear in the future
 */
SimpleCCMProto.register = function( as, name, ifacever, endpoint, credentials, options )
{
    // Unregister First
    if ( name in this._iface_info )
    {
        as.error( futoin_error.InvokerError, "Already registered" );
    }

    // Check ifacever
    var m = ifacever.match( common._ifacever_pattern );

    if ( m === null )
    {
        as.error( futoin_error.InvokerError, "Invalid ifacever" );
    }

    var iface = m[1];
    var mjrmnr = m[4];
    var mjr = m[5];
    var mnr = m[6];

    var secure_channel = false;
    var impl = null;

    if ( typeof endpoint === "string" )
    {
        if ( this._secure_replace.test( endpoint ) )
        {
            secure_channel = true;
            endpoint = endpoint.replace( this._secure_replace, '' );
        }
        else if ( this._secure_test.test( endpoint ) )
        {
            secure_channel = true;
        }

        impl = this._native_iface_builder;
    }
    else
    {
        impl = endpoint;
        endpoint = null;
    }

    options = options || {};
    _.defaults( options, this._impl.options );

    var info = {
        iface : iface,
        version : mjrmnr,
        mjrver : mjr,
        mnrver : mnr,
        endpoint : endpoint,
        creds : credentials || null,
        secure_channel : secure_channel,
        impl : impl,
        regname : name,
        inherits : null,
        funcs : null,
        constraints : null,
        options : options,
        _invoker_use : true
    };

    this._iface_info[ name ] = info;

    this._impl.onRegister( as, info );
};

/**
 * Get native interface wrapper for invocation of iface methods
 * @param {string} name - see register()
 * @returns {module:futoin-invoker.NativeInterface} - native interface
 */
SimpleCCMProto.iface = function( name )
{
    var info = this._iface_info[ name ];

    if ( !info )
    {
        throw new Error( futoin_error.InvokerError );
    }

    var regname = info.regname;
    var impl = this._iface_impl[ regname ];

    if ( !impl )
    {
        impl = info.impl( this._impl, info );
        this._iface_impl[ regname ] = impl;
    }

    return impl;
};

/**
 * Unregister previously registered interface (should not be used, unless really needed)
 * @param {string} name - see register()
 */
SimpleCCMProto.unRegister = function( name )
{
    var info = this._iface_info[ name ];

    if ( !info )
    {
        throw new Error( futoin_error.InvokerError );
    }

    var regname = info.regname;

    if ( regname === name )
    {
        delete this._iface_info[ regname ];
        delete this._iface_impl[ regname ];

        if ( info.aliases )
        {
            var aliases = info.aliases;

            for ( var i = 0; i < aliases.length; ++i )
            {
                delete this._iface_info[ aliases[ i ] ];
            }
        }
    }
    else
    {
        delete this._iface_info[ name ];
        info.aliases.splice( info.aliases.indexOf( name ), 0 );
    }
};

/**
 * Shortcut to iface( "#defense" )
 */
SimpleCCMProto.defense = function()
{
    return this.iface( this.SVC_DEFENSE );
};

/**
 * Returns extended API interface as defined in FTN9 IF AuditLogService
 * @returns {object}
 */
SimpleCCMProto.log = function()
{
    return this.iface( this.SVC_LOG );
};

/**
 * Returns extended API interface as defined in [FTN10 Burst Calls][]
 * @returns {object}
 */
SimpleCCMProto.burst = function()
{
    throw new Error( futoin_error.NotImplemented );
};

/**
 * Returns extended API interface as defined in [FTN14 Cache][]
 * @returns {object}
 */
SimpleCCMProto.cache_l1 = function()
{
    return this.iface( this.SVC_CACHE_L1 );
};

/**
 * Returns extended API interface as defined in [FTN14 Cache][]
 * @returns {object}
 */
SimpleCCMProto.cache_l2 = function()
{
    return this.iface( this.SVC_CACHE_L2 );
};

/**
 * Returns extended API interface as defined in [FTN14 Cache][]
 * @returns {object}
 */
SimpleCCMProto.cache_l3 = function()
{
    return this.iface( this.SVC_CACHE_L3 );
};

/**
 * Assert that interface registered by name matches major version and minor is not less than required.
 * This function must generate fatal error and forbid any further execution
 * @param {string} name - unique identifier in scope of CCM instance
 * @param {string} ifacever - interface identifier and its version separated by colon
 */
SimpleCCMProto.assertIface = function( name, ifacever )
{
    var info = this._iface_info[ name ];

    if ( !info )
    {
        throw new Error( futoin_error.InvokerError );
    }

    var m = ifacever.match( common._ifacever_pattern );

    if ( m === null )
    {
        throw new Error( futoin_error.InvokerError );
    }

    var iface = m[1];
    var mjr = m[5];
    var mnr = m[6];

    if ( ( info.iface !== iface ) ||
         ( info.mjrver !== mjr ) ||
         ( info.mnrver < mnr ) )
    {
        throw new Error( futoin_error.InvokerError );
    }
};

/**
 * Alias interface name with another name
 * @param {string} name - unique identifier in scope of CCM instance
 * @param {string} alias - alternative name for registered interface
 */
SimpleCCMProto.alias = function( name, alias )
{
    var info = this._iface_info[ name ];

    if ( !info ||
         this._iface_info[ alias ] )
    {
        throw new Error( futoin_error.InvokerError );
    }

    this._iface_info[ alias ] = info;

    if ( !info.aliases )
    {
        info.aliases = [ alias ];
    }
    else
    {
        info.aliases.push( alias );
    }
};

SimpleCCM.prototype = SimpleCCMProto;
/* --- */

/**
 * Advanced CCM - Reference Implementation
 * @link http://specs.futoin.org/final/preview/ftn7_iface_invoker_concept-1.html
 * @alias module:futoin-invoker.AdvancedCCM
 * @class
 */
function AdvancedCCM( options )
{
    this._iface_info = {};
    this._iface_impl = {};
    this._impl = advanced_ccm( options );
}

_.extend( AdvancedCCM, SimpleCCMPublic );

/**
 * AdvancedCCM proto
 * @ignore
 */
var AdvancedCCMProto =
{
};

_.extend( AdvancedCCMProto, SimpleCCMProto );

/**
 * Try to load internal registration info from cache
 * @param {AsyncSteps} as - AsyncSteps instance as registration may be waiting for external resources
 * @param {string} cache_l1_endpoint - URI or any other resource identifier of iface implementing peer, accepted by CCM implementation
 */
AdvancedCCMProto.initFromCache = function( as, cache_l1_endpoint )
{
    void cache_l1_endpoint;
    as.error( futoin_error.NotImplemented, "Caching is not supported yet" );
};

/**
 * Save internal registration info to cache
 * @param {AsyncSteps} as - AsyncSteps instance as registration may be waiting for external resources
 */
AdvancedCCMProto.cacheInit = function( as )
{
    void as;
    // Fail silently
};

AdvancedCCM.prototype = AdvancedCCMProto;
/* --- */

exports.SimpleCCM = SimpleCCM;
exports.AdvancedCCM = AdvancedCCM;

/**
 * Easy access of futoin-asyncsteps.FutoInError errors, which may be extended in the future
 * @alias module:futoin-invoker.FutoInError
 * @class
 */
exports.FutoInError = futoin_error;

/**
 * Useful base for custom implementation of NativeIface
 * @alias module:futoin-invoker.NativeIface
 * @class
 */
exports.NativeIface = native_iface.NativeIface;

/**
 * NativeInterface.ifaceInfo() class for custom implementations of NativeIface
 * @alias module:futoin-invoker.InterfaceInfo
 * @class
 */
exports.InterfaceInfo = native_iface.InterfaceInfo;

/**
 * @ignore
 */
exports.SpecTools = spectools;
exports.SpecTools._ifacever_pattern = common._ifacever_pattern;
