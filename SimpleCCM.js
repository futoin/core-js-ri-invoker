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

const common = require( './lib/common' );
const futoin_error = common.FutoInError;
const NativeIface = require( './NativeIface' );
const _extend = require( 'lodash/extend' );
const _defaults = require( 'lodash/defaults' );
const SimpleCCMImpl = require( './lib/SimpleCCMImpl' );
const ee = require( 'event-emitter' );
const Limiter = require( `futoin-asyncsteps/Limiter` );

/**
 * SimpleCCM public properties
 * @ignore
 */
const SimpleCCMPublic = common.Options;

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
class SimpleCCM {
    constructor( options, impl=null ) {
        this._iface_info = {};
        this._iface_impl = {};
        this._impl = impl || new SimpleCCMImpl( options );

        this.limitZone(
            "default",
            {
                concurrent: 8,
                max_queue: 32,
                rate: 10,
                period_ms: 1e3,
                burst: null,
            }
        );
    }

    /** @ignore */
    get _secure_replace() {
        return /^secure\+/;
    }

    /** @ignore */
    get _secure_test() {
        return /^(https|wss|unix):\/\//;
    }

    /**
    * @ignore
    * @param {SimpleCCMImpl} ccmimpl - _
    * @param {InterfaceInfo} info - interface info
    * @returns {NativeIface} new instance of native face
    */
    _native_iface_builder( ccmimpl, info ) {
        return new NativeIface( ccmimpl, info );
    }

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
    register( as, name, ifacever, endpoint, credentials, options ) {
        const is_channel_reg = ( name === null );

        // Unregister First
        if ( !is_channel_reg &&
            ( name in this._iface_info ) ) {
            as.error( futoin_error.InvokerError, "Already registered" );
        }

        // Check ifacever
        const m = ifacever.match( common._ifacever_pattern );

        if ( m === null ) {
            as.error( futoin_error.InvokerError, "Invalid ifacever" );
        }

        const iface = m[ common._ifacever_pattern_name ];
        const mjrmnr = m[ common._ifacever_pattern_ver ];
        const mjr = m[ common._ifacever_pattern_mjr ];
        const mnr = m[ common._ifacever_pattern_mnr ];

        let secure_channel = false;
        let impl = null;
        let endpoint_scheme;
        let is_bidirect = false;
        let limitZone = 'default';

        // ---
        if ( is_channel_reg ) {
            endpoint_scheme = 'callback';
            is_bidirect = true;
        } else if ( typeof endpoint === "string" ) {
            if ( this._secure_replace.test( endpoint ) ) {
                secure_channel = true;
                endpoint = endpoint.replace( this._secure_replace, '' );
            } else if ( this._secure_test.test( endpoint ) ) {
                secure_channel = true;
            }

            impl = this._native_iface_builder;

            // ---
            endpoint_scheme = endpoint.split( ':' )[ 0 ];

            switch ( endpoint_scheme ) {
            case 'http':
            case 'https':
                break;

            case 'ws':
            case 'wss':
            case 'unix':
                is_bidirect = true;
                break;

            case 'browser':
                if ( options && options.targetOrigin ) {
                    secure_channel = true;
                }

                is_bidirect = true;
                break;

            default:
                as.error( futoin_error.InvokerError, "Unknown endpoint schema" );
            }
        } else if ( 'onInternalRequest' in endpoint ) {
            secure_channel = true;
            impl = this._native_iface_builder;
            endpoint_scheme = '#internal#';
            is_bidirect = true;
            credentials = credentials || '-internal';
            limitZone = 'unlimited';
        } else {
            secure_channel = true;
            impl = endpoint;
            endpoint = null;
            endpoint_scheme = null;
            is_bidirect = true;
        }

        // ---
        options = options || {};
        _defaults( options, this._impl.options );

        // ---
        limitZone = options.limitZone || limitZone;

        if ( !( limitZone in this._impl.limiters ) ) {
            as.error(
                futoin_error.InvokerError,
                `Unknown limit zone ${limitZone}`
            );
        }

        // ---

        const info = {
            iface,
            version : mjrmnr,
            mjrver : mjr,
            mnrver : mnr,
            endpoint,
            endpoint_scheme,
            creds : credentials || null,
            creds_master : credentials === 'master',
            creds_hmac : credentials && ( credentials.substr( 0, 6 ) === '-hmac:' ),
            secure_channel,
            impl : impl,
            regname : name,
            inherits : null,
            funcs : null,
            constraints : null,
            options : options,
            _invoker_use : true,
            _user_info : null,
            limitZone,
        };

        if ( info.creds_hmac &&
            ( !options.hmacKey || !options.hmacAlgo ) ) {
            as.error( futoin_error.InvokerError, "Missing options.hmacKey or options.hmacAlgo" );
        }

        if ( name ) {
            this._iface_info[ name ] = info;
        }

        as.add(
            ( as ) => {
                this._impl.onRegister( as, info );

                as.add( ( as ) => {
                    // error checks
                    // ---
                    if ( !info.simple_req ) {
                        if ( !( 'AllowAnonymous' in info.constraints ) &&
                            !info.creds ) {
                            as.error( futoin_error.SecurityError, "Requires authenticated user" );
                        }

                        if ( ( 'SecureChannel' in info.constraints ) &&
                            !secure_channel ) {
                            as.error( futoin_error.SecurityError, "SecureChannel is required" );
                        }

                        if ( ( 'MessageSignature' in info.constraints ) &&
                            !info.creds_master &&
                            !info.creds_hmac ) {
                            as.error( futoin_error.SecurityError, "SecureChannel is required" );
                        }

                        if ( ( 'BiDirectChannel' in info.constraints ) &&
                            !is_bidirect ) {
                            as.error( futoin_error.InvokerError, "BiDirectChannel is required" );
                        }
                    }

                    // Must be last
                    // ---
                    if ( is_channel_reg ) {
                        as.success( info, this._native_iface_builder( this._impl, info ) );
                    }

                    this.emit( 'register', name, ifacever, info );
                } );
            },
            ( as, err ) => {
                if ( name ) {
                    delete this._iface_info[ name ];
                }
            }
        );
    }

    /**
    * Get native interface wrapper for invocation of iface methods
    * @param {string} name - see register()
    * @returns {NativeInterface} - native interface
    * @alias SimpleCCM#iface
    */
    iface( name ) {
        const info = this._iface_info[ name ];

        if ( !info ) {
            throw new Error( futoin_error.InvokerError );
        }

        const regname = info.regname;
        let impl = this._iface_impl[ regname ];

        if ( !impl ) {
            const NativeImpl = info.options.nativeImpl;

            if ( NativeImpl ) {
                impl = new NativeImpl( this._impl, info );
            } else {
                impl = info.impl( this._impl, info );
            }

            this._iface_impl[ regname ] = impl;
        }

        return impl;
    }

    /**
    * Unregister previously registered interface (should not be used, unless really needed)
    * @param {string} name - see register()
    * @alias SimpleCCM#unRegister
    * @fires SimpleCCM#unregister
    */
    unRegister( name ) {
        const info = this._iface_info[ name ];

        if ( !info ) {
            throw new Error( futoin_error.InvokerError );
        }

        const regname = info.regname;

        if ( regname === name ) {
            delete this._iface_info[ regname ];
            let impl = this._iface_impl[ regname ];

            if ( impl ) {
                impl._close();
                delete this._iface_impl[ regname ];
            }

            if ( info.aliases ) {
                const aliases = info.aliases;

                for ( let i = 0; i < aliases.length; ++i ) {
                    delete this._iface_info[ aliases[ i ] ];
                }
            }
        } else {
            delete this._iface_info[ name ];
            info.aliases.splice( info.aliases.indexOf( name ), 0 );
        }

        this.emit( 'unregister', name, info );
    }

    /**
    * Shortcut to iface( "#defense" )
    * @returns {object} native defense interface
    * @alias SimpleCCM#defense
    */
    defense() {
        return this.iface( this.SVC_DEFENSE );
    }

    /**
    * Returns extended API interface as defined in FTN9 IF AuditLogService
    * @returns {object} FTN9 native face
    * @alias SimpleCCM#log
    */
    log() {
        return this.iface( this.SVC_LOG );
    }

    /**
    * Returns extended API interface as defined in [FTN14 Cache][]
    * @param {string} [bucket=default] - cache bucket name
    * @returns {object} FTN14 native face
    * @alias SimpleCCM#cache
    */
    cache( bucket ) {
        return this.iface( this.SVC_CACHE_ + ( bucket || "default" ) );
    }

    /**
    * Assert that interface registered by name matches major version and minor is not less than required.
    * This function must generate fatal error and forbid any further execution
    * @param {string} name - unique identifier in scope of CCM instance
    * @param {string} ifacever - interface identifier and its version separated by colon
    * @alias SimpleCCM#assertIface
    */
    assertIface( name, ifacever ) {
        const info = this._iface_info[ name ];

        if ( !info ) {
            throw new Error( futoin_error.InvokerError );
        }

        const m = ifacever.match( common._ifacever_pattern );

        if ( m === null ) {
            throw new Error( futoin_error.InvokerError );
        }

        const iface = m[ common._ifacever_pattern_name ];
        const mjr = m[ common._ifacever_pattern_mjr ];
        const mnr = m[ common._ifacever_pattern_mnr ];

        if ( ( info.iface === iface ) &&
            ( info.mjrver === mjr ) &&
            ( info.mnrver >= mnr ) ) {
            return;
        }

        const inherits = info.inherits;

        if ( inherits ) {
            for ( let i = inherits.length - 1; i >= 0; --i ) {
                const mi = inherits[i].match( common._ifacever_pattern );

                if ( ( mi[ common._ifacever_pattern_name ] === iface ) &&
                    ( mi[ common._ifacever_pattern_mjr ] === mjr ) &&
                    ( mi[ common._ifacever_pattern_mnr ] >= mnr )
                ) {
                    return;
                }
            }
        }

        throw new Error( futoin_error.InvokerError );
    }

    /**
    * Alias interface name with another name
    * @param {string} name - unique identifier in scope of CCM instance
    * @param {string} alias - alternative name for registered interface
    * @alias SimpleCCM#alias
    * @fires SimpleCCM#register
    */
    alias( name, alias ) {
        const info = this._iface_info[ name ];

        if ( !info ||
            this._iface_info[ alias ] ) {
            throw new Error( futoin_error.InvokerError );
        }

        this._iface_info[ alias ] = info;

        if ( !info.aliases ) {
            info.aliases = [ alias ];
        } else {
            info.aliases.push( alias );
        }

        this.emit( 'register', alias, `${info.iface}:${info.version}`, info );
    }

    /**
    * Shutdown CCM (close all active comms)
    * @alias SimpleCCM#close
    * @fires SimpleCCM#close
    */
    close() {
        const impls = this._iface_impl;

        for ( let n in impls ) {
            impls[ n ]._close();
        }

        // ---
        const comms = this._impl.comms;

        for ( let k in comms ) {
            comms[ k ].close();
        }

        // ---
        this.emit( 'close' );
    }

    /**
     * Configure named AsyncSteps Limiter instance
     * @alias SimpleCCM#limitZone
     * @param {string} name - zone name
     * @param {object} options - options to pass to Limiter c-tor
     */
    limitZone( name, options ) {
        if ( name !== 'unlimited' ) {
            this._impl.limiters[name] = new Limiter( options );
        }
    }
}

_extend( SimpleCCM.prototype, SimpleCCMPublic );
_extend( SimpleCCM, SimpleCCMPublic );
ee( SimpleCCM.prototype );

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
