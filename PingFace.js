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

const NativeFace = require( './NativeIface' );

/**
 * Base for FTN4 ping-based interfaces
 */
class PingFace extends NativeFace {
    ping( as, echo ) {
        this.call( as, 'ping', { echo } );
        as.add( function( as, rsp ) {
            as.success( rsp.echo );
        } );
    }

    /**
     * Register ping interface
     * @param {AsyncSteps} as - step interface
     * @param {AdvancedCCM} ccm - CCM instance
     * @param {string} name - registration name for CCM
     * @param {string} endpoint - endpoint URL
     * @param {*} [credentials=null] - see CCM register()
     * @param {object} [options={}] - registration options
     * @param {string} [options.version=1.0] - iface version
     * @note Iface spec is embedded
     */
    static register( as, ccm, name, endpoint, credentials=null, options={} ) {
        const ifacever = options.version || '1.0';
        const iface = this.spec( ifacever );

        options.nativeImpl = this;
        options.specDirs = [ iface ];

        ccm.register(
            as,
            name,
            iface.iface + ':' + ifacever,
            endpoint,
            credentials,
            options
        );
    }
}

module.exports = PingFace;

const specs = {};
PingFace._specs = specs;

PingFace._specs['1.0'] = {
    iface : "futoin.ping",
    version : "1.0",
    ftn3rev : "1.1",
    funcs : {
        ping : {
            params : {
                echo : {
                    type : "integer",
                    desc : "Arbitrary integer",
                },
            },
            result : {
                echo : {
                    type : "integer",
                    desc : "See params",
                },
            },
            desc : "Check if peer is accessible",
        },
    },
    desc : "Ping-pong interface",
};
