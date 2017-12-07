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

const async_steps = require( 'futoin-asyncsteps' );

/** @ignore */
exports.AsyncSteps = async_steps;
/** @ignore */
exports.FutoInError = async_steps.FutoInError;

/** @ignore */
exports.Options =
{
    /**
     * Maximum FutoIn message payload size (not related to raw data)
     * @alias SimpleCCM.SAFE_PAYLOAD_LIMIT
     * @const
     * @default 65536
     */
    SAFE_PAYLOAD_LIMIT : 65536,

    /**
     * Runtime iface resolution v1.x
     * @alias SimpleCCM.SVC_RESOLVER
     * @const
     */
    SVC_RESOLVER : '#resolver',

    /**
     * AuthService v1.x
     * @alias SimpleCCM.SVC_AUTH
     * @const
     */
    SVC_AUTH : '#auth',

    /**
     * Defense system v1.x
     * @alias SimpleCCM.SVC_DEFENSE
     * @const
     */
    SVC_DEFENSE : '#defense',

    /**
     * Access Control system v1.x
     * @alias SimpleCCM.SVC_ACL
     * @const
     */
    SVC_ACL : '#acl',

    /**
     * Audit Logging v1.x
     * @alias SimpleCCM.SVC_LOG
     * @const
     */
    SVC_LOG : '#log',

    /**
     * cache v1.x iface name prefix
     * @alias SimpleCCM.SVC_CACHE_
     * @const
     */
    SVC_CACHE_ : "#cache.",

    /**
     * @private
     * @const
     */
    FUTOIN_CONTENT_TYPE : 'application/futoin+json',
};

/** @ignore */
exports._ifacever_pattern = /^(([a-z][a-z0-9]*)(\.[a-z][a-z0-9]*)*):(([0-9]+)\.([0-9]+))$/;
exports._ifacever_pattern_name = 1;
exports._ifacever_pattern_ver = 4;
exports._ifacever_pattern_mjr = 5;
exports._ifacever_pattern_mnr = 6;
/** @ignore */
exports._isNode = ( typeof window === 'undefined' ) && require( 'detect-node' );
