'use strict';

if ( typeof window === 'undefined' ) {
    const mod = module;
    mod.require( 'tough-cookie' );
    mod.require( 'borc' );
    mod.require( 'msgpack-lite' );
}

Object.freeze( Object.prototype );
