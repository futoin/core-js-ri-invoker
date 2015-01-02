"use strict";

var common = require( './common' );
var FutoInError = common.FutoInError;

var fs;
var request;
var isNode = require( 'detect-node' );
var _ = require( 'lodash' );

if ( isNode )
{
    var hidereq = require;
    fs = hidereq( 'fs' );
    request = hidereq( 'request' );
}

/**
 * SpecTools
 * @class
 */
var spectools =
{
    /**
     * Enumeration of standard errors
     * @const
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

    /**
     * Load FutoIn iface definition.
     *
     * NOTE: Browser uses XHR to load specs, Node.js searches in local fs.
     * @param {AsyncSteps} as
     * @param {Object} info - destination object with "iface" and "version" fields already set
     * @param {Array} specdirs - each element - search path/url (string) or raw iface (object)
     */
    loadSpec : function( as, info, specdirs )
    {
        var raw_spec = null;

        as.forEach( specdirs, function( as, k, v )
        {
            var fn = info.iface + '-' + info.version + '-iface.json';

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
                    ( v.version === info.version ) &&
                    ( 'funcs' in v ) )
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

            spectools.parseSpec( as, info, specdirs, raw_spec );
        } );
    },

    /**
     * Parse raw futoin spec (preloaded)
     * @param {AsyncSteps} as
     * @param {Object} info - destination object with "iface" and "version" fields already set
     * @param {Array} specdirs - each element - search path/url (string) or raw iface (object)
     * @param {Object} raw_spec - iface definition object
     */
    parseSpec : function( as, info, specdirs, raw_spec )
    {
        if ( raw_spec._just_loaded )
        {
            info.funcs = raw_spec.funcs || {};
            info.types = raw_spec.types || {};
        }
        else
        {
            info.funcs = _.cloneDeep( raw_spec.funcs || {} );
            info.types = _.cloneDeep( raw_spec.types || {} );
        }

        var finfo;
        var pn;

        for ( var f in info.funcs )
        {
            finfo = info.funcs[f];
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
                    var rinfo = fresult[rn];

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

                finfo.throws = _.object( throws, throws );
            }
            else
            {
                finfo.throws = {};
            }
        }

        if ( 'requires' in raw_spec )
        {
            var requires = raw_spec.requires;

            if ( !Array.isArray( requires ) )
            {
                as.error( FutoInError.InternalError, '"requires" is not array' );
            }

            info.constraints = _.object( requires, requires );
        }
        else
        {
            info.constraints = {};
        }

        info.inherits = [];

        if ( 'inherit' in raw_spec )
        {
            var m = raw_spec.inherit.match( common._ifacever_pattern );

            if ( m === null )
            {
                as.error( FutoInError.InvokerError, "Invalid inherit ifacever: " + raw_spec.inherit );
            }

            var sup_info = {};
            sup_info.iface = m[1];
            sup_info.version = m[4];
            spectools.loadSpec( as, sup_info, specdirs );

            as.add( function( as )
            {
                spectools._parseInherit( as, info, specdirs, raw_spec, sup_info );
            } );
        }

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
                imp_info.iface = m[1];
                imp_info.version = m[4];
                spectools.loadSpec( as, imp_info, specdirs );

                as.add( function( as )
                {
                    Array.prototype.push.apply( info.imports, imp_info.imports );
                    spectools._parseImport( as, info, specdirs, raw_spec, imp_info );
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
    _parseInherit : function( as, info, specdirs, raw_spec, sup_info )
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
                info.funcs[f] = fdef;
                continue;
            }

            var sup_params = fdef.params;
            var params = info.funcs[f].params;

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

                if ( sup_params[pn].type !== params[pn].type )
                {
                    as.error( FutoInError.InternalError, "Param type mismatch '" + f + "/" + pn + "'" );
                }
            }

            // Verify that all added params have default value
            for ( ; i < params_keys.length; ++i )
            {
                pn = params_keys[ i ];

                if ( !( pn in sup_params ) &&
                     !( 'default' in params[pn] ||
                        params[pn] === null ) )
                {
                    as.error( FutoInError.InternalError, "Missing default for '" + f + "/" + pn + "'" );
                }
            }

            if ( fdef.rawresult !== info.funcs[f].rawresult )
            {
                as.error( FutoInError.InternalError, "'rawresult' flag mismatch for '" + f + "'" );
            }

            if ( fdef.rawupload &&
                 !info.funcs[f].rawupload )
            {
                as.error( FutoInError.InternalError, "'rawupload' flag is missing for '" + f + "'" );
            }
        }

        info.inherits.push( raw_spec.inherit );
        info.inherits = info.inherits.concat( sup_info.inherits );

        if ( _.difference(
                Object.keys( sup_info.constraints ),
                raw_spec.requires ).length )
        {
            as.error( FutoInError.InternalError, "Missing constraints from inherited" );
        }
    },

    /**
     * @private
     */
    _parseImport : function( as, info, specdirs, raw_spec, imp_info )
    {
        for ( var t in imp_info.types )
        {
            if ( t in info.types )
            {
                continue;
            }

            info.types[ t ] = imp_info.types[ t ];
        }

        for ( var f in imp_info.funcs )
        {
            // Ignore if exists
            if ( f in info.funcs )
            {
                continue;
            }

            info.funcs[ f ] = imp_info.funcs[ f ];
        }
    },

    /**
     * Deeply check consistency of loaded interface.
     *
     * NOTE: not yet implemented
     * @param {AsyncSteps} as
     * @param {Object} info - previously loaded iface
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
     */
    checkType : function( info, type, val, _type_stack )
    {
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
                return ( typeof val === 'object' );

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
                        var _comp_regex;

                        if ( '_comp_regex' in info )
                        {
                            _comp_regex = {};
                            info._comp_regex = _comp_regex;
                        }
                        else
                        {
                            _comp_regex = info._comp_regex;
                        }

                        if ( type in _comp_regex )
                        {
                            _comp_regex[ type ] = new RegExp( tdef.regex );
                        }

                        return ( val.match( _comp_regex[ type ] ) !== null );
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
                        for ( var i = 0; i < val_len; ++i )
                        {
                            // Note, new type stack
                            if ( !this.checkType( info, tdef.elemtype, val, [] ) )
                            {
                                return false;
                            }
                        }
                    }

                    return true;

                case 'map':
                    if ( 'fields' in tdef )
                    {
                        var fields = tdef.fields;

                        for ( var f in fields )
                        {
                            var field_def = fields[ f ];

                            if ( !field_def.optional &&
                                 ( f in val ) )
                            {
                                return false;
                            }

                            // Note, new type stack
                            if ( !this.checkType( info, field_def.type, val[ f ], [] ) )
                            {
                                return false;
                            }
                        }
                    }

                    return true;
            }
        }

        return false;
    },

    /**
     * Check if parameter value matches required type
     * @param {AsyncSteps} as
     * @param {Object} info - previously loaded iface
     * @param {string} varname - parameter name
     * @param {string} type - standard or custom iface type
     * @param {*} value - value to check
     */
    checkParameterType : function( as, info, varname, type, value )
    {
        if ( !spectools.checkType( info, type, value ) )
        {
            as.error( FutoInError.InvalidRequest, "Type mismatch for parameter: " + varname );
        }
    },

    /**
     * Check if result value matches required type
     * @param {AsyncSteps} as
     * @param {Object} info - previously loaded iface
     * @param {string} varname - result variable name
     * @param {string} type - standard or custom iface type
     * @param {*} value - value to check
     */
    checkResultType : function( as, info, varname, type, value )
    {
        if ( !spectools.checkType( info, type, value ) )
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
    }
};

module.exports = spectools;
