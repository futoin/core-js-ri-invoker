'use strict';

/**
 * @file
 *
 * Copyright 2018 FutoIn Project (https://futoin.org)
 * Copyright 2018 Andrey Galkin <andrey@futoin.org>
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

const coders = {};

class MessageCoder {
    isBinary() {
        return false;
    }

    name() {
        return 'Unknown';
    }

    /*
    contentType() {
        return 'application/futoin+';
    }

    detect(data) {
        return false;
    }

    encode( msg ) {
        as.error( 'NotImplemented' );
    }

    decode( buffer ) {
        as.error( 'NotImplemented' );
    }
    */

    static detect( data ) {
        for ( let k in coders ) {
            const c = coders[k];

            if ( c.detect( data ) ) {
                return c;
            }
        }

        // fallback
        return coders.JSON;
    }

    static registerCoder( name, impl ) {
        coders[ name ] = impl;
    }

    static get( name ) {
        // eslint-disable-next-line no-prototype-builtins
        const res = coders.hasOwnProperty( name ) && coders[name];

        if ( !res ) {
            throw new Error( `Missing coder: ${name}` );
        }

        return res;
    }
}

module.exports = MessageCoder;
