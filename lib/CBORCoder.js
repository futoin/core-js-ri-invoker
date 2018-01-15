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

let cbor;

try {
    cbor = require( 'borc' );
} catch ( _ ) {
    // pass
}

const MessageCoder = require( '../MessageCoder' );

const CODER_NAME = 'CBOR';

class CBORCoder extends MessageCoder {
    isBinary() {
        return true;
    }

    name() {
        return CODER_NAME;
    }

    contentType() {
        return 'application/futoin+cbor';
    }

    detect( data ) {
        return data.slice( 0, 4 ).toString() === CODER_NAME;
    }

    encode( msg ) {
        // TODO: optimize
        return Buffer.concat( [
            Buffer.from( CODER_NAME ),
            cbor.encode( msg ),
        ] );
    }

    decode( buffer ) {
        return cbor.decode( buffer.slice( 4 ) );
    }

    static register( lib = null ) {
        cbor = lib || cbor;

        if ( cbor ) {
            this.registerCoder( CODER_NAME, new this );
        }
    }
}

module.exports = CBORCoder;
