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
const $as_test = async_steps.testcase;

let as;
let ccm;
const stats = {};

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

    it( 'should register interface', $as_test( ( as ) => {
        let reg_fired = false;

        ccm.once( 'register', () => {
            reg_fired = true;
        } );
        ccm.register( as, 'myiface', 'iface.a:1.1', 'http://localhost:23456' );

        as.add( break_burst );
        as.add( ( as ) => {
            expect( reg_fired ).be.true;
        } );
    } ) );

    it( 'should unregister interface', $as_test( ( as ) => {
        ccm.register( as, 'myiface', 'iface.a:1.1', 'http://localhost:23456' );
        ccm.register( as, 'otherface', 'iface.b:1.2', 'http://localhost:23456' );

        let reg_fired = false;

        as.add( ( as ) => {
            ccm.assertIface( 'myiface', 'iface.a:1.1' );
            ccm.assertIface( 'otherface', 'iface.b:1.2' );

            ccm.once( 'unregister', () => {
                reg_fired = true;
            } );
            ccm.unRegister( 'myiface' );
            ccm.assertIface( 'otherface', 'iface.b:1.2' );

            assert.throws( function() {
                ccm.assertIface( 'myiface', 'iface.a:1.1' );
            }, 'InvokerError' );
        } );
        as.add( break_burst );
        as.add( ( as ) => {
            expect( reg_fired ).be.true;
        } );
    } ) );

    it( 'should create interface alias', $as_test( ( as ) => {
        ccm.register( as, 'myiface', 'iface.a:1.1', 'http://localhost:23456' );
        ccm.register( as, 'otherface', 'iface.b:1.2', 'http://localhost:23456' );

        as.add( ( as ) => {
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
        } );
    } ) );

    it( 'should fail on double registration', $as_test(
        ( as ) => {
            ccm.register( as, 'myiface', 'iface.a:1.1', 'http://localhost:23456' );
            as.state.fire_reg = true;
            ccm.register( as, 'myiface', 'iface.a:1.1', 'http://localhost:23456' );
        },
        ( as, err ) => {
            expect( as.state.fire_reg ).be.true;
            expect( err ).equal( 'InvokerError' );
            expect( as.state.error_info ).equal( 'Already registered' );
            as.success();
        }
    ) );

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

    it( 'should use "-internal" credentials', $as_test( ( as ) => {
        var ifacedef = {
            iface: 'internal.test',
            version: '1.0',
            ftn3rev: '1.7',
        };

        ccm.register( as, 'mf', 'internal.test:1.0',
            { onInternalRequest: function() {} }, null,
            { specDirs: [ ifacedef ] } );

        as.add(
            ( as ) => {
                ccm.register( as, 'mf2', 'internal.test:1.0',
                    'http://localhost:23456', null,
                    { specDirs: [ ifacedef ] } );
            },
            ( as, err ) => {
                if ( err === 'SecurityError' ) {
                    as.success();
                }
            }
        );
    } ) );
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

    it( 'should register interface', $as_test( ( as ) => {
        ccm.register( as, 'myiface', 'fileface.a:1.1', 'secure+http://localhost:23456' );
    } ) );

    it( 'should behave as cache miss on initFromCache', $as_test(
        ( as ) => {
            ccm.initFromCache( as, 'secure+http://localhost:23456' );
        },
        ( as, err ) => {
            expect( err ).equal( 'NotImplemented' );
            expect( as.state.error_info ).equal( 'Caching is not supported yet' );
            ccm.register( as, 'myiface', 'fileface.a:1.1', 'secure+http://localhost:23456' );
            ccm.cacheInit( as );
        }
    ) );

    it( 'should handle inheritted interface assert', $as_test( ( as ) => {
        ccm.register( as, 'myiface', 'fileface.a:1.1', 'secure+http://localhost:23456' );

        as.add( ( as ) => {
            ccm.assertIface( 'myiface', 'fileface.a:1.1' );
            ccm.assertIface( 'myiface', 'fileface.a:1.0' );
            ccm.assertIface( 'myiface', 'fileface.b:3.1' );
            ccm.assertIface( 'myiface', 'fileface.b:3.0' );
        } );
        as.forEach( [
            'fileface.a:1.2', 'fileface.a:0.1',
            'fileface.b:3.2', 'fileface.b:2.1' ],
        ( as, i, v ) => {
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
    } ) );

    it( 'should use MessagePack for BinaryData interfaces', $as_test( ( as ) => {
        ccm.register( as, 'myiface', 'fileface.a:1.1', 'secure+http://localhost:23456' );
        ccm.register( as, 'mpackface', 'binaryface.a:1.0', 'secure+http://localhost:23456' );

        as.add( ( as ) => {
            expect( ccm._iface_info[ 'myiface' ].coder.name() ).equal( 'JSON' );
            expect( ccm._iface_info[ 'mpackface' ].coder.name() ).equal( 'MPCK' );
        } );
    } ) );
} );

//============================================================================

const create_remote_call_tests = ( coder = 'JSON' ) => {
    let iface;
    let is_ws;
    let is_browser;

    before( () => {
        iface = ccm.iface( 'myiface' );
        is_ws = ( iface._raw_info.endpoint.split( ':' )[0] === 'ws' );
        is_browser = ( iface._raw_info.endpoint.split( ':' )[0] === 'browser' );
    } );


    it( 'testFunc', $as_test( ( as ) => {
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

        as.add( ( as, res ) => {
            expect( res.res ).equal( 'MY_RESULT' );
        } );
    } ) );

    it( 'testFuncRetry', $as_test( ( as ) => {
        if ( is_browser ) {
            return;
        }

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

        as.add( ( as, res ) => {
            expect( res.res ).equal( 'MY_RESULT' );
        } );
    } ) );

    it( 'noResult', $as_test( ( as ) => {
        iface.call(
            as,
            "noResult",
            {
                a : "123",
            }
        );

        as.add( ( as, res ) => {
            if ( iface._raw_info.funcs.noResult ) {
                assert.strictEqual( undefined, res );
            } else {
                expect( res ).be.empty;
            }
        } );
    } ) );

    it( 'customResult', $as_test( ( as ) => {
        iface.call(
            as,
            "customResult"
        );

        as.add( ( as, res ) => {
            assert.strictEqual( true, res );
        } );
    } ) );

    it( 'call', $as_test( ( as ) => {
        iface.call(
            as,
            "call"
        );

        as.add( ( as, res ) => {
            if ( iface._raw_info.funcs.call ) {
                assert.strictEqual( undefined, res );
            } else {
                expect( res ).be.empty;
            }
        } );
    } ) );

    it( 'rawUploadFunc', $as_test( ( as ) => {
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

        as.add( ( as, res ) => {
            expect( res.ok ).equal( "OK" );
        } );
    } ) );

    it( 'rawUploadFuncParams', $as_test( ( as ) => {
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

        as.add( ( as, res ) => {
            expect( res.ok ).equal( "OK" );
        } );
    } ) );

    it( 'rawDownload', $as_test( ( as ) => {
        if ( is_ws || is_browser ) {
            return;
        }

        iface.call(
            as,
            "rawDownload"
        );

        as.add( ( as, res ) => {
            expect( res.toString() ).equal( "MY_DOWNLOAD" );
        } );
    } ) );

    it( 'triggerError', $as_test(
        ( as ) => {
            if ( is_ws || is_browser ) {
                as.error( 'MY_ERROR' );
            }

            iface.call(
                as,
                "triggerError"
            );
        },
        ( as, err ) => {
            expect( err ).equal( "MY_ERROR" );
            as.success();
        }
    ) );

    it( 'wrongDataResult', $as_test(
        ( as ) => {
            if ( is_ws || is_browser ) {
                as.state.skip = true;
                as.error( 'NegativeTestMustThrow' );
            }

            iface.call(
                as,
                "wrongDataResult"
            );

            as.add( ( as, res ) => {
                expect( res.toString() ).equal( "MY_DOWNLOAD" );
            } );
        },
        ( as, err ) => {
            if ( iface._raw_info.funcs.wrongDataResult && !as.state.skip ) {
                expect( err ).equal( "InternalError" );
                expect( as.state.error_info )
                    .equal( "Raw result is not expected: wrongDataResult()" );
            } else {
                expect( err ).equal( "NegativeTestMustThrow" );
            }

            as.success();
        }
    ) );

    it( 'missingResultVar', $as_test(
        ( as ) => {
            iface.call(
                as,
                "missingResultVar"
            );

            as.add( ( as, res ) => {
                expect( res.ok ).equal( "OK" );
            } );
        },
        ( as, err ) => {
            if ( iface._raw_info.funcs.missingResultVar ) {
                expect( err ).equal( "InternalError" );
                expect( as.state.error_info )
                    .equal( "Missing result variables: missingResultVar()" );
            } else {
                expect( err ).equal( "NegativeTestMustThrow" );
            }

            as.success();
        }
    ) );

    it( 'rawResultExpected', $as_test(
        ( as ) => {
            if ( is_ws || is_browser ) {
                as.state.skip = true;
                as.error( 'NegativeTestMustThrow' );
            }

            iface.call(
                as,
                "rawResultExpected"
            );

            as.add( ( as, res ) => {
                expect( res.ok ).equal( "OK" );
            } );
        },
        ( as, err ) => {
            if ( iface._raw_info.funcs.rawResultExpected && !as.state.skip ) {
                expect( err ).equal( "InternalError" );
                expect( as.state.error_info )
                    .equal( 'Raw result is expected: rawResultExpected()' );
            } else {
                expect( err ).equal( "NegativeTestMustThrow" );
            }

            as.success();
        }
    ) );

    it( 'wrongException', $as_test(
        ( as ) => {
            iface.call(
                as,
                "wrongException"
            );
        },
        ( as, err ) => {
            if ( iface._raw_info.funcs.wrongException ) {
                expect( err ).equal( "InternalError" );
                expect( as.state.error_info )
                    .equal( 'Not expected exception from Executor: wrongException()' );
            } else {
                expect( err ).equal( "MY_ERROR" );
            }

            as.success();
        }
    ) );

    it( 'unknownFunc', $as_test(
        ( as ) => {
            iface.call(
                as,
                "unknownFunc"
            );
        },
        ( as, err ) => {
            if ( iface._raw_info.funcs.wrongException ) {
                expect( err ).equal( "InvokerError" );
                expect( as.state.error_info )
                    .equal( 'Unknown interface function: unknownFunc()' );
            } else {
                expect( err ).equal( "MY_ERROR" );
            }

            as.success();
        }
    ) );

    it( 'unexpectedUpload', $as_test(
        ( as ) => {
            iface.call(
                as,
                "unexpectedUpload",
                {},
                "MY_UPLOAD"
            );

            as.add( ( as, res ) => {
                expect( res.ok ).equal( "OK" );
            } );
        },
        ( as, err ) => {
            if ( is_browser && !iface._raw_info.funcs.unexpectedUpload ) {
                expect( err ).equal( "InvokerError" );
                expect( as.state.error_info )
                    .equal( "Upload data is allowed only for HTTP/WS endpoints" );
            } else if ( iface._raw_info.funcs.unexpectedUpload ) {
                expect( err ).equal( "InvokerError" );
                expect( as.state.error_info )
                    .equal( "Raw upload is not allowed: unexpectedUpload()" );
            } else {
                expect( err ).equal( "NegativeTestMustThrow" );
            }

            as.success();
        }
    ) );

    it( 'noParams', $as_test(
        ( as ) => {
            iface.call(
                as,
                "noParams",
                { a : "a" }
            );

            as.add( ( as, res ) => {
                expect( res.ok ).equal( "OK" );
            } );
        },
        ( as, err ) => {
            if ( iface._raw_info.funcs.noParams ) {
                expect( err ).equal( "InvokerError" );
                expect( as.state.error_info )
                    .equal( 'No params are defined: noParams()' );
            } else {
                expect( err ).equal( "NegativeTestMustThrow" );
            }

            as.success();
        }
    ) );

    it( 'unknownParam', $as_test(
        ( as ) => {
            iface.call(
                as,
                "unknownParam",
                { a : "a",
                    b : "b" }
            );

            as.add( ( as, res ) => {
                expect( res.ok ).equal( "OK" );
            } );
        },
        ( as, err ) => {
            if ( iface._raw_info.funcs.unknownParam ) {
                expect( err ).equal( "InvokerError" );
                expect( as.state.error_info )
                    .equal( 'Unknown parameter: unknownParam(b)' );
            } else {
                expect( err ).equal( "NegativeTestMustThrow" );
            }

            as.success();
        }
    ) );

    it( 'missingParam', $as_test(
        ( as ) => {
            iface.call(
                as,
                "unknownParam",
                {}
            );

            as.add( ( as, res ) => {
                expect( res.ok ).equal( "OK" );
            } );
        },
        ( as, err ) => {
            if ( iface._raw_info.funcs.unknownParam ) {
                expect( err ).equal( "InvokerError" );
                expect( as.state.error_info )
                    .equal( 'Missing parameter: unknownParam(a)' );
            } else {
                expect( err ).equal( "NegativeTestMustThrow" );
            }

            as.success();
        }
    ) );

    it( 'testUnicode', $as_test( ( as ) => {
        iface.call(
            as,
            "pingPong",
            { ping : "Мои данные на русском un latviešu valodā" }
        );

        as.add( ( as, res ) => {
            expect( res.pong ).equal( "Мои данные на русском un latviešu valodā" );
        } );
    } ) );

    it( 'getCoder', $as_test( ( as ) => {
        iface.call(
            as,
            "getCoder"
        );

        as.add( ( as, res ) => {
            expect( res.name ).equal( coder );
        } );
    } ) );

    it( 'CCM#close()', $as_test( ( as ) => {
        const state = as.state;
        state.close_called = false;
        state.iface_close_called = false;

        ccm.once( 'close', () => {
            state.close_called = true;
        } );

        iface.once( 'close', () => {
            state.iface_close_called = true;
        } );

        ccm.close();

        as.add( break_burst );
        as.add( ( as ) => {
            expect( state.close_called ).be.true;
            expect( state.iface_close_called ).be.true;
        } );
    } ) );
};


const create_interceptor_call_tests = () => {
    let iface;

    before( () => {
        iface = ccm.iface( 'myiface' );
    } );

    it( 'testFunc', $as_test( ( as ) => {
        iface.testFunc(
            as,
            "1",
            2.8,
            { m : 3 },
            4
        );

        as.add( ( as, res ) => {
            expect( res.res ).equal( 'MY_RESULT' );
        } );
    } ) );

    it( 'noResult', $as_test( ( as ) => {
        iface.noResult(
            as,
            "123"
        );

        as.add( ( as, res ) => {
            if ( iface._raw_info.funcs.noResult ) {
                assert.strictEqual( undefined, res );
            } else {
                expect( res ).be.empty;
            }
        } );
    } ) );

    it( 'rawDownload', $as_test( ( as ) => {
        iface.rawDownload( as );

        as.add( ( as, res ) => {
            expect( res.toString() ).equal( "MY_DOWNLOAD" );
        } );
    } ) );

    it( 'triggerError', $as_test(
        ( as ) => {
            iface.triggerError( as );

            as.add( ( as, res ) => {
                expect( res.toString() ).equal( "MY_DOWNLOAD" );
            } );
        },
        ( as, err ) => {
            expect( err ).equal( "MY_ERROR" );
            as.success();
        }
    ) );

    it ( 'should check stats', () => {
        expect( stats.incomming_msg.length ).equal( 4 );
        expect( stats.outgoing_msg.length ).equal( 4 );
    } );
};

//============================================================================
describe( 'NativeIface', function() {
    const start_server = ( as ) => {
        as.add( ( as ) => {
            as.setTimeout( 100 );
            createTestHttpServer( () => as.success() );
        } );
    };

    const before_common = ( CCM = invoker.AdvancedCCM ) => {
        stats.incomming_msg = [];
        stats.outgoing_msg = [];

        var opts = {};

        if ( CCM === invoker.AdvancedCCM ) {
            opts.specDirs = thisDir + '/specs';
        }

        opts.commConfigCallback = function( proto, agent_opts ) {
            if ( proto === 'http' ) {
                agent_opts.maxSockets = 3;
            }
        };
        opts.messageSniffer = function( info, msg, is_incomming ) {
            if ( is_incomming ) {
                stats.incomming_msg.push( msg );
            } else {
                stats.outgoing_msg.push( msg );
            }
        };

        ccm = new CCM( opts );
        ccm.limitZone( 'default', {
            concurrent: 0xFFFF,
            rate: 0xFFFF,
        } );
    };

    const after_common = ( done ) => closeTestHttpServer( done );

    describe( 'SimpleCCM', function() {
        for ( let coder in coders ) {
            describe( 'HTTP remotes ' + coder, function() {
                before( $as_test( ( as ) => {
                    before_common( invoker.SimpleCCM );

                    ccm.register( as, 'myiface', 'fileface.a:1.1',
                        'secure+http://localhost:23456/ftn',
                        null, { coder: coder } );

                    start_server( as );
                } ) );

                after( after_common );

                create_remote_call_tests( coder );
            } );

            describe( 'WS remotes ' + coder, function() {
                before( $as_test( ( as ) => {
                    before_common( invoker.SimpleCCM );

                    ccm.register( as, 'myiface', 'fileface.a:1.1',
                        'secure+ws://localhost:23456/ftn',
                        null, { coder: coder } );

                    start_server( as );
                } ) );

                after( after_common );

                create_remote_call_tests( coder );
            } );
        }

        if ( typeof window !== 'undefined' ) {
            describe( 'browser:// remotes', function() {
                before( $as_test( ( as ) => {
                    before_common( invoker.SimpleCCM );

                    ccm.register(
                        as, 'myiface', 'fileface.a:1.1',
                        'browser://server_frame', null,
                        { targetOrigin: 'http://localhost:8000' } );
                } ) );

                create_remote_call_tests();
            } );
        }
    } );

    describe( 'AdvancedCCM', function() {
        for ( let coder in coders ) {
            describe( 'HTTP remotes ' + coder, function() {
                before( $as_test( ( as ) => {
                    before_common();

                    ccm.register( as, 'myiface', 'fileface.a:1.1',
                        'secure+http://localhost:23456/ftn',
                        null, { coder: coder } );

                    start_server( as );
                } ) );

                after( after_common );

                create_remote_call_tests( coder, before_common, after_common );
            } );

            describe( 'WS remotes ' + coder, function() {
                before( $as_test( ( as ) => {
                    before_common();

                    ccm.register( as, 'myiface', 'fileface.a:1.1',
                        'secure+ws://localhost:23456/ftn',
                        null, { coder: coder } );

                    start_server( as );
                } ) );

                after( after_common );

                create_remote_call_tests( coder );
            } );


            if ( typeof window === 'undefined' ) {
                describe( 'HTTP remotes with Stateless MAC ' + coder, function() {
                    before( $as_test( ( as ) => {
                        before_common();

                        ccm.register( as, 'myiface', 'fileface.a:1.1',
                            'secure+http://localhost:23456/ftn',
                            '-smac:usr', {
                                macKey: '111222333444555666777888999',
                                coder,
                            } );

                        start_server( as );
                    } ) );

                    after( after_common );

                    create_remote_call_tests( coder );
                } );

                describe( 'WS remotes with Stateless MAC ' + coder, function() {
                    before( $as_test( ( as ) => {
                        before_common();

                        ccm.register( as, 'myiface', 'fileface.a:1.1',
                            'secure+ws://localhost:23456/ftn',
                            '-smac:usr', {
                                macKey: '111222333444555666777888999',
                                coder,
                            } );

                        start_server( as );
                    } ) );

                    after( after_common );

                    create_remote_call_tests( coder );
                } );

                describe( 'HTTP remotes with Master MAC ' + coder, function() {
                    before( $as_test( ( as ) => {
                        before_common();

                        ccm.register( as, 'myiface', 'fileface.a:1.1',
                            'secure+http://localhost:23456/ftn',
                            'master', {
                                coder,
                                masterAuth : new TestMasterAuth,
                            } );

                        start_server( as );
                    } ) );

                    after( after_common );

                    create_remote_call_tests( coder );
                } );

                describe( 'WS remotes with Master MAC ' + coder, function() {
                    before( $as_test( ( as ) => {
                        before_common();

                        ccm.register( as, 'myiface', 'fileface.a:1.1',
                            'secure+ws://localhost:23456/ftn',
                            'master', {
                                masterAuth : new TestMasterAuth,
                                coder,
                            } );

                        start_server( as );
                    } ) );

                    after( after_common );

                    create_remote_call_tests( coder );
                } );
            }
        }

        if ( typeof window !== 'undefined' ) {
            describe( 'browser:// remotes', function() {
                before( $as_test( ( as ) => {
                    before_common();

                    ccm.register(
                        as, 'myiface', 'fileface.a:1.1',
                        'browser://server_frame', null,
                        { targetOrigin: 'http://localhost:8000' } );
                } ) );

                after( after_common );

                create_remote_call_tests( coder );
            } );
        } else {
            describe( 'Binary', function() {
                before( before_common );
                after( after_common );

                it( 'should call binary', $as_test( ( as ) => {
                    ccm.register(
                        as, 'myiface', 'binaryface.a:1.0',
                        'secure+http://localhost:23456/ftn' );
                    ccm.register(
                        as, 'myiface2', 'binaryface.a:1.0',
                        'secure+ws://localhost:23456/ftn' );

                    const buf = Buffer.alloc( 16, 0x12 );

                    as.add( start_server );
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
                    as.add( ( as ) => {
                        as.waitExternal();
                        closeTestHttpServer( () => as.success() );
                    } );
                } ) );
            } );
        }

        describe( 'WS remotes through interceptors', function() {
            before( $as_test( ( as ) => {
                before_common();
                ccm.register( as, 'myiface', 'fileface.a:1.1',
                    'secure+ws://localhost:23456/ftn',
                    null );

                start_server( as );
            } ) );

            after( after_common );

            create_interceptor_call_tests();
        } );
    } );

    describe( '#ifaceInfo() - SimpleCCM', function() {
        beforeEach( () => {
            before_common( invoker.SimpleCCM );
        } );

        it( 'should return ifaceInfo without details', $as_test( ( as ) => {
            ccm.register( as, 'myiface', 'fileface.a:1.1', 'http://localhost:23456' );

            as.add( function( as ) {
                const info = ccm.iface( 'myiface' ).ifaceInfo();

                expect( ccm.iface( 'myiface' ).ifaceInfo() ).equal( info );

                expect( info.name() ).equal( 'fileface.a' );
                expect( info.version() ).equal( '1.1' );
                expect( info.inherits().length ).equal( 0 );
                expect( _isEmpty( info.funcs() ) ).be.true;
                expect( _isEmpty( info.constraints() ) ).be.true;

                const iface = ccm.iface( 'myiface' );

                expect( iface ).not.have.property( 'testFunc' );
                expect( iface ).not.have.property( 'rawUploadFunc' );
            } );
        } ) );

        it( 'should fail with unknown scheme', function( done ) {
            as.add(
                function( as ) {
                    ccm.register( as, 'unknown', 'fileface.a:1.1', 'unknown://localhost:23456/ftn' );

                    as.add( ( as ) => {
                        ccm.iface( 'unknown' ).call( as, 'test' );
                    } );
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
        beforeEach( () => {
            before_common( invoker.AdvancedCCM );
        } );

        afterEach( ( done ) => closeTestHttpServer( done ) );

        it( 'should return ifaceInfo with details', $as_test( ( as ) => {
            ccm.register( as, 'myiface', 'fileface.a:1.1', 'secure+http://localhost:23456' );

            as.add( ( as ) => {
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
            } );
        } ) );

        it( 'should check secure channel', $as_test(
            ( as ) => {
                ccm.register( as, 'myiface', 'fileface.a:1.1', 'ws://localhost:23456/ftn' );
            },
            ( as, err ) => {
                expect( err ).equal( 'SecurityError' );
                expect( as.state.error_info ).equal( "SecureChannel is required" );
                as.success();
            }
        ) );

        it( 'should throw on not implemented UNIX transport', $as_test(
            ( as ) => {
                ccm.register( as, 'myiface', 'fileface.a:1.1', 'unix://tmp.sock/' );
                as.add( ( as ) => {
                    ccm.iface( 'myiface' ).call(
                        as,
                        "noResult",
                        {
                            a : "123",
                        }
                    );
                } );
            },
            ( as, err ) => {
                expect( err ).equal( "InvokerError" );
                as.success();
            }
        ) );

        it( 'should throw on missing spec', $as_test(
            ( as ) => {
                ccm.register( as, 'myiface', 'fileface.missign:1.1', 'unix://tmp.sock/' );
            },
            ( as, err ) => {
                expect( err ).equal( "InternalError" );
                as.success();
            }
        ) );

        it( 'should call internal effectively', $as_test( ( as ) => {
            ccm.register( as, 'myiface', 'fileface.a:1.1', {
                onInternalRequest : function( as, info, ftnreq ) {
                    as.add( ( as ) => {
                        info._server_executor_context = {};
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

            as.add( ( as ) => {
                var iface = ccm.iface( 'myiface' );

                iface.call( as, 'testFunc', { a : '1',
                    n : 2.8,
                    i : 4,
                    o : { m : 3 } } );
                as.add( function( as, res ) {
                    expect( res.res ).equal( 'MY_RESULT' );
                } );
            } );
        } ) );
    } );
} );

//============================================================================
describe( 'LogFace', function() {
    before( $as_test( ( as ) => {
        var opts = {};

        opts.specDirs = thisDir + '/specs';
        ccm = new invoker.AdvancedCCM( opts );
        ccm.limitZone( 'default', {
            concurrent: 0xFFFF,
            rate: 0xFFFF,
        } );

        as.add( ( as ) => {
            LogFace.register( as, ccm, 'secure+ws://localhost:23456/ftn' );
            ccm.register( as, 'myiface', 'fileface.a:1.1', 'secure+ws://localhost:23456/ftn' );

            as.add( function( as ) {
                as.waitExternal();
                createTestHttpServer( () => as.success() );
            } );
        } );
    } ) );

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

    it( 'should call futoin.log through native interface', $as_test( function( as ) {
        this.timeout( 10e3 );

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

        as.loop( ( as ) => {
            as.add( ( as ) => {
                as.setTimeout( 1e3 );
                async_steps.ActiveAsyncTool.callImmediate( () => as.success(), 300 );
            } )
                .add( break_burst )
                .add( ( as ) => {
                    ccm.iface( 'myiface' ).getLogCount( as );
                } )
                .add( ( as, res ) => {
                    if ( res.count === 7 ) {
                        as.break();
                    }

                    as.state.waits += 1;

                    if ( as.state.waits > 20 ) {
                        expect( res.count ).equal( 7 );
                    }
                } );
        } );
    } ) );
} );

//============================================================================
describe( 'CacheFace', function() {
    before( $as_test( ( as ) => {
        var opts = {};

        opts.specDirs = thisDir + '/specs';
        ccm = new invoker.AdvancedCCM( opts );
        ccm.limitZone( 'default', {
            concurrent: 0xFFFF,
            rate: 0xFFFF,
        } );

        as.add( ( as ) => {
            CacheFace.register( as, ccm, 'my', 'secure+ws://localhost:23456/ftn', 'login:pass' );
            ccm.register( as, 'myiface', 'fileface.a:1.1', 'secure+ws://localhost:23456/ftn' );

            as.add( ( as ) => {
                as.waitExternal();
                createTestHttpServer( () => as.success() );
            } );
        } );
    } ) );

    after( ( done ) => {
        closeTestHttpServer( done );
    } );

    it( 'should call futoin.cache through native interface', $as_test( ( as ) => {
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
    } ) );
} );


//============================================================================
if ( isNode ) {
    describe( 'PingFace', function() {
        var PingFace = module.require( '../PingFace' );

        before( $as_test( ( as ) => {
            var opts = {};

            opts.specDirs = thisDir + '/specs';
            ccm = new invoker.AdvancedCCM( opts );
            ccm.limitZone( 'default', {
                concurrent: 0xFFFF,
                rate: 0xFFFF,
            } );

            as.add( $as_test( ( as ) => {
                PingFace.register( as, ccm, 'ping', 'secure+ws://localhost:23456/ftn', 'login:pass' );

                as.add( ( as ) => {
                    as.waitExternal();
                    createTestHttpServer( () => as.success() );
                } );
            } ) );
        } ) );

        after( ( done ) => {
            closeTestHttpServer( done );
        } );

        it( 'should call futoin.ping through native interface', $as_test( ( as ) => {
            as.add( ( as ) => {
                ccm.iface( 'ping' ).ping( as, 123 );

                as.add( ( as, echo ) => {
                    expect( echo ).equal( 123 );
                } );
            } );
        } ) );
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

