'use strict';

const spectools = {};

require( '../../lib/node/spectools_hmac' )( spectools );

const Benchmark = require( 'benchmark' );
const expect = require( 'chai' ).expect;
const crypto = require( 'crypto' );

var start;
var diff;
var key = Buffer.from( 'MySecretKeyHere' );
var count = 1e5;

const small_req = {
    f : 'some.iface:1.2',
    p : {},
};

const req = {
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
        dataParam: Buffer.alloc( 100, 0x0F ),
        longDataParam: Buffer.alloc( 8192, 0x0F ),
        setParam: [ 'one', 1, 123 ],
    },
    r : {
        test : 'alpha',
    },
    sec : 'to be ignored',
};
Object.freeze( req );

//---
{
    const hmacu = spectools._genHMACU( 'sha256', key, small_req ).toString( 'base64' );
    const hmacj = spectools._genHMACJ( 'sha256', key, small_req ).toString( 'base64' );
    const hmacb = crypto.createHmac( 'sha256', key )
        .update( spectools.macBaseB( small_req ) )
        .digest().toString( 'base64' );
    const hmacbs = crypto.createHmac( 'sha256', key )
        .update( spectools.macBaseBS( small_req ) )
        .digest().toString( 'base64' );

    const hmac_req = 'OPs8M8/m5kGIuQQQS/e5TNqE4GHUCOJzgKpMGzfm8LM=';
    expect( hmacu ).to.equal( hmac_req );
    expect( hmacj ).to.equal( hmac_req );
    expect( hmacb ).to.equal( hmac_req );
    expect( hmacbs ).to.equal( hmac_req );
}

{
    const hmacu = spectools._genHMACU( 'sha256', key, req ).toString( 'base64' );
    const hmacj = spectools._genHMACJ( 'sha256', key, req ).toString( 'base64' );
    const hmacb = crypto.createHmac( 'sha256', key )
        .update( spectools.macBaseB( req ) )
        .digest().toString( 'base64' );
    const hmacbs = crypto.createHmac( 'sha256', key )
        .update( spectools.macBaseBS( req ) )
        .digest().toString( 'base64' );

    const hmac_req = 'oOv1rab99WXaFLqdVAowSLFSPljCXHQ3KDpVzkBh1G0=';
    expect( hmacu ).to.equal( hmac_req );
    expect( hmacj ).to.equal( hmac_req );
    expect( hmacb ).to.equal( hmac_req );
    expect( hmacbs ).to.equal( hmac_req );
}

//---
const suite = new Benchmark.Suite();

suite.add( 'Update method (small)', () => {
    spectools._genHMACU( 'sha256', key, small_req );
} );

suite.add( 'Join method (small)', () => {
    spectools._genHMACJ( 'sha256', key, small_req );
} );

suite.add( 'Update method', () => {
    spectools._genHMACU( 'sha256', key, req );
} );

suite.add( 'Join method', () => {
    spectools._genHMACJ( 'sha256', key, req );
} );


suite.add( 'MAC base buffer.concat (small)', () => {
    spectools.macBaseB( small_req );
} );

suite.add( 'MAC base buffer-string (small)', () => {
    spectools.macBaseBS( small_req );
} );

suite.add( 'MAC base buffer.concat', () => {
    spectools.macBaseB( req );
} );

suite.add( 'MAC base buffer-string', () => {
    spectools.macBaseBS( req );
} );


// ---
/*
[ 'md5', 'sha224', 'sha256', 'sha384', 'sha512' ].forEach( function( algo ) {
    suite.add(`Algo ${algo}`, () => {
        spectools.genHMACRaw( algo, key, req );
    } );
} );
*/

const res = suite.run( {
    initCount: 10000,
    maxTime: 5,
    minTime: 3,
} );

for ( let i = 0, c = res.length; i < c; ++i ) {
    const b = res[i];
    console.log( `Benchmark: ${b.name}` );
    console.log( `Time: ${b.times.elapsed} RPS: ${b.hz}` );
    console.log( '' );
}
