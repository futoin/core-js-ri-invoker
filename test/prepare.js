'use strict';

if ( typeof window === 'undefined' ) {
    module.require( 'websocket-driver' );
    module.require( 'tough-cookie' );
    module.require( 'borc' );
    module.require( 'msgpack-lite' );
}

Object.freeze( Object.prototype );
