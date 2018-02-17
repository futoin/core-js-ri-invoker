'use strict';

require( './prepare' );

const expect = require( 'chai' ).expect;
const performance_now = require( "performance-now" );

const MessageCoder = require( '../MessageCoder' );
require( '../lib/JSONCoder' ).register();
require( '../lib/CBORCoder' ).register();
require( '../lib/MsgPackCoder' ).register();

const BENCH_COUNT = 10e3; // 100e3 has issues with CBOR

const msg = {
    f: 'some.iface:1.0:some_func',
    p: {
        name: 'Name',
        array: [ 1, 2, 3, 4 ],
        num: 123,
        object : {
            field: 123,
        },
    },
    rid: 'C123456',
};

for ( let coder_name of [ 'JSON', 'CBOR', 'MPCK' ] ) {
    describe( coder_name, function() {
        let coder;

        before( coder_name, function() {
            coder = MessageCoder.get( coder_name );
        } );

        it ( 'should indicate binary support', function() {
            expect( coder.isBinary() ).to.equal( coder_name !== 'JSON' );
        } );


        it ( 'should encode & decode', function() {
            const m = coder.encode( msg );
            const res = coder.decode( m );
        } );

        it ( 'should auto-detect', function() {
            const m = coder.encode( msg );
            const res = MessageCoder.detect( m );
            expect( res.name() ).to.equal( coder_name );
        } );

        it ( 'encode benchmark', function() {
            this.timeout( 30e3 );
            const count = BENCH_COUNT;
            const start = performance_now();

            for ( let i = 0; i < count; ++i ) {
                coder.encode( msg );
            }

            const diff = performance_now() - start;
            console.log( 'Encode: ' + diff + ' @' + ( count/diff*1e3 ) + '/sec' );
        } );

        it ( 'decode benchmark', function() {
            this.timeout( 30e3 );
            const count = BENCH_COUNT;

            const m = coder.encode( msg );

            const start = performance_now();

            for ( let i = 0; i < count; ++i ) {
                coder.decode( m );
            }

            const diff = performance_now() - start;
            console.log( 'Decode: ' + diff + ' @' + ( count/diff*1e3 ) + '/sec' );
        } );
    } );
}
