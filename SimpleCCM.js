"use strict";

var common = require( './lib/common' );
var futoin_error = common.FutoInError;
var NativeIface = require( './NativeIface' );
var _extend = require( 'lodash/extend' );
var _defaults = require( 'lodash/defaults' );
var SimpleCCMImpl = require( './lib/SimpleCCMImpl' );
var ee = require( 'event-emitter' );

/**
 * SimpleCCM public properties
 * @ignore
 */
var SimpleCCMPublic = common.Options;

/**
 * Simple CCM - Reference Implementation
 *
 * Base Connection and Credentials Manager with limited error control
 * @see {@link http://specs.futoin.org/final/preview/ftn7_iface_invoker_concept-1.html FTN7: FutoIn Invoker Concept}
 * @alias SimpleCCM
 * @class
 * @param {object=} options - map of options
 * @see SimpleCCMOptions
 */
function SimpleCCM( options )
{
    ee( this );
    this._iface_info = {};
    this._iface_impl = {};
    this._impl = new SimpleCCMImpl( options );
}

_extend( SimpleCCM, SimpleCCMPublic );

/**
 * SimpleCCM proto
 * @ignore
 */
var SimpleCCMProto = {};
SimpleCCM.prototype = SimpleCCMProto;
_extend( SimpleCCMProto, SimpleCCMPublic );

/** @ignore */
SimpleCCMProto._secure_replace = /^secure\+/;

/** @ignore */
SimpleCCMProto._secure_test = /^(https|wss|unix):\/\//;

/** @ignore */
SimpleCCMProto._native_iface_builder = function( ccmimpl, info )
{
    return new NativeIface( ccmimpl, info );
};

/**
 * Register standard MasterService end-point (adds steps to *as*)
 * @param {AsyncSteps} as - AsyncSteps instance as registration may be waiting for external resources
 * @param {string} name - unique identifier in scope of CCM instance
 * @param {string} ifacever - interface identifier and its version separated by colon
 * @param {string} endpoint - URI
 *      OR any other resource identifier of function( ccmimpl, info )
 *          returning iface implementing peer, accepted by CCM implementation
 *      OR instance of Executor
 * @param {string=} credentials - optional, authentication credentials:
 * 'master' - enable MasterService authentication logic (Advanced CCM only)
 * '{user}:{clear-text-password}' - send as is in the 'sec' section
 * NOTE: some more reserved words and/or patterns can appear in the future
 * @param {object=} options - fine tune global CCM options per endpoint
 * @alias SimpleCCM#register
 * @fires SimpleCCM#register
 */
SimpleCCMProto.register = function( as, name, ifacever, endpoint, credentials, options )
{
    var is_channel_reg = ( name === null );

    // Unregister First
    if ( !is_channel_reg &&
         ( name in this._iface_info ) )
    {
        as.error( futoin_error.InvokerError, "Already registered" );
    }

    // Check ifacever
    var m = ifacever.match( common._ifacever_pattern );

    if ( m === null )
    {
        as.error( futoin_error.InvokerError, "Invalid ifacever" );
    }

    var iface = m[ 1 ];
    var mjrmnr = m[ 4 ];
    var mjr = m[ 5 ];
    var mnr = m[ 6 ];

    var secure_channel = false;
    var impl = null;
    var endpoint_scheme;
    var is_bidirect = false;

    // ---
    if ( is_channel_reg )
    {
        endpoint_scheme = 'callback';
        is_bidirect = true;
    }
    else if ( typeof endpoint === "string" )
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

        // ---
        endpoint_scheme = endpoint.split( ':' )[ 0 ];

        switch ( endpoint_scheme )
        {
            case 'http':
            case 'https':
                break;

            case 'ws':
            case 'wss':
            case 'unix':
                is_bidirect = true;
                break;

            case 'browser':
                if ( options && options.targetOrigin )
                {
                    secure_channel = true;
                }
                is_bidirect = true;
                break;

            default:
                as.error( futoin_error.InvokerError, "Unknown endpoint schema" );
        }
    }
    else if ( 'onInternalRequest' in endpoint )
    {
        secure_channel = true;
        impl = this._native_iface_builder;
        endpoint_scheme = '#internal#';
        is_bidirect = true;
    }
    else
    {
        secure_channel = true;
        impl = endpoint;
        endpoint = null;
        endpoint_scheme = null;
        is_bidirect = true;
    }

    // ---
    options = options || {};
    _defaults( options, this._impl.options );

    var info = {
        iface : iface,
        version : mjrmnr,
        mjrver : mjr,
        mnrver : mnr,
        endpoint : endpoint,
        endpoint_scheme : endpoint_scheme,
        creds : credentials || null,
        creds_master : credentials === 'master',
        creds_hmac : credentials && ( credentials.substr( 0, 6 ) === '-hmac:' ),
        secure_channel : secure_channel,
        impl : impl,
        regname : name,
        inherits : null,
        funcs : null,
        constraints : null,
        options : options,
        _invoker_use : true,
        _user_info : null
    };

    if ( info.creds_hmac &&
         ( !options.hmacKey || !options.hmacAlgo ) )
    {
        as.error( futoin_error.InvokerError, "Missing options.hmacKey or options.hmacAlgo" );
    }

    if ( name )
    {
        this._iface_info[ name ] = info;
    }

    var _this = this;

    as.add(
        function( as )
        {
            _this._impl.onRegister( as, info );

            as.add( function( as )
            {
                // error checks
                // ---
                if ( !info.simple_req )
                {
                    if ( !( 'AllowAnonymous' in info.constraints ) &&
                        !info.creds )
                    {
                        as.error( futoin_error.SecurityError, "Requires authenticated user" );
                    }

                    if ( ( 'SecureChannel' in info.constraints ) &&
                        !secure_channel )
                    {
                        as.error( futoin_error.SecurityError, "SecureChannel is required" );
                    }

                    if ( ( 'MessageSignature' in info.constraints ) &&
                        !info.creds_master &&
                        !info.creds_hmac )
                    {
                        as.error( futoin_error.SecurityError, "SecureChannel is required" );
                    }

                    if ( ( 'BiDirectChannel' in info.constraints ) &&
                        !is_bidirect )
                    {
                        as.error( futoin_error.InvokerError, "BiDirectChannel is required" );
                    }
                }

                // Must be last
                // ---
                if ( is_channel_reg )
                {
                    as.success( info, _this._native_iface_builder( _this._impl, info ) );
                }

                _this.emit( 'register', name, ifacever, info );
            } );
        },
        function( as, err )
        {
            void as;
            void err;

            if ( name )
            {
                delete _this._iface_info[ name ];
            }
        }
    );
};

/**
 * Get native interface wrapper for invocation of iface methods
 * @param {string} name - see register()
 * @returns {NativeInterface} - native interface
 * @alias SimpleCCM#iface
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
        var NativeImpl = info.options.nativeImpl;

        if ( NativeImpl )
        {
            impl = new NativeImpl( this._impl, info );
        }
        else
        {
            impl = info.impl( this._impl, info );
        }

        this._iface_impl[ regname ] = impl;
    }

    return impl;
};

/**
 * Unregister previously registered interface (should not be used, unless really needed)
 * @param {string} name - see register()
 * @alias SimpleCCM#unRegister
 * @fires SimpleCCM#unregister
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
        var impl = this._iface_impl[ regname ];

        if ( impl )
        {
            impl._close();
            delete this._iface_impl[ regname ];
        }

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

    this.emit( 'unregister', name, info );
};

/**
 * Shortcut to iface( "#defense" )
 * @alias SimpleCCM#defense
 */
SimpleCCMProto.defense = function()
{
    return this.iface( this.SVC_DEFENSE );
};

/**
 * Returns extended API interface as defined in FTN9 IF AuditLogService
 * @returns {object}
 * @alias SimpleCCM#log
 */
SimpleCCMProto.log = function()
{
    return this.iface( this.SVC_LOG );
};

/**
 * Returns extended API interface as defined in [FTN14 Cache][]
 * @returns {object}
 * @alias SimpleCCM#cache
 */
SimpleCCMProto.cache = function( bucket )
{
    return this.iface( this.SVC_CACHE_ + ( bucket || "default" ) );
};

/**
 * Assert that interface registered by name matches major version and minor is not less than required.
 * This function must generate fatal error and forbid any further execution
 * @param {string} name - unique identifier in scope of CCM instance
 * @param {string} ifacever - interface identifier and its version separated by colon
 * @alias SimpleCCM#assertIface
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

    var iface = m[ 1 ];
    var mjr = m[ 5 ];
    var mnr = m[ 6 ];

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
 * @alias SimpleCCM#alias
 * @fires SimpleCCM#register
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

    this.emit( 'register', alias, info.iface + ':' + info.version, info );
};

/**
 * Shutdown CCM (close all active comms)
 * @alias SimpleCCM#close
 * @fires SimpleCCM#close
 */
SimpleCCMProto.close = function()
{
    var impls = this._iface_impl;

    for ( var n in impls )
    {
        impls[ n ]._close();
    }

    // ---
    var comms = this._impl.comms;

    for ( var k in comms )
    {
        comms[ k ].close();
    }

    // ---
    this.emit( 'close' );
};

module.exports = SimpleCCM;

/**
 * CCM regiser event. Fired on new interface registration.
 * ( name, ifacever, info )
 * @event SimpleCCM#register
 */

/**
 * CCM regiser event. Fired on interface unregistration.
 * ( name, info )
 * @event SimpleCCM#unregister
 */

/**
 * CCM close event. Fired on CCM shutdown.
 * @event SimpleCCM#close
 */
