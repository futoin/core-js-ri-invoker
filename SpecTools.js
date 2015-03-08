"use strict";

var common = require( './lib/common' );
var FutoInError = common.FutoInError;

var fs;
var request;
var isNode = require( 'detect-node' );
var _cloneDeep = require( 'lodash/lang/cloneDeep' );
var _zipObject = require( 'lodash/array/zipObject' );
var _difference = require( 'lodash/array/difference' );
var _extend = require( 'lodash/object/extend' );

if ( isNode )
{
    var hidereq = require;
    fs = hidereq( 'fs' );
    request = hidereq( 'request' );
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
        SecurityError : true
    },

    _ver_pattern : /^([0-9]+)\.([0-9]+)$/,
    _ifacever_pattern : common._ifacever_pattern,

    _max_supported_v1_minor : 3,

    /**
     * Load FutoIn iface definition.
     *
     * NOTE: Browser uses XHR to load specs, Node.js searches in local fs.
     * @param {AsyncSteps} as
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
            cache_key = info.iface + ':' + info.version +
                    ( info._invoker_use ? ':i' : ':e' );
            cached_info = load_cache[ cache_key ];

            if ( cached_info )
            {
                _extend( info, cached_info );
                return;
            }

            cached_info = {
                _invoker_use : info._invoker_use
            };
        }
        else
        {
            cached_info = info;
        }

        as.forEach( specdirs, function( as, k, v )
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

                var on_read = function( data )
                {
                    if ( !read_as )
                    {
                        return;
                    }

                    try
                    {
                        v = JSON.parse( data );
                        v._just_loaded = true;
                        read_as.success();
                        return;
                    }
                    catch ( e )
                    {}

                    try
                    {
                        read_as.continue();
                    }
                    catch ( e )
                    {}
                };

                if ( uri.substr( 0, 4 ) === 'http' )
                {
                    request( uri, function( error, response, body )
                    {
                        on_read( body );
                    } );
                }
                else
                {
                    fs.readFile(
                        uri,
                        { encoding : 'utf8' },
                        function( err, data )
                        {
                            on_read( data );
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
                        {}
                    }

                    try
                    {
                        as.continue();
                    }
                    catch ( ex )
                    {}
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

            spectools.parseIface( as, cached_info, specdirs, raw_spec );
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
     * @param {AsyncSteps} as
     * @param {Object} info - destination object with "iface" and "version" fields already set
     * @param {Array} specdirs - each element - search path/url (string) or raw iface (object)
     * @param {Object} raw_spec - iface definition object
     * @alias SpecTools.parseIface
     */
    parseIface : function( as, info, specdirs, raw_spec )
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
                as.error( FutoInError.InvokerError, "Invalid inherit ifacever: " + raw_spec.inherit );
            }

            var sup_info = {};
            sup_info.iface = m[ 1 ];
            sup_info.version = m[ 4 ];
            spectools.loadIface( as, sup_info, specdirs );

            as.add( function( as )
            {
                spectools._parseImportInherit( as, info, specdirs, raw_spec, sup_info );

                info.inherits.push( raw_spec.inherit );
                info.inherits = info.inherits.concat( sup_info.inherits );
            } );
        }

        // Process Imports / mixins
        // ---
        if ( 'imports' in raw_spec )
        {
            info.imports = raw_spec.imports.slice();

            as.forEach( raw_spec.imports, function( as, k, v )
            {
                var m = v.match( common._ifacever_pattern );

                if ( m === null )
                {
                    as.error( FutoInError.InvokerError, "Invalid import ifacever: " + v );
                }

                var imp_info = {};
                imp_info.iface = m[ 1 ];
                imp_info.version = m[ 4 ];
                spectools.loadIface( as, imp_info, specdirs );

                as.add( function( as )
                {
                    spectools._parseImportInherit( as, info, specdirs, raw_spec, imp_info );
                    info.imports = info.imports.concat( imp_info.imports );
                } );
            } );
        }
        else
        {
            info.imports = [];
        }
    },

    /**
     * @private
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

        // Check for version-specific features
        // ---
        if ( mjr === 1 )
        {
            if ( mnr < 1 )
            {
                if ( raw_spec.imports ||
                     raw_spec.types ||
                     'BiDirectChannel' in info.constraints )
                {
                    as.error( FutoInError.InternalError,
                              "Missing ftn3rev or wrong field for FTN3 v1.1 features" );
                }
            }

            if ( mnr < 2 )
            {
                if ( 'MessageSignature' in info.constraints )
                {
                    as.error( FutoInError.InternalError,
                              "Missing ftn3rev or wrong field for FTN3 v1.2 features" );
                }
            }

            if ( mnr < 3 )
            {
                for ( var f in info.funcs )
                {
                    if ( info.funcs[f].seclvl )
                    {
                        as.error( FutoInError.InternalError,
                                  "Missing ftn3rev or wrong field for FTN3 v1.2 features" );
                    }
                }
            }

            if ( mnr < 4 )
            {
                // TODO:
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
            else
            {
                finfo.params = {};
            }

            finfo.expect_result = false;

            if ( 'result' in finfo )
            {
                var fresult = finfo.result;

                if ( typeof fresult !== 'object' )
                {
                    as.error( FutoInError.InternalError, "Invalid result object" );
                }

                for ( var rn in fresult )
                {
                    var rinfo = fresult[ rn ];

                    if ( typeof rinfo !== 'object' )
                    {
                        as.error( FutoInError.InternalError, "Invalid resultvar object" );
                    }

                    if ( !( 'type' in rinfo ) )
                    {
                        as.error( FutoInError.InternalError, "Missing type for result" );
                    }

                    finfo.expect_result = true;
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
        }
    },

    /**
     * @private
     */
    _parseTypes : function( as, info )
    {
        var tinfo;

        for ( var t in info.types )
        {
            tinfo = info.types[ t ];

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
                    if ( !( 'type' in tinfo.fields[ f ] ) )
                    {
                        as.error( FutoInError.InternalError, 'Missing "type" for custom type field' );
                    }
                }
            }
        }
    },

    /**
     * @private
     */
    _parseImportInherit : function( as, info, specdirs, raw_spec, sup_info )
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
     * @param {AsyncSteps} as
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
     * @returns {Boolean}
     * @alias SpecTools.checkType
     */
    checkType : function( info, type, val, _type_stack )
    {
        if ( val === null )
        {
            return false;
        }

        // Standard Types
        // ---
        switch ( type )
        {
            case 'any':
                return true;

            case 'boolean':
            case 'string':
            case 'number':
                return ( typeof val === type );

            case 'map':
                return ( typeof val === 'object' ) &&
                       !( val instanceof Array );

            case 'integer':
                return ( typeof val === "number" ) &&
                       ( ( val | 0 ) === val );

            case 'array':
                return ( val instanceof Array );

            default:
                if ( !( 'types' in info ) ||
                     !( type in info.types ) )
                {
                    return false;
                }
                // continue;
        }

        // Custom Types
        // ---
        if ( type in info.types )
        {
            var tdef = info.types[ type ];

            _type_stack = _type_stack || {};
            var base_type = tdef.type;

            if ( base_type in _type_stack )
            {
                if ( console )
                {
                    console.log( "[ERROR] Custom type recursion: " + tdef );
                }

                throw new Error( FutoInError.InternalError );
            }

            _type_stack[ type ] = true;

            if ( !this.checkType( info, base_type, val, _type_stack ) )
            {
                return false;
            }

            switch ( base_type )
            {
                case 'integer':
                case 'number':
                    if ( ( 'min' in tdef ) &&
                         ( val < tdef.min ) )
                    {
                        return false;
                    }

                    if ( ( 'max' in tdef ) &&
                         ( val > tdef.max ) )
                    {
                        return false;
                    }

                    return true;

                case 'string':
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

                        if ( !( type in comp_regex ) )
                        {
                            comp_regex[ type ] = new RegExp( tdef.regex );
                        }

                        return ( val.match( comp_regex[ type ] ) !== null );
                    }

                    return true;

                case 'array':
                    var val_len = val.length;

                    if ( ( 'minlen' in tdef ) &&
                         ( val_len < tdef.minlen ) )
                    {
                        return false;
                    }

                    if ( ( 'maxlen' in tdef ) &&
                         ( val_len > tdef.maxlen ) )
                    {
                        return false;
                    }

                    if ( 'elemtype' in tdef )
                    {
                        var elemtype = tdef.elemtype;

                        for ( var i = 0; i < val_len; ++i )
                        {
                            // Note, new type stack
                            if ( !this.checkType( info, elemtype, val[ i ], [] ) )
                            {
                                return false;
                            }
                        }
                    }

                    return true;

                case 'map':
                    var fields = tdef.fields;

                    for ( var f in fields )
                    {
                        var field_def = fields[ f ];

                        if ( !( f in val ) ||
                             ( val[ f ] === null ) )
                        {
                            if ( field_def.optional )
                            {
                                val[ f ] = null;
                                return true;
                            }

                            return false;
                        }

                        // Note, new type stack
                        if ( !this.checkType( info, field_def.type, val[ f ], [] ) )
                        {
                            return false;
                        }
                    }

                    return true;
            }
        }

        return false;
    },

    /**
     * Check if parameter value matches required type
     * @param {Object} info - previously loaded iface
     * @param {string} funcname - function name
     * @param {string} varname - parameter name
     * @param {*} value - value to check
     * @alias SpecTools.checkParameterType
     */
    checkParameterType : function( info, funcname, varname, value )
    {
        return spectools.checkType(
                info,
                info.funcs[ funcname ].params[ varname ].type,
                value
        );
    },

    /**
     * Check if result value matches required type
     * @param {AsyncSteps} as
     * @param {Object} info - previously loaded iface
     * @param {string} funcname - function name
     * @param {string} varname - result variable name
     * @param {*} value - value to check
     * @alias SpecTools.checkResultType
     */
    checkResultType : function( as, info, funcname, varname, value )
    {
        if ( !spectools.checkType( info, info.funcs[ funcname ].result[ varname ].type, value ) )
        {
            as.error( FutoInError.InvalidRequest, "Type mismatch for result: " + varname );
        }
    },

    /**
     * @deprecated
     * @ignore
     */
    checkFutoInType : function( as, type, varname, value )
    {
        if ( !spectools.checkType( {}, type, value ) )
        {
            as.error( FutoInError.InvalidRequest, "Type mismatch for parameter: " + varname );
        }
    },

    /**
     * Generate HMAC
     *
     * NOTE: for simplicity, 'sec' field must not be present
     * @param {AsyncSteps} as
     * @param {object} info - Interface raw info object
     * @param {object} ftnreq - Request Object
     * @returns {Buffer} Binary HMAC signature
     */
    genHMAC : function( as, info, ftnreq )
    {
        void as;
        void info;
        void ftnreq;
        as.error( FutoInError.InvalidRequest, "HMAC generation is supported only for server environment" );
    }
};

if ( isNode )
{
    hidereq( './lib/node/spectools_hmac' )( spectools );
}

module.exports = spectools;
