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
 * @module futoin-invoker
 */

const common = require( './common' );

require( './JSONCoder' ).register();
require( './CBORCoder' ).register();
require( './MsgPackCoder' ).register();

exports.SimpleCCM = require( '../SimpleCCM' );
exports.AdvancedCCM = require( '../AdvancedCCM' );
exports.FutoInError = common.FutoInError;
exports.Errors = common.FutoInError;
exports.InterfaceInfo = require( '../InterfaceInfo' );
exports.NativeIface = require( '../NativeIface' );
exports.SpecTools = require( '../SpecTools' );
exports.MessageCoder = require( '../MessageCoder' );
exports.MasterAuth = require( '../MasterAuth' );

exports.CacheFace = require( '../CacheFace' );
exports.LogFace = require( '../LogFace' );
exports.PingFace = require( '../PingFace' );

if ( typeof window === 'undefined' ) {
    exports.specDirs = require( '@futoin/specs' ).SPEC_DIRS;
}
