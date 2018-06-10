'use strict';

require( './prepare' );

const _isEmpty = require( 'lodash/isEmpty' );

const is_browser = ( typeof window !== 'undefined' );
const invoker = is_browser
    ? require( 'futoin-invoker' )
    : module.require( '../lib/invoker' );

const isNode = !is_browser;
const chai = require( 'chai' );
const { assert, expect } = chai;
const async_steps = require( 'futoin-asyncsteps' );

let as;
let ccm;

const {
    MessageCoder,
    LogFace,
    CacheFace,
} = invoker;

var createTestHttpServer;
var closeTestHttpServer;
var thisDir;
var coder;
var coders;

if ( is_browser ) {
    createTestHttpServer = function( cb ) {
        cb();
    };

    closeTestHttpServer = function( done ) {
        done();
    };

    thisDir = '.';

    expect( window.FutoInInvoker ).to.equal( invoker );

    coders = {
        JSON: true,
        // CBOR: true,
        // MPCK: true,
    };
} else {
    var node_server = module.require( './node_server.js' );

    createTestHttpServer = node_server.createTestHttpServer;
    closeTestHttpServer = node_server.closeTestHttpServer;

    thisDir = __dirname;

    coders = {
        JSON: true,
        CBOR: true,
        MPCK: true,
    };
}

const break_burst = ( as ) => {
    as.waitExternal();
    async_steps.ActiveAsyncTool.callImmediate( () => as.state && as.success(), 0 );
};

class TestMasterAuth extends invoker.MasterAuth {
    constructor() {
        super();
        this._macopt = {
            macKey: '111222333444555666777888999',
            macAlgo : null,
        };
        this._spectools = module.require( '../SpecTools' );
    }

    signMessage( ctx, req ) {
        const { macAlgo } = ctx.options;
        this._macopt.macAlgo = macAlgo;
        const sig = this.genMAC( ctx, req ).toString( 'base64' );
        req.sec = `-mmac:x123:${macAlgo}:HKDF256:20180101:${sig}`;
    }

    genMAC( ctx, msg ) {
        return this._spectools.genHMAC( {}, this._macopt, msg );
    }
}


describe( 'Invoker Basic', function() {
    it( 'should create Simple CCM', function() {
        var sccm = new invoker.SimpleCCM();
    } );

    it( 'should create Advanced CCM', function() {
        var sccm = new invoker.SimpleCCM();
    } );
} );

describe( 'SimpleCCM', function() {
    beforeEach( function() {
        as = async_steps();
        ccm = new invoker.SimpleCCM();
        ccm.limitZone( 'default', {
            concurrent: 0xFFFF,
            rate: 0xFFFF,
        } );
    } );

    it( 'should register interface',
        function( done ) {
            as
                .add(
                    function( as ) {
                        try {
                            const state = as.state;
                            state.reg_fired = false;
                            ccm.once( 'register', function() {
                                state.reg_fired = true;
                            } );
                            ccm.register( as, 'myiface', 'iface.a:1.1', 'http://localhost:23456' );
                        } catch ( e ) {
                            done( e );
                        }
                    },
                    function( as, err ) {
                        done( new Error( err + ": " + as.state.error_info ) );
                    }
                )
                .add( break_burst )
                .add( function( as ) {
                    expect( as.state.reg_fired ).be.true;
                    done();
                } )
                .execute();
        }
    );

    it( 'should unregister interface', function( done ) {
        ccm.register( as, 'myiface', 'iface.a:1.1', 'http://localhost:23456' );
        ccm.register( as, 'otherface', 'iface.b:1.2', 'http://localhost:23456' );

        as.add(
            function( as ) {
                try {
                    ccm.assertIface( 'myiface', 'iface.a:1.1' );
                    ccm.assertIface( 'otherface', 'iface.b:1.2' );

                    const state = as.state;
                    state.reg_fired = false;
                    ccm.once( 'unregister', function() {
                        state.reg_fired = true;
                    } );
                    ccm.unRegister( 'myiface' );
                    ccm.assertIface( 'otherface', 'iface.b:1.2' );

                    assert.throws( function() {
                        ccm.assertIface( 'myiface', 'iface.a:1.1' );
                    }, 'InvokerError' );
                } catch ( e ) {
                    console.dir( e.stack );
                    console.log( as.state.error_info );
                    throw e;
                }
            },
            function( as, err ) {
                console.log( err + ": " + as.state.error_info );
            }
        )
            .add( break_burst )
            .add( function( as ) {
                expect( as.state.reg_fired ).be.true;
                done();
            } )
            .execute();
    } );

    it( 'should create interface alias', function( done ) {
        ccm.register( as, 'myiface', 'iface.a:1.1', 'http://localhost:23456' );
        ccm.register( as, 'otherface', 'iface.b:1.2', 'http://localhost:23456' );

        as.add(
            function( as ) {
                try {
                    ccm.assertIface( 'myiface', 'iface.a:1.0' );
                    ccm.assertIface( 'otherface', 'iface.b:1.2' );

                    ccm.alias( 'myiface', 'newname' );

                    ccm.assertIface( 'newname', 'iface.a:1.0' );

                    assert.throws( function() {
                        ccm.assertIface( 'myiface', 'iface.a:1.3' );
                    }, 'InvokerError' );

                    assert.throws( function() {
                        ccm.assertIface( 'myiface', 'iface.a:2.0' );
                    }, 'InvokerError' );

                    assert.strictEqual( ccm.iface( 'myiface' ), ccm.iface( 'newname' ) );

                    as.success();
                    done();
                } catch ( e ) {
                    console.dir( e.stack );
                    console.log( as.state.error_info );
                    throw e;
                }
            },
            function( as, err ) {
                console.log( err + ": " + as.state.error_info );
            }
        );
        as.execute();
    } );

    it( 'should fail on double registration', function( done ) {
        as.state.fire_reg = false;
        as.add(
            function( as ) {
                ccm.register( as, 'myiface', 'iface.a:1.1', 'http://localhost:23456' );
                as.state.fire_reg = true;
                ccm.register( as, 'myiface', 'iface.a:1.1', 'http://localhost:23456' );
                as.successStep();
            },
            function( as, err ) {
                try {
                    expect( as.state.fire_reg ).be.true;
                    expect( err ).equal( 'InvokerError' );
                    expect( as.state.error_info ).equal( 'Already registered' );
                    done();
                } catch( e ) {
                    console.log( e.message );
                    console.dir( e.stack );
                }
            }
        );

        as.execute();
    } );

    it( 'should fail on invalid ifacever at registration/assert', function() {
        assert.throws( function() {
            ccm.register( as, 'myiface', 'iface.a:1.', 'http://localhost:23456' );
        }, 'InvokerError' );

        assert.throws( function() {
            ccm.register( as, 'myiface', 'iface.a.1.0', 'http://localhost:23456' );
        }, 'InvokerError' );

        assert.throws( function() {
            ccm.register( as, 'myiface', 'iface$%$%.a.1.0', 'http://localhost:23456' );
        }, 'InvokerError' );

        ccm.register( as, 'myiface', 'iface.a:1.1', 'http://localhost:23456' );

        assert.throws( function() {
            ccm.assertIface( 'myiface', 'iface.a' );
        }, 'InvokerError' );
    } );

    it( 'should return iface impls', function() {
        var deff;
        var logf;
        var cl1f;
        var cl2f;
        var cl3f;

        ccm.register( as, ccm.SVC_DEFENSE, 'futoin.defense:1.0', function( ccmimpl, rawinfo ) {
            deff = new invoker.NativeIface( ccmimpl, rawinfo );
            return deff;
        } );
        ccm.register( as, ccm.SVC_LOG, 'futoin.log:1.0', function( ccmimpl, rawinfo ) {
            logf = new invoker.NativeIface( ccmimpl, rawinfo );
            return logf;
        } );
        ccm.register( as, ccm.SVC_CACHE_ + 'default', 'futoin.cache:1.0', function( ccmimpl, rawinfo ) {
            cl1f = new invoker.NativeIface( ccmimpl, rawinfo );
            return cl1f;
        } );
        ccm.register( as, ccm.SVC_CACHE_ + "L2", 'futoin.cache:1.0', function( ccmimpl, rawinfo ) {
            cl2f = new invoker.NativeIface( ccmimpl, rawinfo );
            return cl2f;
        } );
        ccm.register( as, ccm.SVC_CACHE_ + "L3", 'futoin.cache:1.0', function( ccmimpl, rawinfo ) {
            cl3f = new invoker.NativeIface( ccmimpl, rawinfo );
            return cl3f;
        } );

        expect( ccm.defense() ).equal( deff );
        expect( ccm.log() ).equal( logf );
        expect( ccm.cache() ).equal( cl1f );
        expect( ccm.cache( "L2" ) ).equal( cl2f );
        expect( ccm.cache( "L3" ) ).equal( cl3f );
    } );

    it( 'should marked endpoints as secure', function() {
        ccm.register( as, 'myhttp', 'a:1.0', 'http://localhost:23456' );
        expect( ccm._iface_info.myhttp.secure_channel ).be.false;
        ccm.register( as, 'myhttps', 'a:1.0', 'https://localhost:23456' );
        expect( ccm._iface_info.myhttps.secure_channel ).be.true;
        ccm.register( as, 'myws', 'a:1.0', 'ws://localhost:23456' );
        expect( ccm._iface_info.myws.secure_channel ).be.false;
        ccm.register( as, 'mywss', 'a:1.0', 'wss://localhost:23456' );
        expect( ccm._iface_info.mywss.secure_channel ).be.true;
        ccm.register( as, 'mysechttp', 'a:1.0', 'secure+http://localhost:23456' );
        expect( ccm._iface_info.mysechttp.secure_channel ).be.true;
        ccm.register( as, 'mysecws', 'a:1.0', 'secure+ws://localhost:23456' );
        expect( ccm._iface_info.mysecws.secure_channel ).be.true;
        ccm.register( as, 'myunix', 'a:1.0', 'unix://localhost:23456' );
        expect( ccm._iface_info.myunix.secure_channel ).be.true;
    } );

    it( 'should fail on missing iface registration', function() {
        assert.throws( function() {
            ccm.iface( 'missing' );
        }, 'InvokerError' );
    } );

    it( 'should fail on missing iface unregistration', function() {
        assert.throws( function() {
            ccm.unRegister( 'missing' );
        }, 'InvokerError' );
    } );

    it( 'should properly properly manage aliases', function() {
        ccm.register( as, 'myifacea', 'iface.a:1.0', 'http://localhost:23456' );
        ccm.register( as, 'myifaceb', 'iface.b:1.1', 'http://localhost:23456' );

        ccm.alias( 'myifacea', 'aiface1' );
        ccm.alias( 'myifacea', 'aiface2' );
        ccm.alias( 'myifacea', 'aiface3' );

        assert.throws( function() {
            ccm.alias( 'myifacea', 'aiface3' );
        }, 'InvokerError' );

        assert.throws( function() {
            ccm.alias( 'myifacec', 'aiface4' );
        }, 'InvokerError' );

        expect( ccm.iface( 'myifacea' ) ).equal( ccm.iface( 'aiface1' ) );
        expect( ccm.iface( 'myifacea' ) ).equal( ccm.iface( 'aiface2' ) );
        expect( ccm.iface( 'myifacea' ) ).equal( ccm.iface( 'aiface3' ) );

        ccm.unRegister( 'aiface3' );

        assert.throws( function() {
            ccm.iface( 'aiface3' );
        }, 'InvokerError' );

        expect( ccm.iface( 'myifacea' ) ).equal( ccm.iface( 'aiface2' ) );

        ccm.unRegister( 'myifacea' );

        assert.throws( function() {
            ccm.iface( 'myifacea' );
        }, 'InvokerError' );

        assert.throws( function() {
            ccm.iface( 'aiface2' );
        }, 'InvokerError' );
    } );

    it( 'should use "-internal" credentials', function( done ) {
        var ifacedef = {
            iface: 'internal.test',
            version: '1.0',
            ftn3rev: '1.7',
        };

        as.add( function( as ) {
            as.add(
                function( as ) {
                    ccm.register( as, 'mf', 'internal.test:1.0',
                        { onInternalRequest: function() {} }, null,
                        { specDirs: [ ifacedef ] } );
                },
                function( as, err ) {
                    done( err );
                }
            );

            as.add(
                function( as ) {
                    ccm.register( as, 'mf2', 'internal.test:1.0',
                        'http://localhost:23456', null,
                        { specDirs: [ ifacedef ] } );
                },
                function( as, err ) {
                    if ( err === 'SecurityError' ) {
                        as.success();
                    } else {
                        console.log( as.state.error_info );
                        done( err );
                    }
                }
            );
        } );
        as.add( function( as ) {
            done();
        } );
        as.execute();
    } );
} );

describe( 'AdvancedCCM', function() {
    beforeEach( function() {
        as = async_steps();
        var opts = {};

        opts.specDirs = thisDir + '/specs';
        ccm = new invoker.AdvancedCCM( opts );
        ccm.limitZone( 'default', {
            concurrent: 0xFFFF,
            rate: 0xFFFF,
        } );
    } );

    it( 'should register interface',
        function( done ) {
            as.add(
                function( as ) {
                    ccm.register( as, 'myiface', 'fileface.a:1.1', 'secure+http://localhost:23456' );
                },
                function( as, err ) {
                    done( as.state.last_exception || 'Fail' );
                }
            ).add( function( as ) {
                done();
            } ).execute();
        }
    );

    it( 'should behave as cache miss on initFromCache',
        function( done ) {
            as.add(
                function( as ) {
                    ccm.initFromCache( as, 'http://localhost:23456' );
                    as.successStep();
                },
                function( as, err ) {
                    ccm.register( as, 'myiface', 'fileface.a:1.1', 'http://localhost:23456' );
                    ccm.cacheInit( as );
                    as.successStep();
                    done();
                }
            );

            as.execute();
        }
    );

    it( 'should handle inheritted interface assert',
        function( done ) {
            as.add(
                function( as ) {
                    ccm.register( as, 'myiface', 'fileface.a:1.1', 'secure+http://localhost:23456' );

                    as.add( function( as ) {
                        ccm.assertIface( 'myiface', 'fileface.a:1.1' );
                        ccm.assertIface( 'myiface', 'fileface.a:1.0' );
                        ccm.assertIface( 'myiface', 'fileface.b:3.1' );
                        ccm.assertIface( 'myiface', 'fileface.b:3.0' );
                    } );
                    as.forEach( [
                        'fileface.a:1.2', 'fileface.a:0.1',
                        'fileface.b:3.2', 'fileface.b:2.1' ],
                    function( as, i, v ) {
                        as.add(
                            function( as ) {
                                ccm.assertIface( 'myiface', v );
                                as.error( 'Fail' );
                            },
                            function( as, err ) {
                                if ( err !== 'Fail' ) {
                                    as.success();
                                }
                            }
                        );
                    }
                    );
                },
                function( as, err ) {
                    done( as.state.last_exception || 'Fail' );
                }
            ).add( function( as ) {
                done();
            } ).execute();
        }
    );

    it( 'should use MessagePack for BinaryData interfaces',
        function( done ) {
            as.add(
                function( as ) {
                    ccm.register( as, 'myiface', 'fileface.a:1.1', 'secure+http://localhost:23456' );
                    ccm.register( as, 'mpackface', 'binaryface.a:1.0', 'secure+http://localhost:23456' );

                    as.add( ( as ) => {
                        expect( ccm._iface_info[ 'myiface' ].coder.name() ).equal( 'JSON' );
                        expect( ccm._iface_info[ 'mpackface' ].coder.name() ).equal( 'MPCK' );
                    } );
                },
                function( as, err ) {
                    done( as.state.last_exception || 'Fail' );
                }
            ).add( function( as ) {
                done();
            } ).execute();
        }
    );
} );

//============================================================================

var call_remotes_model_as = async_steps();

call_remotes_model_as.add(
    function( as ) {
        var iface = ccm.iface( 'myiface' );
        var is_ws = ( iface._raw_info.endpoint.split( ':' )[0] === 'ws' );
        var is_browser = ( iface._raw_info.endpoint.split( ':' )[0] === 'browser' );

        as.add( function( as ) {
            as.state.step = "testFunc";

            iface.call(
                as,
                'testFunc',
                {
                    a : "1",
                    n : 2.8,
                    o : { m : 3 },
                    i : 4,
                }
            );
            as.add( function( as, res ) {
                expect( res.res ).equal( 'MY_RESULT' );
            } );
        } ).add( function( as, res ) {
            if ( is_browser ) {
                return;
            }

            as.state.step = "testFuncRetry";
            iface.call(
                as,
                'testFuncRetry',
                {
                    a : "1",
                    n : 2.8,
                    o : { m : 3 },
                    i : 4,
                }
            );
            as.add( function( as, res ) {
                expect( res.res ).equal( 'MY_RESULT' );
            } );
        } ).add( function( as ) {
            as.state.step = "noResult";

            iface.call(
                as,
                "noResult",
                {
                    a : "123",
                }
            );
            as.add( function( as, res ) {
                if ( iface._raw_info.funcs.noResult ) {
                    assert.strictEqual( undefined, res );
                } else {
                    expect( res ).be.empty;
                }
            } );
        } ).add( function( as ) {
            as.state.step = "customResult";

            iface.call(
                as,
                "customResult"
            );
            as.add( function( as, res ) {
                assert.strictEqual( true, res );
            } );
        } ).add( function( as ) {
            as.state.step = "call";

            iface.call(
                as,
                "call"
            );

            as.add( function( as, res ) {
                if ( iface._raw_info.funcs.call ) {
                    assert.strictEqual( undefined, res );
                } else {
                    expect( res ).be.empty;
                }
            } );
        } ).add( function( as ) {
            as.state.step = "rawUploadFunc";

            if ( is_browser ) {
                as.success( { ok : 'OK' } );
                return;
            }

            iface.call(
                as,
                "rawUploadFunc",
                {},
                "MY_UPLOAD"
            );

            as.add( function( as, res ) {
                expect( res.ok ).equal( "OK" );
            } );
        } ).add( function( as ) {
            as.state.step = "rawUploadFuncParams";

            if ( is_browser ) {
                return;
            }

            iface.call(
                as,
                "rawUploadFuncParams",
                {
                    a : "123",
                    o : {
                        b : false,
                    },
                },
                "MY_UPLOAD",
                null,
                3e3
            );

            as.add( function( as, res ) {
                expect( res.ok ).equal( "OK" );
            } );
        } ).add( function( as ) {
            if ( is_ws || is_browser ) {
                return;
            }

            as.state.step = "rawDownload";

            iface.call(
                as,
                "rawDownload"
            );


            as.add( function( as, res ) {
                expect( res.toString() ).equal( "MY_DOWNLOAD" );
            } );
        } ).add(
            function( as ) {
                as.state.step = "triggerError";

                iface.call(
                    as,
                    "triggerError"
                );
            },
            function( as, err ) {
                expect( err ).equal( "MY_ERROR" );
                as.success( "YES" );
            }
        ).add(
            function( as, res ) {
                expect( res ).equal( "YES" );

                as.state.step = "wrongDataResult";

                if ( is_ws || is_browser ) {
                    return;
                }

                iface.call(
                    as,
                    "wrongDataResult"
                );
            },
            function( as, err ) {
                expect( err ).equal( "InternalError" );
                expect( as.state.error_info )
                    .equal( "Raw result is not expected: wrongDataResult()" );

                as.success();
            }
        ).add(
            function( as, res ) {
                if ( iface._raw_info.funcs.wrongDataResult ) {
                    assert.strictEqual( undefined, res );
                } else if ( !is_ws && !is_browser ) {
                    expect( res.toString() ).equal( "MY_DOWNLOAD" );
                }

                as.state.step = "missingResultVar";

                iface.call(
                    as,
                    "missingResultVar"
                );
            },
            function( as, err ) {
                expect( err ).equal( "InternalError" );
                expect( as.state.error_info )
                    .equal( "Missing result variables: missingResultVar()" );

                as.success();
            }
        ).add(
            function( as, res ) {
                if ( iface._raw_info.funcs.wrongDataResult ) {
                    assert.strictEqual( undefined, res );
                } else {
                    expect( res.ok ).equal( "OK" );
                }

                as.state.step = "rawResultExpected";

                if ( is_ws || is_browser ) {
                    return;
                }

                iface.call(
                    as,
                    "rawResultExpected"
                );
            },
            function( as, err ) {
                expect( err ).equal( "InternalError" );
                expect( as.state.error_info )
                    .equal( "Raw result is expected: rawResultExpected()" );

                as.success();
            }
        ).add(
            function( as, res ) {
                if ( iface._raw_info.funcs.rawResultExpected ) {
                    assert.strictEqual( undefined, res );
                } else if ( !is_ws && !is_browser ) {
                    expect( res.ok ).equal( "OK" );
                }

                as.state.step = "wrongException";

                iface.call(
                    as,
                    "wrongException"
                );
            },
            function( as, err ) {
                if ( iface._raw_info.funcs.wrongException ) {
                    expect( err ).equal( "InternalError" );
                    expect( as.state.error_info )
                        .equal( "Not expected exception from Executor: wrongException()" );
                } else {
                    expect( err ).equal( "MY_ERROR" );
                }

                as.success();
            }
        ).add(
            function( as, res ) {
                assert.strictEqual( undefined, res );

                as.state.step = "unknownFunc";

                iface.call(
                    as,
                    "unknownFunc"
                );
            },
            function( as, err ) {
                if ( iface._raw_info.funcs.wrongException ) {
                    expect( err ).equal( "InvokerError" );
                    expect( as.state.error_info )
                        .equal( "Unknown interface function: unknownFunc()" );
                } else {
                    expect( err ).equal( "MY_ERROR" );
                }

                as.success();
            }
        ).add(
            function( as, res ) {
                assert.strictEqual( undefined, res );

                as.state.step = "unexpectedUpload";

                iface.call(
                    as,
                    "unexpectedUpload",
                    {},
                    "MY_UPLOAD"
                );
            },
            function( as, err ) {
                expect( err ).equal( "InvokerError" );

                if ( is_browser && !iface._raw_info.funcs.unexpectedUpload ) {
                    expect( as.state.error_info )
                        .equal( "Upload data is allowed only for HTTP/WS endpoints" );
                } else {
                    expect( as.state.error_info )
                        .equal( "Raw upload is not allowed: unexpectedUpload()" );
                }


                as.success();
            }
        ).add(
            function( as, res ) {
                if ( iface._raw_info.funcs.unexpectedUpload || is_browser ) {
                    assert.strictEqual( undefined, res );
                } else {
                    expect( res.ok ).equal( "OK" );
                }

                as.state.step = "noParams";

                iface.call(
                    as,
                    "noParams",
                    { a : "a" }
                );
            },
            function( as, err ) {
                expect( err ).equal( "InvokerError" );
                expect( as.state.error_info )
                    .equal( "No params are defined: noParams()" );

                as.success();
            }
        ).add(
            function( as, res ) {
                if ( iface._raw_info.funcs.noParams ) {
                    assert.strictEqual( undefined, res );
                } else {
                    expect( res.ok ).equal( "OK" );
                }

                as.state.step = "unknownParam";

                iface.call(
                    as,
                    "unknownParam",
                    { a : "a",
                        b : "b" }
                );
            },
            function( as, err ) {
                expect( err ).equal( "InvokerError" );
                expect( as.state.error_info )
                    .equal( "Unknown parameter: unknownParam(b)" );

                as.success();
            }
        ).add(
            function( as, res ) {
                if ( iface._raw_info.funcs.noParams ) {
                    assert.strictEqual( undefined, res );
                } else {
                    expect( res.ok ).equal( "OK" );
                }

                as.state.step = "missingParam";

                iface.call(
                    as,
                    "unknownParam",
                    {}
                );
            },
            function( as, err ) {
                expect( err ).equal( "InvokerError" );
                expect( as.state.error_info )
                    .equal( "Missing parameter: unknownParam(a)" );

                as.success();
            }
        ).add(
            function( as, res ) {
                if ( iface._raw_info.funcs.noParams ) {
                    assert.strictEqual( undefined, res );
                } else {
                    expect( res.ok ).equal( "OK" );
                }

                as.state.step = "testUnicode";

                iface.call(
                    as,
                    "pingPong",
                    { ping : "Мои данные на русском un latviešu valodā" }
                );
            }
        ).add(
            function( as, res ) {
                expect( res.pong ).equal( "Мои данные на русском un latviešu valodā" );

                as.state.step = "getCoder";

                iface.call(
                    as,
                    "getCoder"
                );
            }
        ).add(
            function( as, res ) {
                expect( res.name ).equal( as.state.coder );
            }
        ).add(
            function( as ) {
                const state = as.state;
                state.close_called = false;
                state.iface_close_called = false;

                ccm.once( 'close', function() {
                    state.close_called = true;
                } );

                iface.once( 'close', function() {
                    state.iface_close_called = true;
                } );

                ccm.close();
            }
        ).add( break_burst ).add(
            function( as ) {
                expect( as.state.close_called ).be.true;
                expect( as.state.iface_close_called ).be.true;
            }
        );
    },
    function( as, err ) {
        console.log( as.state.last_exception.stack );
        as.state.done( new Error( err + ": " + as.state.error_info + " at "+as.state.step ) );
    }
).add( function( as ) {
    as.state.done();
} );


var call_interceptors_model_as = async_steps();

call_interceptors_model_as.add(
    function( as ) {
        var iface = ccm.iface( 'myiface' );

        as.add( function( as ) {
            try {
                as.state.step = "testFunc";

                iface.testFunc(
                    as,
                    "1",
                    2.8,
                    { m : 3 },
                    4
                );
            } catch ( e ) {
                console.dir( e.stack );
                console.log( as.state.error_info );
                throw e;
            }
        } ).add( function( as, res ) {
            expect( res.res ).equal( 'MY_RESULT' );

            as.state.step = "noResult";

            iface.noResult(
                as,
                "123"
            );
        } ).add( function( as, res ) {
            if ( iface._raw_info.funcs.noResult ) {
                assert.strictEqual( undefined, res );
            } else {
                expect( res ).be.empty;
            }

            as.state.step = "rawDownload";

            iface.rawDownload( as );
        } ).add(
            function( as, res ) {
                expect( res.toString() ).equal( "MY_DOWNLOAD" );

                as.state.step = "triggerError";

                iface.triggerError( as );
            },
            function( as, err ) {
                expect( err ).equal( "MY_ERROR" );
                as.success( "YES" );
            }
        ).add( function( as, res ) {
            expect( res ).equal( "YES" );
            expect( as.state.incomming_msg.length ).equal( 4 );
            expect( as.state.outgoing_msg.length ).equal( 4 );
            as.success();
        } );
    },
    function( as, err ) {
        console.log( err + ": " + as.state.error_info + "("+as.state.step+")" );
        as.state.done( as.state.last_exception || 'Fail' );
    }
).add( function( as ) {
    as.state.done();
} );

//============================================================================
describe( 'NativeIface', function() {
    describe( '#ifaceInfo() - SimpleCCM', function() {
        beforeEach( function() {
            as = async_steps();

            as.state.incomming_msg = [];
            as.state.outgoing_msg = [];

            var opts = {};

            opts.commConfigCallback = function( proto, agent_opts ) {
                if ( proto === 'http' ) {
                    agent_opts.maxSockets = 3;
                }
            };
            opts.messageSniffer = function( info, msg, is_incomming ) {
                if ( is_incomming ) {
                    as.state.incomming_msg.push( msg );
                } else {
                    as.state.outgoing_msg.push( msg );
                }
            };

            ccm = new invoker.SimpleCCM( opts );
            ccm.limitZone( 'default', {
                concurrent: 0xFFFF,
                rate: 0xFFFF,
            } );
        } );

        afterEach( function( done ) {
            closeTestHttpServer( done );
        } );

        it( 'should return ifaceInfo without details', function( done ) {
            ccm.register( as, 'myiface', 'fileface.a:1.1', 'http://localhost:23456' );

            as.add( function( as ) {
                var info = ccm.iface( 'myiface' ).ifaceInfo();

                expect( ccm.iface( 'myiface' ).ifaceInfo() ).equal( info );

                expect( info.name() ).equal( 'fileface.a' );
                expect( info.version() ).equal( '1.1' );
                expect( info.inherits().length ).equal( 0 );
                expect( _isEmpty( info.funcs() ) ).be.true;
                expect( _isEmpty( info.constraints() ) ).be.true;

                var iface = ccm.iface( 'myiface' );

                expect( iface ).not.have.property( 'testFunc' );
                expect( iface ).not.have.property( 'rawUploadFunc' );
                done();
            } );
            as.execute();
        } );

        for ( coder in coders ) {
            ( function( coder ) {
                it( 'should call HTTP remotes ' + coder, function( done ) {
                    this.timeout( 5000 );
                    as.add(
                        function( as ) {
                            try {
                                ccm.register( as, 'myiface', 'fileface.a:1.1',
                                    'secure+http://localhost:23456/ftn',
                                    null, { coder: coder } );

                                as.add( function( as ) {
                                    as.setTimeout( 100 );
                                    createTestHttpServer( function() {
                                        as.success();
                                    } );
                                } );
                            } catch ( e ) {
                                console.dir( e.stack );
                                console.log( as.state.error_info );
                                throw e;
                            }
                        },
                        function( as, err ) {
                            as.state.done( new Error( err + ": " + as.state.error_info ) );
                        }
                    );
                    as.copyFrom( call_remotes_model_as );
                    as.state.done = done;
                    as.state.coder = coder;
                    as.execute();
                } );

                it( 'should call WS remotes ' + coder, function( done ) {
                    this.timeout( 5000 );
                    as.add(
                        function( as ) {
                            try {
                                ccm.register( as, 'myiface', 'fileface.a:1.1',
                                    'secure+ws://localhost:23456/ftn',
                                    null, { coder: coder } );

                                as.add( function( as ) {
                                    as.setTimeout( 100 );
                                    createTestHttpServer( function() {
                                        as.success();
                                    } );
                                } );
                            } catch ( e ) {
                                console.dir( e.stack );
                                console.log( as.state.error_info );
                                throw e;
                            }
                        },
                        function( as, err ) {
                            as.state.done( new Error( err + ": " + as.state.error_info ) );
                        }
                    );
                    as.copyFrom( call_remotes_model_as );
                    as.state.done = done;
                    as.state.coder = coder;
                    as.execute();
                } );
            } )( coder );
        }

        if ( typeof window !== 'undefined' ) {
            it( 'should call browser:// remotes', function( done ) {
                this.timeout( 5000 );
                as.add(
                    function( as ) {
                        try {
                            ccm.register(
                                as, 'myiface', 'fileface.a:1.1',
                                'browser://server_frame', null,
                                { targetOrigin: 'http://localhost:8000' } );
                        } catch ( e ) {
                            console.dir( e.stack );
                            console.log( as.state.error_info );
                            throw e;
                        }
                    },
                    function( as, err ) {
                        as.state.done( new Error( err + ": " + as.state.error_info ) );
                    }
                );
                as.copyFrom( call_remotes_model_as );
                as.state.done = done;
                as.state.coder = 'JSON';
                as.execute();
            } );
        }

        it( 'should fail with unknown scheme', function( done ) {
            as.add(
                function( as ) {
                    ccm.register( as, 'myiface', 'fileface.a:1.1', 'unknown://localhost:23456/ftn' );
                },
                function( as, err ) {
                    try {
                        expect( err ).equal( 'InvokerError' );
                        expect( as.state.error_info ).match( /^Unknown endpoint schema/ );
                        done();
                    } catch ( ex ) {
                        done( ex );
                    }
                }
            );
            as.execute();
        } );
    } );

    describe( '#ifaceInfo() - AdvancedCCM', function() {
        beforeEach( function() {
            as = async_steps();

            as.state.incomming_msg = [];
            as.state.outgoing_msg = [];

            var opts = {};

            opts.specDirs = thisDir + '/specs';
            opts.messageSniffer = function( info, msg, is_incomming ) {
                if ( is_incomming ) {
                    as.state.incomming_msg.push( msg );
                } else {
                    as.state.outgoing_msg.push( msg );
                }
            };
            ccm = new invoker.AdvancedCCM( opts );
            ccm.limitZone( 'default', {
                concurrent: 0xFFFF,
                rate: 0xFFFF,
            } );
        } );

        afterEach( function( done ) {
            closeTestHttpServer( done );
        } );

        it( 'should return ifaceInfo with details', function( done ) {
            as.add(
                function( as ) {
                    ccm.register( as, 'myiface', 'fileface.a:1.1', 'http://localhost:23456' );
                },
                function( as, err ) {
                    if ( ( err === 'SecurityError' ) &&
                         ( as.state.error_info === "SecureChannel is required" ) ) {
                        as.success();
                        return;
                    }

                    done( as.state.last_exception || 'Fail' );
                }
            ).add(
                function( as ) {
                    try {
                        ccm.register( as, 'myiface', 'fileface.a:1.1', 'secure+http://localhost:23456' );
                        as.successStep();
                    } catch ( e ) {
                        console.dir( e.stack );
                        console.log( as.state.error_info );
                        throw e;
                    }
                },
                function( as, err ) {
                    console.log( err + ": " + as.state.error_info );
                }
            ).add(
                function( as ) {
                    try {
                        var info = ccm.iface( 'myiface' ).ifaceInfo();

                        expect( ccm.iface( 'myiface' ).ifaceInfo() ).equal( info );
                        ccm.assertIface( 'myiface', 'fileface.b:3.1' );
                        ccm.assertIface( 'myiface', 'fileface.b:3.0' );

                        expect( info.name() ).equal( 'fileface.a' );
                        expect( info.version() ).equal( '1.1' );
                        expect( info.inherits().length ).equal( 1 );
                        expect( _isEmpty( info.funcs() ) ).be.false;
                        expect( _isEmpty( info.constraints() ) ).be.false;

                        var iface = ccm.iface( 'myiface' );

                        expect( iface ).have.property( 'testFunc' );
                        expect( iface ).not.have.property( 'rawUploadFunc' );

                        assert.throws( function() {
                            iface.bindDerivedKey();
                        }, 'InvokerError' );

                        done();
                        as.success();
                    } catch ( e ) {
                        console.dir( e.stack );
                        console.log( as.state.error_info );
                        throw e;
                    }
                },
                function( as, err ) {
                    console.log( err + ": " + as.state.error_info );
                }
            );
            as.execute();
        } );

        for ( coder in coders ) {
            ( function( coder ) {
                it( 'should call HTTP remotes ' + coder, function( done ) {
                    this.timeout( 5000 );
                    as.add(
                        function( as ) {
                            try {
                                ccm.register( as, 'myiface', 'fileface.a:1.1',
                                    'secure+http://localhost:23456/ftn',
                                    null, { coder: coder } );

                                as.add( function( as ) {
                                    as.setTimeout( 100 );
                                    createTestHttpServer( function() {
                                        as.success();
                                    } );
                                } );
                            } catch ( e ) {
                                console.dir( e.stack );
                                console.log( as.state.error_info );
                                throw e;
                            }
                        },
                        function( as, err ) {
                            as.state.done( new Error( err + ": " + as.state.error_info ) );
                        }
                    );
                    as.copyFrom( call_remotes_model_as );
                    as.state.done = done;
                    as.state.coder = coder;
                    as.execute();
                } );

                it( 'should call WS remotes ' + coder, function( done ) {
                    this.timeout( 5000 );
                    as.add(
                        function( as ) {
                            try {
                                ccm.register( as, 'myiface', 'fileface.a:1.1',
                                    'secure+ws://localhost:23456/ftn',
                                    null, { coder: coder } );

                                as.add( function( as ) {
                                    as.setTimeout( 100 );
                                    createTestHttpServer( function() {
                                        as.success();
                                    } );
                                } );
                            } catch ( e ) {
                                console.dir( e.stack );
                                console.log( as.state.error_info );
                                throw e;
                            }
                        },
                        function( as, err ) {
                            as.state.done( new Error( err + ": " + as.state.error_info ) );
                        }
                    );
                    as.copyFrom( call_remotes_model_as );
                    as.state.done = done;
                    as.state.coder = coder;
                    as.execute();
                } );
            } )( coder );

            if ( typeof window === 'undefined' ) {
                it( 'should call HTTP remotes with Stateless MAC ' + coder, function( done ) {
                    this.timeout( 5000 );
                    as.add(
                        function( as ) {
                            try {
                                ccm.register( as, 'myiface', 'fileface.a:1.1',
                                    'secure+ws://localhost:23456/ftn',
                                    '-smac:usr', {
                                        macKey: '111222333444555666777888999',
                                        coder,
                                    } );

                                as.add( function( as ) {
                                    as.setTimeout( 100 );
                                    createTestHttpServer( function() {
                                        as.success();
                                    } );
                                } );
                            } catch ( e ) {
                                console.dir( e.stack );
                                console.log( as.state.error_info );
                                throw e;
                            }
                        },
                        function( as, err ) {
                            as.state.done( new Error( err + ": " + as.state.error_info ) );
                        }
                    );
                    as.copyFrom( call_remotes_model_as );
                    as.state.done = done;
                    as.state.coder = coder;
                    as.execute();
                } );

                it( 'should call WS remotes with Stateless MAC ' + coder, function( done ) {
                    this.timeout( 5000 );
                    as.add(
                        function( as ) {
                            try {
                                ccm.register( as, 'myiface', 'fileface.a:1.1',
                                    'secure+http://localhost:23456/ftn',
                                    '-smac:usr', {
                                        macKey: '111222333444555666777888999',
                                        coder,
                                    } );

                                as.add( function( as ) {
                                    as.setTimeout( 100 );
                                    createTestHttpServer( function() {
                                        as.success();
                                    } );
                                } );
                            } catch ( e ) {
                                console.dir( e.stack );
                                console.log( as.state.error_info );
                                throw e;
                            }
                        },
                        function( as, err ) {
                            as.state.done( new Error( err + ": " + as.state.error_info ) );
                        }
                    );
                    as.copyFrom( call_remotes_model_as );
                    as.state.done = done;
                    as.state.coder = coder;
                    as.execute();
                } );

                it( 'should call HTTP remotes with Master MAC ' + coder, function( done ) {
                    this.timeout( 5000 );
                    as.add(
                        function( as ) {
                            try {
                                ccm.register( as, 'myiface', 'fileface.a:1.1',
                                    'secure+ws://localhost:23456/ftn',
                                    'master', {
                                        masterAuth : new TestMasterAuth,
                                        coder,
                                    } );

                                as.add( function( as ) {
                                    as.setTimeout( 100 );
                                    createTestHttpServer( function() {
                                        as.success();
                                    } );
                                } );
                            } catch ( e ) {
                                console.dir( e.stack );
                                console.log( as.state.error_info );
                                throw e;
                            }
                        },
                        function( as, err ) {
                            as.state.done( new Error( err + ": " + as.state.error_info ) );
                        }
                    );
                    as.copyFrom( call_remotes_model_as );
                    as.state.done = done;
                    as.state.coder = coder;
                    as.execute();
                } );

                it( 'should call WS remotes with Master MAC ' + coder, function( done ) {
                    this.timeout( 5000 );
                    as.add(
                        function( as ) {
                            try {
                                ccm.register( as, 'myiface', 'fileface.a:1.1',
                                    'secure+http://localhost:23456/ftn',
                                    'master', {
                                        coder,
                                        masterAuth : new TestMasterAuth,
                                    } );

                                as.add( function( as ) {
                                    as.setTimeout( 100 );
                                    createTestHttpServer( function() {
                                        as.success();
                                    } );
                                } );
                            } catch ( e ) {
                                console.dir( e.stack );
                                console.log( as.state.error_info );
                                throw e;
                            }
                        },
                        function( as, err ) {
                            as.state.done( new Error( err + ": " + as.state.error_info ) );
                        }
                    );
                    as.copyFrom( call_remotes_model_as );
                    as.state.done = done;
                    as.state.coder = coder;
                    as.execute();
                } );
            }
        }

        if ( typeof window !== 'undefined' ) {
            it( 'should call browser:// remotes', function( done ) {
                this.timeout( 5000 );
                as.add(
                    function( as ) {
                        try {
                            ccm.register(
                                as, 'myiface', 'fileface.a:1.1',
                                'browser://server_frame', null,
                                { targetOrigin: 'http://localhost:8000' } );
                        } catch ( e ) {
                            console.dir( e.stack );
                            console.log( as.state.error_info );
                            throw e;
                        }
                    },
                    function( as, err ) {
                        as.state.done( new Error( err + ": " + as.state.error_info ) );
                    }
                );
                as.copyFrom( call_remotes_model_as );
                as.state.done = done;
                as.state.coder = 'JSON';
                as.execute();
            } );
        } else {
            it( 'should call binary', function( done ) {
                as.add(
                    function( as ) {
                        ccm.register(
                            as, 'myiface', 'binaryface.a:1.0',
                            'secure+http://localhost:23456/ftn' );
                        ccm.register(
                            as, 'myiface2', 'binaryface.a:1.0',
                            'secure+ws://localhost:23456/ftn' );

                        const buf = Buffer.alloc( 16, 0x12 );

                        as.add( function( as ) {
                            as.setTimeout( 100 );
                            createTestHttpServer( function() {
                                as.success();
                            } );
                        } );
                        as.add( ( as ) => {
                            ccm.iface( 'myiface' ).binaryPingPong( as, buf );
                        } );
                        as.add( ( as, res ) => {
                            expect( buf.equals( res.pong ) ).be.true;
                        } );
                        as.add( ( as ) => {
                            ccm.iface( 'myiface2' ).binaryPingPong( as, buf );
                        } );
                        as.add( ( as, res ) => {
                            expect( buf.equals( res.pong ) ).be.true;
                        } );
                        as.add( ( as ) => done() );
                    },
                    function( as, err ) {
                        console.log( err + ": " + as.state.error_info );
                        done( as.state.last_exception || 'Fail' );
                    }
                );
                as.execute();
            } );
        }

        it( 'should call WS remotes through interceptors', function( done ) {
            this.timeout( 5000 );
            as.add(
                function( as ) {
                    try {
                        ccm.register( as, 'myiface', 'fileface.a:1.1', 'secure+ws://localhost:23456/ftn' );

                        as.add( function( as ) {
                            as.setTimeout( 100 );
                            createTestHttpServer( function() {
                                as.success();
                            } );
                        } );
                    } catch ( e ) {
                        console.dir( e.stack );
                        console.log( as.state.error_info );
                        throw e;
                    }
                },
                function( as, err ) {
                    as.state.done( new Error( err + ": " + as.state.error_info ) );
                }
            );
            as.copyFrom( call_interceptors_model_as );
            as.state.done = done;
            as.execute();
        } );

        it( 'should check secure channel', function( done ) {
            as.add(
                function( as ) {
                    ccm.register( as, 'myiface', 'fileface.a:1.1', 'ws://localhost:23456/ftn' );

                    as.add( function( as ) {
                        as.setTimeout( 100 );
                        createTestHttpServer( function() {
                            as.success();
                        } );
                    } );
                    as.add( function( as ) {
                        ccm.iface( 'myiface' ).call( as, 'missingResultVar' );
                    } );
                },
                function( as, err ) {
                    try {
                        expect( err ).equal( 'SecurityError' );
                        expect( as.state.error_info ).equal( "SecureChannel is required" );
                        done();
                    } catch ( ex ) {
                        done( ex );
                    }

                    as.state.done( new Error( err + ": " + as.state.error_info ) );
                }
            );

            as.execute();
        } );

        it( 'should throw on not implemented UNIX transport', function( done ) {
            as.add(
                function( as ) {
                    ccm.register( as, 'myiface', 'fileface.a:1.1', 'unix://tmp.sock/' );
                    as.successStep();
                },
                function( as, err ) {
                    done( new Error( err + ": " + as.state.error_info ) );
                }
            ).add(
                function( as ) {
                    ccm.iface( 'myiface' ).call(
                        as,
                        "noResult",
                        {
                            a : "123",
                        }
                    );
                },
                function( as, err ) {
                    expect( err ).equal( "InvokerError" );
                    done();
                }
            );
            as.execute();
        } );

        it( 'should throw on missing spec', function( done ) {
            as.add(
                function( as ) {
                    ccm.register( as, 'myiface', 'fileface.missign:1.1', 'unix://tmp.sock/' );
                    as.successStep();
                },
                function( as, err ) {
                    expect( err ).equal( "InternalError" );
                    done();
                }
            );
            as.execute();
        } );

        it( 'should call internal effectively', function( done ) {
            as.add(
                function( as ) {
                    ccm.register( as, 'myiface', 'fileface.a:1.1', {
                        onInternalRequest : function( as, info, ftnreq ) {
                            as.add( function( as ) {
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
                    } );
                },
                function( as, err ) {
                    done( as.state.last_exception || 'Fail' );
                }
            ).add(
                function( as ) {
                    var iface = ccm.iface( 'myiface' );

                    iface.call( as, 'testFunc', { a : '1',
                        n : 2.8,
                        i : 4,
                        o : { m : 3 } } );
                    as.add( function( as, res ) {
                        expect( res.res ).equal( 'MY_RESULT' );
                        done();
                    } );
                },
                function( as, err ) {
                    done( as.state.last_exception || 'Fail' );
                }
            );
            as.execute();
        } );
    } );
} );

//============================================================================
describe( 'LogFace', function() {
    before( function( done ) {
        as = async_steps();

        var opts = {};

        opts.specDirs = thisDir + '/specs';
        ccm = new invoker.AdvancedCCM( opts );
        ccm.limitZone( 'default', {
            concurrent: 0xFFFF,
            rate: 0xFFFF,
        } );

        as
            .add(
                function( as ) {
                    LogFace.register( as, ccm, 'secure+ws://localhost:23456/ftn' );
                    ccm.register( as, 'myiface', 'fileface.a:1.1', 'secure+ws://localhost:23456/ftn' );

                    as.add( function( as ) {
                        createTestHttpServer( function() {
                            done();
                        } );
                    } );
                },
                function( as, err ) {
                    console.log( as.state.error_info );
                    done( as.state.last_exception || 'Fail' );
                }
            )
            .execute();
    } );

    after( function( done ) {
        closeTestHttpServer( done );
    } );

    it ( 'should have levels', () => {
        const log = ccm.log();

        expect( log.LVL_DEBUG ).equal( 'debug' );
        expect( log.LVL_INFO ).equal( 'info' );
        expect( log.LVL_WARN ).equal( 'warn' );
        expect( log.LVL_ERROR ).equal( 'error' );
        expect( log.LVL_SECURITY ).equal( 'security' );
    } );

    it( 'should call futoin.log through native interface', function( done ) {
        this.timeout( 10e3 );

        as
            .add(
                function( as ) {
                    ccm.log().debug( 'DEBUGMSG' );
                    ccm.log().info( 'INFOMSG' );
                    ccm.log().warn( 'WARNMSG' );
                    ccm.log().error( 'ERRORMSG' );
                    ccm.log().security( 'SECURITYMSG' );
                    ccm.log().hexdump( 'debug', 'DEBUGMSG', 'HEXDATA' );
                    ccm.log().call( as, 'msg', { txt: 'sync',
                        lvl : 'debug',
                        ts : '12345678901234.123' } );

                    as.state.waits = 0;

                    as.loop( function( as ) {
                        as.add( function( as ) {
                            as.setTimeout( 1e3 );
                            async_steps.ActiveAsyncTool.callImmediate( () => as.success(), 300 );
                        } )
                            .add( break_burst )
                            .add( function( as ) {
                                ccm.iface( 'myiface' ).getLogCount( as );
                            } )
                            .add( function( as, res ) {
                                if ( res.count === 7 ) {
                                    as.break();
                                }

                                as.state.waits += 1;

                                if ( as.state.waits > 20 ) {
                                    expect( res.count ).equal( 7 );
                                }
                            } );
                    } );
                },
                function( as, err ) {
                    console.log( as.state.error_info );
                    done( as.state.last_exception || 'Fail' );
                }
            )
            .add( break_burst )
            .add( function( as, res ) {
                done();
            } )
            .execute();
    } );
} );

//============================================================================
describe( 'CacheFace', function() {
    before( function( done ) {
        as = async_steps();

        var opts = {};

        opts.specDirs = thisDir + '/specs';
        ccm = new invoker.AdvancedCCM( opts );
        ccm.limitZone( 'default', {
            concurrent: 0xFFFF,
            rate: 0xFFFF,
        } );

        as
            .add(
                function( as ) {
                    CacheFace.register( as, ccm, 'my', 'secure+ws://localhost:23456/ftn', 'login:pass' );
                    ccm.register( as, 'myiface', 'fileface.a:1.1', 'secure+ws://localhost:23456/ftn' );

                    as.add( function( as ) {
                        createTestHttpServer( function() {
                            done();
                        } );
                    } );
                },
                function( as, err ) {
                    console.log( as.state.error_info );
                    done( as.state.last_exception || 'Fail' );
                }
            )
            .execute();
    } );

    after( function( done ) {
        closeTestHttpServer( done );
    } );

    it( 'should call futoin.cache through native interface', function( done ) {
        as
            .add(
                function( as ) {
                    var cface = ccm.cache( 'my' );
                    var call_count = 0;
                    var cb = function( as, a, b ) {
                        call_count += 1;
                        as.add( function( as ) {
                            as.success( a + b || 100 );
                        } );
                    };

                    cface.getOrSet( as, 'mykey', cb, [ 1, 2 ], 10 );

                    as.add( function( as, value ) {
                        expect( value ).equal( 3 );
                        cface.getOrSet( as, 'mykey', cb, [ 1, 2 ], 10 );
                    } );

                    as.add( function( as, value ) {
                        expect( value ).equal( 3 );
                        expect( call_count ).equal( 1 );
                    } );

                    cface.getOrSet( as, 'mykey', cb );

                    as.add( function( as, value ) {
                        expect( value ).equal( 100 );
                        expect( call_count ).equal( 2 );
                    } );
                },
                function( as, err ) {
                    console.log( as.state.error_info );
                    done( as.state.last_exception || 'Fail' );
                }
            )
            .add( function( as, res ) {
                done();
            } )
            .execute();
    } );
} );


//============================================================================
if ( isNode ) {
    describe( 'PingFace', function() {
        var PingFace = module.require( '../PingFace' );

        before( function( done ) {
            as = async_steps();

            var opts = {};

            opts.specDirs = thisDir + '/specs';
            ccm = new invoker.AdvancedCCM( opts );
            ccm.limitZone( 'default', {
                concurrent: 0xFFFF,
                rate: 0xFFFF,
            } );

            as
                .add(
                    function( as ) {
                        PingFace.register( as, ccm, 'ping', 'secure+ws://localhost:23456/ftn', 'login:pass' );
                        ccm.register( as, 'myiface', 'fileface.a:1.1', 'secure+ws://localhost:23456/ftn' );

                        as.add( function( as ) {
                            createTestHttpServer( function() {
                                done();
                            } );
                        } );
                    },
                    function( as, err ) {
                        console.log( as.state.error_info );
                        done( as.state.last_exception || 'Fail' );
                    }
                )
                .execute();
        } );

        after( function( done ) {
            closeTestHttpServer( done );
        } );

        it( 'should call futoin.ping through native interface', function( done ) {
            as
                .add(
                    function( as ) {
                        var pface = ccm.iface( 'ping' );

                        pface.ping( as, 123 );

                        as.add( function( as, echo ) {
                            expect( echo ).equal( 123 );
                        } );
                    },
                    function( as, err ) {
                        console.log( as.state.error_info );
                        done( as.state.last_exception || 'Fail' );
                    }
                )
                .add( function( as, res ) {
                    done();
                } )
                .execute();
        } );
    } );

    describe( 'MasterAuth', function() {
        it( 'should raise default errors', function() {
            const ma = new invoker.MasterAuth;
            expect( () => ma.signMessage() ).throw(
                'Missing signMessage() implementation' );
            expect( () => ma.genMAC() ).throw(
                'Missing genMAC() implementation' );
        } );
    } );
}

