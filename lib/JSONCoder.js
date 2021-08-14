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

const MessageCoder = require( '../MessageCoder' );

const CODER_NAME = 'JSON';

class JSONCoder extends MessageCoder {
    isBinary() {
        return false;
    }

    name() {
        return CODER_NAME;
    }

    contentType() {
        return 'application/futoin+json';
    }

    detect( data ) {
        if ( typeof data === 'string' ) {
            return data.charAt( 0 ) === '{';
        } else if ( data instanceof ArrayBuffer ) {
            return ( new Uint8Array( data ) )[0] == 0x7B;
        } else {
            return data[0] === 0x7B;
        }
    }

    encode( msg ) {
        return JSON.stringify( msg );
    }

    decode( buffer ) {
        if ( buffer instanceof ArrayBuffer ) {
            return JSON.parse( new TextDecoder().decode( buffer ) );
        }

        return JSON.parse( buffer.toString() );
    }

    static register() {
        this.registerCoder( CODER_NAME, new this );
    }
}

module.exports = JSONCoder;
