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

/**
 * FutoIn interface info
 * @alias InterfaceInfo
 * @param {object} raw_info - futoin spec as is
 * @class
 */
class InterfaceInfo {
    constructor( raw_info ) {
        this._raw_info = raw_info;
    }

    /**
    * Get FutoIn interface name
    * @returns {string} name
    * @alias InterfaceInfo#name
    */
    name() {
        return this._raw_info.iface;
    }

    /**
    * Get FutoIn interface version
    * @returns {string} version
    * @alias InterfaceInfo#version
    */
    version() {
        return this._raw_info.version;
    }

    /**
    * Get list of inherited interfaces starting from the most derived, may be null
    * @returns {string} inherited interface name-ver
    * @alias InterfaceInfo#inherits
    */
    inherits() {
        return this._raw_info.inherits;
    }

    /**
    * Get list of available functions, may be null
    * @returns {object} list of functions
    * @alias InterfaceInfo#funcs
    */
    funcs() {
        return this._raw_info.funcs;
    }

    /**
    * Get list of interface constraints, may be null
    * @returns {array} list of constraints
    * @alias InterfaceInfo#constraints
    */
    constraints() {
        return this._raw_info.constraints;
    }
}

module.exports = InterfaceInfo;
