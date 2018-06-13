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

const _cloneDeep = require( 'lodash/cloneDeep' );
const _zipObject = require( 'lodash/zipObject' );
const _difference = require( 'lodash/difference' );

const common = require( './common' );
const {
    InternalError,
    InvokerError,
} = common.FutoInError;
const { SAFE_PAYLOAD_LIMIT } = common.Options;
const {
    _ifacever_pattern_name,
    _ifacever_pattern_ver,
} = common;

const VERSION_RE = /^([0-9]+)\.([0-9]+)$/;
const IFACE_RE = common._ifacever_pattern;
const FUNC_RE = /^[a-z][a-zA-Z0-9]*$/;
const PARAM_RE = /^[a-z][a-z0-9_]*$/;
const TYPE_RE = /^[A-Z][a-zA-Z0-9]*$/;
const THROWS_RE = /^([A-Z][a-zA-Z0-9]*|[A-Z][A-Z0-9_]*)$/;

const EMPTY_OBJECT = {};
Object.freeze( EMPTY_OBJECT );

const MAX_SUPPORTED_V1_MINOR = 9;

module.exports = ( spectools ) => {
    const ST = spectools;

    const {
        loadIface,
        _checkType,
        checkKnownType,
        checkCompiledTypeVariant,
        compileChecks,
    } = ST;

    //=================================
    // Parsing & validation related API
    //=================================

    /**
     * Parse raw futoin spec (preloaded)
     * @param {AsyncSteps} as - step interface
     * @param {Object} info - destination object with "iface" and "version" fields already set
     * @param {Array} specdirs - each element - search path/url (string) or raw iface (object)
     * @param {Object} raw_spec - iface definition object
     * @param {Object} [load_cache] - cache of already loaded interfaces
     * @alias SpecTools.parseIface
     */
    const parseIface = ( as, info, specdirs, raw_spec, load_cache ) => {
        ST._validateBySchema( as, info, raw_spec );

        // ---
        info.funcs = raw_spec.funcs || {};
        info.types = raw_spec.types || {};

        // Process Constraints
        // ---
        const requires = raw_spec.requires;

        if ( requires ) {
            if ( !Array.isArray( requires ) ) {
                as.error( InternalError, '"requires" is not array' );
            }

            info.constraints = _zipObject( requires, requires );
            Object.freeze( info.constraints );
        } else {
            info.constraints = EMPTY_OBJECT;
        }

        // Process inherited interface
        // ---
        info.inherits = [];
        const inherit = raw_spec.inherit;

        if ( inherit ) {
            const m = inherit.match( IFACE_RE );

            if ( m === null ) {
                as.error( InvokerError,
                    "Invalid inherit ifacever: " + inherit );
            }

            const sup_info = {
                iface : m[ _ifacever_pattern_name ],
                version : m[ _ifacever_pattern_ver ],
                _invoker_use : info._invoker_use,
                _lazy_compile : true,
            };
            loadIface( as, sup_info, specdirs, load_cache );

            as.add( ( as ) => {
                parseImportInherit( as, info, raw_spec, sup_info );

                info.inherits.push( inherit );
                info.inherits = info.inherits.concat( sup_info.inherits );
            } );
        }

        // Process Imports / mixins
        // ---
        let all_imports = raw_spec.imports;

        if ( all_imports ) {
            const imp_load_cache = load_cache || {}; // make sure we always use cache here

            as.forEach( all_imports, ( as, _k, v ) => {
                const m = v.match( IFACE_RE );

                if ( m === null ) {
                    as.error( InvokerError, "Invalid import ifacever: " + v );
                }

                const imp_info = {
                    iface : m[ _ifacever_pattern_name ],
                    version : m[ _ifacever_pattern_ver ],
                    _import_use : true,
                };
                loadIface( as, imp_info, specdirs, imp_load_cache );

                as.add( ( as ) => {
                    all_imports = all_imports.concat( imp_info.imports );
                } );
            } );

            as.add( ( as ) => {
                // 1. Use each imported interface only once
                // 2. Merge compatible interface versions
                const import_candidates = {};

                for ( let i = all_imports.length - 1; i >= 0; --i ) {
                    const imp_ifacever = all_imports[i];
                    const m = imp_ifacever.match( IFACE_RE );
                    const iface = m[ _ifacever_pattern_name ];
                    const ver = m[ _ifacever_pattern_ver ];
                    let curr_ver = import_candidates[iface];

                    if ( curr_ver ) {
                        curr_ver = curr_ver.split( '.' );
                        const new_ver = ver.split( '.' );

                        if ( curr_ver[0] !== new_ver[0] ) {
                            as.error( InvokerError,
                                "Incompatible iface versions: " +
                                        iface + " " +
                                        ver + "/" + import_candidates[iface] );
                        }

                        if ( parseInt( curr_ver[1] ) < parseInt( new_ver[1] ) ) {
                            import_candidates[iface] = ver;
                        }
                    } else {
                        import_candidates[iface] = ver;
                    }
                }

                const imports = info.imports = [];

                as.forEach( import_candidates, ( as, iface, version ) => {
                    imports.push( iface + ':' + version );

                    const imp_info = {
                        iface,
                        version,
                        _import_use : true,
                    };
                    loadIface( as, imp_info, specdirs, imp_load_cache );

                    if ( !info._import_use ) {
                        as.add( ( as ) => {
                            parseImportInherit( as, info, raw_spec, imp_info );
                        } );
                    }
                } );
            } );
        } else {
            info.imports = [];
        }

        as.add( ( as ) => {
            // Process type definitions
            // ---
            parseTypes( as, info );

            // Process function definitions
            // ---
            parseFuncs( as, info );

            // Check "ftn3rev" field
            // ---
            checkFTN3Rev( as, info, raw_spec );

            info._comp_regex = {};
            info._comp_set = {};
            info._comp_type_check = {};
            info._comp_msg_check = {};

            if ( !info._import_use && !info._lazy_compile ) {
                compileChecks( as, info );
            }

            Object.freeze( info.funcs );
            Object.freeze( info.types );
            Object.freeze( info.inherits );
            Object.freeze( info.imports );
            Object.freeze( info );
        } );
    };

    /**
     * @private
     * @param {AsyncSteps} as - _
     * @param {object} info - _
     * @param {object} raw_spec - _
     */
    const checkFTN3Rev = ( as, info, raw_spec ) => {
        const ftn3rev = raw_spec.ftn3rev || '1.0';
        const rv = ftn3rev.match( VERSION_RE );

        if ( rv === null ) {
            as.error( InternalError, "Invalid ftn3rev field" );
        }

        const mjr = parseInt( rv[ 1 ] );
        const mnr = parseInt( rv[ 2 ] );
        const funcs = info.funcs;
        const types = info.types;

        // Check for version-specific features
        // ---
        if ( mjr === 1 ) {
            if ( mnr < 1 ) {
                if ( raw_spec.imports ) {
                    as.error( InternalError,
                        "Import is FTN3 v1.1 feature" );
                }

                if ( raw_spec.types ) {
                    as.error( InternalError,
                        "Custom types is FTN3 v1.1 feature" );
                }

                if ( 'BiDirectChannel' in info.constraints ) {
                    as.error( InternalError,
                        "BiDirectChannel is FTN3 v1.1 feature" );
                }
            }

            if ( mnr < 2 ) {
                if ( 'MessageSignature' in info.constraints ) {
                    as.error( InternalError,
                        "MessageSignature is FTN3 v1.2 feature" );
                }
            }

            if ( mnr < 3 ) {
                for ( let f in funcs ) {
                    if ( funcs[f].seclvl ) {
                        as.error( InternalError,
                            "Function seclvl is FTN3 v1.3 feature" );
                    }
                }
            }

            if ( mnr < 4 ) {
                const check_shortcuts = ( scope ) => {
                    for ( let n in scope ) {
                        const t = scope[n];

                        if ( typeof t === 'string' ) {
                            as.error( InternalError,
                                "Type shortcut is FTN3 v1.4 feature" );
                        } else {
                            const { fields } = t;

                            if ( fields ) {
                                for ( let f in fields ) {
                                    if ( typeof fields[f] === 'string' ) {
                                        as.error( InternalError,
                                            "Type shortcut is FTN3 v1.4 feature" );
                                    }
                                }
                            }
                        }
                    }
                };

                for ( let f in funcs ) {
                    const params = funcs[f].params;

                    if ( params ) {
                        check_shortcuts( params );
                    }

                    const result = funcs[f].result;

                    if ( result && typeof result === 'object' ) {
                        check_shortcuts( result );
                    }
                }

                check_shortcuts( types );
            }

            if ( mnr < 5 ) {
                for ( let t in types ) {
                    const tt = types[t];

                    if ( tt.minlen !== undefined || tt.maxlen !== undefined ) {
                        const ts = {};
                        _checkType( info, t, '', ts );

                        if ( ts['#last_base'] === 'string' ) {
                            as.error( InternalError,
                                "String min/maxlen is FTN3 v1.5 feature" );
                        }
                    }
                }
            }

            if ( mnr < 6 ) {
                for ( let f in funcs ) {
                    const params = funcs[f].params;

                    if ( params ) {
                        for ( let t in params ) {
                            if ( params[t] instanceof Array ) {
                                as.error( InternalError,
                                    "Type variant is FTN3 v1.6 feature" );
                            }
                        }
                    }

                    const result = funcs[f].result;

                    if ( result && typeof result === 'object' ) {
                        for ( let t in result ) {
                            if ( result[t] instanceof Array ) {
                                as.error( InternalError,
                                    "Type variant is FTN3 v1.6 feature" );
                            }
                        }
                    }
                }

                for ( let t in types ) {
                    const tt = types[t];

                    if ( tt instanceof Array ) {
                        as.error( InternalError,
                            "Type variant is FTN3 v1.6 feature" );
                    } else if ( tt === 'enum' || tt === 'set' ||
                         tt.type === 'enum' || tt.type === 'set' ) {
                        as.error( InternalError,
                            "Enum/Set is FTN3 v1.6 feature" );
                    } else if ( tt.elemtype ) {
                        const ts = {};
                        _checkType( info, t, '', ts );

                        if ( ts['#last_base'] === 'map' ) {
                            as.error( InternalError,
                                "Map elemtype is FTN3 v1.6 feature" );
                        }
                    }
                }
            }

            if ( mnr < 7 ) {
                for ( let f in funcs ) {
                    f = funcs[f];

                    if ( f.result && typeof f.result === 'string' ) {
                        as.error( InternalError,
                            "Custom result type FTN3 v1.7 feature" );
                    }
                }
            }

            if ( mnr < 8 ) {
                for ( let f in funcs ) {
                    if ( funcs[f].maxreqsize || funcs[f].maxrspsize ) {
                        as.error( InternalError,
                            "Function maxreqsize/maxrspsize is FTN3 v1.8 feature" );
                    }
                }
            }

            if ( mnr < 9 ) {
                if ( 'BinaryData' in info.constraints ) {
                    as.error( InternalError,
                        "BinaryData is FTN3 v1.9 feature" );
                }

                // ---
                let found_data = false;
                const data_type = 'data';

                for ( let f in funcs ) {
                    const params = funcs[f].params;

                    if ( params ) {
                        for ( let t in params ) {
                            const pt = params[t];

                            if ( pt === data_type || pt.type === data_type ) {
                                found_data = true;
                            }
                        }
                    }

                    const result = funcs[f].result;

                    if ( result && typeof result === 'object' ) {
                        for ( let t in result ) {
                            const rt = result[t];

                            if ( rt === data_type || rt.type === data_type ) {
                                found_data = true;
                            }
                        }
                    }
                }

                for ( let t in types ) {
                    const tt = types[t];

                    if ( ( tt === data_type ) ||
                         ( tt.type === data_type ) ||
                         ( tt.elemtype === data_type ) ||
                         ( ( tt instanceof Array ) && ( tt.indexOf( data_type ) !== -1 ) )
                    ) {
                        found_data = true;
                    }

                    const fields = tt.fields;

                    if ( fields ) {
                        for ( let f in fields ) {
                            const ft = fields[f];

                            if ( ft === data_type ) {
                                found_data = true;
                            }
                        }
                    }
                }

                if ( found_data ) {
                    as.error( InternalError,
                        "'data' type is FTN3 v1.9 feature" );
                }
            }

            if ( mnr < 10 ) {
                // TODO: ...
            }

            // Executor is not allowed to support newer than implemented version (v1.1)
            // ---
            if ( !info._invoker_use &&
                 ( mnr > MAX_SUPPORTED_V1_MINOR ) ) {
                as.error( InternalError, "Not supported FTN3 revision for Executor" );
            }
        } else {
            as.error( InternalError, "Not supported FTN3 revision" );
        }
    };

    /**
     * @private
     * @param {AsyncSteps} as - _
     * @param {object} info - _
     */
    const parseFuncs = ( as, info ) => {
        for ( let f in info.funcs ) {
            if ( !f.match( FUNC_RE ) ) {
                as.error( InternalError,
                    `Invalid function name: ${f}` );
            }

            const finfo = info.funcs[ f ];
            finfo.min_args = 0;

            const fparams = finfo.params;

            if ( fparams ) {
                if ( typeof fparams !== 'object' ) {
                    as.error( InternalError,
                        `Invalid params object: ${f}` );
                }

                for ( let pn in fparams ) {
                    if ( pn.match( PARAM_RE ) === null ) {
                        as.error( InternalError,
                            `Invalid parameter name: ${f}(${pn})` );
                    }

                    const pinfo = fparams[ pn ];

                    if ( typeof pinfo === 'string' ) {
                        finfo.min_args += 1;
                        checkKnownType( as, info, pinfo );
                    } else if ( pinfo instanceof Array ) {
                        finfo.min_args += 1;

                        for ( let pv of pinfo ) {
                            checkKnownType( as, info, pv );
                        }
                    } else {
                        if ( typeof pinfo !== 'object' ) {
                            as.error( InternalError,
                                `Invalid parameter definition: ${f}(${pn})` );
                        }

                        const pt = pinfo.type;

                        if ( pt ) {
                            checkKnownType( as, info, pt );
                        } else {
                            as.error( InternalError, "Missing type for params" );
                        }

                        if ( pinfo.default === undefined ) {
                            // Set even if it was not set!
                            pinfo.default = undefined;
                        } else {
                            finfo.min_args += 1;
                        }

                        Object.freeze( pinfo );
                    }
                }

                Object.freeze( finfo.params );
            } else {
                finfo.params = EMPTY_OBJECT;
            }

            //---
            finfo.expect_result = false;

            const fresult = finfo.result;

            if ( fresult ) {
                if ( typeof fresult === 'string' ) {
                    finfo.expect_result = true;
                    checkKnownType( as, info, fresult );
                } else if ( fresult instanceof Array ) {
                    finfo.expect_result = true;

                    for ( let rv of fresult ) {
                        checkKnownType( as, info, rv );
                    }

                    Object.freeze( fresult );
                } else if ( typeof fresult === 'object' ) {
                    for ( let rn in fresult ) {
                        if ( rn.match( PARAM_RE ) === null ) {
                            as.error( InternalError,
                                `Invalid resultvar name: ${f}(${rn})` );
                        }

                        const rinfo = fresult[ rn ];

                        if ( typeof rinfo === 'string' ) {
                            checkKnownType( as, info, rinfo );
                        } else if ( rinfo instanceof Array ) {
                            for ( let rv of rinfo ) {
                                checkKnownType( as, info, rv );
                            }
                        } else {
                            if ( typeof rinfo !== 'object' ) {
                                as.error( InternalError,
                                    `Invalid resultvar definition: ${f}(${rn})` );
                            }

                            const rt = rinfo.type;

                            if ( rt ) {
                                checkKnownType( as, info, rt );
                            } else {
                                as.error( InternalError,
                                    `Missing type for resultvar: ${f}(${rn})` );
                            }

                            Object.freeze( rinfo );
                        }

                        finfo.expect_result = true;
                    }

                    Object.freeze( fresult );
                } else {
                    as.error( InternalError,
                        `Invalid result object: ${f}` );
                }
            } else {
                finfo.result = EMPTY_OBJECT;
            }

            //---
            if ( !( 'rawupload' in finfo ) ) {
                finfo.rawupload = false;
            }

            if ( !( 'rawresult' in finfo ) ) {
                finfo.rawresult = false;
            }

            //---
            if ( finfo.rawresult ) {
                finfo.expect_result = true;
            }

            //---
            const throws = finfo.throws;

            if ( throws ) {
                if ( !finfo.expect_result ) {
                    as.error( InternalError,
                        `"throws" without result: ${f}` );
                }

                if ( !Array.isArray( throws ) ) {
                    as.error( InternalError,
                        `"throws" is not array: ${f}` );
                }

                for ( let t of throws ) {
                    if ( !t.match( THROWS_RE ) ) {
                        as.error( InternalError,
                            `Invalid "throws": ${t}` );
                    }
                }

                finfo._raw_throws = throws;
                Object.freeze( throws );

                finfo.throws = _zipObject( throws, throws );
                Object.freeze( finfo.throws );
            } else {
                finfo._raw_throws = undefined;
                finfo.throws = EMPTY_OBJECT;
            }

            //---

            finfo._max_req_size = parseSize( finfo.maxreqsize );
            finfo._max_rsp_size = parseSize( finfo.maxrspsize );
            Object.freeze( finfo );
        }
    };

    /**
     * @private
     * @param {AsyncSteps} as - _
     * @param {object} info - _
     */
    const parseTypes = ( as, info ) => {
        for ( let t in info.types ) {
            if ( !t.match( TYPE_RE ) ) {
                as.error( InternalError,
                    `Invalid type name: ${t}` );
            }

            const tinfo = info.types[ t ];

            if ( typeof tinfo === 'string' ) {
                checkKnownType( as, info, tinfo );
            } else if ( tinfo instanceof Array ) {
                for ( let bt of tinfo ) {
                    checkKnownType( as, info, bt );
                }
            } else {
                const base_type = tinfo.type;

                if ( !base_type ) {
                    as.error( InternalError,
                        `Missing "type" for custom type: ${t}` );
                }

                checkKnownType( as, info, base_type );

                const fields = tinfo.fields;

                if ( fields ) {
                    for ( let f in tinfo.fields ) {
                        const fdef = tinfo.fields[ f ];

                        if ( typeof fdef === 'string' ) {
                            checkKnownType( as, info, fdef );
                        } else if ( fdef instanceof Array ) {
                            for ( let bt of fdef ) {
                                checkKnownType( as, info, bt );
                            }
                        } else {
                            const bt = fdef.type;

                            if ( bt ) {
                                checkKnownType( as, info, bt );
                            } else {
                                as.error( InternalError,
                                    `Missing "type" for custom type field: ${t}[${f}]` );
                            }
                        }
                    }

                    Object.freeze( tinfo.fields );
                } else if ( base_type === 'map' ) {
                    tinfo.fields = EMPTY_OBJECT;
                }

                // ---
                const elemtype = tinfo.elemtype;

                if ( elemtype ) {
                    if ( typeof elemtype === 'string' ) {
                        checkKnownType( as, info, elemtype );
                    } else if ( elemtype instanceof Array ) {
                        for ( let et of elemtype ) {
                            checkKnownType( as, info, et );
                        }

                        Object.freeze( elemtype );
                    } else {
                        as.error( InternalError,
                            `Invalid "elemtype" for custom type: ${t}` );
                    }
                }

                // ---
                switch ( base_type ) {
                case 'string':
                    for ( let c of [ 'regex', 'minlen', 'maxlen' ] ) {
                        if ( !( c in tinfo ) ) {
                            tinfo[c] = undefined;
                        }
                    }

                    break;
                case 'integer':
                case 'number':
                    for ( let c of [ 'min', 'max' ] ) {
                        if ( !( c in tinfo ) ) {
                            tinfo[c] = undefined;
                        }
                    }

                    break;
                case 'map':
                    if ( !( 'elemtype' in tinfo ) ) {
                        tinfo.elemtype = undefined;
                    }

                    break;
                case 'array':
                    for ( let c of [ 'elemtype', 'minlen', 'maxlen' ] ) {
                        if ( !( c in tinfo ) ) {
                            tinfo[c] = undefined;
                        }
                    }

                    break;

                case 'set':
                case 'enum': {
                    const items = tinfo.items;

                    if ( items ) {
                        Object.freeze( items );
                    } else {
                        as.error( InternalError,
                            `Missing "items" for ${t}` );
                    }

                    break;
                }
                case 'data':
                    for ( let c of [ 'minlen', 'maxlen' ] ) {
                        if ( !( c in tinfo ) ) {
                            tinfo[c] = undefined;
                        }
                    }

                    break;
                }
                // ---

                Object.freeze( tinfo );
            }
        }
    };


    /**
     * @private
     * @param {AsyncSteps} as - _
     * @param {object} info - _
     * @param {object} raw_spec - _
     * @param {object} sup_info - _
     */
    const parseImportInherit = ( as, info, raw_spec, sup_info ) => {
        for ( let t in sup_info.types ) {
            if ( t in info.types ) {
                as.error( InternalError,
                    `Iface "${info.iface}" type redefinition: ${t}` );
                continue;
            }

            info.types[ t ] = sup_info.types[ t ];
        }

        for ( let f in sup_info.funcs ) {
            const fdef = sup_info.funcs[ f ];

            if ( !( f in info.funcs ) ) {
                const fc = _cloneDeep( fdef );
                fc.throws = fdef._raw_throws;
                info.funcs[ f ] = fc;
                continue;
            }

            const sup_params = fdef.params;
            const params = info.funcs[ f ].params || EMPTY_OBJECT;

            const sup_params_keys = Object.keys( sup_params );
            const params_keys = Object.keys( params );

            if ( params_keys.length < sup_params_keys.length ) {
                as.error( InternalError,
                    `Invalid parameter count for: "${f}"` );
            }

            // Verify that all added params have default value
            for ( let i = sup_params_keys.length; i < params_keys.length; ++i ) {
                const pn = params_keys[ i ];

                if ( !( pn in sup_params ) &&
                     ( params[ pn ].default === undefined )
                ) {
                    as.error( InternalError,
                        `Missing default for "${f}/${pn}"` );
                }
            }

            // Verify parameters are correctly duplicated
            for ( let i = 0; i < sup_params_keys.length; ++i ) {
                const pn = sup_params_keys[ i ];

                if ( pn !== params_keys[ i ] ) {
                    as.error( InternalError,
                        `Invalid parameter order for "${f}/${pn}"` );
                }

                const spdef = sup_params[ pn ];
                const pdef = params[ pn ];

                if ( ( typeof spdef === 'string' && ( spdef !== pdef ) ) ||
                     ( spdef.type && ( spdef.type !== pdef.type ) )
                ) {
                    as.error( InternalError,
                        `Parameter type mismatch "${f}/${pn}"` );
                }
            }

            if ( fdef.rawresult !== ( info.funcs[ f ].rawresult || false ) ) {
                as.error( InternalError,
                    `'rawresult' flag mismatch for "${f}"` );
            }

            if ( fdef.seclvl !== info.funcs[ f ].seclvl ) {
                as.error( InternalError,
                    `'seclvl' mismatch for "${f}"` );
            }

            if ( fdef.rawupload !== ( info.funcs[ f ].rawupload || false ) ) {
                as.error( InternalError,
                    `'rawupload' flag mismatch for "${f}"` );
            }
        }

        const constraint_diff = _difference(
            Object.keys( sup_info.constraints ),
            raw_spec.requires );

        if ( constraint_diff.length ) {
            as.error( InternalError,
                `Missing constraints from inherited: ${constraint_diff}` );
        }
    };

    /**
     * Parse size
     * @param {string} ms - max size value
     * @return {integer} size in bytes
     */
    const parseSize = ( ms ) => {
        if ( ms ) {
            const res = parseInt( ms );
            const str_ms = `${ms}`;

            switch( str_ms[ str_ms.length ? str_ms.length - 1 : 0 ] ) {
            case 'B': return res;
            case 'K': return res << 10;
            case 'M': return res << 20;
            default: throw new Error( `Invalid size specification: ${str_ms}` );
            }
        } else {
            return SAFE_PAYLOAD_LIMIT;
        }
    };


    /**
     * Workaround FTN5 v1.2 Query String parameter coding rules
     * @param {Object} info - previously loaded iface
     * @param {string} name - interface function name
     * @param {object} req - request message
     */
    const normalizeURLParams = ( info, name, req ) => {
        const { params } = info.funcs[name];
        const { p } = req;

        for ( let n in params ) {
            const pinfo = params[n];

            let type = pinfo;

            if ( ( type !== 'string' ) && !( type instanceof Array ) ) {
                type = pinfo.type;
            }

            const val = p[n];

            if ( !checkCompiledTypeVariant( info, type, val ) ) {
                try {
                    p[n] = JSON.parse( val );
                } catch ( _ ) {
                    // ignore
                }
            }
        }
    };


    //=================================
    Object.assign( ST, {
        parseIface,
        parseSize,
        normalizeURLParams,

        _ver_pattern : VERSION_RE,
        _ifacever_pattern : IFACE_RE,
        _type_pattern : TYPE_RE,
        _func_pattern : FUNC_RE,
        _param_pattern : PARAM_RE,

        _max_supported_v1_minor : MAX_SUPPORTED_V1_MINOR,
    } );
};
