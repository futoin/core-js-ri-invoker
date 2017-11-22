'use strict';

var assert;
var async_steps = require( 'futoin-asyncsteps' );
var _ = require( 'lodash' );
var common = require( '../lib/common' );
var isNode = common._isNode;
var invoker;
var as;

var thisDir;

if ( !isNode )
{
    // Browser test
    chai.should();
    assert = chai.assert;

    thisDir = '.';

    invoker = FutoInInvoker;
}
else
{
    // Node test
    var chai_module = module.require( 'chai' );

    chai_module.should();
    assert = chai_module.assert;

    thisDir = __dirname;

    invoker = module.require( '../lib/invoker.js' );
    var crypto = module.require( 'crypto' );
}

var SpecTools = invoker.SpecTools;

// SpecTools.on('error', function() { console.log( arguments ) } );

describe( 'SpecTools', function()
{
    beforeEach( function()
    {
        as = async_steps();
    } );

    after( function()
    {
        as = null;
    } );

    describe( '#loadIface', function()
    {
        var testspec = {
            iface : 'test.spec',
            version : '2.3',
            funcs : {
            },
        };

        it( 'should load spec from file', function( done )
        {
            if ( !isNode )
            {
                done();
                return;
            }

            var info = {
                iface : 'fileface.a',
                version : '1.1',
            };

            as.add(
                function( as )
                {
                    SpecTools.loadIface(
                        as,
                        info,
                        [ thisDir + '/specs' ]
                    );
                },
                function( as, err )
                {
                    done( as.state.last_exception );
                }
            ).
                add( function( as )
                {
                    try
                    {
                        info.funcs.should.have.property( 'testFunc' );
                        done();
                    }
                    catch ( e )
                    {
                        done( e );
                    }
                } );
            as.execute();
        } );

        it( 'should load spec from url', function( done )
        {
            var info = {
                iface : 'fileface.a',
                version : '1.1',
            };

            as.add(
                function( as )
                {
                    SpecTools.loadIface(
                        as,
                        info,
                        [ 'not_existing', 'http://localhost:8000/test/specs' ]
                    );
                },
                function( as, err )
                {
                    console.log( err + ': ' + as.state.error_info );
                    console.log( as.state.last_exception );
                    done( as.state.error_info );
                }
            ).
                add( function( as )
                {
                    try
                    {
                        info.funcs.should.have.property( 'testFunc' );
                        done();
                    }
                    catch ( e )
                    {
                        done( e );
                    }
                } );
            as.execute();
        } );

        it( 'should load spec from cache', function( done )
        {
            var info = {
                iface : 'fileface.a',
                version : '1.1',
            };

            var load_cache = {};

            as.add(
                function( as )
                {
                    SpecTools.loadIface(
                        as,
                        info,
                        [ 'not_existing', 'http://localhost:8000/test/specs' ],
                        load_cache
                    );
                },
                function( as, err )
                {
                    console.log( err + ': ' + as.state.error_info );
                    done( as.state.last_exception );
                }
            )
                .add(
                    function( as )
                    {
                        load_cache[ 'fileface.a:1.1:e' ].comes_from_cache = true;
                        SpecTools.loadIface(
                            as,
                            info,
                            [ 'not_existing', 'http://localhost:8000/test/specs' ],
                            load_cache
                        );
                    },
                    function( as, err )
                    {
                        console.log( err + ': ' + as.state.error_info );
                        done( as.state.last_exception );
                    }
                )
                .add( function( as )
                {
                    try
                    {
                        info.should.have.property( 'comes_from_cache' );
                        done();
                    }
                    catch ( e )
                    {
                        done( e );
                    }
                } );
            as.execute();
        } );

        it( 'should handle ftn3rev correctly', function( done )
        {
            var info = {
                iface : 'test.face',
                version: '1.0',
            };

            as.add(
                function( as )
                {
                    var iface = {
                        iface : info.iface,
                        version: info.version,
                        imports: [],
                    };

                    SpecTools.loadIface( as, info, [ iface ] );
                },
                function( as, err )
                {
                    try
                    {
                        err.should.equal( 'InternalError' );
                        as.state.error_info.should.equal( "Import is FTN3 v1.1 feature" );
                        as.success( 'OK' );
                    }
                    catch ( e )
                    {
                        done( e );
                    }
                }
            ).add(
                function( as, ok )
                {
                    ok.should.equal( 'OK' );

                    var iface = {
                        iface : info.iface,
                        version: info.version,
                        types: {},
                    };

                    SpecTools.loadIface( as, info, [ iface ] );
                },
                function( as, err )
                {
                    try
                    {
                        err.should.equal( 'InternalError' );
                        as.state.error_info.should.equal( "Custom types is FTN3 v1.1 feature" );
                        as.success( 'OK' );
                    }
                    catch ( e )
                    {
                        done( e );
                    }
                }
            ).add(
                function( as, ok )
                {
                    ok.should.equal( 'OK' );

                    var iface = {
                        iface : info.iface,
                        version: info.version,
                        requires: [ 'BiDirectChannel' ],
                    };

                    SpecTools.loadIface( as, info, [ iface ] );
                },
                function( as, err )
                {
                    try
                    {
                        err.should.equal( 'InternalError' );
                        as.state.error_info.should.equal( "BiDirectChannel is FTN3 v1.1 feature" );
                        as.success( 'OK' );
                    }
                    catch ( e )
                    {
                        done( e );
                    }
                }
            ).add(
                function( as, ok )
                {
                    ok.should.equal( 'OK' );

                    var iface = {
                        iface : info.iface,
                        version: info.version,
                        requires: [ 'MessageSignature' ],
                    };

                    SpecTools.loadIface( as, info, [ iface ] );
                },
                function( as, err )
                {
                    try
                    {
                        err.should.equal( 'InternalError' );
                        as.state.error_info.should.equal( "MessageSignature is FTN3 v1.2 feature" );
                        as.success( 'OK' );
                    }
                    catch ( e )
                    {
                        done( e );
                    }
                }
            ).add(
                function( as, ok )
                {
                    ok.should.equal( 'OK' );

                    var iface = {
                        iface : info.iface,
                        version: info.version,
                        funcs: {
                            test: {
                                seclvl: 'OPS',
                            },
                        },
                    };

                    SpecTools.loadIface( as, info, [ iface ] );
                },
                function( as, err )
                {
                    try
                    {
                        err.should.equal( 'InternalError' );
                        as.state.error_info.should.equal( "Function seclvl is FTN3 v1.3 feature" );
                        as.success( 'OK' );
                    }
                    catch ( e )
                    {
                        done( e );
                    }
                }
            ).add(
                function( as, ok )
                {
                    ok.should.equal( 'OK' );

                    var iface = {
                        iface : info.iface,
                        version: info.version,
                        ftn3rev: "1.3",
                        types: {
                            Str: "string",
                        },
                    };

                    SpecTools.loadIface( as, info, [ iface ] );
                },
                function( as, err )
                {
                    try
                    {
                        err.should.equal( 'InternalError' );
                        as.state.error_info.should.equal( "Type shortcut is FTN3 v1.4 feature" );
                        as.success( 'OK' );
                    }
                    catch ( e )
                    {
                        done( e );
                    }
                }
            ).add(
                function( as, ok )
                {
                    ok.should.equal( 'OK' );

                    var iface = {
                        iface : info.iface,
                        version: info.version,
                        ftn3rev: "1.4",
                        types: {
                            Str: "string",
                            StrMin: {
                                type: "Str",
                                minlen: 1,
                            },
                        },
                    };

                    SpecTools.loadIface( as, info, [ iface ] );
                    as.add( ( as ) => as.success( 'Fail' ) );
                },
                function( as, err )
                {
                    try
                    {
                        err.should.equal( 'InternalError' );
                        as.state.error_info.should.equal( "String min/maxlen is FTN3 v1.5 feature" );
                        as.success( 'OK' );
                    }
                    catch ( e )
                    {
                        done( e );
                    }
                }
            ).add(
                function( as, ok )
                {
                    ok.should.equal( 'OK' );

                    var iface = {
                        iface : info.iface,
                        version: info.version,
                        ftn3rev: "1.5",
                        types: {
                            Map: "map",
                            MapElemType: {
                                type: "Map",
                                elemtype: 'string',
                            },
                        },
                    };

                    SpecTools.loadIface( as, info, [ iface ] );
                },
                function( as, err )
                {
                    try
                    {
                        err.should.equal( 'InternalError' );
                        as.state.error_info.should.equal( "Map elemtype is FTN3 v1.6 feature" );
                        as.success( 'OK' );
                    }
                    catch ( e )
                    {
                        done( e );
                    }
                }
            ).add(
                function( as, ok )
                {
                    ok.should.equal( 'OK' );

                    var iface = {
                        iface : info.iface,
                        version: info.version,
                        ftn3rev: "1.5",
                        types: {
                            Enum: "enum",
                        },
                    };

                    SpecTools.loadIface( as, info, [ iface ] );
                },
                function( as, err )
                {
                    try
                    {
                        err.should.equal( 'InternalError' );
                        as.state.error_info.should.equal( "Enum/Set is FTN3 v1.6 feature" );
                        as.success( 'OK' );
                    }
                    catch ( e )
                    {
                        done( e );
                    }
                }
            ).add(
                function( as, ok )
                {
                    ok.should.equal( 'OK' );

                    var iface = {
                        iface : info.iface,
                        version: info.version,
                        ftn3rev: "1.5",
                        types: {
                            Or: [ "enum", "string" ],
                        },
                    };

                    SpecTools.loadIface( as, info, [ iface ] );
                },
                function( as, err )
                {
                    try
                    {
                        err.should.equal( 'InternalError' );
                        as.state.error_info.should.equal( "Type variant is FTN3 v1.6 feature" );
                        as.success( 'OK' );
                    }
                    catch ( e )
                    {
                        done( e );
                    }
                }
            ).add(
                function( as, ok )
                {
                    ok.should.equal( 'OK' );

                    var iface = {
                        iface : info.iface,
                        version: info.version,
                        ftn3rev: '1.' + ( 1 + SpecTools._max_supported_v1_minor ),
                    };

                    SpecTools.loadIface( as, info, [ iface ] );
                },
                function( as, err )
                {
                    try
                    {
                        err.should.equal( 'InternalError' );
                        as.state.error_info.should.equal( "Not supported FTN3 revision for Executor" );
                        as.success( 'OK' );
                    }
                    catch ( e )
                    {
                        done( e );
                    }
                }
            ).add(
                function( as, ok )
                {
                    ok.should.equal( 'OK' );

                    var iface = {
                        iface : info.iface,
                        version: info.version,
                        ftn3rev: '1.' + ( 1 + SpecTools._max_supported_v1_minor ),
                    };

                    SpecTools.loadIface( as, info, [ iface ] );
                },
                function( as, err )
                {
                    try
                    {
                        err.should.equal( 'InternalError' );
                        as.state.error_info.should.equal( "Not supported FTN3 revision for Executor" );
                        as.success( 'OK' );
                    }
                    catch ( e )
                    {
                        done( e );
                    }
                }
            ).add(
                function( as, ok )
                {
                    ok.should.equal( 'OK' );

                    var iface = {
                        iface : info.iface,
                        version: info.version,
                        ftn3rev: '1.' + ( 1 + SpecTools._max_supported_v1_minor ),
                    };

                    info._invoker_use = true;
                    SpecTools.loadIface( as, info, [ iface ] );
                },
                function( as, err )
                {
                    done( as.state.last_exception );
                }
            ).add(
                function( as, ok )
                {
                    assert.isUndefined( ok );

                    var iface = {
                        iface : info.iface,
                        version: info.version,
                        ftn3rev: '2.0',
                    };

                    info._invoker_use = true;
                    SpecTools.loadIface( as, info, [ iface ] );
                },
                function( as, err )
                {
                    try
                    {
                        err.should.equal( 'InternalError' );
                        as.state.error_info.should.equal( "Not supported FTN3 revision" );
                        as.success( 'OK' );
                    }
                    catch ( e )
                    {
                        done( e );
                    }
                }
            ).add(
                function( as, ok )
                {
                    ok.should.equal( 'OK' );
                    done();
                }
            ).execute();
        } );

        it ( 'should fail to find with invalid version', function( done )
        {
            as.add(
                function( as )
                {
                    SpecTools.loadIface(
                        as,
                        {
                            iface : 'test.spec',
                            version : 2.4,
                        },
                        [ 'somedir', testspec ]
                    );
                    as.successStep();
                },
                function( as, err )
                {
                    try
                    {
                        err.should.equal( 'InternalError' );
                        as.state.error_info.should.match( /^Failed to load valid spec for/ );
                        done();
                    }
                    catch ( ex )
                    {
                        done( ex );
                    }
                }
            ).execute();
        } );

        it ( 'should load iface without funcs', function( done )
        {
            as.add(
                function( as )
                {
                    SpecTools.loadIface(
                        as,
                        {
                            iface : 'test.spec',
                            version : '2.4',
                        },
                        [ 'somedir',
                            {
                                iface : 'test.spec',
                                version : '2.4',
                            },
                        ]
                    );
                }
            ).add( function( as )
            {
                done();
            } ).execute();
        } );

        it ( 'should fail to load iface with different version', function( done )
        {
            as.add(
                function( as )
                {
                    SpecTools.loadIface(
                        as,
                        {
                            iface : 'test.spec',
                            version : '2.4',
                        },
                        [ 'somedir', testspec ]
                    );
                    as.successStep();
                },
                function( as, err )
                {
                    try
                    {
                        err.should.equal( 'InternalError' );
                        as.state.error_info.should.match( /^Failed to load valid spec for/ );
                        done();
                    }
                    catch ( ex )
                    {
                        done( ex );
                    }
                }
            );

            as.execute();
        } );

        it ( 'should fail on params without type', function( done )
        {
            as.add(
                function( as )
                {
                    var spec = _.cloneDeep( testspec );

                    spec.funcs.missingParam = {
                        params : {
                            a : {
                                type : "string",
                            },
                            b : {
                                default : "B",
                            },
                        },
                    };

                    SpecTools.loadIface(
                        as,
                        {
                            iface : 'test.spec',
                            version : '2.3',
                        },
                        [ 'somedir', spec ]
                    );
                    as.successStep();
                },
                function( as, err )
                {
                    try
                    {
                        err.should.equal( 'InternalError' );
                        as.state.error_info.should.match( /^Missing type for params/ );
                        done();
                    }
                    catch ( ex )
                    {
                        done( ex );
                    }
                }
            );

            as.execute();
        } );

        it ( 'should fail on result without type', function( done )
        {
            as.add(
                function( as )
                {
                    var spec = _.cloneDeep( testspec );

                    spec.funcs.missingResult = {
                        result : {
                            a : {
                                type : "string",
                            },
                            b : {},
                        },
                    };

                    SpecTools.loadIface(
                        as,
                        {
                            iface : 'test.spec',
                            version : '2.3',
                        },
                        [ 'somedir', spec ]
                    );
                    as.successStep();
                },
                function( as, err )
                {
                    try
                    {
                        err.should.equal( 'InternalError' );
                        as.state.error_info.should.match( /^Missing type for result/ );
                        done();
                    }
                    catch ( ex )
                    {
                        done( ex );
                    }
                }
            );

            as.execute();
        } );

        it ( 'should fail on params not object', function( done )
        {
            as.add(
                function( as )
                {
                    var spec = _.cloneDeep( testspec );

                    spec.funcs.missingResult = {
                        params : true,
                    };

                    SpecTools.loadIface(
                        as,
                        {
                            iface : 'test.spec',
                            version : '2.3',
                        },
                        [ 'somedir', spec ]
                    );
                    as.successStep();
                },
                function( as, err )
                {
                    try
                    {
                        err.should.equal( 'InternalError' );
                        as.state.error_info.should.match( /^Invalid params object/ );
                        done();
                    }
                    catch ( ex )
                    {
                        done( ex );
                    }
                }
            );

            as.execute();
        } );

        it ( 'should fail on param not object', function( done )
        {
            as.add(
                function( as )
                {
                    var spec = _.cloneDeep( testspec );

                    spec.funcs.missingResult = {
                        params : {
                            a : true,
                        },
                    };

                    SpecTools.loadIface(
                        as,
                        {
                            iface : 'test.spec',
                            version : '2.3',
                        },
                        [ 'somedir', spec ]
                    );
                    as.successStep();
                },
                function( as, err )
                {
                    try
                    {
                        err.should.equal( 'InternalError' );
                        as.state.error_info.should.match( /^Invalid param object/ );
                        done();
                    }
                    catch ( ex )
                    {
                        done( ex );
                    }
                }
            );

            as.execute();
        } );

        it ( 'should fail on result not object', function( done )
        {
            as.add(
                function( as )
                {
                    var spec = _.cloneDeep( testspec );

                    spec.funcs.missingResult = {
                        result : true,
                    };

                    SpecTools.loadIface(
                        as,
                        {
                            iface : 'test.spec',
                            version : '2.3',
                        },
                        [ 'somedir', spec ]
                    );
                    as.successStep();
                },
                function( as, err )
                {
                    try
                    {
                        err.should.equal( 'InternalError' );
                        as.state.error_info.should.match( /^Invalid result object/ );
                        done();
                    }
                    catch ( ex )
                    {
                        done( ex );
                    }
                }
            );

            as.execute();
        } );

        it ( 'should fail on resultvar not object', function( done )
        {
            as.add(
                function( as )
                {
                    var spec = _.cloneDeep( testspec );

                    spec.funcs.missingResult = {
                        result : {
                            a : true,
                        },
                    };

                    SpecTools.loadIface(
                        as,
                        {
                            iface : 'test.spec',
                            version : '2.3',
                        },
                        [ 'somedir', spec ]
                    );
                    as.successStep();
                },
                function( as, err )
                {
                    try
                    {
                        err.should.equal( 'InternalError' );
                        as.state.error_info.should.match( /^Invalid resultvar object/ );
                        done();
                    }
                    catch ( ex )
                    {
                        done( ex );
                    }
                }
            );

            as.execute();
        } );

        it ( 'should fail on throws not array', function( done )
        {
            as.add(
                function( as )
                {
                    var spec = _.cloneDeep( testspec );

                    spec.funcs.missingResult = {
                        result : {
                            a : {
                                type : "string",
                            },
                        },
                        throws : true,
                    };

                    SpecTools.loadIface(
                        as,
                        {
                            iface : 'test.spec',
                            version : '2.3',
                        },
                        [ 'somedir', spec ]
                    );
                    as.successStep();
                },
                function( as, err )
                {
                    try
                    {
                        err.should.equal( 'InternalError' );
                        as.state.error_info.should.match( /^"throws" is not array/ );
                        done();
                    }
                    catch ( ex )
                    {
                        done( ex );
                    }
                }
            );

            as.execute();
        } );

        it ( 'should fail on requires not array', function( done )
        {
            as.add(
                function( as )
                {
                    var spec = _.cloneDeep( testspec );

                    spec.funcs.missingResult = {
                        result : {
                            a : {
                                type : "string",
                            },
                        },
                        throws : [ 'SomeError' ],
                    };
                    spec.requires = true;

                    SpecTools.loadIface(
                        as,
                        {
                            iface : 'test.spec',
                            version : '2.3',
                        },
                        [ 'somedir', spec ]
                    );
                    as.successStep();
                },
                function( as, err )
                {
                    try
                    {
                        err.should.equal( 'InternalError' );
                        as.state.error_info.should.match( /^"requires" is not array/ );
                        done();
                    }
                    catch ( ex )
                    {
                        done( ex );
                    }
                }
            );

            as.execute();
        } );

        it ( 'should load with no requires', function( done )
        {
            as.add(
                function( as )
                {
                    var spec = _.cloneDeep( testspec );

                    spec.funcs.missingResult = {
                        result : {
                            a : {
                                type : "string",
                            },
                        },
                        throws : [ 'SomeError' ],
                    };

                    SpecTools.loadIface(
                        as,
                        {
                            iface : 'test.spec',
                            version : '2.3',
                        },
                        [ 'somedir', spec ]
                    );
                    as.successStep();
                },
                function( as, err )
                {
                    done( new Error( err + ": " + as.state.error_info ) );
                }
            ).add( function( as )
            {
                done();
            } );

            as.execute();
        } );

        it ( 'should fail on integer type mismatch', function( done )
        {
            as.add(
                function( as )
                {
                    SpecTools.checkFutoInType( as, 'integer', 'var', 1 );
                    as.state.var = true;
                    SpecTools.checkFutoInType( as, 'integer', 'var2', 1.3 );
                    as.successStep();
                },
                function( as, err )
                {
                    try
                    {
                        err.should.equal( 'InvalidRequest' );
                        as.state.error_info.should.match( /^Type mismatch for parameter/ );
                        as.state.var.should.be.true;
                        done();
                    }
                    catch ( ex )
                    {
                        done( ex );
                    }
                }
            );

            as.execute();
        } );

        it ( 'should fail on boolean type mismatch', function( done )
        {
            as.add(
                function( as )
                {
                    SpecTools.checkFutoInType( as, 'boolean', 'var', true );
                    as.state.var = true;
                    SpecTools.checkFutoInType( as, 'boolean', 'var2', 'true' );
                    as.successStep();
                },
                function( as, err )
                {
                    try
                    {
                        err.should.equal( 'InvalidRequest' );
                        as.state.error_info.should.match( /^Type mismatch for parameter/ );
                        as.state.var.should.be.true;
                        done();
                    }
                    catch ( ex )
                    {
                        done( ex );
                    }
                }
            );

            as.execute();
        } );

        it ( 'should correctly process imports', function( done )
        {
            var baseface = {
                iface: 'base.face',
                version: '2.1',
                ftn3rev: '1.1',
                types: {
                    MyString : {
                        type: 'string',
                    },
                },
                funcs: {
                    FirstFunc : {
                        rawresult : true,
                    },
                },
            };

            var derivedface = {
                iface: 'derived.face',
                version: '1.0',
                ftn3rev: '1.1',
                imports: [
                    'base.face:2.1',
                ],
                types: {
                    MyInt : {
                        type: 'integer',
                    },
                },
                funcs: {
                    SecondFunc : {
                        rawresult : true,
                    },
                },
            };

            var load_info = {
                iface : 'derived.face',
                version : '1.0',
            };

            as.add(
                function( as )
                {
                    SpecTools.loadIface(
                        as,
                        load_info,
                        [ baseface, derivedface ] );
                },
                function( as, err )
                {
                    done( as.state.last_exception );
                }
            ).add( function( as )
            {
                try
                {
                    load_info.types.should.have.property( 'MyString' );
                    load_info.types.should.have.property( 'MyInt' );
                    load_info.inherits.should.be.empty;
                    load_info.funcs.should.have.property( 'FirstFunc' );
                    load_info.funcs.should.have.property( 'SecondFunc' );
                    load_info.imports[0].should.equal( 'base.face:2.1' );
                    done();
                }
                catch ( e )
                {
                    done( e );
                }
            } ).execute();
        } );

        it ( 'should correctly process diamond import', function( done )
        {
            var baseface = {
                iface: 'base.face',
                version: '2.1',
                ftn3rev: '1.4',
                types: {
                    MyString : {
                        type: 'string',
                    },
                },
                funcs: {
                    FirstFunc : {
                        rawresult : true,
                    },
                },
            };

            var newer_baseface = {
                iface: 'base.face',
                version: '2.2',
                ftn3rev: '1.4',
                types: {
                    MyString : {
                        type: 'string',
                    },
                    MyString2 : {
                        type: 'string',
                    },
                },
                funcs: {
                    FirstFunc : {
                        rawresult : true,
                    },
                },
            };

            var derivedface1 = {
                iface: 'derived.face1',
                version: '1.0',
                ftn3rev: '1.4',
                imports: [
                    'base.face:2.2',
                ],
                types: {
                    MyInt : {
                        type: 'integer',
                    },
                },
                funcs: {
                    SecondFunc : {
                        rawresult : true,
                    },
                },
            };

            var derivedface2 = {
                iface: 'derived.face2',
                version: '1.0',
                ftn3rev: '1.4',
                imports: [
                    'base.face:2.1',
                ],
                types: {
                    MyInt2 : {
                        type: 'integer',
                    },
                },
                funcs: {
                    ThirdFunc : {
                        rawresult : true,
                    },
                },
            };

            var topface = {
                iface: 'top.face',
                version: '1.0',
                ftn3rev: '1.4',
                imports: [
                    'derived.face1:1.0',
                    'derived.face2:1.0',
                ],
            };

            var load_info = {
                iface : 'top.face',
                version : '1.0',
            };

            as.add(
                function( as )
                {
                    SpecTools.loadIface(
                        as,
                        load_info,
                        [ baseface, newer_baseface, derivedface1, derivedface2, topface ] );
                },
                function( as, err )
                {
                    console.log( as.state.error_info );
                    done( as.state.last_exception );
                }
            ).add( function( as )
            {
                try
                {
                    load_info.types.should.have.property( 'MyString' );
                    load_info.types.should.have.property( 'MyString2' );
                    load_info.types.should.have.property( 'MyInt' );
                    load_info.types.should.have.property( 'MyInt2' );
                    load_info.inherits.should.be.empty;
                    load_info.funcs.should.have.property( 'FirstFunc' );
                    load_info.funcs.should.have.property( 'SecondFunc' );
                    load_info.funcs.should.have.property( 'ThirdFunc' );
                    load_info.imports.should.be.eql( [
                        'base.face:2.2',
                        'derived.face2:1.0',
                        'derived.face1:1.0',
                    ] );
                    done();
                }
                catch ( e )
                {
                    done( e );
                }
            } ).execute();
        } );

        it ( 'should properly check standard types', function( done )
        {
            this.timeout( 10e3 );
            var tests = {
                any : {
                    ok : [ true, false, 'yes', 1, 1.1, {}, [], null ],
                    fail : [ undefined ],
                },
                string : {
                    ok : [ 'yes' ],
                    fail : [ true, false, 1, 1.1, {}, [], null, undefined ],
                },
                number : {
                    ok : [ 1, 1.1, -1, 100 ],
                    fail : [ true, false, 'yes', {}, [], null, undefined ],
                },
                integer : {
                    ok : [ 1, 2, -1 ],
                    fail : [ true, false, 'yes', 1.1, {}, [], null, undefined ],
                },
                boolean : {
                    ok : [ true, false ],
                    fail : [ 'yes', 1, 1.1, {}, [], null, undefined ],
                },
                array : {
                    ok : [ [] ],
                    fail : [ true, false, 'yes', 1, 1.1, {}, null, undefined ],
                },
                map : {
                    ok : [ {} ],
                    fail : [ true, false, 'yes', 1, 1.1, [], null, undefined ],
                },
            };

            as.forEach( tests, function( as, type, v )
            {
                as.add( function( as )
                {
                    as.forEach( v.ok, function( as, i, t )
                    {
                        SpecTools.checkFutoInType( as, type, type + ':ok', t );
                    } );
                    as.forEach( v.fail, function( as, i, t )
                    {
                        as.add(
                            function( as )
                            {
                                SpecTools.checkFutoInType( as, type, type + ':fail', t );
                                as.success( `Fail at ${type} : ${t}` );
                            },
                            function( as, err )
                            {
                                as.state.error_info.should.match( /^Type mismatch for parameter/ );
                                as.success( 'OK' );
                            }
                        ).add( function( as, ok )
                        {
                            ok.should.equal( 'OK' );
                        } );
                    } );
                },
                function( as, err )
                {
                    done( as.state.last_exception );
                } );
            } ).add( function( as )
            {
                done();
            } ).execute();
        } );

        it ( 'should process custom type constraints', function( done )
        {
            this.timeout( 5e3 );
            var iface = {
                iface: 'some.face',
                version: '1.0',
                ftn3rev: '1.7',
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
                },
            };

            var info = {
                iface: iface.iface,
                version: iface.version,
            };

            var tests = {
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
                    ok : [ 2, 3, 'abcde', false ],
                    fail : [ 1, 4, 'abcdE', 'abc', null, {}, [] ],
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
            };

            as.add(
                function( as )
                {
                    SpecTools.loadIface( as, info, [ iface ] );
                },
                function( as, err )
                {
                    done( as.state.last_exception );
                }
            ).forEach( tests, function( as, type, v )
            {
                as.add( function( as )
                {
                    as.forEach( v.ok, function( as, i, t )
                    {
                        if ( !SpecTools.checkType( info, type, t ) )
                        {
                            throw new Error( 'Failed at ' + type + " " + t );
                        }
                    } );
                    as.forEach( v.fail, function( as, i, t )
                    {
                        if ( SpecTools.checkType( info, type, t ) )
                        {
                            throw new Error( 'Failed at ' + type + " " + t );
                        }
                    } );
                },
                function( as, err )
                {
                    done( as.state.last_exception );
                } );
            } ).add( function( as )
            {
                done();
            } ).execute();
        } );
    } );


    it ( 'should allow null for default null parameter', function( done )
    {
        this.timeout( 5e3 );
        var iface = {
            iface: 'some.face',
            version: '1.0',
            ftn3rev: '1.7',
            funcs: {
                test: {
                    params: {
                        required : {
                            type: "string",
                        },
                        nullable: {
                            type: "string",
                            default: null,
                        },
                    },
                },
            },
        };

        var info = {
            iface: iface.iface,
            version: iface.version,
        };

        as.add(
            function( as )
            {
                SpecTools.loadIface( as, info, [ iface ] );
            },
            function( as, err )
            {
                done( as.state.last_exception );
            }
        ).add(
            function( as )
            {
                SpecTools.checkParameterType( info, "test", "nullable", "abc" ).should.be.true;
                SpecTools.checkParameterType( info, "test", "nullable", null ).should.be.true;
                SpecTools.checkParameterType( info, "test", "required", "abc" ).should.be.true;
                SpecTools.checkParameterType( info, "test", "required", null ).should.be.false;
                done();
            },
            function( as, err )
            {
                console.log( err, as.state.error_info );
                done( as.state.last_exception );
            }
        ).execute();
    } );

    it ( 'should allow type definition shortcut', function( done )
    {
        this.timeout( 5e3 );
        var iface = {
            iface: 'some.face',
            version: '1.0',
            ftn3rev: '1.4',
            types: {
                MyNum: 'integer',
                MyOtherNum: 'MyNum',
                MyObj: {
                    type: 'map',
                    fields : {
                        num: 'MyOtherNum',
                    },
                },
            },
            funcs: {
                test: {
                    params: {
                        myobj : 'MyObj',
                    },
                    result: {
                        resobj: 'MyObj',
                    },
                },
            },
        };

        var info = {
            iface: iface.iface,
            version: iface.version,
        };

        as.add(
            function( as )
            {
                SpecTools.loadIface( as, info, [ iface ] );
            },
            function( as, err )
            {
                console.log( err, as.state.error_info );
                done( as.state.last_exception );
            }
        ).add(
            function( as )
            {
                SpecTools.checkParameterType( info, "test", "myobj", { num: 1 } ).should.be.true;
                SpecTools.checkParameterType( info, "test", "myobj", { num: '1' } ).should.be.false;
                SpecTools.checkResultType( as, info, "test", "resobj", { num: 1 } );
                done();
            },
            function( as, err )
            {
                console.log( err, as.state.error_info );
                done( as.state.last_exception );
            }
        ).execute();
    } );

    it( 'should allow custom result type', function( done )
    {
        this.timeout( 5e3 );
        var iface = {
            iface: 'some.face',
            version: '1.0',
            ftn3rev: '1.7',
            funcs: {
                test: {
                    params: {
                        required : {
                            type: "string",
                        },
                        nullable: {
                            type: "string",
                            default: null,
                        },
                    },
                    result: "boolean",
                },
            },
        };

        var info = {
            iface: iface.iface,
            version: iface.version,
        };

        as.add(
            function( as )
            {
                SpecTools.loadIface( as, info, [ iface ] );
            },
            function( as, err )
            {
                console.log( err, as.state.error_info );
                done( as.state.last_exception );
            }
        ).add(
            function( as )
            {
                SpecTools.checkParameterType( info, "test", "nullable", "abc" ).should.be.true;
                SpecTools.checkParameterType( info, "test", "nullable", null ).should.be.true;
                SpecTools.checkParameterType( info, "test", "required", "abc" ).should.be.true;
                SpecTools.checkParameterType( info, "test", "required", null ).should.be.false;
                done();
            },
            function( as, err )
            {
                done( as.state.last_exception );
            }
        ).execute();
    } );

    it( 'should allow enum in variant', function( done )
    {
        var iface = {
            iface: 'some.face',
            version: '1.0',
            ftn3rev: '1.6',
            types: {
                MyEnum: {
                    type: "enum",
                    items: [ '11', '22', 33 ],
                },
                MyString: {
                    type: "string",
                    minlen: 3,
                    maxlen: 16,
                },
                MyVariant: [ 'MyString', 'MyEnum' ],
            },
        };

        var info = {
            iface: iface.iface,
            version: iface.version,
        };

        as.add(
            function( as )
            {
                SpecTools.loadIface( as, info, [ iface ] );
            },
            function( as, err )
            {
                done( as.state.last_exception || 'Fail' );
            }
        ).add(
            function( as )
            {
                SpecTools.checkType( info, "MyVariant", '22' ).should.be.true;
                SpecTools.checkType( info, "MyVariant", '444' ).should.be.true;
                SpecTools.checkType( info, "MyVariant", 44 ).should.be.false;
                SpecTools.checkType( info, "MyVariant", 33 ).should.be.true;
                done();
            },
            function( as, err )
            {
                done( as.state.last_exception );
            }
        ).execute();
    } );

    if ( isNode )
    {
        describe( '#genHMAC', function()
        {
            var req = {
                rid : 'C1234',
                f : 'some.iface:1.2',
                p : {
                    b : false,
                    a : 'alpha',
                    n : 1.34,
                    o : {
                        b : true,
                        a : 'beta',
                    },
                },
                r : {
                    test : 'alpha',
                },
            };

            var hmacbase = 'f:some.iface:1.2;p:a:alpha;b:false;n:1.34;o:a:beta;b:true;;;r:test:alpha;;rid:C1234;';
            var key = crypto.randomBytes( 200 ); // 1600-bit block size for SHA3
            var keyb64 = key.toString( 'base64' );

            var algos = [ 'MD5', 'SHA224', 'SHA256', 'SHA384', 'SHA512' ];

            it ( 'should correclt create HMAC base', function()
            {
                var b = [];

                SpecTools._hmacBase( b, req );
                b.join( '' ).should.equal( hmacbase );
            } );

            for ( var i = 0, c = algos.length; i < c; ++i )
            {
                ( function( i )
                {
                    var algo = algos[i];
                    var algo_lo = algo.toLowerCase();

                    it ( 'should gen correct ' + algo + ' HMAC', function()
                    {
                        var options = {
                            hmacKey : keyb64,
                            hmacAlgo : algo,
                        };

                        var res1 = SpecTools.genHMAC( as, options, req );
                        var res2 = SpecTools.genHMAC( as, options, req );

                        //SpecTools.hmacbase.should.equal( hmacbase );
                        SpecTools.checkHMAC( res1, res2 ).should.be.true;

                        var testres = crypto
                            .createHmac( algo_lo, key )
                            .update( hmacbase )
                            .digest();

                        SpecTools.checkHMAC( res1, testres ).should.be.true;
                        testres
                            .toString( 'hex' )
                            .should.equal(
                                res1.toString( 'hex' )
                            );
                    } );
                } )( i );
            }
        } );
    }
} );
