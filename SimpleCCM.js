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
const { InvokerError, SecurityError } = common.FutoInError;
const NativeIface = require( './NativeIface' );
const _extend = require( 'lodash/extend' );

const SimpleCCMImpl = require( './lib/SimpleCCMImpl' );
const $asyncevent = require( 'futoin-asyncevent' );
const Limiter = require( 'futoin-asyncsteps' ).Limiter;

/**
 * SimpleCCM public properties
 * @ignore
 */
const SimpleCCMPublic = common.Options;

const SECURE_PREFIX_RE = /^secure\+/;
const SECURE_PROTO_RE = /^(https|wss|unix):\/\//;
const native_iface_builder = ( ccmimpl, info ) => {
    return new NativeIface( ccmimpl, info );
};

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
        $asyncevent( this, [
            'register',
            'unregister',
            'close',
        ] );

        this._iface_info = {};
        this._iface_instance = {};
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
    register( as, name, ifacever, endpoint, credentials, options={} ) {
        const is_channel_reg = ( name === null );

        // Unregister First
        if ( !is_channel_reg &&
            ( name in this._iface_info ) ) {
            as.error( InvokerError, "Already registered" );
        }

        // Check ifacever
        const m = ifacever.match( common._ifacever_pattern );

        if ( m === null ) {
            as.error( InvokerError, "Invalid ifacever" );
        }


        // ---
        options = Object.assign( {}, this._impl.options, options );

        // ---
        const iface = m[ common._ifacever_pattern_name ];
        const mjrmnr = m[ common._ifacever_pattern_ver ];
        const mjr = m[ common._ifacever_pattern_mjr ];
        const mnr = m[ common._ifacever_pattern_mnr ];

        let secure_channel = options.secureChannel || false;
        let impl = null;
        let endpoint_scheme;
        let is_bidirect = false;
        let is_internal = false;
        let limitZone = 'default';

        // ---
        if ( is_channel_reg ) {
            endpoint_scheme = 'callback';
            is_bidirect = true;
        } else if ( typeof endpoint === "string" ) {
            if ( SECURE_PREFIX_RE.test( endpoint ) ) {
                secure_channel = true;
                endpoint = endpoint.replace( SECURE_PREFIX_RE, '' );
            } else if ( SECURE_PROTO_RE.test( endpoint ) ) {
                secure_channel = true;
            }

            impl = native_iface_builder;

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
                if ( options.targetOrigin ) {
                    secure_channel = true;
                }

                is_bidirect = true;
                break;

            default:
                as.error( InvokerError, "Unknown endpoint schema" );
            }
        } else if ( 'onInternalRequest' in endpoint ) {
            secure_channel = true;
            impl = native_iface_builder;
            endpoint_scheme = '#internal#';
            is_bidirect = true;
            is_internal = true;
            credentials = credentials || '-internal';
            limitZone = 'unlimited';
        } else {
            secure_channel = true;
            impl = endpoint;
            endpoint = null;
            endpoint_scheme = null;
            is_bidirect = true;
            is_internal = true;
        }

        // ---
        limitZone = options.limitZone || limitZone;

        if ( !( limitZone in this._impl.limiters ) ) {
            as.error(
                InvokerError,
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
            creds_mac : credentials && ( credentials.match( /^-[hs]mac:/ ) !== null ),
            secure_channel,
            impl : impl,
            regname : name,
            inherits : null,
            funcs : null,
            constraints : null,
            options : options,
            _invoker_use : true,
            _user_info : null,
            _server_executor_context : null,
            limitZone,
            aliases: [],
        };

        if ( info.creds_mac ) {
            if ( credentials.match( /^-hmac:/ ) ) {
                if ( !options.hmacKey ) {
                    as.error( InvokerError, "Missing options.hmacKey" );
                }

                options.macKey = options.hmacKey;
                options.macAlgo = options.hmacAlgo;
            } else if ( !options.macKey ) {
                as.error( InvokerError, "Missing options.macKey" );
            }
        }

        if ( info.creds_master && !options.masterAuth ) {
            as.error( InvokerError, "Missing options.masterAuth" );
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
                            !info.creds
                        ) {
                            as.error( SecurityError, "Requires authenticated user" );
                        }

                        if ( ( 'SecureChannel' in info.constraints ) &&
                            !secure_channel
                        ) {
                            as.error( SecurityError, "SecureChannel is required" );
                        }

                        if ( ( 'MessageSignature' in info.constraints ) &&
                            !info.creds_master &&
                            !info.creds_mac &&
                            !is_internal
                        ) {
                            as.error( SecurityError, "MessageSignature is required" );
                        }

                        if ( ( 'BiDirectChannel' in info.constraints ) &&
                            !is_bidirect
                        ) {
                            as.error( InvokerError, "BiDirectChannel is required" );
                        }
                    }

                    // Must be last
                    // ---
                    if ( is_channel_reg ) {
                        as.success( info, native_iface_builder( this._impl, info ) );
                    }

                    Object.seal( info );

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
        return this._iface_instance[ name ] || this._initIface( name );
    }

    _initIface( name ) {
        const info = this._iface_info[ name ];

        if ( !info ) {
            throw new Error( InvokerError );
        }

        const { regname } = info;

        const instances = this._iface_instance;
        let instance = instances[ regname ];

        if ( !instance ) {
            const NativeImpl = info.options.nativeImpl;

            if ( NativeImpl ) {
                instance = new NativeImpl( this._impl, info );
            } else {
                instance = info.impl( this._impl, info );
            }

            Object.seal( instance ); // make sure it's optimized
            instances[ regname ] = instance;
        }

        if ( regname !== name ) {
            instances[ name ] = instance;
        }

        return instance;
    }

    /**
    * Unregister previously registered interface (should not be used, unless really needed)
    * @param {string} name - see register()
    * @alias SimpleCCM#unRegister
    * @fires SimpleCCM#unregister
    */
    unRegister( name ) {
        const ifaces = this._iface_info;
        const instances = this._iface_instance;
        const info = ifaces[ name ];

        if ( !info ) {
            throw new Error( InvokerError );
        }

        if ( info.regname === name ) {
            const { aliases } = info;
            const instance = instances[ name ];

            if ( instance ) {
                instance._close();
            }

            for ( let i = 0; i < aliases.length; ++i ) {
                const alias = aliases[ i ];
                delete ifaces[ alias ];
                delete instances[ alias ];
            }
        } else {
            info.aliases.splice( info.aliases.indexOf( name ), 0 );
        }

        delete ifaces[ name ];
        delete instances[ name ];

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
            throw new Error( InvokerError );
        }

        const m = ifacever.match( common._ifacever_pattern );

        if ( m === null ) {
            throw new Error( InvokerError );
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

        throw new Error( InvokerError );
    }

    /**
    * Alias interface name with another name
    * @param {string} name - unique identifier in scope of CCM instance
    * @param {string} alias - alternative name for registered interface
    * @alias SimpleCCM#alias
    * @fires SimpleCCM#register
    */
    alias( name, alias ) {
        const ifaces = this._iface_info;
        const info = ifaces[ name ];

        if ( !info || ifaces[ alias ] ) {
            throw new Error( InvokerError );
        }

        ifaces[ alias ] = info;
        info.aliases.push( alias );
        this.emit( 'register', alias, `${info.iface}:${info.version}`, info );
    }

    /**
    * Shutdown CCM (close all active comms)
    * @alias SimpleCCM#close
    * @fires SimpleCCM#close
    */
    close() {
        const instances = this._iface_instance;
        const ifaces = this._iface_info;

        for ( let n in ifaces ) {
            const info = ifaces[n];
            const instance = instances[n];

            if ( instance && ( n === info.regname ) ) {
                instance._close();
            }
        }

        this._iface_instance = {};
        this._iface_info = {};

        // ---
        const impl = this._impl;
        const comms = impl.comms;

        for ( let k in comms ) {
            comms[ k ].close();
        }

        impl.comms = {};

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
