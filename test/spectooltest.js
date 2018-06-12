'use strict';

require( './prepare' );

const chai = require( 'chai' );
const { assert, expect } = chai;
const _cloneDeep = require( 'lodash/cloneDeep' );

const is_browser = ( typeof window !== 'undefined' );
const isNode = !is_browser;

const async_steps = require( 'futoin-asyncsteps' );
const invoker = is_browser
    ? require( 'futoin-invoker' )
    : module.require( '../lib/invoker' );

const $as_test = require( 'futoin-asyncsteps/testcase' );

var thisDir;

if ( !isNode ) {
    thisDir = '.';
} else {
    thisDir = __dirname;
    var crypto = module.require( 'crypto' );
}

const {
    SpecTools,
} = invoker;

SpecTools.enableSchemaValidator( false );

// SpecTools.on( 'error', ( ...args ) => console.log( args ) );

describe( 'SpecTools', function() {
    let as;

    beforeEach( function() {
        as = async_steps();
    } );

    after( function() {
        as = null;
    } );

    describe( '#secureObjectPrototype', function() {
        SpecTools.secureObjectPrototype();
    } );

    describe( '#loadIface', function() {
        var testspec = {
            iface : 'test.spec',
            version : '2.3',
            funcs : {
            },
        };

        if ( isNode ) {
            it( 'should load spec from file', $as_test( ( as ) => {
                const info = {
                    iface : 'fileface.a',
                    version : '1.1',
                };

                SpecTools.loadIface(
                    as,
                    info,
                    [ thisDir + '/specs' ]
                );

                as.add( ( as ) => {
                    expect( info.funcs ).have.property( 'testFunc' );
                } );
            } ) );
        }

        it( 'should load spec from url', $as_test( ( as ) => {
            const info = {
                iface : 'fileface.a',
                version : '1.1',
            };

            SpecTools.loadIface(
                as,
                info,
                [ 'not_existing', 'http://localhost:8000/test/specs' ]
            );

            as.add( ( as ) => {
                expect( info.funcs ).have.property( 'testFunc' );
            } );
        } ) );

        it( 'should load spec from cache', $as_test( ( as ) => {
            const info = {
                iface : 'fileface.a',
                version : '1.1',
            };

            const load_cache = {};

            SpecTools.loadIface(
                as,
                info,
                [ 'not_existing', 'http://localhost:8000/test/specs' ],
                load_cache
            );

            as.add( ( as ) => {
                load_cache[ 'fileface.a:1.1:e' ] = Object.assign(
                    { comes_from_cache : true },
                    load_cache[ 'fileface.a:1.1:e' ]
                );
                Object.freeze( load_cache[ 'fileface.a:1.1:e' ] );
                SpecTools.loadIface(
                    as,
                    info,
                    [ 'not_existing', 'http://localhost:8000/test/specs' ],
                    load_cache
                );
            } ) ;
            as.add( ( as ) => {
                expect( info ).have.property( 'comes_from_cache' );
            } );
        } ) );

        describe( 'ftn3rev checks', function() {
            const info = {
                iface : 'test.face',
                version: '1.0',
            };
            Object.freeze( info );

            it( 'should invalid ftn3rev', $as_test(
                ( as ) => {
                    const iface = {
                        iface : info.iface,
                        version: info.version,
                        ftn3rev: '1.2.3',
                    };

                    SpecTools.loadIface( as, Object.assign( {}, info ), [ iface ] );
                },
                ( as, err ) => {
                    expect( err ).equal( 'InternalError' );
                    expect( as.state.error_info ).equal(
                        "Invalid ftn3rev field" );
                    as.success();
                }
            ) );

            it( 'should check v1.1 import', $as_test(
                ( as ) => {
                    const iface = {
                        iface : info.iface,
                        version: info.version,
                        imports: [],
                    };

                    SpecTools.loadIface( as, Object.assign( {}, info ), [ iface ] );
                },
                ( as, err ) => {
                    expect( err ).equal( 'InternalError' );
                    expect( as.state.error_info ).equal(
                        "Import is FTN3 v1.1 feature" );
                    as.success();
                }
            ) );

            it( 'should check v1.1 custom types', $as_test(
                ( as ) => {
                    const iface = {
                        iface : info.iface,
                        version: info.version,
                        types: {},
                    };

                    SpecTools.loadIface( as, Object.assign( {}, info ), [ iface ] );
                },
                ( as, err ) => {
                    expect( err ).equal( 'InternalError' );
                    expect( as.state.error_info ).equal(
                        "Custom types is FTN3 v1.1 feature" );
                    as.success();
                }
            ) );

            it( 'should check v1.1 BiDirectChannel', $as_test(
                ( as ) => {
                    const iface = {
                        iface : info.iface,
                        version: info.version,
                        requires: [ 'BiDirectChannel' ],
                    };

                    SpecTools.loadIface( as, Object.assign( {}, info ), [ iface ] );
                },
                ( as, err ) => {
                    expect( err ).equal( 'InternalError' );
                    expect( as.state.error_info ).equal(
                        "BiDirectChannel is FTN3 v1.1 feature" );
                    as.success();
                }
            ) );

            it( 'should check v1.2 BiDirectChannel', $as_test(
                ( as ) => {
                    const iface = {
                        iface : info.iface,
                        version: info.version,
                        ftn3rev: "1.1",
                        requires: [ 'MessageSignature' ],
                    };

                    SpecTools.loadIface( as, Object.assign( {}, info ), [ iface ] );
                },
                ( as, err ) => {
                    expect( err ).equal( 'InternalError' );
                    expect( as.state.error_info ).equal(
                        "MessageSignature is FTN3 v1.2 feature" );
                    as.success();
                }
            ) );

            it( 'should check v1.3 seclvl', $as_test(
                ( as ) => {
                    const iface = {
                        iface : info.iface,
                        version: info.version,
                        ftn3rev: "1.2",
                        funcs: {
                            test: {
                                seclvl: 'OPS',
                            },
                        },
                    };

                    SpecTools.loadIface( as, Object.assign( {}, info ), [ iface ] );
                },
                ( as, err ) => {
                    expect( err ).equal( 'InternalError' );
                    expect( as.state.error_info ).equal(
                        "Function seclvl is FTN3 v1.3 feature" );
                    as.success();
                }
            ) );

            it( 'should check v1.4 type shortcut: types', $as_test(
                ( as ) => {
                    const iface = {
                        iface : info.iface,
                        version: info.version,
                        ftn3rev: "1.3",
                        types: {
                            Str: "string",
                        },
                    };

                    SpecTools.loadIface( as, Object.assign( {}, info ), [ iface ] );
                },
                ( as, err ) => {
                    expect( err ).equal( 'InternalError' );
                    expect( as.state.error_info ).equal(
                        "Type shortcut is FTN3 v1.4 feature" );
                    as.success();
                }
            ) );

            it( 'should check v1.4 type shortcut: map fields', $as_test(
                ( as ) => {
                    const iface = {
                        iface : info.iface,
                        version: info.version,
                        ftn3rev: "1.3",
                        types: {
                            Map: {
                                type: 'map',
                                fields: {
                                    p : 'string',
                                },
                            },
                        },
                    };

                    SpecTools.loadIface( as, Object.assign( {}, info ), [ iface ] );
                },
                ( as, err ) => {
                    expect( err ).equal( 'InternalError' );
                    expect( as.state.error_info ).equal(
                        "Type shortcut is FTN3 v1.4 feature" );
                    as.success();
                }
            ) );

            it( 'should check v1.4 type shortcut: params', $as_test(
                ( as ) => {
                    const iface = {
                        iface : info.iface,
                        version: info.version,
                        ftn3rev: "1.3",
                        funcs: {
                            f: {
                                params: {
                                    p : 'string',
                                },
                            },
                        },
                    };

                    SpecTools.loadIface( as, Object.assign( {}, info ), [ iface ] );
                },
                ( as, err ) => {
                    expect( err ).equal( 'InternalError' );
                    expect( as.state.error_info ).equal(
                        "Type shortcut is FTN3 v1.4 feature" );
                    as.success();
                }
            ) );

            it( 'should check v1.4 type shortcut: resultvar', $as_test(
                ( as ) => {
                    const iface = {
                        iface : info.iface,
                        version: info.version,
                        ftn3rev: "1.3",
                        funcs: {
                            f: {
                                result: {
                                    r : 'string',
                                },
                            },
                        },
                    };

                    SpecTools.loadIface( as, Object.assign( {}, info ), [ iface ] );
                },
                ( as, err ) => {
                    expect( err ).equal( 'InternalError' );
                    expect( as.state.error_info ).equal(
                        "Type shortcut is FTN3 v1.4 feature" );
                    as.success();
                }
            ) );

            it( 'should check v1.5 min/maxlen', $as_test(
                ( as ) => {
                    const iface = {
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

                    SpecTools.loadIface( as, Object.assign( {}, info ), [ iface ] );
                },
                ( as, err ) => {
                    expect( err ).equal( 'InternalError' );
                    expect( as.state.error_info ).equal(
                        "String min/maxlen is FTN3 v1.5 feature" );
                    as.success();
                }
            ) );

            it( 'should check v1.6 elemtype', $as_test(
                ( as ) => {
                    const iface = {
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

                    SpecTools.loadIface( as, Object.assign( {}, info ), [ iface ] );
                },
                ( as, err ) => {
                    expect( err ).equal( 'InternalError' );
                    expect( as.state.error_info ).equal(
                        "Map elemtype is FTN3 v1.6 feature" );
                    as.success();
                }
            ) );

            it( 'should check v1.6 enum', $as_test(
                ( as ) => {
                    const iface = {
                        iface : info.iface,
                        version: info.version,
                        ftn3rev: "1.5",
                        types: {
                            Enum: "enum",
                        },
                    };

                    SpecTools.loadIface( as, Object.assign( {}, info ), [ iface ] );
                },
                ( as, err ) => {
                    expect( err ).equal( 'InternalError' );
                    expect( as.state.error_info ).equal(
                        "Enum/Set is FTN3 v1.6 feature" );
                    as.success();
                }
            ) );

            it( 'should check v1.6 type variant: types', $as_test(
                ( as ) => {
                    const iface = {
                        iface : info.iface,
                        version: info.version,
                        ftn3rev: "1.5",
                        types: {
                            Or: [ "enum", "string" ],
                        },
                    };

                    SpecTools.loadIface( as, Object.assign( {}, info ), [ iface ] );
                },
                ( as, err ) => {
                    expect( err ).equal( 'InternalError' );
                    expect( as.state.error_info ).equal(
                        "Type variant is FTN3 v1.6 feature" );
                    as.success();
                }
            ) );

            it( 'should check v1.6 type variant: result', $as_test(
                ( as ) => {
                    const iface = {
                        iface : info.iface,
                        version: info.version,
                        ftn3rev: "1.5",
                        funcs: {
                            f: {
                                result: {
                                    r : [ 'string', 'integer' ],
                                },
                            },
                        },
                    };

                    SpecTools.loadIface( as, Object.assign( {}, info ), [ iface ] );
                },
                ( as, err ) => {
                    expect( err ).equal( 'InternalError' );
                    expect( as.state.error_info ).equal(
                        "Type variant is FTN3 v1.6 feature" );
                    as.success();
                }
            ) );

            it( 'should check v1.6 type variant: params', $as_test(
                ( as ) => {
                    const iface = {
                        iface : info.iface,
                        version: info.version,
                        ftn3rev: "1.5",
                        funcs: {
                            f: {
                                params: {
                                    f : [ 'string', 'integer' ],
                                },
                            },
                        },
                    };

                    SpecTools.loadIface( as, Object.assign( {}, info ), [ iface ] );
                },
                ( as, err ) => {
                    expect( err ).equal( 'InternalError' );
                    expect( as.state.error_info ).equal(
                        "Type variant is FTN3 v1.6 feature" );
                    as.success();
                }
            ) );

            it( 'should check v1.7 custom result type', $as_test(
                ( as ) => {
                    const iface = {
                        iface : info.iface,
                        version: info.version,
                        ftn3rev: "1.6",
                        funcs: {
                            f: {
                                result: "string",
                            },
                        },
                    };

                    SpecTools.loadIface( as, Object.assign( {}, info ), [ iface ] );
                },
                ( as, err ) => {
                    expect( err ).equal( 'InternalError' );
                    expect( as.state.error_info ).equal(
                        "Custom result type FTN3 v1.7 feature" );
                    as.success();
                }
            ) );

            it( 'should check v1.8 maxreqsize', $as_test(
                ( as ) => {
                    const iface = {
                        iface : info.iface,
                        version: info.version,
                        ftn3rev: "1.7",
                        funcs: {
                            f: {
                                maxreqsize: '1M',
                            },
                        },
                    };

                    SpecTools.loadIface( as, Object.assign( {}, info ), [ iface ] );
                },
                ( as, err ) => {
                    expect( err ).equal( 'InternalError' );
                    expect( as.state.error_info ).equal(
                        "Function maxreqsize/maxrspsize is FTN3 v1.8 feature" );
                    as.success();
                }
            ) );

            it( 'should check v1.8 maxrspsize', $as_test(
                ( as ) => {
                    const iface = {
                        iface : info.iface,
                        version: info.version,
                        ftn3rev: "1.7",
                        funcs: {
                            f: {
                                maxrspsize: '1K',
                            },
                        },
                    };

                    SpecTools.loadIface( as, Object.assign( {}, info ), [ iface ] );
                },
                ( as, err ) => {
                    expect( err ).equal( 'InternalError' );
                    expect( as.state.error_info ).equal(
                        "Function maxreqsize/maxrspsize is FTN3 v1.8 feature" );
                    as.success();
                }
            ) );

            it( 'should check v1.9 BinaryData', $as_test(
                ( as ) => {
                    const iface = {
                        iface : info.iface,
                        version: info.version,
                        ftn3rev: "1.8",
                        requires: [ 'BinaryData' ],
                    };

                    SpecTools.loadIface( as, Object.assign( {}, info ), [ iface ] );
                },
                ( as, err ) => {
                    expect( err ).equal( 'InternalError' );
                    expect( as.state.error_info ).equal(
                        "BinaryData is FTN3 v1.9 feature" );
                    as.success();
                }
            ) );

            it( 'should check v1.9 BinaryData', $as_test( ( as ) => {
                const iface = {
                    iface : info.iface,
                    version: info.version,
                    ftn3rev: "1.8",
                };

                const types = {
                    T1: 'data',
                    T2: {
                        type: 'data',
                    },
                    TV: [ 'string', 'data' ],
                    TM: {
                        type: 'map',
                        fields: {
                            f: 'data',
                        },
                    },
                    TA: {
                        type: 'array',
                        elemtype: 'data',
                    },
                };
                const funcs = {
                    f: {
                        params: {
                            a: 'data',
                            b: { type: 'data' },
                        },
                        result: 'data',
                    },
                    r: {
                        result: {
                            a: 'data',
                            b: { type: 'data' },
                        },
                    },
                };

                as.forEach( types, ( as, k, v ) => {
                    const tface = Object.assign( {
                        types: { [k]: v },
                    }, iface );

                    as.add(
                        ( as ) => {
                            SpecTools.loadIface( as, Object.assign( {}, info ), [ tface ] );
                        },
                        ( as, err ) => {
                            expect( err ).equal( 'InternalError' );
                            expect( as.state.error_info ).equal(
                                "'data' type is FTN3 v1.9 feature" );
                            as.success();
                        }
                    );
                } );

                as.forEach( funcs, ( as, k, v ) => {
                    const tface = Object.assign( {
                        funcs: { [k]: v },
                    }, iface );
                    as.add(
                        ( as ) => {
                            SpecTools.loadIface( as, Object.assign( {}, info ), [ tface ] );
                        },
                        ( as, err ) => {
                            expect( err ).equal( 'InternalError' );
                            expect( as.state.error_info ).equal(
                                "'data' type is FTN3 v1.9 feature" );
                            as.success();
                        }
                    );
                } );
            } ) );

            it( 'should check unsupported minor revision for Executor', $as_test(
                ( as ) => {
                    const iface = {
                        iface : info.iface,
                        version: info.version,
                        ftn3rev: '1.' + ( 1 + SpecTools._max_supported_v1_minor ),
                    };

                    SpecTools.loadIface( as, Object.assign( {}, info ), [ iface ] );
                },
                ( as, err ) => {
                    expect( err ).equal( 'InternalError' );
                    expect( as.state.error_info ).equal(
                        "Not supported FTN3 revision for Executor" );
                    as.success();
                }
            ) );

            it( 'should check unsupported major revision', $as_test(
                ( as ) => {
                    const iface = {
                        iface : info.iface,
                        version: info.version,
                        ftn3rev: '2.0',
                    };

                    SpecTools.loadIface( as, Object.assign( {}, info ), [ iface ] );
                },
                ( as, err ) => {
                    expect( err ).equal( 'InternalError' );
                    expect( as.state.error_info ).equal(
                        "Not supported FTN3 revision" );
                    as.success();
                }
            ) );

            it( 'should allow unsupported minor revision for Invoker', $as_test(
                ( as ) => {
                    const iface = {
                        iface : info.iface,
                        version: info.version,
                        ftn3rev: '1.' + ( 1 + SpecTools._max_supported_v1_minor ),
                    };

                    const info2 = Object.assign( { _invoker_use: true }, info );

                    SpecTools.loadIface( as, info2, [ iface ] );
                }
            ) );
        } );

        it ( 'should fail to find with invalid version', $as_test(
            ( as ) => {
                SpecTools.loadIface(
                    as,
                    {
                        iface : 'test.spec',
                        version : 2.4,
                    },
                    [ 'somedir', testspec ]
                );
            },
            function( as, err ) {
                expect( err ).equal( 'InternalError' );
                expect( as.state.error_info ).match( /^Failed to load valid spec for/ );
                as.success();
            }
        ) );

        it ( 'should load iface without funcs', $as_test( ( as ) => {
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
        } ) );

        it ( 'should fail to load iface with different version', $as_test(
            ( as ) => {
                SpecTools.loadIface(
                    as,
                    {
                        iface : 'test.spec',
                        version : '2.4',
                    },
                    [ 'somedir', testspec ]
                );
            },
            ( as, err ) => {
                expect( err ).equal( 'InternalError' );
                expect( as.state.error_info ).match( /^Failed to load valid spec for/ );
                as.success();
            }
        ) );

        it ( 'should fail on invalid inherit', $as_test(
            ( as ) => {
                SpecTools.loadIface(
                    as,
                    {
                        iface : 'test.spec',
                        version : '2.4',
                    },
                    [ {
                        iface : 'test.spec',
                        version : '2.4',
                        inherit: '1.0:abcedf',
                    } ]
                );
            },
            ( as, err ) => {
                expect( as.state.error_info ).equal(
                    "Invalid inherit ifacever: 1.0:abcedf" );
                expect( err ).equal( 'InvokerError' );
                as.success();
            }
        ) );

        it ( 'should fail on invalid imports', $as_test(
            ( as ) => {
                SpecTools.loadIface(
                    as,
                    {
                        iface : 'test.spec',
                        version : '2.4',
                    },
                    [ {
                        iface : 'test.spec',
                        version : '2.4',
                        ftn3rev: '1.1',
                        imports: [ '1.0:abcedf' ],
                    } ]
                );
            },
            ( as, err ) => {
                expect( as.state.error_info ).equal(
                    "Invalid import ifacever: 1.0:abcedf" );
                expect( err ).equal( 'InvokerError' );
                as.success();
            }
        ) );

        it ( 'should fail on incompatible base imports', $as_test(
            ( as ) => {
                SpecTools.loadIface(
                    as,
                    {
                        iface : 'test.spec',
                        version : '2.4',
                    },
                    [ {
                        iface : 'test.spec',
                        version : '2.4',
                        ftn3rev: '1.1',
                        imports: [ 'test.b:1.0', 'test.b:2.0' ],
                    }, {
                        iface : 'test.b',
                        version : '1.0',
                    }, {
                        iface : 'test.b',
                        version : '2.0',
                    } ]
                );
            },
            ( as, err ) => {
                expect( as.state.error_info ).equal(
                    "Incompatible iface versions: test.b 1.0/2.0" );
                expect( err ).equal( 'InvokerError' );
                as.success();
            }
        ) );

        it ( 'should fail on invalid function name', $as_test(
            ( as ) => {
                const spec = _cloneDeep( testspec );

                spec.funcs.Func = {};

                SpecTools.loadIface(
                    as,
                    {
                        iface : 'test.spec',
                        version : '2.3',
                    },
                    [ 'somedir', spec ]
                );
            },
            ( as, err ) => {
                expect( as.state.error_info ).equal( 'Invalid function name: Func' );
                expect( err ).equal( 'InternalError' );
                as.success();
            }
        ) );

        it ( 'should fail on invalid type name', $as_test(
            ( as ) => {
                const spec = _cloneDeep( testspec );

                spec.types = {
                    tp : {},
                };
                spec.ftn3rev = '1.9';

                SpecTools.loadIface(
                    as,
                    {
                        iface : spec.iface,
                        version : spec.version,
                    },
                    [ 'somedir', spec ]
                );
            },
            ( as, err ) => {
                //console.log( as.state.last_exception );
                expect( as.state.error_info ).equal( 'Invalid type name: tp' );
                expect( err ).equal( 'InternalError' );
                as.success();
            }
        ) );

        it ( 'should fail on missing "type" in custom type field', $as_test(
            ( as ) => {
                const spec = _cloneDeep( testspec );

                spec.types = {
                    T : {},
                };
                spec.ftn3rev = '1.9';

                SpecTools.loadIface(
                    as,
                    {
                        iface : 'test.spec',
                        version : '2.3',
                    },
                    [ 'somedir', spec ]
                );
            },
            ( as, err ) => {
                expect( as.state.error_info ).equal( 'Missing "type" for custom type: T' );
                expect( err ).equal( 'InternalError' );
                as.success();
            }
        ) );

        it ( 'should fail on missing "type" in custom type field', $as_test(
            ( as ) => {
                const spec = _cloneDeep( testspec );

                spec.types = {
                    TT : {
                        type: "map",
                        fields: {
                            ff: {},
                        },
                    },
                };
                spec.ftn3rev = '1.9';

                SpecTools.loadIface(
                    as,
                    {
                        iface : 'test.spec',
                        version : '2.3',
                    },
                    [ 'somedir', spec ]
                );
            },
            ( as, err ) => {
                expect( as.state.error_info ).equal( 'Missing "type" for custom type field: TT[ff]' );
                expect( err ).equal( 'InternalError' );
                as.success();
            }
        ) );

        it ( 'should fail on missing base "type"', $as_test(
            ( as ) => {
                const spec = _cloneDeep( testspec );

                spec.types = {
                    TT : {
                        type: "map",
                        fields: {
                            ff: [ 'string', 'Missing', 'integer' ],
                        },
                    },
                };
                spec.ftn3rev = '1.9';

                SpecTools.loadIface(
                    as,
                    {
                        iface : 'test.spec',
                        version : '2.3',
                    },
                    [ 'somedir', spec ]
                );
            },
            ( as, err ) => {
                expect( as.state.error_info ).equal(
                    'Unknown type Missing in test.spec:2.3' );
                expect( err ).equal( 'InternalError' );
                as.success();
            }
        ) );

        it ( 'should fail on invalid elemtype', $as_test(
            ( as ) => {
                SpecTools.loadIface(
                    as,
                    {
                        iface : 'test.a',
                        version : '1.0',
                        ftn3rev : '1.9',
                    },
                    [ {
                        iface : 'test.a',
                        version : '1.0',
                        types : {
                            E : {
                                type: 'array',
                                elemtype: 123,
                            },
                        },
                        ftn3rev : '1.9',
                    } ]
                );
            },
            ( as, err ) => {
                expect( as.state.error_info ).equal(
                    'Invalid "elemtype" for custom type: E' );
                expect( err ).equal( 'InternalError' );
                as.success();
            }
        ) );

        it ( 'should fail on type redefinition', $as_test(
            ( as ) => {
                SpecTools.loadIface(
                    as,
                    {
                        iface : 'test.a',
                        version : '1.0',
                        ftn3rev : '1.9',
                    },
                    [ {
                        iface : 'test.a',
                        version : '1.0',
                        types : {
                            T : 'string',
                        },
                        ftn3rev : '1.9',
                        inherit : 'test.b:1.1',
                    }, {
                        iface : 'test.b',
                        version : '1.1',
                        types : {
                            T : 'string',
                        },
                        ftn3rev : '1.9',
                    } ]
                );
            },
            ( as, err ) => {
                expect( as.state.error_info ).equal(
                    'Iface "test.a" type redefinition: T' );
                expect( err ).equal( 'InternalError' );
                as.success();
            }
        ) );

        it ( 'should fail on missing parameter in derived', $as_test(
            ( as ) => {
                SpecTools.loadIface(
                    as,
                    {
                        iface : 'test.a',
                        version : '1.0',
                        ftn3rev : '1.9',
                    },
                    [ {
                        iface : 'test.a',
                        version : '1.0',
                        funcs : {
                            fnc : {
                                params : {
                                    a: 'string',
                                },
                            },
                        },
                        ftn3rev : '1.9',
                        inherit : 'test.b:1.1',
                    }, {
                        iface : 'test.b',
                        version : '1.1',
                        funcs : {
                            fnc : {
                                params: {
                                    a: 'string',
                                    b: 'string',
                                },
                            },
                        },
                        ftn3rev : '1.9',
                    } ]
                );
            },
            ( as, err ) => {
                expect( as.state.error_info ).equal(
                    'Invalid parameter count for: "fnc"' );
                expect( err ).equal( 'InternalError' );
                as.success();
            }
        ) );

        it ( 'should fail on invalid parameter order in derived', $as_test(
            ( as ) => {
                SpecTools.loadIface(
                    as,
                    {
                        iface : 'test.a',
                        version : '1.0',
                        ftn3rev : '1.9',
                    },
                    [ {
                        iface : 'test.a',
                        version : '1.0',
                        funcs : {
                            fnc : {
                                params : {
                                    b: 'string',
                                    a: 'string',
                                },
                            },
                        },
                        ftn3rev : '1.9',
                        inherit : 'test.b:1.1',
                    }, {
                        iface : 'test.b',
                        version : '1.1',
                        funcs : {
                            fnc : {
                                params: {
                                    a: 'string',
                                    b: 'string',
                                },
                            },
                        },
                        ftn3rev : '1.9',
                    } ]
                );
            },
            ( as, err ) => {
                //console.log(as.state.last_exception);
                expect( as.state.error_info ).equal(
                    'Invalid parameter order for "fnc/a"' );
                expect( err ).equal( 'InternalError' );
                as.success();
            }
        ) );

        it ( 'should fail on parameter type mismatch in derived', $as_test(
            ( as ) => {
                SpecTools.loadIface(
                    as,
                    {
                        iface : 'test.a',
                        version : '1.0',
                        ftn3rev : '1.9',
                    },
                    [ {
                        iface : 'test.a',
                        version : '1.0',
                        funcs : {
                            fnc : {
                                params : {
                                    a: 'string',
                                    b: { type: 'integer' },
                                },
                            },
                        },
                        ftn3rev : '1.9',
                        inherit : 'test.b:1.1',
                    }, {
                        iface : 'test.b',
                        version : '1.1',
                        funcs : {
                            fnc : {
                                params: {
                                    a: 'string',
                                    b: { type: 'string' },
                                },
                            },
                        },
                        ftn3rev : '1.9',
                    } ]
                );
            },
            ( as, err ) => {
                //console.log(as.state.last_exception);
                expect( as.state.error_info ).equal(
                    'Parameter type mismatch "fnc/b"' );
                expect( err ).equal( 'InternalError' );
                as.success();
            }
        ) );

        it ( 'should fail on parameter type mismatch in derived (shortcut)', $as_test(
            ( as ) => {
                SpecTools.loadIface(
                    as,
                    {
                        iface : 'test.a',
                        version : '1.0',
                        ftn3rev : '1.9',
                    },
                    [ {
                        iface : 'test.a',
                        version : '1.0',
                        funcs : {
                            fnc : {
                                params : {
                                    a: 'string',
                                    b: 'integer',
                                },
                            },
                        },
                        ftn3rev : '1.9',
                        inherit : 'test.b:1.1',
                    }, {
                        iface : 'test.b',
                        version : '1.1',
                        funcs : {
                            fnc : {
                                params: {
                                    a: 'string',
                                    b: 'string',
                                },
                            },
                        },
                        ftn3rev : '1.9',
                    } ]
                );
            },
            ( as, err ) => {
                //console.log(as.state.last_exception);
                expect( as.state.error_info ).equal(
                    'Parameter type mismatch "fnc/b"' );
                expect( err ).equal( 'InternalError' );
                as.success();
            }
        ) );

        it ( 'should fail on parameter type mismatch in derived (mixed)', $as_test(
            ( as ) => {
                SpecTools.loadIface(
                    as,
                    {
                        iface : 'test.a',
                        version : '1.0',
                        ftn3rev : '1.9',
                    },
                    [ {
                        iface : 'test.a',
                        version : '1.0',
                        funcs : {
                            fnc : {
                                params : {
                                    a: 'string',
                                    b: 'integer',
                                },
                            },
                        },
                        ftn3rev : '1.9',
                        inherit : 'test.b:1.1',
                    }, {
                        iface : 'test.b',
                        version : '1.1',
                        funcs : {
                            fnc : {
                                params: {
                                    a: 'string',
                                    b: {
                                        type: 'string',
                                    },
                                },
                            },
                        },
                        ftn3rev : '1.9',
                    } ]
                );
            },
            ( as, err ) => {
                //console.log(as.state.last_exception);
                expect( as.state.error_info ).equal(
                    'Parameter type mismatch "fnc/b"' );
                expect( err ).equal( 'InternalError' );
                as.success();
            }
        ) );

        it ( 'should fail on missing "default" in derived', $as_test(
            ( as ) => {
                SpecTools.loadIface(
                    as,
                    {
                        iface : 'test.a',
                        version : '1.0',
                        ftn3rev : '1.9',
                    },
                    [ {
                        iface : 'test.a',
                        version : '1.0',
                        funcs : {
                            fnc : {
                                params : {
                                    a: 'string',
                                    b: 'integer',
                                },
                            },
                        },
                        ftn3rev : '1.9',
                        inherit : 'test.b:1.1',
                    }, {
                        iface : 'test.b',
                        version : '1.1',
                        funcs : {
                            fnc : {
                                params: {
                                    a: 'string',
                                },
                            },
                        },
                        ftn3rev : '1.9',
                    } ]
                );
            },
            ( as, err ) => {
                //console.log( as.state.last_exception );
                expect( as.state.error_info ).equal(
                    'Missing default for "fnc/b"' );
                expect( err ).equal( 'InternalError' );
                as.success();
            }
        ) );

        it ( 'should fail on "rawresult" mismatch in derived', $as_test(
            ( as ) => {
                SpecTools.loadIface(
                    as,
                    {
                        iface : 'test.a',
                        version : '1.0',
                        ftn3rev : '1.9',
                    },
                    [ {
                        iface : 'test.a',
                        version : '1.0',
                        funcs : {
                            fnc : {},
                        },
                        ftn3rev : '1.9',
                        inherit : 'test.b:1.1',
                    }, {
                        iface : 'test.b',
                        version : '1.1',
                        funcs : {
                            fnc : {
                                rawresult: true,
                            },
                        },
                        ftn3rev : '1.9',
                    } ]
                );
            },
            ( as, err ) => {
                //console.log( as.state.last_exception );
                expect( as.state.error_info ).equal(
                    `'rawresult' flag mismatch for "fnc"` );
                expect( err ).equal( 'InternalError' );
                as.success();
            }
        ) );

        it ( 'should fail on "rawupload" mismatch in derived', $as_test(
            ( as ) => {
                SpecTools.loadIface(
                    as,
                    {
                        iface : 'test.a',
                        version : '1.0',
                        ftn3rev : '1.9',
                    },
                    [ {
                        iface : 'test.a',
                        version : '1.0',
                        funcs : {
                            fnc : {},
                        },
                        ftn3rev : '1.9',
                        inherit : 'test.b:1.1',
                    }, {
                        iface : 'test.b',
                        version : '1.1',
                        funcs : {
                            fnc : {
                                rawupload: true,
                            },
                        },
                        ftn3rev : '1.9',
                    } ]
                );
            },
            ( as, err ) => {
                //console.log( as.state.last_exception );
                expect( as.state.error_info ).equal(
                    `'rawupload' flag mismatch for "fnc"` );
                expect( err ).equal( 'InternalError' );
                as.success();
            }
        ) );

        it ( 'should fail on "seclvl" mismatch in derived', $as_test(
            ( as ) => {
                SpecTools.loadIface(
                    as,
                    {
                        iface : 'test.a',
                        version : '1.0',
                        ftn3rev : '1.9',
                    },
                    [ {
                        iface : 'test.a',
                        version : '1.0',
                        funcs : {
                            fnc : {},
                        },
                        ftn3rev : '1.9',
                        inherit : 'test.b:1.1',
                    }, {
                        iface : 'test.b',
                        version : '1.1',
                        funcs : {
                            fnc : {
                                seclvl: 'Info',
                            },
                        },
                        ftn3rev : '1.9',
                    } ]
                );
            },
            ( as, err ) => {
                //console.log( as.state.last_exception );
                expect( as.state.error_info ).equal(
                    `'seclvl' mismatch for "fnc"` );
                expect( err ).equal( 'InternalError' );
                as.success();
            }
        ) );

        it ( 'should fail on missing constraints in derived', $as_test(
            ( as ) => {
                SpecTools.loadIface(
                    as,
                    {
                        iface : 'test.a',
                        version : '1.0',
                        ftn3rev : '1.9',
                    },
                    [ {
                        iface : 'test.a',
                        version : '1.0',
                        ftn3rev : '1.9',
                        inherit : 'test.b:1.1',
                        requires: [ 'Abc' ],
                    }, {
                        iface : 'test.b',
                        version : '1.1',
                        ftn3rev : '1.9',
                        requires: [ 'Missing', 'Abc' ],
                    } ]
                );
            },
            ( as, err ) => {
                //console.log( as.state.last_exception );
                expect( as.state.error_info ).equal(
                    `Missing constraints from inherited: Missing` );
                expect( err ).equal( 'InternalError' );
                as.success();
            }
        ) );

        it ( 'should fail on invalid param name', $as_test(
            ( as ) => {
                const spec = _cloneDeep( testspec );

                spec.funcs.func = {
                    params: {
                        P: {
                            type: 'string',
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
            },
            ( as, err ) => {
                expect( as.state.error_info ).equal(
                    'Invalid parameter name: func(P)' );
                expect( err ).equal( 'InternalError' );
                as.success();
            }
        ) );

        it ( 'should fail on invalid result name', $as_test(
            ( as ) => {
                const spec = _cloneDeep( testspec );

                spec.funcs.func = {
                    result: {
                        R: {
                            type: 'string',
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
            },
            ( as, err ) => {
                expect( as.state.error_info ).equal(
                    'Invalid resultvar name: func(R)' );
                expect( err ).equal( 'InternalError' );
                as.success();
            }
        ) );

        it ( 'should fail on params without type', $as_test(
            ( as ) => {
                const spec = _cloneDeep( testspec );

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
            ( as, err ) => {
                expect( err ).equal( 'InternalError' );
                expect( as.state.error_info ).match( /^Missing type for params/ );
                as.success();
            }
        ) );

        it ( 'should fail on result without type', $as_test(
            ( as ) => {
                const spec = _cloneDeep( testspec );

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
            },
            ( as, err ) => {
                expect( err ).equal( 'InternalError' );
                expect( as.state.error_info ).match( /^Missing type for result/ );
                as.success();
            }
        ) );

        it ( 'should fail on params not object', $as_test(
            ( as ) => {
                const spec = _cloneDeep( testspec );

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
            },
            ( as, err ) => {
                expect( err ).equal( 'InternalError' );
                expect( as.state.error_info ).match( /^Invalid params object/ );
                as.success();
            }
        ) );

        it ( 'should fail on param not object', $as_test(
            ( as ) => {
                const spec = _cloneDeep( testspec );

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
            ( as, err ) => {
                expect( err ).equal( 'InternalError' );
                expect( as.state.error_info ).equal(
                    'Invalid parameter definition: missingResult(a)' );
                as.success();
            }
        ) );

        it ( 'should fail on result not object', $as_test(
            ( as ) => {
                const spec = _cloneDeep( testspec );

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
            },
            ( as, err ) => {
                expect( err ).equal( 'InternalError' );
                expect( as.state.error_info ).equal(
                    'Invalid result object: missingResult' );
                as.success();
            }
        ) );

        it ( 'should fail on resultvar not object', $as_test(
            ( as ) => {
                const spec = _cloneDeep( testspec );

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
            },
            ( as, err ) => {
                expect( err ).equal( 'InternalError' );
                expect( as.state.error_info ).equal(
                    'Invalid resultvar definition: missingResult(a)' );
                as.success();
            }
        ) );

        it ( 'should fail on throws not array', $as_test(
            ( as ) => {
                const spec = _cloneDeep( testspec );

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
            },
            ( as, err ) => {
                expect( err ).equal( 'InternalError' );
                expect( as.state.error_info ).match( /^"throws" is not array/ );
                as.success();
            }
        ) );

        it ( 'should fail on "throws" without result', $as_test(
            ( as ) => {
                const spec = _cloneDeep( testspec );

                spec.funcs.missingResult = {
                    throws : [ 'Test' ],
                };

                SpecTools.loadIface(
                    as,
                    {
                        iface : 'test.spec',
                        version : '2.3',
                    },
                    [ 'somedir', spec ]
                );
            },
            ( as, err ) => {
                expect( as.state.error_info ).equal(
                    '"throws" without result: missingResult' );
                expect( err ).equal( 'InternalError' );
                as.success();
            }
        ) );

        it ( 'should fail on invalid "throws"', $as_test(
            ( as ) => {
                const spec = _cloneDeep( testspec );

                spec.funcs.missingResult = {
                    result : { r: { type: 'boolean' } },
                    throws : [ 'testError' ],
                };

                SpecTools.loadIface(
                    as,
                    {
                        iface : 'test.spec',
                        version : '2.3',
                    },
                    [ 'somedir', spec ]
                );
            },
            ( as, err ) => {
                expect( as.state.error_info ).equal(
                    'Invalid "throws": testError' );
                expect( err ).equal( 'InternalError' );
                as.success();
            }
        ) );

        it ( 'should fail on requires not array', $as_test(
            ( as ) => {
                const spec = _cloneDeep( testspec );

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
            },
            ( as, err ) => {
                expect( err ).equal( 'InternalError' );
                expect( as.state.error_info ).match( /^"requires" is not array/ );
                as.success();
            }
        ) );

        it ( 'should load with no requires', $as_test(
            ( as ) => {
                const spec = _cloneDeep( testspec );

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
            }
        ) );

        it ( 'should fail on integer type mismatch', $as_test(
            ( as ) => {
                SpecTools.checkFutoInType( as, 'integer', 'var', 1 );
                as.state.var = true;
                SpecTools.checkFutoInType( as, 'integer', 'var2', 1.3 );
            },
            ( as, err ) => {
                expect( err ).equal( 'InvalidRequest' );
                expect( as.state.error_info ).match( /^Type mismatch for parameter/ );
                expect( as.state.var ).be.true;
                as.success();
            }
        ) );

        it ( 'should fail on boolean type mismatch', $as_test(
            ( as ) => {
                SpecTools.checkFutoInType( as, 'boolean', 'var', true );
                as.state.var = true;
                SpecTools.checkFutoInType( as, 'boolean', 'var2', 'true' );
            },
            ( as, err ) => {
                expect( err ).equal( 'InvalidRequest' );
                expect( as.state.error_info ).match( /^Type mismatch for parameter/ );
                expect( as.state.var ).be.true;
                as.success();
            }
        ) );

        it ( 'should correctly process imports', $as_test( ( as ) => {
            const baseface = {
                iface: 'base.face',
                version: '2.1',
                ftn3rev: '1.1',
                types: {
                    MyString : {
                        type: 'string',
                    },
                },
                funcs: {
                    firstFunc : {
                        rawresult : true,
                    },
                },
            };

            const derivedface = {
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
                    secondFunc : {
                        rawresult : true,
                    },
                },
            };

            const load_info = {
                iface : 'derived.face',
                version : '1.0',
            };

            SpecTools.loadIface(
                as,
                load_info,
                [ baseface, derivedface ] );


            as.add( ( as ) => {
                expect( load_info.types ).have.property( 'MyString' );
                expect( load_info.types ).have.property( 'MyInt' );
                expect( load_info.inherits ).be.empty;
                expect( load_info.funcs ).have.property( 'firstFunc' );
                expect( load_info.funcs ).have.property( 'secondFunc' );
                expect( load_info.imports[0] ).equal( 'base.face:2.1' );
            } );
        } ) );

        it ( 'should correctly process diamond import', $as_test( ( as ) => {
            const baseface = {
                iface: 'base.face',
                version: '2.1',
                ftn3rev: '1.4',
                types: {
                    MyString : {
                        type: 'string',
                    },
                },
                funcs: {
                    firstFunc : {
                        rawresult : true,
                    },
                },
            };

            const newer_baseface = {
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
                    firstFunc : {
                        rawresult : true,
                    },
                },
            };

            const derivedface1 = {
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
                    secondFunc : {
                        rawresult : true,
                    },
                },
            };

            const derivedface2 = {
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
                    thirdFunc : {
                        rawresult : true,
                    },
                },
            };

            const topface = {
                iface: 'top.face',
                version: '1.0',
                ftn3rev: '1.4',
                imports: [
                    'derived.face1:1.0',
                    'derived.face2:1.0',
                ],
            };

            const load_info = {
                iface : 'top.face',
                version : '1.0',
            };

            SpecTools.loadIface(
                as,
                load_info,
                [ baseface, newer_baseface, derivedface1, derivedface2, topface ] );

            as.add( ( as ) => {
                expect( load_info.types ).have.property( 'MyString' );
                expect( load_info.types ).have.property( 'MyString2' );
                expect( load_info.types ).have.property( 'MyInt' );
                expect( load_info.types ).have.property( 'MyInt2' );
                expect( load_info.inherits ).be.empty;
                expect( load_info.funcs ).have.property( 'firstFunc' );
                expect( load_info.funcs ).have.property( 'secondFunc' );
                expect( load_info.funcs ).have.property( 'thirdFunc' );
                expect( load_info.imports ).be.eql( [
                    'base.face:2.2',
                    'derived.face2:1.0',
                    'derived.face1:1.0',
                ] );
            } );
        } ) );

        it ( 'should properly check standard types', $as_test( ( as ) => {
            const tests = {
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
                data : {
                    ok : [ new Uint8Array( 10 ) ],
                    fail : [ true, false, 'yes', 1, 1.1, [], null, undefined, {}, new Int32Array( 10 ) ],
                },
            };

            as.forEach( tests, ( as, type, v ) => {
                as.add( ( as ) => {
                    as.forEach( v.ok, ( as, i, t ) => {
                        SpecTools.checkFutoInType( as, type, type + ':ok', t );
                    } );
                    as.forEach( v.fail, ( as, i, t ) => {
                        as.add(
                            ( as ) => {
                                SpecTools.checkFutoInType( as, type, type + ':fail', t );
                                as.success( `Fail at ${type} : ${t}` );
                            },
                            ( as, err ) => {
                                expect( as.state.error_info ).match( /^Type mismatch for parameter/ );
                                as.success( 'OK' );
                            }
                        ).add( ( as, ok ) => {
                            expect( ok ).equal( 'OK' );
                        } );
                    } );
                } );
            } );
        } ) );

        it ( 'should process custom type constraints', $as_test( ( as ) => {
            const iface = {
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
                            variant : [ 'IntMinMax', 'StringRegex', "boolean" ],
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
                        elemtype: [ "Int", "Int" ],
                        maxlen: 3,
                    },
                    Data : {
                        type: "data",
                        minlen: 3,
                        maxlen: 5,
                    },
                },
            };

            const info = {
                iface: iface.iface,
                version: iface.version,
            };

            const tests = {
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
                    ok: [
                        { int:1, variant: 1 },
                        { int:3, string:'abcde', variant: 'abcde' },
                    ],
                    fail: [
                        { int:5, string:'abcde', variant: 1 },
                        { string:'abcde', variant: 1 },
                        { int:3, string:'abcdE', variant: 1 },
                    ],
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

            SpecTools.loadIface( as, Object.assign( { _invoker_use: true }, info ), [ iface ] );
            SpecTools.loadIface( as, info, [ iface ] );
            as.forEach( tests, ( as, type, v ) => {
                as.forEach( v.ok, ( as, i, t ) => {
                    if ( !SpecTools.checkType( info, type, t ) ) {
                        throw new Error( 'Failed at ' + type + " " + t );
                    }

                    if ( !SpecTools.checkCompiledType( as, info, type, t ) ) {
                        throw new Error( 'Failed at compiled ' + type + " " + t );
                    }
                } );
                as.forEach( v.fail, ( as, i, t ) => {
                    if ( SpecTools.checkType( info, type, t ) ) {
                        throw new Error( 'Failed at neg ' + type + " " + t );
                    }

                    if ( SpecTools.checkCompiledType( as, info, type, t ) ) {
                        throw new Error( 'Failed at neg compiled ' + type + " " + t );
                    }
                } );
            } );
        } ) );
    } );

    it ( 'should handle diamond inherited "regex" and "items" correctly', $as_test( ( as ) => {
        const iface = {
            iface: 'some.face',
            version: '1.0',
            ftn3rev: '1.9',
            types: {
                Regex1 : {
                    type : 'string',
                    regex : '^a$',
                },
                Regex2 : {
                    type : 'string',
                    regex : '^b$',
                },
                Set1 : {
                    type : 'set',
                    items: [ 1, 2 ],
                },
                Set2 : {
                    type : 'set',
                    items : [ 3, 4 ],
                },
                DiamonRegex: [ 'Regex1', 'Regex2' ],
                DiamonSet: [ 'Set1', 'Set2' ],
            },
        };

        const info = {
            iface: iface.iface,
            version: iface.version,
        };

        SpecTools.loadIface( as, info, [ iface ] );
        as.add( ( as ) => {
            expect( SpecTools.checkType( info, 'DiamonRegex', 'a' ) ).to.be.true;
            expect( SpecTools.checkType( info, 'DiamonRegex', 'b' ) ).to.be.true;
            expect( SpecTools.checkType( info, 'DiamonSet', [ 1 ] ) ).to.be.true;
            expect( SpecTools.checkType( info, 'DiamonSet', [ 3 ] ) ).to.be.true;
        } );
    } ) );


    it ( 'should allow null for default null parameter', $as_test( ( as ) => {
        const iface = {
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

        const info = {
            iface: iface.iface,
            version: iface.version,
        };

        SpecTools.loadIface( as, info, [ iface ] );

        as.add( ( as ) => {
            expect( SpecTools.checkParameterType( info, "test", "nullable", "abc" ) ).be.true;
            expect( SpecTools.checkParameterType( info, "test", "nullable", null ) ).be.true;
            expect( SpecTools.checkParameterType( info, "test", "required", "abc" ) ).be.true;
            expect( SpecTools.checkParameterType( info, "test", "required", null ) ).be.false;
        } );
    } ) );

    it ( 'should allow type definition shortcut', $as_test( ( as ) => {
        const iface = {
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

        const info = {
            iface: iface.iface,
            version: iface.version,
        };

        SpecTools.loadIface( as, info, [ iface ] );

        as.add( ( as ) => {
            expect( SpecTools.checkParameterType( info, "test", "myobj", { num: 1 } ) ).be.true;
            expect( SpecTools.checkParameterType( info, "test", "myobj", { num: '1' } ) ).be.false;
            SpecTools.checkResultType( as, info, "test", "resobj", { num: 1 } );
        } );
    } ) );

    it( 'should allow custom result type', $as_test( ( as ) => {
        const iface = {
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

        const info = {
            iface: iface.iface,
            version: iface.version,
        };

        SpecTools.loadIface( as, info, [ iface ] );

        as.add( ( as ) => {
            expect( SpecTools.checkParameterType( info, "test", "nullable", "abc" ) ).be.true;
            expect( SpecTools.checkParameterType( info, "test", "nullable", null ) ).be.true;
            expect( SpecTools.checkParameterType( info, "test", "required", "abc" ) ).be.true;
            expect( SpecTools.checkParameterType( info, "test", "required", null ) ).be.false;
        } );
    } ) );

    it( 'should correctly compare', function() {
        expect( SpecTools.secureEquals( 'abc', 'abc' ) ).to.be.true;
        expect( SpecTools.secureEquals( 'abc', 'abd' ) ).to.be.false;
        expect( SpecTools.secureEquals( 'abc', 'abcd' ) ).to.be.false;
        expect( SpecTools.secureEquals( 'ab', 'abc' ) ).to.be.false;
        expect( SpecTools.secureEquals( '', '' ) ).to.be.true;
        expect( SpecTools.secureEquals( '', 'a' ) ).to.be.false;
    } );

    it( 'securely compare', $as_test( ( as ) => {
        const iface = {
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

        const info = {
            iface: iface.iface,
            version: iface.version,
        };

        SpecTools.loadIface( as, info, [ iface ] );

        as.add( ( as ) => {
            expect( SpecTools.checkType( info, "MyVariant", '22' ) ).be.true;
            expect( SpecTools.checkType( info, "MyVariant", '444' ) ).be.true;
            expect( SpecTools.checkType( info, "MyVariant", 44 ) ).be.false;
            expect( SpecTools.checkType( info, "MyVariant", 33 ) ).be.true;
        } );
    } ) );

    it( 'convert maxsize', $as_test( ( as ) => {
        expect( SpecTools.parseSize( '21M' ) ).equal( 21 * 1024 * 1024 );
        expect( SpecTools.parseSize( '21K' ) ).equal( 21 * 1024 );
        expect( SpecTools.parseSize( '21B' ) ).equal( 21 );
        expect( SpecTools.parseSize() ).equal( 64 * 1024 );

        expect( () => SpecTools.parseSize( '21' ) ).throw( 'Invalid size specification: 21' );
        expect( () => SpecTools.parseSize( '21b' ) ).throw( 'Invalid size specification: 21b' );
        expect( () => SpecTools.parseSize( '21G' ) ).throw( 'Invalid size specification: 21G' );
    } ) );

    if ( isNode ) {
        describe( '#genHMAC', function() {
            const req = {
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
                    d : Buffer.alloc( 3, '1' ),
                    def: null, // must be ignored - never gets transfered
                },
                r : {
                    test : 'alpha',
                },
            };

            const hmacbase = 'f:some.iface:1.2;p:a:alpha;b:false;d:111;n:1.34;o:a:beta;b:true;;;r:test:alpha;;rid:C1234;';
            const key = crypto.randomBytes( 200 ); // 1600-bit block size for SHA3
            const keyb64 = key.toString( 'base64' );

            const algos = [ 'MD5', 'SHA224', 'SHA256', 'SHA384', 'SHA512' ];

            it ( 'should correctly create MAC base', function() {
                expect( SpecTools.macBase( req ).toString( 'utf8' ) ).equal( hmacbase );
            } );

            for ( let i = 0, c = algos.length; i < c; ++i ) {
                ( ( i ) => {
                    const algo = algos[i];
                    const algo_lo = algo.toLowerCase();

                    it ( 'should gen correct ' + algo + ' HMAC', function() {
                        const options = {
                            macKey : keyb64,
                            macAlgo : algo,
                        };

                        const res1 = SpecTools.genHMAC( as, options, req );
                        const res2 = SpecTools.genHMAC( as, options, req );
                        const testres = crypto
                            .createHmac( algo_lo, key )
                            .update( hmacbase )
                            .digest();

                        expect( testres.toString( 'hex' ) ).equal(
                            res1.toString( 'hex' )
                        );

                        expect( SpecTools.checkHMAC( res1, res2 ) ).be.true;
                    } );
                } )( i );
            }
        } );

        describe( 'JSON Schema', function() {
            before( () => {
                SpecTools.enableSchemaValidator( true );
            } );
            after( () => {
                SpecTools.enableSchemaValidator( false );
            } );

            it ( 'should validate spec against schema', $as_test( ( as ) => {
                SpecTools.loadIface(
                    as,
                    {
                        iface : 'test.a',
                        version : '1.0',
                    },
                    [ {
                        iface : 'test.a',
                        version : '1.0',
                        funcs : {
                            fnc : {
                                params : {
                                    a: {
                                        type: 'string',
                                    },
                                    b: {
                                        type: 'integer',
                                    },
                                },
                            },
                        },
                    } ]
                );
                SpecTools.loadIface(
                    as,
                    {
                        iface : 'test.a',
                        version : '1.0',
                    },
                    [ {
                        iface : 'test.a',
                        version : '1.0',
                        ftn3rev : '1.9',
                        funcs : {
                            fnc : {
                                params : {
                                    a: 'string',
                                    b: 'integer',
                                },
                            },
                        },
                    } ]
                );
            } ) );

            it ( 'should detect errors in spec', $as_test(
                ( as ) => {
                    SpecTools.loadIface(
                        as,
                        {
                            iface : 'test.a',
                            version : '1.0',
                        },
                        [ {
                            iface : 'test.a',
                            version : '1.0',
                            funcs : {
                                fnc : {
                                    params : {
                                        a: 'string',
                                        b: 'integer',
                                    },
                                },
                            },
                        } ]
                    );
                },
                ( as, err ) => {
                    expect( as.state.error_info ).to.equal(
                        `JSON Schema validation failed: data.funcs['fnc'].params['a'] should be object` );
                    expect( err ).to.equal( 'InternalError' );
                    as.success();
                }
            ) );

            it ( 'should detect invalid ftn3rev', $as_test(
                ( as ) => {
                    SpecTools.loadIface(
                        as,
                        {
                            iface : 'test.a',
                            version : '1.0',
                        },
                        [ {
                            iface : 'test.a',
                            version : '1.0',
                            ftn3rev : '1.0.b',
                        } ]
                    );
                },
                ( as, err ) => {
                    expect( as.state.error_info ).to.equal(
                        `Invalid ftn3rev field` );
                    expect( err ).to.equal( 'InternalError' );
                    as.success();
                }
            ) );
        } );
    }
} );
