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

const common = require( './lib/common' );
const { InternalError, InvokerError, InvalidRequest } = common.FutoInError;

let fs;
let request;
const isNode = common._isNode;
const _cloneDeep = require( 'lodash/cloneDeep' );
const _zipObject = require( 'lodash/zipObject' );
const _difference = require( 'lodash/difference' );
const _extend = require( 'lodash/extend' );
const $asyncevent = require( 'futoin-asyncevent' );

if ( isNode ) {
    fs = module.require( 'fs' );
    request = module.require( 'request' );
}

const VERSION_RE = /^([0-9]+)\.([0-9]+)$/;
const IFACE_RE = common._ifacever_pattern;
const FUNC_RE = /^[a-z][a-zA-Z0-9]*$/;
const PARAM_RE = /^[a-z][a-z0-9_]*$/;
const TYPE_RE = /^[A-Z][a-zA-Z0-9]*$/;
const THROWS_RE = /^([A-Z][a-zA-Z0-9]*|[A-Z][A-Z0-9_]*)$/;

const EMPTY_OBJECT = {};
Object.freeze( EMPTY_OBJECT );

/**
 * SpecTools
 * @class
 * @alias SpecTools
 */
const spectools =
{
    /**
     * Enumeration of standard errors
     * @const
     * @alias SpecTools.standard_errors
     */
    standard_errors : {
        UnknownInterface : true,
        NotSupportedVersion : true,
        NotImplemented : true,
        Unauthorized : true,
        InternalError : true,
        InvalidRequest : true,
        DefenseRejected : true,
        PleaseReauth : true,
        SecurityError : true,
    },

    _ver_pattern : VERSION_RE,
    _ifacever_pattern : IFACE_RE,
    _type_pattern : TYPE_RE,
    _func_pattern : FUNC_RE,
    _param_pattern : PARAM_RE,

    _max_supported_v1_minor : 9,

    /**
     * Load FutoIn iface definition.
     *
     * NOTE: Browser uses XHR to load specs, Node.js searches in local fs.
     * @param {AsyncSteps} as - step interface
     * @param {Object} info - destination object with "iface" and "version" fields already set
     * @param {Array} specdirs - each element - search path/url (string) or raw iface (object)
     * @param {Object=} load_cache - arbitrary object to use for caching
     * @alias SpecTools.loadIface
     */
    loadIface : function( as, info, specdirs, load_cache ) {
        let raw_spec = null;
        const fn = `${info.iface}-${info.version}-iface.json`;
        let cached_info;
        let cache_key;

        if ( load_cache ) {
            cache_key = `${info.iface}:${info.version}`;

            if ( info._import_use ) {
                cache_key += ':r';
            } else if ( info._invoker_use ) {
                cache_key += ':i';
            } else {
                cache_key += ':e';
            }

            cached_info = load_cache[ cache_key ];

            if ( cached_info ) {
                _extend( info, cached_info );
                return;
            }

            cached_info = {
                _import_use : info._import_use,
                _invoker_use : info._invoker_use,
            };
        } else {
            cached_info = info;
        }

        as.forEach( specdirs, ( as, _k, v ) => {
            if ( typeof v === 'string' ) {
                if ( isNode ) {
                    as.add( ( read_as ) => {
                        const uri = `${v}/${fn}`;

                        const on_read = ( data, err ) => {
                            if ( !read_as ) {
                                return;
                            }

                            if ( !err ) {
                                try {
                                    v = JSON.parse( data );
                                    read_as.success();
                                    return;
                                } catch ( e ) {
                                    spectools.emit(
                                        'error',
                                        `Invalid JSON for '${uri}": ${e}`
                                    );

                                    try {
                                        as.break();
                                    } catch ( _ ) {
                                        // pass
                                    }
                                }
                            }

                            try {
                                read_as.continue();
                            } catch ( e ) {
                                // ignore
                            }
                        };

                        if ( uri.substr( 0, 4 ) === 'http' ) {
                            request( uri, ( error, _response, body ) => {
                                on_read( body, error );
                            } );
                        } else {
                            fs.readFile(
                                uri,
                                { encoding : 'utf8' },
                                ( err, data ) => {
                                    on_read( data, err );
                                }
                            );
                        }

                        read_as.setCancel( ( as ) => {
                            read_as = null; // see readFile above
                        } );
                    } );
                } else {
                    // Check remote URL in browser
                    as.add( ( as ) => {
                        if ( ( typeof v !== 'string' ) || isNode ) {
                            return;
                        }

                        const uri = `${v}/${fn}`;

                        const httpreq = new XMLHttpRequest(); // jshint ignore:line

                        httpreq.onreadystatechange = function() {
                            if ( this.readyState !== this.DONE ) {
                                return;
                            }

                            const response = this.responseText;

                            if ( ( this.status === 200 ) && response ) {
                                try {
                                    v = JSON.parse( response );
                                    as.success();
                                    return;
                                } catch ( e ) {
                                    spectools.emit(
                                        'error',
                                        `Invalid JSON for '${uri}": ${e}`
                                    );

                                    try {
                                        as.break();
                                    } catch ( _ ) {
                                        // pass
                                    }
                                }
                            }

                            try {
                                as.continue();
                            } catch ( ex ) {
                                // ignore
                            }
                        };

                        httpreq.open( "GET", uri, true );
                        httpreq.send();

                        as.setCancel( ( as ) => {
                            httpreq.abort();
                        } );
                    } );
                }
            }

            // Check object spec
            as.add( ( as ) => {
                if ( ( typeof v === 'object' ) &&
                    ( v.iface === info.iface ) &&
                    ( v.version === info.version )
                ) {
                    raw_spec = _cloneDeep( v );
                    as.break();
                }
            } );
        } );
        as.add( ( as ) => {
            if ( raw_spec === null ) {
                as.error(
                    InternalError,
                    `Failed to load valid spec for ${info.iface}:${info.version}`
                );
            }

            spectools.parseIface( as, cached_info, specdirs, raw_spec, load_cache );
        } );

        if ( load_cache ) {
            as.add( ( as ) => {
                load_cache[ cache_key ] = cached_info;
                _extend( info, cached_info );
            } );
        }
    },

    /**
     * Parse raw futoin spec (preloaded)
     * @param {AsyncSteps} as - step interface
     * @param {Object} info - destination object with "iface" and "version" fields already set
     * @param {Array} specdirs - each element - search path/url (string) or raw iface (object)
     * @param {Object} raw_spec - iface definition object
     * @param {Object} [load_cache] - cache of already loaded interfaces
     * @alias SpecTools.parseIface
     */
    parseIface : function( as, info, specdirs, raw_spec, load_cache ) {
        // Do not damage FutoIn specs passed by value
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

        // Check "ftn3rev" field
        // ---
        spectools._checkFTN3Rev( as, info, raw_spec );

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
                iface : m[ common._ifacever_pattern_name ],
                version : m[ common._ifacever_pattern_ver ],
                _invoker_use : info._invoker_use,
            };
            spectools.loadIface( as, sup_info, specdirs, load_cache );

            as.add( ( as ) => {
                spectools._parseImportInherit( as, info, raw_spec, sup_info );

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
                    iface : m[ common._ifacever_pattern_name ],
                    version : m[ common._ifacever_pattern_ver ],
                    _import_use : true,
                };
                spectools.loadIface( as, imp_info, specdirs, imp_load_cache );

                as.add( ( as ) => {
                    all_imports = all_imports.concat( imp_info.imports );
                } );
            } );

            if ( !info._import_use ) {
                as.add( ( as ) => {
                    // 1. Use each imported interface only once
                    // 2. Merge compatible interface versions
                    const import_candidates = {};

                    for ( let i = all_imports.length - 1; i >= 0; --i ) {
                        const imp_ifacever = all_imports[i];
                        const m = imp_ifacever.match( IFACE_RE );
                        const iface = m[ common._ifacever_pattern_name ];
                        const ver = m[ common._ifacever_pattern_ver ];
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
                        spectools.loadIface( as, imp_info, specdirs, imp_load_cache );

                        as.add( ( as ) => {
                            spectools._parseImportInherit( as, info, raw_spec, imp_info );
                        } );
                    } );
                } );
            } else {
                info.imports = all_imports;
            }
        } else {
            info.imports = [];
        }

        as.add( ( as ) => {
            // Process type definitions
            // ---
            spectools._parseTypes( as, info );

            // Process function definitions
            // ---
            spectools._parseFuncs( as, info );

            info._comp_regex = {};
            info._comp_set = {};

            Object.freeze( info.funcs );
            Object.freeze( info.types );
            Object.freeze( info.inherits );
            Object.freeze( info.imports );
            Object.freeze( info );
        } );
    },

    /**
     * @private
     * @param {AsyncSteps} as - _
     * @param {object} info - _
     * @param {object} raw_spec - _
     */
    _checkFTN3Rev : function( as, info, raw_spec ) {
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
                for ( let f in funcs ) {
                    const params = funcs[f].params;

                    if ( params ) {
                        for ( let t in params ) {
                            if ( typeof params[t] === 'string' ) {
                                as.error( InternalError,
                                    "Type shortcut is FTN3 v1.4 feature" );
                            }
                        }
                    }

                    const result = funcs[f].result;

                    if ( result && typeof result === 'object' ) {
                        for ( let t in result ) {
                            t = result[t];

                            if ( typeof t === 'string' ) {
                                as.error( InternalError,
                                    "Type shortcut is FTN3 v1.4 feature" );
                            } else if ( t.type === 'map' && t.fields ) {
                                for ( t in t.fields ) {
                                    if ( typeof t === 'string' ) {
                                        as.error( InternalError,
                                            "Type shortcut is FTN3 v1.4 feature" );
                                    }
                                }
                            }
                        }
                    }
                }

                for ( let t in types ) {
                    if ( typeof types[t] === 'string' ) {
                        as.error( InternalError,
                            "Type shortcut is FTN3 v1.4 feature" );
                    }
                }
            }

            if ( mnr < 5 ) {
                for ( let t in types ) {
                    const tt = types[t];

                    if ( tt.minlen !== undefined || tt.maxlen !== undefined ) {
                        const ts = {};
                        this._checkType( info, t, '', ts );

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
                        this._checkType( info, t, '', ts );

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
                 ( mnr > spectools._max_supported_v1_minor ) ) {
                as.error( InternalError, "Not supported FTN3 revision for Executor" );
            }
        } else {
            as.error( InternalError, "Not supported FTN3 revision" );
        }
    },

    /**
     * @private
     * @param {AsyncSteps} as - _
     * @param {object} info - _
     */
    _parseFuncs : function( as, info ) {
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
                        this._checkKnownType( as, info, pinfo );
                    } else {
                        if ( typeof pinfo !== 'object' ) {
                            as.error( InternalError,
                                `Invalid parameter definition: ${f}(${pn})` );
                        }

                        const pt = pinfo.type;

                        if ( pt ) {
                            this._checkKnownType( as, info, pt );
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
                    this._checkKnownType( as, info, fresult );
                } else if ( typeof fresult === 'object' ) {
                    for ( let rn in fresult ) {
                        if ( rn.match( PARAM_RE ) === null ) {
                            as.error( InternalError,
                                `Invalid resultvar name: ${f}(${rn})` );
                        }

                        const rinfo = fresult[ rn ];

                        if ( typeof rinfo !== 'string' ) {
                            if ( typeof rinfo !== 'object' ) {
                                as.error( InternalError,
                                    `Invalid resultvar definition: ${f}(${rn})` );
                            }

                            const rt = rinfo.type;

                            if ( rt ) {
                                this._checkKnownType( as, info, rt );
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

            finfo._max_req_size = this._maxSize( finfo.maxreqsize );
            finfo._max_rsp_size = this._maxSize( finfo.maxrspsize );
            Object.freeze( finfo );
        }
    },

    /**
     * @private
     * @param {string} ms - max size value
     * @return {integer} size in bytes
     */
    _maxSize : function( ms ) {
        if ( ms ) {
            const res = parseInt( ms );

            switch( ms[ ms.length ? ms.length - 1 : 0 ] ) {
            case 'K': return res << 10;
            case 'M': return res << 20;
            default: return res;
            }
        } else {
            return common.Options.SAFE_PAYLOAD_LIMIT;
        }
    },

    /**
     * @private
     * @param {AsyncSteps} as - _
     * @param {object} info - _
     */
    _parseTypes : function( as, info ) {
        for ( let t in info.types ) {
            if ( !t.match( TYPE_RE ) ) {
                as.error( InternalError,
                    `Invalid type name: ${t}` );
            }

            const tinfo = info.types[ t ];

            if ( typeof tinfo === 'string' ) {
                this._checkKnownType( as, info, tinfo );
            } else if ( tinfo instanceof Array ) {
                for ( let bt of tinfo ) {
                    this._checkKnownType( as, info, bt );
                }
            } else {
                const base_type = tinfo.type;

                if ( !base_type ) {
                    as.error( InternalError,
                        `Missing "type" for custom type: ${t}` );
                }

                this._checkKnownType( as, info, base_type );

                const fields = tinfo.fields;

                if ( fields ) {
                    for ( let f in tinfo.fields ) {
                        const fdef = tinfo.fields[ f ];

                        if ( typeof fdef === 'string' ) {
                            this._checkKnownType( as, info, fdef );
                        } else if ( fdef instanceof Array ) {
                            for ( let bt of fdef ) {
                                this._checkKnownType( as, info, bt );
                            }
                        } else {
                            const bt = fdef.type;

                            if ( bt ) {
                                this._checkKnownType( as, info, bt );
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
                    this._checkKnownType( as, info, elemtype );
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
    },

    /**
     * Ensure type exists in spec
     * @private
     * @param {AsyncSteps} as - _
     * @param {object} info - _
     * @param {string} name - _
     */
    _checkKnownType( as, info, name ) {
        switch ( name ) {
        case 'any':
        case 'boolean':
        case 'integer':
        case 'number':
        case 'string':
        case 'map':
        case 'array':
        case 'enum':
        case 'set':
        case 'data':
            return;
        }

        if ( !info.types[name] ) {
            as.error( InternalError,
                `Unknown type ${name} in ${info.iface}:${info.version}` );
        }
    },

    /**
     * @private
     * @param {AsyncSteps} as - _
     * @param {object} info - _
     * @param {object} raw_spec - _
     * @param {object} sup_info - _
     */
    _parseImportInherit : function( as, info, raw_spec, sup_info ) {
        for ( let t in sup_info.types ) {
            if ( t in info.types ) {
                as.error( InternalError,
                    `Iface "${info.iface}" type redifintion: ${t}` );
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
    },

    /**
     * Check if value matches required type
     * @param {Object} info - previously loaded iface
     * @param {string} type - standard or custom iface type
     * @param {*} val - value to check
     * @returns {Boolean} true on success
     * @alias SpecTools.checkType
     */
    checkType : function( info, type, val ) {
        return this._checkType( info, type, val );
    },

    /**
     * Check if value matches required type (internal)
     * @private
     * @param {Object} info - previously loaded iface
     * @param {string} type - standard or custom iface type
     * @param {*} val - value to check
     * @param {object} [_type_stack=null] - for internal use only
     * @returns {Boolean} true on success
     */
    _checkType : function( info, type, val, _type_stack ) {
        _type_stack = _type_stack || {};
        const tdef = _type_stack[ '#tdef' ] || {};
        const type_path = _type_stack[ '#tp' ] || type;

        // Standard Types
        // ---
        switch ( type ) {
        case 'any':
            return ( typeof val !== 'undefined' );

        case 'boolean':
            return ( typeof val === type );

        case 'string': {
            if ( typeof val !== type ) {
                return false;
            }

            //---
            const regex = tdef.regex;

            if ( regex ) {
                const comp_regex = info._comp_regex;
                let regex_obj = comp_regex[ type_path ];

                if ( !regex_obj ) {
                    regex_obj = new RegExp( regex );
                    comp_regex[ type_path ] = regex_obj;
                }

                if ( val.match( regex_obj ) === null ) {
                    spectools.emit( 'error',
                        `Regex mismatch for ${type_path}` );

                    return false;
                }
            }

            const val_len = val.length;

            //---
            const minlen = tdef.minlen;

            if ( ( minlen !== undefined ) &&
                 ( val_len < minlen ) ) {
                spectools.emit( 'error',
                    `Value min length "${val_len}" mismatch for ${type_path}` );

                return false;
            }

            //---
            const maxlen = tdef.maxlen;

            if ( ( minlen !== undefined ) &&
                 ( val_len > maxlen ) ) {
                spectools.emit( 'error',
                    `Value max length "${val_len}" mismatch for ${type_path}` );

                return false;
            }

            return true;
        }

        case 'map': {
            if ( ( typeof val !== 'object' ) ||
                 ( val instanceof Array ) ||
                 ( val === null )
            ) {
                return false;
            }

            //---
            const fields = tdef.fields;

            if ( fields ) {
                for ( let f in fields ) {
                    let field_def = fields[ f ];

                    if ( typeof field_def === 'string' ) {
                        field_def = { type : field_def };
                    }

                    if ( !( f in val ) ||
                            ( val[ f ] === null ) ) {
                        if ( field_def.optional ) {
                            val[ f ] = null;
                            continue;
                        }
                    }

                    if ( !this._checkType( info, field_def.type, val[ f ], null ) ) {
                        spectools.emit( 'error',
                            `Field "${f}" value "${val[ f ]}" mismatch for ${type_path}` );

                        return false;
                    }
                }
            }

            //---
            const elemtype = tdef.elemtype;

            if ( elemtype ) {
                for ( let ft in val ) {
                    if ( !this._checkType( info, elemtype, val[ ft ], null ) ) {
                        spectools.emit( 'error',
                            `Value "${val[ ft ]}" mismatch for ${type_path}` );

                        return false;
                    }
                }
            }

            return true;
        }

        case 'integer':
        case 'number': {
            if ( typeof val !== 'number' ) {
                return false;
            }

            if ( ( type === 'integer' ) && ( ( val | 0 ) !== val ) ) {
                return false;
            }

            //---
            const min = tdef.min;

            if ( ( min !== undefined ) && ( val < min ) ) {
                spectools.emit( 'error',
                    `Value min range mismatch for ${type_path}` );

                return false;
            }

            //---
            const max = tdef.max;

            if ( ( max !== undefined ) && ( val > max ) ) {
                spectools.emit( 'error',
                    `Value max range mismatch for ${type_path}` );

                return false;
            }

            return true;
        }

        case 'array': {
            if ( !( val instanceof Array ) ) {
                return false;
            }

            const val_len = val.length;

            //---
            const minlen = tdef.minlen;

            if ( ( minlen !== undefined ) && ( val_len < minlen ) ) {
                spectools.emit( 'error',
                    `Value min length "${val_len}" mismatch for ${type_path}` );

                return false;
            }

            //---
            const maxlen = tdef.maxlen;

            if ( ( maxlen !== undefined ) && ( val_len > maxlen ) ) {
                spectools.emit( 'error',
                    `Value max length "${val_len}" mismatch for ${type_path}` );

                return false;
            }

            //--
            const elemtype = tdef.elemtype;

            if ( elemtype ) {
                for ( let i = 0; i < val_len; ++i ) {
                    // Note, new type stack
                    if ( !this._checkType( info, elemtype, val[ i ], null ) ) {
                        spectools.emit( 'error',
                            `Value "${val[ i ]}" mismatch for ${type_path}` );

                        return false;
                    }
                }
            }

            return true;
        }

        case 'enum':
        case 'set': {
            if ( _type_stack ) {
                if ( type === 'set' && !( val instanceof Array ) ) {
                    return false;
                }
            } else {
                console.log( "[ERROR] enum and set are allowed only in custom types: " + type_path );
                throw new Error( InternalError );
            }

            const comp_set = info._comp_set;
            let set_items = comp_set[ type_path ];

            if ( !set_items ) {
                set_items = tdef.items;

                if ( typeof set_items === 'undefined' ) {
                    console.log( "[ERROR] enum and set require items: " + type_path );
                    throw new Error( InternalError );
                }

                set_items = _zipObject( set_items, set_items );
                comp_set[ type_path ] = set_items;
                Object.freeze( set_items );
            }

            if ( type === 'enum' ) {
                val = [ val ];
            }

            for ( let ii = val.length - 1; ii >= 0; --ii ) {
                const iv = val[ii];

                if ( ( !this._checkType( info, 'string', iv ) &&
                            !this._checkType( info, 'integer', iv ) ) ||
                            !set_items.hasOwnProperty( iv ) ) {
                    spectools.emit( 'error',
                        `No set item "${iv}" for ${type_path}` );
                    return false;
                }
            }

            return true;
        }

        case 'data': {
            if ( !( val instanceof Uint8Array ) ) {
                return false;
            }

            const val_len = val.length;

            //---
            const minlen = tdef.minlen;

            if ( ( minlen !== undefined ) && ( val_len < minlen ) ) {
                spectools.emit( 'error',
                    `Value min length "${val_len}" mismatch for ${type_path}` );

                return false;
            }

            //---
            const maxlen = tdef.maxlen;

            if ( ( maxlen !== undefined ) && ( val_len > maxlen ) ) {
                spectools.emit( 'error',
                    `Value max length "${val_len}" mismatch for ${type_path}` );

                return false;
            }

            return true;
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

                _type_stack[ '#tdef' ] = _extend( {}, tdef_part, tdef );

                // ---
                if ( type in _type_stack ) {
                    console.log( "[ERROR] Custom type recursion: " + type_path );
                    throw new Error( InternalError );
                }

                _type_stack[ type ] = true;

                // ---
                const base_type = tdef_part.type;

                if ( base_type instanceof Array ) {
                    for ( let vti = base_type.length - 1; vti >= 0; --vti ) {
                        const vtype = base_type[vti];
                        const new_type_stack = _extend( {}, _type_stack );
                        new_type_stack[ '#tp' ] = `${type_path}:${vtype}`;

                        if ( this._checkType( info, vtype, val, new_type_stack ) ) {
                            return true;
                        }
                    }

                    return false;
                } else {
                    _type_stack['#last_base'] = base_type; // see FTN3 rev check
                    _type_stack['#tp'] = `${type_path}:${base_type}`;
                    return this._checkType( info, base_type, val, _type_stack );
                }
            } else {
                console.log( "[ERROR] missing type: " + type );
                throw new Error( InternalError );
            }
        }
        }
    },

    /**
     * Check if parameter value matches required type
     * @param {Object} info - previously loaded iface
     * @param {string} funcname - function name
     * @param {string} varname - parameter name
     * @param {*} value - value to check
     * @returns {boolean} true on success
     * @alias SpecTools.checkParameterType
     */
    checkParameterType : function( info, funcname, varname, value ) {
        const vardef = info.funcs[ funcname ].params[ varname ];

        if ( value === null && vardef.default === null ) {
            return true;
        }

        const vartype = ( typeof vardef === 'string' ) ? vardef : vardef.type;

        return spectools._checkType( info, vartype, value );
    },

    /**
     * Check if result value matches required type
     * @param {AsyncSteps} as - step interface
     * @param {Object} info - previously loaded iface
     * @param {string} funcname - function name
     * @param {string} varname - result variable name
     * @param {*} value - value to check
     * @alias SpecTools.checkResultType
     */
    checkResultType : function( as, info, funcname, varname, value ) {
        const vardef = info.funcs[ funcname ].result[ varname ];
        const vartype = ( typeof vardef === 'string' ) ? vardef : vardef.type;

        if ( !spectools._checkType( info, vartype, value ) ) {
            const msg = `Type mismatch for result: ${varname}`;

            spectools.emit( 'error', msg );
            as.error( InvalidRequest, msg );
        }
    },

    /**
     * @deprecated
     * @ignore
     * @param {AsyncSteps} as - step interface
     * @param {string} type - interface type
     * @param {string} varname - variable name
     * @param {string} value - variable value
     * @throws {FutoInError}
     */
    checkFutoInType : function( as, type, varname, value ) {
        if ( !spectools._checkType( {}, type, value ) ) {
            const msg = `Type mismatch for parameter: ${varname}`;

            spectools.emit( 'error', msg );
            as.error( InvalidRequest, msg );
        }
    },

    /**
     * Generate HMAC
     *
     * NOTE: for simplicity, 'sec' field must not be present
     * @param {AsyncSteps} as - step interface
     * @param {object} info - Interface raw info object
     * @param {object} ftnreq - Request Object
     * @returns {Buffer} Binary HMAC signature
     * @throws {FutoInError}
     */
    genHMAC : function( as, info, ftnreq ) {
        void as;
        void info;
        void ftnreq;
        as.error( InvalidRequest, "HMAC generation is supported only for server environment" );
        return {}; // suppress eslint
    },

    /**
     * Secure compare to cover time-based side-channels for attacks
     * @note Pure JS is used in browser and crypto-based in Node.js
     * @param {string} a - first string
     * @param {string} b - second String
     * @returns {boolean} true, if match
     */
    secureEquals( a, b ) {
        let res = a.length - b.length;

        for ( let i = Math.min( a.length, b.length ) - 1; i >= 0; --i ) {
            res |= a.charCodeAt( i ) ^ b.charCodeAt( i );
        }

        return ( res === 0 );
    },

    /**
     * Call after loading all depedency modules.
     *
     * Mitigates CVE-2018-3721 and similar.
     */
    secureObjectPrototype() {
        // CVE-2018-3721
        Object.freeze( Object.prototype );
    },
};

if ( isNode ) {
    module.require( './lib/node/spectools_hmac' )( spectools );
}

$asyncevent( spectools, [ 'error' ] );

/**
 * On error message for details in debugging.
 * @event SpecTools.error
 */

Object.freeze( spectools );

module.exports = spectools;
