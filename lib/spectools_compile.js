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

const _zipObject = require( 'lodash/zipObject' );
const _extend = require( 'lodash/extend' );

const common = require( './common' );
const { InternalError } = common.FutoInError;

//---
const makeSym = ( typeof Symbol === 'undefined' )
    ? ( name ) => name
    : ( name ) => Symbol( name );

const TYPE_DEF = makeSym( '#tdef' );
const TYPE_PATH = makeSym( '#tp' );

module.exports = ( spectools ) => {
    const ST = spectools;

    //=================================
    // Check compilation extensions
    //=================================

    const compileType = ( as, info, type ) => {
        // Try pre-compiled
        let checker = info._comp_type_check[ type ];

        if ( checker ) {
            return checker;
        }

        // Try if standard type
        checker = standard_type_info._comp_type_check[type];

        // Otherwise, compile standard type
        if ( !checker ) {
            const src = [];

            src.push( '(function(info, val){' );
            src.push( `'use strict';` );
            src.push( ...compileTypeInner( as, info, type ) );
            src.push( '});' );

            checker = eval( src.join( '' ) );
        }

        info._comp_type_check[ type ] = checker;

        return checker;
    };

    const compileSubCheck = ( as, info, variant, valexpr ) => {
        if ( !( variant instanceof Array ) ) {
            variant = [ variant ];
        }

        const cond = [];

        for ( let type of variant ) {
            compileType( as, info, type );
            cond.push(
                `!comp_type_check.${type}(info, subval)`
            );
        }

        return [
            `subval = ${valexpr};`,
            `if ( ${cond.join( ' && ' )} ) return false;`,
        ];
    };

    const COMPILE_SUBCHECK_COMMON = 'var comp_type_check = info._comp_type_check; var subval;';

    const compileTypeInner = ( as, info, type, _type_stack = {} ) => {
        const tdef = _type_stack[ TYPE_DEF ] || {};
        const type_path = _type_stack[ TYPE_PATH ] || type;

        // Standard Types
        // ---
        switch ( type ) {
        case 'any':
            return [
                `return ( typeof val !== 'undefined' );`,
            ];

        case 'boolean':
            return [
                `return ( typeof val === 'boolean' );`,
            ];

        case 'string': {
            const cond = [
                `( typeof val === 'string' )`,
            ];

            //---
            const { regex, minlen, maxlen } = tdef;

            if ( regex ) {
                const comp_regex = info._comp_regex;
                let regex_obj = comp_regex[ type_path ];

                if ( !regex_obj ) {
                    regex_obj = new RegExp( regex );
                    comp_regex[ type_path ] = regex_obj;
                }

                // NOTE: regex is not put into eval code directly just for the sake of security.
                //       It may be slower, but much safer!
                cond.push(
                    `(val.match(info._comp_regex['${type_path}']) !== null)`
                );
            }

            if ( minlen !== undefined ) {
                cond.push(
                    `( val.length >= ${parseInt( minlen )} )`
                );
            }

            if ( maxlen !== undefined ) {
                cond.push(
                    `( val.length <= ${parseInt( maxlen )} )`
                );
            }

            return [ `return (${cond.join( ' && ' )});` ];
        }

        case 'map': {
            const res = [
                `if ( !val || ( typeof val !== 'object' ) || ( val instanceof Array ) ) return false;`,
            ];

            //---
            const { fields, elemtype } = tdef;

            if ( fields || elemtype ) {
                res.push( COMPILE_SUBCHECK_COMMON );
            }

            //---
            if ( fields ) {
                for ( let f in fields ) {
                    let field_def = fields[ f ];

                    if ( ( typeof field_def === 'string' ) ||
                         ( field_def instanceof Array )
                    ) {
                        field_def = { type: field_def };
                    }

                    if ( field_def.optional ) {
                        if ( info._invoker_use ) {
                            res.push(
                                `if ( ('${f}' in val) && ( val.${f} !== null ) ) {`
                            );
                        } else {
                            res.push(
                                `if ( !('${f}' in val) || ( val.${f} === null ) ) {`,
                                ` val.${f} = null;`,
                                `} else {`
                            );
                        }
                    }

                    res.push( ...compileSubCheck( as, info, field_def.type, `val.${f}` ) );

                    if ( field_def.optional ) {
                        res.push( '}' );
                    }
                }
            }

            //---
            if ( elemtype ) {
                res.push(
                    `for ( var f in val ) {`,
                    ...compileSubCheck( as, info, elemtype, `val[f]` ),
                    `}`
                );
            }

            //---
            res.push( 'return true;' );

            return res;
        }

        case 'integer':
        case 'number': {
            const cond = [
                `( typeof val === 'number' )`,
            ];

            if ( type === 'integer' ) {
                cond.push(
                    `( ( val | 0 ) === val )`
                );
            }

            //---
            const { min, max } = tdef;

            if ( min !== undefined ) {
                cond.push(
                    `( val >= ${( type === 'integer' ) ? parseInt( min ) : parseFloat( min )} )`
                );
            }

            if ( max !== undefined ) {
                cond.push(
                    `( val <= ${( type === 'integer' ) ? parseInt( max ) : parseFloat( max )} )`
                );
            }

            return [ `return (${cond.join( ' && ' )});` ];
        }

        case 'array': {
            const cond = [
                `( val instanceof Array )`,
            ];

            //---
            const { minlen, maxlen, elemtype } = tdef;

            if ( minlen !== undefined ) {
                cond.push(
                    `( val.length >= ${parseInt( minlen )} )`
                );
            }

            if ( maxlen !== undefined ) {
                cond.push(
                    `( val.length <= ${parseInt( maxlen )} )`
                );
            }

            const res = [
                `if (${cond.join( ' && ' )}) {`,
            ];

            //---
            if ( elemtype ) {
                res.push( COMPILE_SUBCHECK_COMMON );
                res.push(
                    `for ( var i = val.length - 1; i >= 0; --i ) {`,
                    ...compileSubCheck( as, info, elemtype, `val[i]` ),
                    `}`
                );
            }
            //---

            res.push( 'return true; } return false;' );
            return res;
        }

        case 'enum':
        case 'set': {
            const comp_set = info._comp_set;
            let set_items = comp_set[ type_path ];

            if ( !set_items ) {
                set_items = tdef.items;

                if ( typeof set_items === 'undefined' ) {
                    as.error( InternalError,
                        `"enum" and "set" require items: ${type_path}` );
                }

                set_items = _zipObject( set_items, set_items );
                comp_set[ type_path ] = set_items;
                Object.freeze( set_items );
            }

            if ( type === 'enum' ) {
                const cond = [
                    `((typeof val === 'string') || ((typeof val === 'number') && ((val|0) === val)))`,
                    `info._comp_set['${type_path}'].hasOwnProperty(val)`,
                ];
                return [
                    `return ${cond.join( ' && ' )};`,
                ];
            } else {
                const cond = [
                    `((typeof subval !== 'string') && (typeof subval !== 'number'))`,
                    `((typeof subval === 'number') && ((subval|0) !== subval))`,
                    `!info._comp_set['${type_path}'].hasOwnProperty(subval)`,
                ];
                return [
                    `if ( !(val instanceof Array) ) return false;`,
                    `for ( var i = val.length - 1, subval; i >= 0; --i ) {`,
                    `subval = val[i];`,
                    `if (${cond.join( ' || ' )}) return false;`,
                    `}`,
                    `return true;`,
                ];
            }
        }

        case 'data': {
            const cond = [
                `( val instanceof Uint8Array )`,
            ];

            //---
            const { minlen, maxlen } = tdef;

            if ( minlen !== undefined ) {
                cond.push(
                    `( val.length >= ${parseInt( minlen )} )`
                );
            }

            if ( maxlen !== undefined ) {
                cond.push(
                    `( val.length <= ${parseInt( maxlen )} )`
                );
            }

            return [ `return (${cond.join( ' && ' )});` ];
        }

        default: {
            // Custom Types
            // ---
            let tdef_part = info.types[ type ];

            if ( tdef_part ) {
                if ( ( typeof tdef_part === 'string' ) ||
                     ( tdef_part instanceof Array )
                ) {
                    tdef_part = { type : tdef_part };
                }

                _type_stack[ TYPE_DEF ] = _extend( {}, tdef_part, tdef );

                // ---
                if ( type in _type_stack ) {
                    as.error( InternalError,
                        `Custom type recursion: ${type_path}` );
                }

                _type_stack[ type ] = true;

                // ---
                const base_type = tdef_part.type;

                if ( base_type instanceof Array ) {
                    const res = [];

                    for ( let vti = base_type.length - 1; vti >= 0; --vti ) {
                        const vtype = base_type[vti];
                        const new_type_stack = _extend( {}, _type_stack );
                        new_type_stack[ TYPE_PATH ] = `${type_path}:${vtype}`;

                        const f = [
                            `(function(info, val){`,
                            ...compileTypeInner( as, info, vtype, new_type_stack ),
                            `})(info, val)`,
                        ];

                        res.push( f.join( '' ) );
                    }

                    return [
                        `return ${res.join( ' || ' )};`,
                    ];
                } else {
                    _type_stack[ TYPE_PATH ] = `${type_path}:${base_type}`;
                    return compileTypeInner( as, info, base_type, _type_stack );
                }
            } else {
                as.error( InternalError,
                    `Missing type:: ${type_path}` );
            }
        }
        }
    };

    const compileFunc = ( as, info, func ) => {
        void info;
        void func;
        // TODO: workaround until functions are also compiled with induced compileType()
        Object.assign( info._comp_type_check, standard_type_info._comp_type_check );
    };

    const compileChecks = ( as, info ) => {
        //---
        for ( let type in info.types ) {
            compileType( as, info, type );
        }

        //---
        for ( let func in info.funcs ) {
            compileFunc( as, info, func );
        }

        //---
        Object.freeze( info._comp_type_check );
        Object.freeze( info._comp_regex );
        Object.freeze( info._comp_set );
        Object.freeze( info._comp_req_check );
        Object.freeze( info._comp_rsp_check );
    };

    /**
     * Check if value matches required type
     * @param {AsyncSteps} as - AsyncSteps interface
     * @param {Object} info - previously loaded iface
     * @param {string} type - standard or custom iface type
     * @param {*} val - value to check
     * @returns {Boolean} true on success
     * @alias SpecTools.checkCompiledType
     */
    const checkCompiledType = ( as, info, type, val ) => {
        return compileType( as, info, type )( info, val );
    };

    //=================================
    const standard_type_info = {
        _comp_type_check : {
            enum : () => false,
            set : () => false,
        },
    };

    for ( let type of [ 'any', 'boolean', 'string', 'integer', 'number', 'map', 'array', 'data' ] ) {
        compileType( null, standard_type_info, type );
    }

    Object.freeze( standard_type_info._comp_type_check );
    Object.freeze( standard_type_info );

    //=================================
    Object.assign( ST, {
        compileChecks,
        compileType,
        compileFunc,
        checkCompiledType,
        _standard_type_info: standard_type_info,
    } );
};
