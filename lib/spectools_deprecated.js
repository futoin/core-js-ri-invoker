"use strict";

/**
 * @file
 *
 * Copyright 2014-2018 FutoIn Project (https://futoin.org)
 * Copyright 2014-2018 Andrey Galkin <andrey@futoin.org>
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

const common = require( './common' );
const { InvalidRequest } = common.FutoInError;

module.exports = ( spectools ) => {
    const ST = spectools;

    const {
        checkCompiledType,
        checkCompiledTypeVariant,
        _standard_type_info,
    } = ST;

    //=================================
    // Deprecated type checking API
    //=================================

    /**
     * Check if parameter value matches required type
     * @param {Object} info - previously loaded iface
     * @param {string} funcname - function name
     * @param {string} varname - parameter name
     * @param {*} value - value to check
     * @returns {boolean} true on success
     * @alias SpecTools.checkParameterType
     * @deprecated
     */
    const checkParameterType = ( info, funcname, varname, value ) => {
        const vardef = info.funcs[ funcname ].params[ varname ];

        if ( value === null && vardef.default === null ) {
            return true;
        }

        const vartype = ( typeof vardef === 'string' ) ? vardef : vardef.type;

        return checkCompiledTypeVariant( info, vartype, value );
    };

    /**
     * Check if result value matches required type
     * @param {AsyncSteps} as - step interface
     * @param {Object} info - previously loaded iface
     * @param {string} funcname - function name
     * @param {string} varname - result variable name
     * @param {*} value - value to check
     * @alias SpecTools.checkResultType
     * @deprecated
     */
    const checkResultType = ( as, info, funcname, varname, value ) => {
        const vardef = info.funcs[ funcname ].result[ varname ];
        const vartype = ( typeof vardef === 'string' ) ? vardef : vardef.type;

        if ( !checkCompiledTypeVariant( info, vartype, value ) ) {
            const msg = `Type mismatch for result: ${varname}`;

            ST.emit( 'error', msg );
            as.error( InvalidRequest, msg );
        }
    };

    /**
     * @deprecated
     * @ignore
     * @param {AsyncSteps} as - step interface
     * @param {string} type - interface type
     * @param {string} varname - variable name
     * @param {string} value - variable value
     * @throws {FutoInError}
     */
    const checkFutoInType = ( as, type, varname, value ) => {
        if ( !checkCompiledType( as, _standard_type_info, type, value ) ) {
            const msg = `Type mismatch for parameter: ${varname}`;

            ST.emit( 'error', msg );
            as.error( InvalidRequest, msg );
        }
    };

    //=================================
    Object.assign( ST, {
        checkParameterType,
        checkResultType,
        checkFutoInType,
    } );
};
