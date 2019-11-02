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
const async_steps = require( 'futoin-asyncsteps' );

const btoa = ( typeof window !== 'undefined' ) ? window.btoa :
    function( str ) {
        return new Buffer( str ).toString( 'base64' );
    };

/**
 * AuditLog Native interface
 *
 * Register with LogFace.register().
 *
 * NOTE: it is not directly available Invoker module
 * interface, include separately
 * @class
 * @alias LogFace
 * @augments NativeIface
 */
class LogFace extends NativeIface {
    constructor( ...args ) {
        super( ...args );
        this._log_queue = [];
        this._active_runner = false;
    }

    /**
    * AuditLog Native interface registration helper
    * @param {AsyncSteps} as - step interface
    * @param {AdvancedCCM} ccm - CCM instance
    * @param {string} endpoint - endpoint URL
    * @param {*} [credentials=null] - see CCM register()
    * @param {object} [options={}] - registration options
    * @param {string} [options.version=1.0] - iface version
    * @alias LogFace.register
    */
    static register( as, ccm, endpoint, credentials, options ) {
        options = options || {};
        const ifacever = options.version || '1.0';
        const iface = LogFace.spec( ifacever );

        options.nativeImpl = this;
        options.specDirs = [ iface ];

        ccm.register(
            as,
            common.Options.SVC_LOG,
            iface.iface + ':' + iface.version,
            endpoint,
            credentials,
            options
        );
    }

    /**
    * Debug log level
    * @const
    * @alias LogFace.LVL_DEBUG
    */
    get LVL_DEBUG() {
        return 'debug';
    }

    /**
    * Info log level
    * @const
    * @alias LogFace.LVL_INFO
    */
    get LVL_INFO() {
        return 'info';
    }

    /**
    * Warn log level
    * @const
    * @alias LogFace.LVL_WARN
    */
    get LVL_WARN() {
        return 'warn';
    }

    /**
    * Error log level
    * @const
    * @alias LogFace.LVL_ERROR
    */
    get LVL_ERROR() {
        return 'error';
    }

    /**
    * Security log level
    * @const
    * @alias LogFace.LVL_SECURITY
    */
    get LVL_SECURITY() {
        return 'security';
    }

    /**
    * Generate 'ts' field log messages
    * @private
    * @returns {string} current timestamp
    */
    _ts() {
        const d = new Date();

        return d.getUTCFullYear().toString() +
            ( '0' + ( d.getUTCMonth() + 1 ).toString() ).slice( -2 ) +
            ( '0' + d.getUTCDate().toString() ).slice( -2 ) +
            ( '0' + d.getUTCHours().toString() ).slice( -2 ) +
            ( '0' + d.getUTCMinutes().toString() ).slice( -2 ) +
            ( '0' + d.getUTCSeconds().toString() ).slice( -2 ) +
            '.' + d.getUTCMilliseconds().toString();
    }

    /**
    * Log message
    * @param {string} lvl - debug|info|warn|error|security
    * @param {string} txt - message to log
    * @alias LogFace#msg
    */
    msg( lvl, txt ) {
        this._add_queue(
            'msg', {
                lvl : lvl,
                txt : txt,
                ts : this._ts(),
            } );
    }

    /**
    * Log message
    * @param {string} lvl - debug|info|warn|error|security
    * @param {string} txt - message to log
    * @param {string} data - raw data
    * @alias LogFace#hexdump
    */
    hexdump( lvl, txt, data ) {
        this._add_queue(
            'hexdump', {
                lvl : lvl,
                txt : txt,
                ts : this._ts(),
                data : btoa( data ),
            } );
    }

    /**
    * Log message in debug level
    * @param {string} txt - message to log
    * @alias LogFace#debug
    */
    debug( txt ) {
        this.msg( 'debug', txt );
    }

    /**
    * Log message in info level
    * @param {string} txt - message to log
    * @alias LogFace#info
    */
    info( txt ) {
        this.msg( 'info', txt );
    }

    /**
    * Log message in warn level
    * @param {string} txt - message to log
    * @alias LogFace#warn
    */
    warn( txt ) {
        this.msg( 'warn', txt );
    }

    /**
    * Log message in error level
    * @param {string} txt - message to log
    * @alias LogFace#error
    */
    error( txt ) {
        this.msg( 'error', txt );
    }

    /**
    * Log message in security level
    * @param {string} txt - message to log
    * @alias LogFace#security
    */
    security( txt ) {
        this.msg( 'security', txt );
    }

    /**
    * Make sure to keep only one pending async request
    * @private
    * @param {string} func - log/hexdump
    * @param {object} args - call args
    */
    _add_queue( func, args ) {
        const log_queue = this._log_queue;

        log_queue.push( [ func, args ] );

        if ( this._active_runner ) {
            return;
        }

        this._active_runner = true;

        async_steps()
            .add(
                ( as ) => as.loop( ( as ) => {
                    if ( !log_queue.length ) {
                        this._active_runner = false;
                        as.break();
                    }

                    const log_item = log_queue.shift();

                    as.add(
                        ( as ) => {
                            this.call( as, log_item[0], log_item[1] );
                        },
                        ( as, err ) => {
                            console.log( `LOGFAIL: ${log_item}` );
                            console.log( `ERROR: ${err}:${as.state.error_info}` );
                            //console.log( as.state.last_exception.stack );
                            as.success();
                        }
                    );
                } ),
                ( as, err ) => {
                    this._active_runner = false;
                    console.log( `ERROR: ${err}:${as.state.error_info}` );
                    //console.log( as.state.last_exception.stack );
                }
            )
            .execute();
    }
}

module.exports = LogFace;

const specs = {};

LogFace._specs = specs;

/**
 * Embedded spec for FutoIn LogFace
 * @ignore
 */
specs['1.0'] = require( '@futoin/specs/final/meta/futoin.log-1.0-iface.json' );
