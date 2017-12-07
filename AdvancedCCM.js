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
const _extend = require( 'lodash/extend' );
const AdvancedCCMImpl = require( './lib/AdvancedCCMImpl' );
const SimpleCCM = require( './SimpleCCM' );

/**
 * Advanced CCM - Reference Implementation
 * @param {object} options - see AdvancedCCMOptions
 * @see {@link http://specs.futoin.org/final/preview/ftn7_iface_invoker_concept-1.html FTN7: FutoIn Invoker Concept}
 * @alias AdvancedCCM
 * @class
 * @extends SimpleCCM
 * @see AdvancedCCMOptions
 */
class AdvancedCCM extends SimpleCCM {
    constructor( options ) {
        super( options, new AdvancedCCMImpl( options ) );
    }

    /**
    * Try to load internal registration info from cache
    * DO NOT USE, this is only a compliance with the spec.
    * @param {AsyncSteps} as - AsyncSteps instance as registration may be waiting for external resources
    * @param {string} cache_l1_endpoint - URI or any other resource identifier of iface implementing peer, accepted by CCM implementation
    * @alias AdvancedCCM#initFromCache
    * @ignore
    */
    initFromCache( as, cache_l1_endpoint ) {
        void cache_l1_endpoint;
        as.error( futoin_error.NotImplemented, "Caching is not supported yet" );
    }

    /**
    * Save internal registration info to cache
    * DO NOT USE, this is only a compliance with the spec.
    * @param {AsyncSteps} as - AsyncSteps instance as registration may be waiting for external resources
    * @alias AdvancedCCM#cacheInit
    * @ignore
    */
    cacheInit( as ) {
        void as;
        // Fail silently
    }
}

_extend( AdvancedCCM, common.Options );

module.exports = AdvancedCCM;
