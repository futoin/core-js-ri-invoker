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
const { InternalError, InvokerError, InvalidRequest } = common.FutoInError;

//---
const makeSym = ( typeof Symbol === 'undefined' )
    ? ( name ) => name
    : ( name ) => Symbol( name );

const TYPE_DEF = makeSym( '#tdef' );
const TYPE_PATH = makeSym( '#tp' );

module.exports = ( spectools ) => {
    const ST = spectools;

    const {
        STANDARD_ERRORS,
    } = ST;

    //=================================
    // Check compilation extensions
    //=================================

    const define_func = ( () => {
        try {
            eval( `(() => {});` );
            return ( args ) => `(${args}) => `;
        } catch ( _ ) {
            return ( args ) => `function(${args})`;
        }
    } )();

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

            src.push( `(${define_func( 'info, val' )}{` );
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
                            `(${define_func( 'info, val' )}{`,
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
        let checker = info._comp_msg_check[ func ];

        if ( checker ) {
            return checker;
        }

        const finfo = info.funcs[ func ];

        if ( !finfo ) {
            as.error( InvokerError,
                `Unknown interface function: ${info.iface}:${info.version}:${func}()` );
        }

        checker = {
            req: compileRequestChecker( as, info, func, finfo ),
            rsp: compileResponseChecker( as, info, func, finfo ),
        };
        Object.freeze( checker );

        info._comp_msg_check[ func ] = checker;

        // TODO: workaround until functions are also compiled with induced compileType()
        Object.assign( info._comp_type_check, standard_type_info._comp_type_check );

        return checker;
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
        Object.freeze( info._comp_msg_check );
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

    const checkCompiledTypeVariant = ( info, type, value ) => {
        if ( type instanceof Array ) {
            for ( let t of type ) {
                if ( checkCompiledType( null, info, t, value ) ) {
                    return true;
                }
            }

            return false;
        } else {
            return checkCompiledType( null, info, type, value );
        }
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

    /**
     * Check if request message is valid
     * @param {AsyncSteps} as - AsyncSteps interface
     * @param {Object} info - previously loaded iface
     * @param {string} name - interface function name
     * @param {object} req - request message
     * @returns {Boolean} true on success
     * @alias SpecTools.checkRequestMessage
     */
    const checkRequestMessage = ( as, info, name, req ) => {
        return compileFunc( as, info, name ).req( as, info, req );
    };

    /**
     * Check if response message is valid
     * @param {AsyncSteps} as - AsyncSteps interface
     * @param {Object} info - previously loaded iface
     * @param {string} name - interface function name
     * @param {object} rsp - response message
     * @returns {Boolean} true on success
     * @alias SpecTools.checkResponseMessage
     */
    const checkResponseMessage = ( as, info, name, rsp ) => {
        return compileFunc( as, info, name ).rsp( as, info, rsp );
    };

    const REQ_FIELDS = {
        f : true,
        p : true,
        forcersp : true,
        obf : true,
        rid : true,
        sec : true,
    };
    Object.freeze( REQ_FIELDS );

    const compileRequestChecker = ( as, info, name, finfo ) => {
        const invoker_use = info._invoker_use;

        const res = [
            `(${define_func( 'as, info, req' )}{`,
            `'use strict';`,
            `var p = req.p, val;`,
        ];

        const { params } = finfo;
        const error_code = invoker_use ? InvokerError : InvalidRequest;
        void error_code;

        if ( !Object.keys( params ).length ) {
            const msg = `'No params are defined: ' + req.f + '()'`;
            res.push(
                `if (p && Object.keys(p).length) as.error(error_code, ${msg});`
            );
        } else {
            const unknown_msg = `'Unknown parameter: ' + req.f + '(' + n + ')'`;
            res.push(
                `if ( typeof p !== 'object' ) as.error(error_code, 'Invalid message: p');`,
                `var params = info.funcs.${name}.params;`,
                `for ( var n in p ) {`,
                `  if (!params.hasOwnProperty( n )) as.error(error_code, ${unknown_msg});`,
                `}`,
                `var comp_check = info._comp_type_check;`
            );

            for ( let p in params ) {
                const pinfo = params[p];
                let type;
                let required = true;

                if ( typeof pinfo == 'string' ) {
                    type = [ pinfo ];
                } else if ( pinfo instanceof Array ) {
                    type = pinfo;
                } else {
                    type = pinfo.type;

                    if ( typeof type == 'string' ) {
                        type = [ type ] ;
                    }

                    required = ( pinfo.default === undefined );
                }

                res.push( `val = p.${p};` );

                if ( required ) {
                    const missing_msg = `'Missing parameter: ' + req.f + '(${p})'`;
                    res.push(
                        `if ( typeof val === 'undefined' ) as.error(error_code, ${missing_msg});`
                    );
                } else {
                    // Even for Invoker, send the default of specific interface version
                    res.push(
                        `if ( typeof val === 'undefined' ) {`,
                        `  p.${p} = params.${p}.default;`,
                        `} else `
                    );
                }

                const cond = type.map( ( t ) => `!comp_check.${t}(info, val)` );
                const mismatch_msg = `'Type mismatch for parameter: ' + req.f + '(${p}) = "' + val + '"'`;
                res.push(
                    `if (${cond.join( '&&' )}) as.error(error_code, ${mismatch_msg});`
                );
            }
        }

        res.push(
            `for (var f in req) {`,
            `  if (!REQ_FIELDS.hasOwnProperty(f)) as.error(error_code, 'Unknown request field: ' + f);`,
            `}`
        );

        res.push( 'return true; });' );
        return eval( res.join( '' ) );
    };

    const RSP_FIELDS = {
        r : true,
        e : true,
        edesc : true,
        rid : true,
        sec : true,
    };
    Object.freeze( RSP_FIELDS );

    const compileResponseChecker = ( as, info, name, finfo ) => {
        const invoker_use = info._invoker_use;

        const res = [
            `(${define_func( 'as, info, rsp' )}{`,
            `'use strict';`,
            `var e = rsp.e;`,
            `var finfo = info.funcs.${name};`,
        ];

        //---
        if ( invoker_use ) {
            void STANDARD_ERRORS;
            const unexpected_msg = `'Not expected exception from Executor: ${name}() = ' + e + '(' + (rsp.edesc || '') + ')'`;
            res.push(
                `if ( typeof e !== 'undefined' ) {`,
                `  if ( ( e in finfo.throws ) || ( e in STANDARD_ERRORS ) ) as.error( e, rsp.edesc );`,
                `  else as.error(InternalError, ${unexpected_msg});`,
                `}`
            );
        }

        //---
        if ( finfo.rawresult ) {
            res.push( `as.error(InternalError, 'Raw result is expected: ${name}()');` );
        } else {
            //---
            let { result } = finfo;

            res.push(
                `var comp_check = info._comp_type_check;`,
                `var r = rsp.r;`
            );

            if ( typeof result === 'string' ) {
                result = [ result ];
            }

            if ( result instanceof Array ) {
                const cond = result.map( ( t ) => `!comp_check.${t}(info, r)` );
                const mismatch_msg = `'Result type mismatch: ${name}() = "' + r + '"'`;
                res.push(
                    `if (${cond.join( '&&' )}) as.error(InternalError, ${mismatch_msg});`
                );
            } else if ( !invoker_use && !Object.keys( result ).length ) {
                const notexpected_msg = `'No result variables are expected: ${name}()'`;
                res.push(
                    `if (Object.keys(r).length) as.error(InternalError, ${notexpected_msg});`
                );
            } else {
                const unknown_msg = `'Unknown result variable: ${name}(' + n + ')'`;
                const unknown_act = invoker_use
                    ? `delete r[n]`
                    : `as.error(InternalError, ${unknown_msg})`;
                res.push(
                    `if ( typeof r !== 'object' ) as.error(InternalError, 'Invalid message: r');`,
                    `var result = finfo.result;`,
                    `for ( var n in r ) {`,
                    `  if (!result.hasOwnProperty( n )) ${unknown_act};`,
                    `}`
                );

                for ( let r in result ) {
                    const rinfo = result[r];
                    let type;

                    if ( typeof rinfo == 'string' ) {
                        type = [ rinfo ];
                    } else if ( rinfo instanceof Array ) {
                        type = rinfo;
                    } else {
                        type = rinfo.type;

                        if ( typeof type == 'string' ) {
                            type = [ type ] ;
                        }
                    }

                    res.push( `var val = r.${r};` );

                    const missing_msg = `'Missing result variable: ${name}(${r})'`;
                    res.push(
                        `if ( (typeof val === 'undefined') || !r.hasOwnProperty('${r}') ) as.error(InternalError, ${missing_msg});`
                    );

                    const cond = type.map( ( t ) => `!comp_check.${t}(info, val)` );
                    const mismatch_msg = `'Type mismatch for result variable: ${name}(${r}) = "' + val + '"'`;
                    res.push(
                        `if (${cond.join( '&&' )}) as.error(InternalError, ${mismatch_msg});`
                    );
                }
            }

            //---
            res.push(
                `for (var f in rsp) {`,
                `  if (!RSP_FIELDS.hasOwnProperty(f)) as.error(InternalError, 'Unknown response field: ' + f);`,
                `}`,
                `return true;`
            );
        }

        res.push( '});' );
        return eval( res.join( '' ) );
    };

    //=================================
    Object.assign( ST, {
        compileChecks,
        compileType,
        compileFunc,
        checkCompiledType,
        checkCompiledTypeVariant,
        _standard_type_info: standard_type_info,
        checkRequestMessage,
        checkResponseMessage,
        REQ_FIELDS,
        RSP_FIELDS,
    } );
};
