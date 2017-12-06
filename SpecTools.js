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

var common = require( './lib/common' );
var FutoInError = common.FutoInError;

var fs;
var request;
var isNode = common._isNode;
var _cloneDeep = require( 'lodash/cloneDeep' );
var _zipObject = require( 'lodash/zipObject' );
var _difference = require( 'lodash/difference' );
var _extend = require( 'lodash/extend' );
var ee = require( 'event-emitter' );

if ( isNode )
{
    fs = module.require( 'fs' );
    request = module.require( 'request' );
}

/**
 * SpecTools
 * @class
 * @alias SpecTools
 */
var spectools =
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

    _ver_pattern : /^([0-9]+)\.([0-9]+)$/,
    _ifacever_pattern : common._ifacever_pattern,

    _max_supported_v1_minor : 8,

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
    loadIface : function( as, info, specdirs, load_cache )
    {
        var raw_spec = null;
        var fn = info.iface + '-' + info.version + '-iface.json';
        var cached_info;
        var cache_key;

        if ( load_cache )
        {
            cache_key = info.iface + ':' + info.version;

            if ( info._import_use )
            {
                cache_key += ':r';
            }
            else if ( info._invoker_use )
            {
                cache_key += ':i';
            }
            else
            {
                cache_key += ':e';
            }

            cached_info = load_cache[ cache_key ];

            if ( cached_info )
            {
                _extend( info, cached_info );
                return;
            }

            cached_info = {
                _import_use : info._import_use,
                _invoker_use : info._invoker_use,
            };
        }
        else
        {
            cached_info = info;
        }

        as.forEach( specdirs, function( as, _k, v )
        {
            // Check Node.js fs
            as.add( function( read_as )
            {
                if ( ( typeof v !== 'string' ) ||
                     !isNode )
                {
                    return;
                }

                var uri = v + '/' + fn;

                var on_read = function( data, err )
                {
                    if ( !read_as )
                    {
                        return;
                    }

                    if ( !err )
                    {
                        try
                        {
                            v = JSON.parse( data );
                            v._just_loaded = true;
                            read_as.success();
                            return;
                        }
                        catch ( e )
                        {
                            // ignore
                        }
                    }

                    try
                    {
                        read_as.continue();
                    }
                    catch ( e )
                    {
                        // ignore
                    }
                };

                if ( uri.substr( 0, 4 ) === 'http' )
                {
                    request( uri, function( error, _response, body )
                    {
                        on_read( body, error );
                    } );
                }
                else
                {
                    fs.readFile(
                        uri,
                        { encoding : 'utf8' },
                        function( err, data )
                        {
                            on_read( data, err );
                        }
                    );
                }

                read_as.setCancel( function( as )
                {
                    void as;
                    read_as = null; // see readFile above
                } );
            } )
            // Check remote URL in browser
                .add( function( as )
                {
                    if ( ( typeof v !== 'string' ) ||
                     isNode )
                    {
                        return;
                    }

                    var uri = v + '/' + fn;

                    var httpreq = new XMLHttpRequest(); // jshint ignore:line

                    httpreq.onreadystatechange = function()
                    {
                        if ( this.readyState !== this.DONE )
                        {
                            return;
                        }

                        var response = this.responseText;

                        if ( response )
                        {
                            try
                            {
                                v = JSON.parse( response );
                                v._just_loaded = true;
                                as.success();
                                return;
                            }
                            catch ( e )
                            {
                                // ignore
                            }
                        }

                        try
                        {
                            as.continue();
                        }
                        catch ( ex )
                        {
                            // ignore
                        }
                    };

                    httpreq.open( "GET", uri, true );
                    httpreq.send();

                    as.setCancel( function( as )
                    {
                        void as;
                        httpreq.abort();
                    } );
                } )
            // Check object spec
                .add( function( as )
                {
                    if ( ( typeof v === 'object' ) &&
                    ( v.iface === info.iface ) &&
                    ( v.version === info.version ) )
                    {
                        raw_spec = v;
                        as.break();
                    }
                } );
        } )
            .add( function( as )
            {
                if ( raw_spec === null )
                {
                    as.error(
                        FutoInError.InternalError,
                        "Failed to load valid spec for " + info.iface + ":" + info.version
                    );
                }

                spectools.parseIface( as, cached_info, specdirs, raw_spec, load_cache );
            } );

        if ( load_cache )
        {
            as.add( function( as )
            {
                void as;
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
    parseIface : function( as, info, specdirs, raw_spec, load_cache )
    {
        // Do not damage FutoIn specs passed by value
        // ---
        if ( raw_spec._just_loaded )
        {
            info.funcs = raw_spec.funcs || {};
            info.types = raw_spec.types || {};
        }
        else
        {
            info.funcs = _cloneDeep( raw_spec.funcs || {} );
            info.types = _cloneDeep( raw_spec.types || {} );
        }

        // Process function definitions
        // ---
        spectools._parseFuncs( as, info );

        // Process type definitions
        // ---
        spectools._parseTypes( as, info );

        // Process Constraints
        // ---
        if ( 'requires' in raw_spec )
        {
            var requires = raw_spec.requires;

            if ( !Array.isArray( requires ) )
            {
                as.error( FutoInError.InternalError, '"requires" is not array' );
            }

            info.constraints = _zipObject( requires, requires );
        }
        else
        {
            info.constraints = {};
        }

        // Check "ftn3rev" field
        // ---
        spectools._checkFTN3Rev( as, info, raw_spec );

        // Process inherited interface
        // ---
        info.inherits = [];

        if ( 'inherit' in raw_spec )
        {
            var m = raw_spec.inherit.match( common._ifacever_pattern );

            if ( m === null )
            {
                as.error( FutoInError.InvokerError,
                    "Invalid inherit ifacever: " + raw_spec.inherit );
            }

            var sup_info = {};

            sup_info.iface = m[ common._ifacever_pattern_name ];
            sup_info.version = m[ common._ifacever_pattern_ver ];
            sup_info._invoker_use = info._invoker_use;
            spectools.loadIface( as, sup_info, specdirs, load_cache );

            as.add( function( as )
            {
                spectools._parseImportInherit( as, info, raw_spec, sup_info );

                info.inherits.push( raw_spec.inherit );
                info.inherits = info.inherits.concat( sup_info.inherits );
            } );
        }

        // Process Imports / mixins
        // ---
        if ( 'imports' in raw_spec )
        {
            var iface_pattern = common._ifacever_pattern;
            var imp_load_cache = load_cache || {}; // make sure we always use cache here

            info.imports = raw_spec.imports.slice();

            as.forEach( raw_spec.imports, function( as, _k, v )
            {
                var m = v.match( iface_pattern );

                if ( m === null )
                {
                    as.error( FutoInError.InvokerError, "Invalid import ifacever: " + v );
                }

                var imp_info = {};

                imp_info.iface = m[ common._ifacever_pattern_name ];
                imp_info.version = m[ common._ifacever_pattern_ver ];
                imp_info._import_use = true;
                spectools.loadIface( as, imp_info, specdirs, imp_load_cache );

                as.add( function( as )
                {
                    void as;
                    info.imports = info.imports.concat( imp_info.imports );
                } );
            } );

            if ( !info._import_use )
            {
                as.add( function( as )
                {
                    // 1. Use each imported interface only once
                    // 2. Merge compatible interface versions
                    var import_candidates = {};

                    for ( var i = info.imports.length - 1; i >= 0; --i )
                    {
                        var imp_ifacever = info.imports[i];
                        var m = imp_ifacever.match( iface_pattern );
                        var iface = m[ common._ifacever_pattern_name ];
                        var ver = m[ common._ifacever_pattern_ver ];
                        var curr_ver = import_candidates[iface];

                        if ( curr_ver )
                        {
                            curr_ver = curr_ver.split( '.' );
                            var new_ver = ver.split( '.' );

                            if ( curr_ver[0] !== new_ver[0] )
                            {
                                as.error( FutoInError.InvokerError,
                                    "Incompatible iface versions: " +
                                          iface + " " +
                                          ver + "/" + import_candidates[iface] );
                            }

                            if ( parseInt( curr_ver[1] ) < parseInt( new_ver[1] ) )
                            {
                                import_candidates[iface] = ver;
                            }
                        }
                        else
                        {
                            import_candidates[iface] = ver;
                        }
                    }

                    info.imports = [];

                    as.forEach( import_candidates, function( as, iface, ver )
                    {
                        info.imports.push( iface + ':' + ver );

                        var imp_info = {};

                        imp_info.iface = iface;
                        imp_info.version = ver;
                        imp_info._import_use = true;
                        spectools.loadIface( as, imp_info, specdirs, imp_load_cache );

                        as.add( function( as )
                        {
                            spectools._parseImportInherit( as, info, raw_spec, imp_info );
                        } );
                    } );
                } );
            }
        }
        else
        {
            info.imports = [];
        }
    },

    /**
     * @private
     * @param {AsyncSteps} as - _
     * @param {object} info - _
     * @param {object} raw_spec - _
     */
    _checkFTN3Rev : function( as, info, raw_spec )
    {
        var ftn3rev = raw_spec.ftn3rev || '1.0';
        var rv = ftn3rev.match( spectools._ver_pattern );

        if ( rv === null )
        {
            as.error( FutoInError.InternalError, "Invalid ftn3rev field" );
        }

        var mjr = parseInt( rv[ 1 ] );
        var mnr = parseInt( rv[ 2 ] );
        var funcs = info.funcs;
        var f;
        var tmp;
        var t;
        var tt;
        var ts;

        // Check for version-specific features
        // ---
        if ( mjr === 1 )
        {
            if ( mnr < 1 )
            {
                if ( raw_spec.imports )
                {
                    as.error( FutoInError.InternalError,
                        "Import is FTN3 v1.1 feature" );
                }

                if ( raw_spec.types )
                {
                    as.error( FutoInError.InternalError,
                        "Custom types is FTN3 v1.1 feature" );
                }

                if ( 'BiDirectChannel' in info.constraints )
                {
                    as.error( FutoInError.InternalError,
                        "BiDirectChannel is FTN3 v1.1 feature" );
                }
            }

            if ( mnr < 2 )
            {
                if ( 'MessageSignature' in info.constraints )
                {
                    as.error( FutoInError.InternalError,
                        "MessageSignature is FTN3 v1.2 feature" );
                }
            }

            if ( mnr < 3 )
            {
                for ( f in funcs )
                {
                    if ( funcs[f].seclvl )
                    {
                        as.error( FutoInError.InternalError,
                            "Function seclvl is FTN3 v1.3 feature" );
                    }
                }
            }

            if ( mnr < 4 )
            {
                for ( f in funcs )
                {
                    tmp = funcs[f].params;

                    if ( tmp )
                    {
                        for ( t in tmp )
                        {
                            if ( typeof tmp[t] === 'string' )
                            {
                                as.error( FutoInError.InternalError,
                                    "Type shortcut is FTN3 v1.4 feature" );
                            }
                        }
                    }

                    tmp = funcs[f].result;

                    if ( tmp && typeof tmp === 'object' )
                    {
                        for ( t in tmp )
                        {
                            t = tmp[t];

                            if ( typeof t === 'string' )
                            {
                                as.error( FutoInError.InternalError,
                                    "Type shortcut is FTN3 v1.4 feature" );
                            }
                            else if ( t.type === 'map' && t.fields )
                            {
                                for ( t in t.fields )
                                {
                                    if ( typeof t === 'string' )
                                    {
                                        as.error( FutoInError.InternalError,
                                            "Type shortcut is FTN3 v1.4 feature" );
                                    }
                                }
                            }
                        }
                    }
                }

                tmp = info.types;

                for ( t in tmp )
                {
                    if ( typeof tmp[t] === 'string' )
                    {
                        as.error( FutoInError.InternalError,
                            "Type shortcut is FTN3 v1.4 feature" );
                    }
                }
            }

            if ( mnr < 5 )
            {
                tmp = info.types;

                for ( t in tmp )
                {
                    tt = tmp[t];

                    if ( tt.minlen !== undefined || tt.maxlen !== undefined )
                    {
                        ts = {};
                        this._checkType( info, t, '', ts );

                        if ( ts['#last_base'] === 'string' )
                        {
                            as.error( FutoInError.InternalError,
                                "String min/maxlen is FTN3 v1.5 feature" );
                        }
                    }
                }
            }

            if ( mnr < 6 )
            {
                for ( f in funcs )
                {
                    tmp = funcs[f].params;

                    if ( tmp )
                    {
                        for ( t in tmp )
                        {
                            if ( tmp[t] instanceof Array )
                            {
                                as.error( FutoInError.InternalError,
                                    "Type variant is FTN3 v1.6 feature" );
                            }
                        }
                    }

                    tmp = funcs[f].result;

                    if ( tmp && typeof tmp === 'object' )
                    {
                        for ( t in tmp )
                        {
                            if ( tmp[t] instanceof Array )
                            {
                                as.error( FutoInError.InternalError,
                                    "Type variant is FTN3 v1.6 feature" );
                            }
                        }
                    }
                }

                tmp = info.types;

                for ( t in tmp )
                {
                    tt = tmp[t];

                    if ( tt instanceof Array )
                    {
                        as.error( FutoInError.InternalError,
                            "Type variant is FTN3 v1.6 feature" );
                    }
                    else if ( tt === 'enum' || tt === 'set' ||
                         tt.type === 'enum' || tt.type === 'set' )
                    {
                        as.error( FutoInError.InternalError,
                            "Enum/Set is FTN3 v1.6 feature" );
                    }
                    else if ( tt.elemtype !== undefined )
                    {
                        ts = {};
                        this._checkType( info, t, '', ts );

                        if ( ts['#last_base'] === 'map' )
                        {
                            as.error( FutoInError.InternalError,
                                "Map elemtype is FTN3 v1.6 feature" );
                        }
                    }
                }
            }

            if ( mnr < 7 )
            {
                for ( f in funcs )
                {
                    f = funcs[f];

                    if ( f.result && typeof f.result === 'string' )
                    {
                        as.error( FutoInError.InternalError,
                            "Custom result type FTN3 v1.7 feature" );
                    }
                }
            }

            if ( mnr < 8 )
            {
                for ( f in funcs )
                {
                    if ( funcs[f].maxreqsize || funcs[f].maxrspsize )
                    {
                        as.error( FutoInError.InternalError,
                            "Function maxreqsize/maxrspsize is FTN3 v1.8 feature" );
                    }
                }
            }

            if ( mnr < 9 )
            {
                // TODO
            }

            // Executor is not allowed to support newer than implemented version (v1.1)
            // ---
            if ( !info._invoker_use &&
                 ( mnr > spectools._max_supported_v1_minor ) )
            {
                as.error( FutoInError.InternalError, "Not supported FTN3 revision for Executor" );
            }
        }
        else
        {
            as.error( FutoInError.InternalError, "Not supported FTN3 revision" );
        }
    },

    /**
     * @private
     * @param {AsyncSteps} as - _
     * @param {object} info - _
     */
    _parseFuncs : function( as, info )
    {
        var finfo;
        var pn;

        for ( var f in info.funcs )
        {
            finfo = info.funcs[ f ];
            finfo.min_args = 0;

            if ( 'params' in finfo )
            {
                var fparams = finfo.params;

                if ( typeof fparams !== 'object' )
                {
                    as.error( FutoInError.InternalError, "Invalid params object" );
                }

                for ( pn in fparams )
                {
                    var pinfo = fparams[ pn ];

                    if ( typeof pinfo === 'string' )
                    {
                        finfo.min_args += 1;
                    }
                    else
                    {
                        if ( typeof pinfo !== 'object' )
                        {
                            as.error( FutoInError.InternalError, "Invalid param object" );
                        }

                        if ( !( 'type' in pinfo ) )
                        {
                            as.error( FutoInError.InternalError, "Missing type for params" );
                        }

                        if ( !( 'default' in pinfo ) )
                        {
                            finfo.min_args += 1;
                        }
                    }
                }
            }
            else
            {
                finfo.params = {};
            }

            finfo.expect_result = false;

            if ( 'result' in finfo )
            {
                var fresult = finfo.result;

                if ( typeof fresult === 'string' )
                {
                    finfo.expect_result = true;
                }
                else if ( typeof fresult == 'object' )
                {
                    for ( var rn in fresult )
                    {
                        var rinfo = fresult[ rn ];

                        if ( typeof rinfo !== 'string' )
                        {
                            if ( typeof rinfo !== 'object' )
                            {
                                as.error( FutoInError.InternalError, "Invalid resultvar object" );
                            }

                            if ( !( 'type' in rinfo ) )
                            {
                                as.error( FutoInError.InternalError, "Missing type for result" );
                            }
                        }

                        finfo.expect_result = true;
                    }
                }
                else
                {
                    as.error( FutoInError.InternalError, "Invalid result object" );
                }
            }
            else
            {
                finfo.result = {};
            }

            if ( !( 'rawupload' in finfo ) )
            {
                finfo.rawupload = false;
            }

            if ( !( 'rawresult' in finfo ) )
            {
                finfo.rawresult = false;
            }

            if ( finfo.rawresult )
            {
                finfo.expect_result = true;
            }

            if ( 'throws' in finfo )
            {
                if ( !finfo.expect_result )
                {
                    as.error( FutoInError.InternalError, '"throws" without result' );
                }

                var throws = finfo.throws;

                if ( !Array.isArray( throws ) )
                {
                    as.error( FutoInError.InternalError, '"throws" is not array' );
                }

                finfo.throws = _zipObject( throws, throws );
            }
            else
            {
                finfo.throws = {};
            }

            finfo._max_req_size = this._maxSize( finfo.maxreqsize );
            finfo._max_rsp_size = this._maxSize( finfo.maxrspsize );
        }
    },

    /**
     * @private
     * @param {string} ms - max size value
     * @return {integer} size in bytes
     */
    _maxSize : function( ms )
    {
        if ( ms )
        {
            var res = parseInt( ms );

            switch( ms[ ms.length ? ms.length - 1 : 0 ] )
            {
            case 'K': return res << 10;
            case 'M': return res << 20;
            default: return res;
            }
        }
        else
        {
            return common.Options.SAFE_PAYLOAD_LIMIT;
        }
    },

    /**
     * @private
     * @param {AsyncSteps} as - _
     * @param {object} info - _
     */
    _parseTypes : function( as, info )
    {
        var tinfo;

        for ( var t in info.types )
        {
            tinfo = info.types[ t ];

            if ( typeof tinfo === 'string' )
            {
                continue;
            }

            if ( tinfo instanceof Array )
            {
                continue;
            }

            if ( !( 'type' in tinfo ) )
            {
                as.error( FutoInError.InternalError, 'Missing "type" for custom type' );
            }

            if ( tinfo.type === 'map' )
            {
                if ( !( 'fields' in tinfo ) )
                {
                    tinfo.fields = {};
                    continue;
                }

                for ( var f in tinfo.fields )
                {
                    var fdef = tinfo.fields[ f ];

                    if ( ( typeof fdef !== 'string' ) &&
                         !( fdef instanceof Array ) &&
                         !( 'type' in fdef ) )
                    {
                        as.error( FutoInError.InternalError, 'Missing "type" for custom type field' );
                    }
                }
            }
        }
    },

    /**
     * @private
     * @param {AsyncSteps} as - _
     * @param {object} info - _
     * @param {object} raw_spec - _
     * @param {object} sup_info - _
     */
    _parseImportInherit : function( as, info, raw_spec, sup_info )
    {
        var i;
        var pn;

        for ( var t in sup_info.types )
        {
            if ( t in info.types )
            {
                as.error( FutoInError.InternalError, "Iface type redifintion: " + t );
                continue;
            }

            info.types[ t ] = sup_info.types[ t ];
        }

        for ( var f in sup_info.funcs )
        {
            var fdef = sup_info.funcs[ f ];

            if ( !( f in info.funcs ) )
            {
                info.funcs[ f ] = fdef;
                continue;
            }

            var sup_params = fdef.params;
            var params = info.funcs[ f ].params;

            var sup_params_keys = Object.keys( sup_params );
            var params_keys = Object.keys( params );

            if ( params_keys.length < sup_params_keys.length )
            {
                as.error( FutoInError.InternalError, "Invalid param count for '" + f + "'" );
            }

            // Verify parameters are correctly duplicated
            for ( i = 0; i < sup_params_keys.length; ++i )
            {
                pn = sup_params_keys[ i ];

                if ( pn !== params_keys[ i ] )
                {
                    as.error( FutoInError.InternalError, "Invalid param order for '" + f + "/" + pn + "'" );
                }

                if ( sup_params[ pn ].type !== params[ pn ].type )
                {
                    as.error( FutoInError.InternalError, "Param type mismatch '" + f + "/" + pn + "'" );
                }
            }

            // Verify that all added params have default value
            for ( ; i < params_keys.length; ++i )
            {
                pn = params_keys[ i ];

                if ( !( pn in sup_params ) &&
                     !( 'default' in params[ pn ] ||
                        params[ pn ] === null ) )
                {
                    as.error( FutoInError.InternalError, "Missing default for '" + f + "/" + pn + "'" );
                }
            }

            if ( fdef.rawresult !== info.funcs[ f ].rawresult )
            {
                as.error( FutoInError.InternalError, "'rawresult' flag mismatch for '" + f + "'" );
            }

            if ( fdef.seclvl !== info.funcs[ f ].seclvl )
            {
                as.error( FutoInError.InternalError, "'seclvl' mismatch for '" + f + "'" );
            }

            if ( fdef.rawupload &&
                 !info.funcs[ f ].rawupload )
            {
                as.error( FutoInError.InternalError, "'rawupload' flag is missing for '" + f + "'" );
            }
        }

        if ( _difference(
            Object.keys( sup_info.constraints ),
            raw_spec.requires ).length )
        {
            as.error( FutoInError.InternalError, "Missing constraints from inherited" );
        }
    },

    /**
     * Deeply check consistency of loaded interface.
     *
     * NOTE: not yet implemented
     * @param {AsyncSteps} as - step interface
     * @param {Object} info - previously loaded iface
     * @alias SpecTools.checkConsistency
     */
    checkConsistency : function( as, info )
    {
        void as;
        void info;
    },

    /**
     * Check if value matches required type
     * @param {Object} info - previously loaded iface
     * @param {string} type - standard or custom iface type
     * @param {*} val - value to check
     * @returns {Boolean} true on success
     * @alias SpecTools.checkType
     */
    checkType : function( info, type, val )
    {
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
    _checkType : function( info, type, val, _type_stack )
    {
        _type_stack = _type_stack || {};
        var tdef = _type_stack[ '#tdef' ] || {};
        var top_type = _type_stack[ '#top' ] || type;
        var elemtype;
        var val_len;

        // Standard Types
        // ---
        switch ( type )
        {
        case 'any':
            return ( typeof val !== 'undefined' );

        case 'boolean':
            return ( typeof val === type );

        case 'string':
            if ( typeof val !== type )
            {
                return false;
            }

            if ( 'regex' in tdef )
            {
                var comp_regex;

                if ( '_comp_regex' in info )
                {
                    comp_regex = info._comp_regex;
                }
                else
                {
                    comp_regex = {};
                    info._comp_regex = comp_regex;
                }

                if ( !( top_type in comp_regex ) )
                {
                    comp_regex[ top_type ] = new RegExp( tdef.regex );
                }

                if ( val.match( comp_regex[ top_type ] ) === null )
                {
                    spectools.emit( 'error',
                        'Regex mismatch mismatch for ' + top_type );

                    return false;
                }
            }

            val_len = val.length;

            if ( ( 'minlen' in tdef ) &&
                        ( val_len < tdef.minlen ) )
            {
                spectools.emit( 'error',
                    'Value min length ' + val_len+ ' mismatch for ' + top_type );

                return false;
            }

            if ( ( 'maxlen' in tdef ) &&
                        ( val_len > tdef.maxlen ) )
            {
                spectools.emit( 'error',
                    'Value max length ' + val_len + ' mismatch for ' + top_type );

                return false;
            }

            return true;

        case 'map':
            if ( ( typeof val !== 'object' ) ||
                 ( val instanceof Array ) ||
                 ( val === null )
            )
            {
                return false;
            }

            var fields = tdef.fields;

            if ( typeof fields !== 'undefined' )
            {
                for ( var f in fields )
                {
                    var field_def = fields[ f ];

                    if ( typeof field_def === 'string' )
                    {
                        field_def = { type : field_def };
                    }

                    if ( !( f in val ) ||
                            ( val[ f ] === null ) )
                    {
                        if ( field_def.optional )
                        {
                            val[ f ] = null;
                            continue;
                        }
                    }

                    if ( !this._checkType( info, field_def.type, val[ f ], null ) )
                    {
                        spectools.emit( 'error',
                            'Field ' + f + ' value ' + val[ f ] +
                            ' mismatch for ' + top_type );

                        return false;
                    }
                }
            }

            elemtype = tdef.elemtype;

            if ( typeof elemtype !== 'undefined' )
            {
                for ( var ft in val )
                {
                    if ( !this._checkType( info, elemtype, val[ ft ], null ) )
                    {
                        spectools.emit( 'error',
                            'Value ' + val[ ft ] + ' mismatch for ' + top_type );

                        return false;
                    }
                }
            }

            return true;

        case 'integer':
        case 'number':
            if ( typeof val !== 'number' )
            {
                return false;
            }

            if ( ( type === 'integer' ) && ( ( val | 0 ) !== val ) )
            {
                return false;
            }

            if ( ( 'min' in tdef ) &&
                        ( val < tdef.min ) )
            {
                spectools.emit( 'error',
                    'Value min range mismatch for ' + top_type );

                return false;
            }

            if ( ( 'max' in tdef ) &&
                        ( val > tdef.max ) )
            {
                spectools.emit( 'error',
                    'Value max range mismatch for ' + top_type );

                return false;
            }

            return true;

        case 'array':
            if ( !( val instanceof Array ) )
            {
                return false;
            }

            val_len = val.length;

            if ( ( 'minlen' in tdef ) &&
                        ( val_len < tdef.minlen ) )
            {
                spectools.emit( 'error',
                    'Value min length' + val_len + ' mismatch for ' + top_type );

                return false;
            }

            if ( ( 'maxlen' in tdef ) &&
                        ( val_len > tdef.maxlen ) )
            {
                spectools.emit( 'error',
                    'Value max length' + val_len + ' mismatch for ' + top_type );

                return false;
            }

            //--
            elemtype = tdef.elemtype;

            if ( typeof elemtype !== 'undefined' )
            {
                for ( var i = 0; i < val_len; ++i )
                {
                    // Note, new type stack
                    if ( !this._checkType( info, elemtype, val[ i ], null ) )
                    {
                        spectools.emit( 'error',
                            'Value ' + val[ i ] + ' mismatch for ' + top_type );

                        return false;
                    }
                }
            }

            return true;

        case 'enum':
        case 'set':
            if ( _type_stack )
            {
                if ( type === 'set' && !( val instanceof Array ) )
                {
                    return false;
                }
            }
            else
            {
                console.log( "[ERROR] enum and set are allowed only in custom types: " + top_type );
                throw new Error( FutoInError.InternalError );
            }

            var comp_set;
            var set_items;

            if ( '_comp_set' in info )
            {
                comp_set = info._comp_set;
            }
            else
            {
                comp_set = {};
                info._comp_set = comp_set;
            }

            if ( !( top_type in comp_set ) )
            {
                set_items = tdef.items;

                if ( typeof set_items === 'undefined' )
                {
                    console.log( "[ERROR] enum and set require items: " + top_type );
                    throw new Error( FutoInError.InternalError );
                }

                set_items = _zipObject( set_items, set_items );
                comp_set[ top_type ] = set_items;
            }
            else
            {
                set_items = comp_set[ top_type ];
            }

            if ( type === 'enum' )
            {
                val = [ val ];
            }

            for ( var ii = val.length - 1; ii >= 0; --ii )
            {
                var iv = val[ii];

                if ( ( !this._checkType( info, 'string', iv ) &&
                            !this._checkType( info, 'integer', iv ) ) ||
                            !set_items.hasOwnProperty( iv ) )
                {
                    spectools.emit( 'error',
                        'No set item ' + iv + ' for ' + top_type );
                    return false;
                }
            }

            return true;

        default:
            // Custom Types
            // ---
            if ( type in info.types )
            {
                var tdef_part = info.types[ type ];

                if ( ( typeof tdef_part === 'string' ) ||
                    ( tdef_part instanceof Array ) )
                {
                    tdef_part = { type : tdef_part };
                }

                _type_stack[ '#tdef' ] = _extend( {}, tdef_part, tdef );
                _type_stack[ '#top' ] = top_type;

                // ---
                if ( type in _type_stack )
                {
                    console.log( "[ERROR] Custom type recursion: " + top_type );
                    throw new Error( FutoInError.InternalError );
                }

                _type_stack[ type ] = true;

                // ---
                var base_type = tdef_part.type;

                if ( base_type instanceof Array )
                {
                    for ( var vti = base_type.length - 1; vti >= 0; --vti )
                    {
                        var vtype = base_type[vti];
                        var new_type_stack = _extend( {}, _type_stack );

                        if ( this._checkType( info, vtype, val, new_type_stack ) )
                        {
                            return true;
                        }
                    }

                    return false;
                }
                else
                {
                    _type_stack['#last_base'] = base_type; // see FTN3 rev check
                    return this._checkType( info, base_type, val, _type_stack );
                }
            }
            else
            {
                console.log( "[ERROR] missing type: " + type );
                throw new Error( FutoInError.InternalError );
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
    checkParameterType : function( info, funcname, varname, value )
    {
        var vardef = info.funcs[ funcname ].params[ varname ];

        if ( value === null && vardef.default === null )
        {
            return true;
        }

        var vartype = ( typeof vardef === 'string' ) ? vardef : vardef.type;

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
    checkResultType : function( as, info, funcname, varname, value )
    {
        var vardef = info.funcs[ funcname ].result[ varname ];
        var vartype = ( typeof vardef === 'string' ) ? vardef : vardef.type;

        if ( !spectools._checkType( info, vartype, value ) )
        {
            var msg = "Type mismatch for result: " + varname;

            spectools.emit( 'error', msg );
            as.error( FutoInError.InvalidRequest, msg );
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
    checkFutoInType : function( as, type, varname, value )
    {
        if ( !spectools._checkType( {}, type, value ) )
        {
            var msg = "Type mismatch for parameter: " + varname;

            spectools.emit( 'error', msg );
            as.error( FutoInError.InvalidRequest, msg );
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
    genHMAC : function( as, info, ftnreq )
    {
        void as;
        void info;
        void ftnreq;
        as.error( FutoInError.InvalidRequest, "HMAC generation is supported only for server environment" );
        return {}; // suppress eslint
    },
};

if ( isNode )
{
    module.require( './lib/node/spectools_hmac' )( spectools );
}

ee( spectools );

/**
 * On error message for details in debugging.
 * @event SpecTools.error
 */

module.exports = spectools;
