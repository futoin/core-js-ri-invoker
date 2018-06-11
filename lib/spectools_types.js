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
    // Type processing extensions
    //=================================

    const console_error = ( ...args ) => {
        // eslint-disable-next-line no-console
        console.error( ...args );
    };

    /**
     * Ensure the type is known in spec.
     * @param {AsyncSteps} as - AsyncSteps interface
     * @param {object} info - spec info
     * @param {string} name - typename
     */
    const checkKnownType = ( as, info, name ) => {
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
    };


    /**
     * Check if value matches required type
     * @param {Object} info - previously loaded iface
     * @param {string} type - standard or custom iface type
     * @param {*} val - value to check
     * @returns {Boolean} true on success
     * @alias SpecTools.checkType
     */
    const checkType = ( info, type, val ) => {
        return _checkType( info, type, val );
    };

    /**
     * Check if value matches required type (internal)
     * @private
     * @param {Object} info - previously loaded iface
     * @param {string} type - standard or custom iface type
     * @param {*} val - value to check
     * @param {object} [_type_stack=null] - for internal use only
     * @returns {Boolean} true on success
     */
    const _checkType = ( info, type, val, _type_stack = {} ) => {
        const tdef = _type_stack[ TYPE_DEF ] || {};
        const type_path = _type_stack[ TYPE_PATH ] || type;

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
                    ST.emit( 'error',
                        `Regex mismatch for ${type_path}` );

                    return false;
                }
            }

            const val_len = val.length;

            //---
            const minlen = tdef.minlen;

            if ( ( minlen !== undefined ) &&
                 ( val_len < minlen ) ) {
                ST.emit( 'error',
                    `Value min length "${val_len}" mismatch for ${type_path}` );

                return false;
            }

            //---
            const maxlen = tdef.maxlen;

            if ( ( minlen !== undefined ) &&
                 ( val_len > maxlen ) ) {
                ST.emit( 'error',
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

                    if ( !_checkType( info, field_def.type, val[ f ] ) ) {
                        ST.emit( 'error',
                            `Field "${f}" value "${val[ f ]}" mismatch for ${type_path}` );

                        return false;
                    }
                }
            }

            //---
            const elemtype = tdef.elemtype;

            if ( elemtype ) {
                for ( let ft in val ) {
                    if ( !_checkType( info, elemtype, val[ ft ] ) ) {
                        ST.emit( 'error',
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
                ST.emit( 'error',
                    `Value min range mismatch for ${type_path}` );

                return false;
            }

            //---
            const max = tdef.max;

            if ( ( max !== undefined ) && ( val > max ) ) {
                ST.emit( 'error',
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
                ST.emit( 'error',
                    `Value min length "${val_len}" mismatch for ${type_path}` );

                return false;
            }

            //---
            const maxlen = tdef.maxlen;

            if ( ( maxlen !== undefined ) && ( val_len > maxlen ) ) {
                ST.emit( 'error',
                    `Value max length "${val_len}" mismatch for ${type_path}` );

                return false;
            }

            //--
            const elemtype = tdef.elemtype;

            if ( elemtype ) {
                for ( let i = 0; i < val_len; ++i ) {
                    // Note, new type stack
                    if ( !_checkType( info, elemtype, val[ i ] ) ) {
                        ST.emit( 'error',
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
                console_error( "[ERROR] enum and set are allowed only in custom types: " + type_path );
                throw new Error( InternalError );
            }

            const comp_set = info._comp_set;
            let set_items = comp_set[ type_path ];

            if ( !set_items ) {
                set_items = tdef.items;

                if ( typeof set_items === 'undefined' ) {
                    console_error( "[ERROR] enum and set require items: " + type_path );
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

                if ( ( !_checkType( info, 'string', iv ) &&
                            !_checkType( info, 'integer', iv ) ) ||
                            !set_items.hasOwnProperty( iv ) ) {
                    ST.emit( 'error',
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
                ST.emit( 'error',
                    `Value min length "${val_len}" mismatch for ${type_path}` );

                return false;
            }

            //---
            const maxlen = tdef.maxlen;

            if ( ( maxlen !== undefined ) && ( val_len > maxlen ) ) {
                ST.emit( 'error',
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

                _type_stack[ TYPE_DEF ] = _extend( {}, tdef_part, tdef );

                // ---
                if ( type in _type_stack ) {
                    console_error( "[ERROR] Custom type recursion: " + type_path );
                    throw new Error( InternalError );
                }

                _type_stack[ type ] = true;

                // ---
                const base_type = tdef_part.type;

                if ( base_type instanceof Array ) {
                    for ( let vti = base_type.length - 1; vti >= 0; --vti ) {
                        const vtype = base_type[vti];
                        const new_type_stack = _extend( {}, _type_stack );
                        new_type_stack[ TYPE_PATH ] = `${type_path}:${vtype}`;

                        if ( _checkType( info, vtype, val, new_type_stack ) ) {
                            return true;
                        }
                    }

                    return false;
                } else {
                    _type_stack['#last_base'] = base_type; // see FTN3 rev check
                    _type_stack[ TYPE_PATH ] = `${type_path}:${base_type}`;
                    return _checkType( info, base_type, val, _type_stack );
                }
            } else {
                console_error( "[ERROR] missing type: " + type );
                throw new Error( InternalError );
            }
        }
        }
    };

    //=================================
    Object.assign( ST, {
        checkKnownType,
        checkType,
        _checkType,
    } );
};
