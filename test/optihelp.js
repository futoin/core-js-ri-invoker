'use strict';

const $as = require( 'futoin-asyncsteps' );
const $as_test = $as.testcase;
const optihelp = require( '@futoin/optihelp' );
const child_process = require( 'child_process' );

const {
    SimpleCCM,
    AdvancedCCM,
    SpecTools,
} = require( '../lib/invoker' );


const IFACE_SPEC = {
    iface: 'some.face',
    version: '1.0',
    ftn3rev: '1.9',
    types: {
        Int : {
            type: 'integer',
        },
        IntMinMax : {
            type: 'integer',
            min: -3,
            max: 3,
        },
        Number : {
            type: 'number',
        },
        NumberMinMax : {
            type: 'number',
            min: -3.1,
            max: 3.1,
        },
        String : {
            type: 'string',
        },
        StringRegex : {
            type: 'string',
            regex: /^[a-z]{5}$/,
        },
        StringMinMax : {
            type: 'string',
            minlen: 1,
            maxlen: 3,
        },
        ArrayMinMax : {
            type: 'array',
            minlen: 1,
            maxlen: 3,
            elemtype: 'IntMinMax',
        },
        Map : {
            type: 'map',
            fields: {
                int : {
                    type:'IntMinMax',
                },
                string : {
                    type:'StringRegex',
                    optional: true,
                },
            },
        },
        MapElemType : {
            type: 'map',
            elemtype: 'IntMinMax',
        },
        DerivedIntMinMax : {
            type: 'IntMinMax',
            min: -2,
        },
        Set : {
            type: 'set',
            items: [ 'one', 'two', 'three', 10, 20 ],
        },
        Enum : {
            type: 'enum',
            items: [ 'one', 'two', 'three', 10, 20 ],
        },
        Variant : [ 'IntMinMax', 'StringRegex', "boolean" ],
        DerivedVariant : {
            type: 'Variant',
            min: 2,
        },
        AnyType : "any",
        MapAny : {
            type: 'map',
            fields: {
                f: "AnyType",
            },
        },
        Array : {
            type: "array",
            elemtype: "Int",
            maxlen: 3,
        },
        Data : {
            type: "data",
            minlen: 3,
            maxlen: 5,
        },
    },
    funcs: {
        funcName : {
            params : {
                d : 'Data',
                a : 'Array',
                m : 'MapAny',
                v : 'DerivedVariant',
            },
            result : {
                e : 'MapElemType',
                m : 'Map',
            }
        }
    }
};
Object.freeze( IFACE_SPEC );

const TYPE_TESTS = {
    Int : {
        ok : [ -5, 1, 5 ],
        fail: [ 1.1 ],
    },
    IntMinMax : {
        ok : [ -3, 1, 3 ],
        fail : [ -4, 1.1, 4 ],
    },
    Number : {
        ok : [ -5, 1.1, 5 ],
        fail: [ 'string' ],
    },
    NumberMinMax : {
        ok : [ -3.1, 0.5, 3.1 ],
        fail : [ -3.2, 'string', 3.2 ],
    },
    String : {
        ok : [ 'Some', 'string' ],
        fail : [ 1, false, null ],
    },
    StringRegex : {
        ok : [ 'strin' ],
        fail : [ 'Some', 'Strin', 1, false, null ],
    },
    StringMinMax : {
        ok : [ 'a', 'abc' ],
        fail : [ '', 'abcd' ],
    },
    ArrayMinMax : {
        ok : [ [ 1, 1, 1 ], [ -3, 0, 3 ] ],
        fail : [ [], [ 1, 1, 1, 1 ], [ 1, -5, 1 ], [ 1, 's', true ], 1, false, null ],
    },
    Map : {
        ok: [ { int:1 }, { int:3,
            string:'abcde' } ],
        fail: [ { int:5,
            string:'abcde' }, { string:'abcde' }, { int:3,
            string:'abcdE' } ],
    },
    MapElemType : {
        ok: [ { int:1 }, { int:3 } ],
        fail: [ { int:5,
            string:'abcde' }, { int: 4 }, { string: 'abcde' } ],
    },
    DerivedIntMinMax : {
        ok : [ -2, 1, 3 ],
        fail : [ -4, -3, 1.1, 4 ],
    },
    Set : {
        ok : [
            [],
            [ 'one' ],
            [ 20, 'one' ],
            [ 'one', 'two', 'three', 10, 20 ],
        ],
        fail : [
            [ 1 ],
            [ 'one', 'two', 'three', 10, 20, 30 ],
            false,
            null,
            1,
        ],
    },
    Enum : {
        ok : [ 'one', 20, 'three' ],
        fail : [ [ 'one' ], false, null, 1 ],
    },
    DerivedVariant : {
        ok : [ 1, 2, 3, 'abcde', false ],
        fail : [ -4, 4, 'abcdE', 'abc', null, {}, [] ],
    },
    AnyType : {
        ok: [ 1, "abc", null, true, false, 1.23, [], {} ],
        fail: [ undefined ],
    },
    MapAny : {
        ok: [ { f: null }, { f: false }, { f: 1 } ],
        fail: [ {}, { f: undefined } ],
    },
    Array : {
        ok: [ [], [ 1 ], [ 1, 2, 3 ] ],
        fail: [ [ 1, 2, 3, 4 ], null, undefined, true ],
    },
    Data : {
        ok: [ new Uint8Array( 3 ), new Uint8Array( 4 ), new Uint8Array( 5 ) ],
        fail: [ new Uint8Array( 2 ), new Uint8Array( 6 ) ],
    },
};

const child = child_process.fork( __dirname + '/node_server.js' );
child.send( { test: true } );
child.on( 'message', function() {
//-------------------------------------
    const internal_endpoint = {
        onInternalRequest : ( as, info, ftnreq ) => {
            as.add( ( as ) => {
                as.success(
                    {
                        r: {
                            res : 'MY_RESULT',
                        },
                    },
                    true
                );
            } );
        },
    };

    const sccm = new SimpleCCM();
    sccm.limitZone( 'default', {
        concurrent: 0xFFFF,
        rate: 0xFFFF,
    } );

    const accm = new AdvancedCCM( {
        specDirs : `${__dirname}/specs`,
    } );
    accm.limitZone( 'default', {
        concurrent: 0xFFFF,
        rate: 0xFFFF,
    } );

    let siface_http;
    let aiface_http;
    let siface_ws;
    let aiface_ws;
    let siface_internal;
    let aiface_internal;
    
    let iface_info;

    const error_handler = ( as, err ) => {
        console.log( `${err}:${as.state.error_info}` );
    };

    const suite = optihelp( 'Invoker', {
        //do_profile: true,
    } )
        .test( 'SimpleCCM unregister-register', $as_test( (as) => {
            sccm.unRegister( 'httpJSON' );
            sccm.register( as, 'httpJSON', 'fileface.a:1.1',
                'secure+http://localhost:23456/ftn',
                null );
        } ) )
        .test( 'AdvancedCCM unregister-register', $as_test( (as) => {
            accm.unRegister( 'httpJSON' );
            accm.register( as, 'httpJSON', 'fileface.a:1.1',
                'secure+http://localhost:23456/ftn',
                null );
        } ) )
        .test( 'iface()', () => {
            siface_http = sccm.iface( 'httpJSON' );
            aiface_http = accm.iface( 'httpJSON' );
        } )
        .test( 'SimpleCCM INTERNAL call', $as_test( (as) => {
            siface_internal.call(
                as,
                'testFunc',
                {
                    a : "1",
                    n : 2.8,
                    o : { m : 3 },
                    i : 4,
                }
            );
        } ) )
        .test( 'AdvancedCCM INTERNAL call', $as_test( (as) => {
            aiface_internal.call(
                as,
                'testFunc',
                {
                    a : "1",
                    n : 2.8,
                    o : { m : 3 },
                    i : 4,
                }
            );
        } ) )
        .test( 'SimpleCCM HTTP call', $as_test( (as) => {
            siface_http.call(
                as,
                'testFunc',
                {
                    a : "1",
                    n : 2.8,
                    o : { m : 3 },
                    i : 4,
                }
            );
        } ) )
        .test( 'AdvancedCCM HTTP call', $as_test( (as) => {
            aiface_http.call(
                as,
                'testFunc',
                {
                    a : "1",
                    n : 2.8,
                    o : { m : 3 },
                    i : 4,
                }
            );
        } ) )
        .test( 'SimpleCCM WS call', $as_test( (as) => {
            siface_ws.call(
                as,
                'testFunc',
                {
                    a : "1",
                    n : 2.8,
                    o : { m : 3 },
                    i : 4,
                }
            );
        } ) )
        .test( 'AdvancedCCM WS call', $as_test( (as) => {
            aiface_ws.call(
                as,
                'testFunc',
                {
                    a : "1",
                    n : 2.8,
                    o : { m : 3 },
                    i : 4,
                }
            );
        } ) )
        .test( 'AdvancedCCM INTERNAL call with interceptor', $as_test( (as) => {
            aiface_internal.testFunc(
                as,
                "1",
                2.8,
                { m : 3 },
                4
            );
        } ) )
        .test( 'Load Spec', $as_test( (as) => {
            iface_info = {
                iface: IFACE_SPEC.iface,
                version: IFACE_SPEC.version,
            };
            
            SpecTools.loadIface( as, iface_info, [ IFACE_SPEC ] );
        } ) )
        .test( 'Type Test', $as_test( (as) => {
            as.forEach( TYPE_TESTS, ( as, type, v ) => {
                as.forEach( v.ok, ( as, i, t ) => {
                    if ( !SpecTools.checkType( iface_info, type, t ) ) {
                        throw new Error( 'Failed at ' + type + " " + t );
                    }
                } );
                as.forEach( v.fail, ( as, i, t ) => {
                    if ( SpecTools.checkType( iface_info, type, t ) ) {
                        throw new Error( 'Failed at ' + type + " " + t );
                    }
                } );
            } );
        } ) )
        ;

    $as().add(
        ( as ) => {
            as.add( ( as ) => {
                sccm.register( as, 'httpJSON', 'fileface.a:1.1',
                    'secure+http://localhost:23456/ftn',
                    null );
                accm.register( as, 'httpJSON', 'fileface.a:1.1',
                    'secure+http://localhost:23456/ftn',
                    null );
                sccm.register( as, 'wsJSON', 'fileface.a:1.1',
                    'secure+ws://localhost:23456/ftn',
                    null );
                accm.register( as, 'wsJSON', 'fileface.a:1.1',
                    'secure+ws://localhost:23456/ftn',
                    null );
                sccm.register( as, 'internalJSON', 'fileface.a:1.1',
                    internal_endpoint );
                accm.register( as, 'internalJSON', 'fileface.a:1.1',
                    internal_endpoint );
                
                // ---
                iface_info = {
                    iface: IFACE_SPEC.iface,
                    version: IFACE_SPEC.version,
                };
                
                SpecTools.loadIface( as, iface_info, [ IFACE_SPEC ] );
            } );
            as.add( ( as ) => {
                siface_http = sccm.iface( 'httpJSON' );
                aiface_http = accm.iface( 'httpJSON' );
                siface_ws = sccm.iface( 'wsJSON' );
                aiface_ws = accm.iface( 'wsJSON' );
                siface_internal = sccm.iface( 'internalJSON' );
                aiface_internal = accm.iface( 'internalJSON' );
            } );
            as.add( ( as ) => {
                as.waitExternal();
                suite.start( ( result ) => {
                    as.success();
                } );
            } );
            as.add( ( as ) => {
                child.kill();
            } );
        },
        ( as, err ) => {
            child.kill();
            console.log( err );
            console.log( as.state.error_info );
        } )
        .execute();
//-------------------------------------
} );

