'use strict';

var spectools = {};

require( '../../lib/node/spectools_hmac' )( spectools );

var performance_now = require( "performance-now" );

var start;
var diff;
var key = new Buffer( 'MySecretKeyHere' ).toString( 'binary' );
var count = 1e5;

var req = {
    rid : 'C1234',
    f : 'some.iface:1.2',
    p : {
        boolPrm : false,
        stringParam : 'alphaStringHere',
        numberParam : 1.34,
        objectParam : {
            boolOther : true,
            alphaOther : 'beta',
        },
    },
    r : {
        test : 'alpha',
    },
};

// ---
start = performance_now();

for ( let i = 0; i < count; ++i ) {
    spectools._genHMACU( 'sha256', key, req );
}

diff = performance_now() - start;
console.log( 'Update method: ' + diff + ' @' + ( count/diff*1e3 ) + '/sec' );

// ---
start = performance_now();

for ( let i = 0; i < count; ++i ) {
    spectools._genHMACJ( 'sha256', key, req );
}

diff = performance_now() - start;
console.log( 'Join method: ' + diff + ' @' + ( count/diff*1e3 ) + '/sec' );


// ---
[ 'md5', 'sha224', 'sha256', 'sha384', 'sha512' ].forEach( function( algo ) {
    start = performance_now();

    for ( let i = 0; i < count; ++i ) {
        spectools.genHMACRaw( algo, key, req );
    }

    diff = performance_now() - start;
    console.log( algo + ': ' + diff + ' @' + ( count/diff*1e3 ) + '/sec' );
} );
