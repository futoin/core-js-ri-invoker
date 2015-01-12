var _ = require( 'lodash' );
var assert;
var async_steps = require( 'futoin-asyncsteps' );
var invoker;
var as;
var ccm;

var createTestHttpServer;
var closeTestHttpServer;
var thisDir;

if ( typeof chai !== 'undefined' )
{
    // Browser test
    chai.should();
    assert = chai.assert;
    
    createTestHttpServer = function( cb ){
        cb();
    };
    
    closeTestHttpServer = function( done ){
        done();
    };
    
    thisDir = '.';
    
    invoker = FutoInInvoker;
}
else
{
    // Node test
    var chai_module = require( 'chai' );
    chai_module.should();
    assert = chai_module.assert;
    
    var hidereq = require;
    var node_server = hidereq('./node_server.js');
    createTestHttpServer = node_server.createTestHttpServer;
    closeTestHttpServer = node_server.closeTestHttpServer;
    
    thisDir = __dirname;
    
    invoker = hidereq('../lib/invoker.js');
}

describe( 'Invoker Basic', function()
{
    it( 'should create Simple CCM', function(){
        var sccm = new invoker.SimpleCCM();
    });
    
    it( 'should create Advanced CCM', function(){
        var sccm = new invoker.SimpleCCM();
    });
} );

describe( 'SimpleCCM', function()
{
    beforeEach(function(){
        as = async_steps();
        ccm = new invoker.SimpleCCM();
    });
    
    it('should register interface',
        function( done ){
            as
                .add(
                    function( as ){
                        try {
                            ccm.register( as , 'myiface', 'iface.a:1.1', 'http://localhost:23456' );
                        } catch ( e ) {
                            done( e );
                        }
                    },
                     function( as, err ){
                        done( new Error( err + ": " + as.state.error_info ) );
                    }
                )
                .add( function(as){ done(); })
                .execute();
        }
    );
    
    it('should unregister interface', function( done ){
        ccm.register( as , 'myiface', 'iface.a:1.1', 'http://localhost:23456' );
        ccm.register( as , 'otherface', 'iface.b:1.2', 'http://localhost:23456' );
        
        as.add(
            function(as){try{
                ccm.assertIface( 'myiface', 'iface.a:1.1' );
                ccm.assertIface( 'otherface', 'iface.b:1.2' );
                
                ccm.unRegister( 'myiface' );
                ccm.assertIface( 'otherface', 'iface.b:1.2' );
                
                assert.throws( function(){
                    ccm.assertIface( 'myiface', 'iface.a:1.1' );
                }, 'InvokerError' );
                
                as.success();
                done();
            } catch ( e ){
                console.dir( e.stack );
                console.log( as.state.error_info );
                throw e;
            }},
            function( as, err )
            {
                console.log( err + ": " + as.state.error_info );
            }
        );
        as.execute();
    });
    
    it('should create interface alias', function( done ){
        ccm.register( as , 'myiface', 'iface.a:1.1', 'http://localhost:23456' );
        ccm.register( as , 'otherface', 'iface.b:1.2', 'http://localhost:23456' );
        
        as.add(
            function(as){try{
                ccm.assertIface( 'myiface', 'iface.a:1.0' );
                ccm.assertIface( 'otherface', 'iface.b:1.2' );
                
                ccm.alias( 'myiface', 'newname' );

                ccm.assertIface( 'newname', 'iface.a:1.0' );

                assert.throws( function(){
                    ccm.assertIface( 'myiface', 'iface.a:1.3' );
                }, 'InvokerError' );
                
                assert.throws( function(){
                    ccm.assertIface( 'myiface', 'iface.a:2.0' );
                }, 'InvokerError' );

                assert.strictEqual( ccm.iface('myiface'), ccm.iface('newname') );
                
                as.success();
                done();
            } catch ( e ){
                console.dir( e.stack );
                console.log( as.state.error_info );
                throw e;
            }},
            function( as, err )
            {
                console.log( err + ": " + as.state.error_info );
            }
        );
        as.execute();
    });

    it('should fail on double registration', function( done ){
        as.state.fire_reg = false;
        as.add(
            function( as ){
                ccm.register( as , 'myiface', 'iface.a:1.1', 'http://localhost:23456' );
                as.state.fire_reg = true;
                ccm.register( as , 'myiface', 'iface.a:1.1', 'http://localhost:23456' );
                as.successStep();
            },
            function( as, err ){try{
                as.state.fire_reg.should.be.true;
                err.should.equal('InvokerError');
                as.state.error_info.should.equal('Already registered');
                done();
            }catch( e ){
                console.log( e.message );
                console.dir( e.stack );
            }}
        );
        
        as.execute();
    });
    
    it('should fail on invalid ifacever at registration/assert', function(){
        
        assert.throws(function(){
            ccm.register( as , 'myiface', 'iface.a:1.', 'http://localhost:23456' );
        }, 'InvokerError' );
        
        assert.throws(function(){
            ccm.register( as , 'myiface', 'iface.a.1.0', 'http://localhost:23456' );
        }, 'InvokerError' );
        
        assert.throws(function(){
            ccm.register( as , 'myiface', 'iface$%$%.a.1.0', 'http://localhost:23456' );
        }, 'InvokerError' );
        
        ccm.register( as , 'myiface', 'iface.a:1.1', 'http://localhost:23456' );
        
        assert.throws(function(){
            ccm.assertIface( 'myiface', 'iface.a' );
        }, 'InvokerError' );
    });
    
    it('should return iface impls', function(){
        var deff, logf, cl1f, cl2f, cl3f;
        
        ccm.register( as, ccm.SVC_DEFENSE, 'futoin.defense:1.0', function( ccmimpl, rawinfo ){
            deff = new invoker.NativeIface( ccmimpl, rawinfo );
            return deff;
        });
        ccm.register( as, ccm.SVC_LOG, 'futoin.log:1.0', function( ccmimpl, rawinfo ){
            logf = new invoker.NativeIface( ccmimpl, rawinfo );
            return logf;
        });
        ccm.register( as, ccm.SVC_CACHE_L1, 'futoin.cache:1.0', function( ccmimpl, rawinfo ){
            cl1f = new invoker.NativeIface( ccmimpl, rawinfo );
            return cl1f;
        });
        ccm.register( as, ccm.SVC_CACHE_L2, 'futoin.cache:1.0', function( ccmimpl, rawinfo ){
            cl2f = new invoker.NativeIface( ccmimpl, rawinfo );
            return cl2f;
        });
        ccm.register( as, ccm.SVC_CACHE_L3, 'futoin.cache:1.0', function( ccmimpl, rawinfo ){
            cl3f = new invoker.NativeIface( ccmimpl, rawinfo );
            return cl3f;
        });
        
        ccm.defense().should.equal( deff );
        ccm.log().should.equal( logf );
        ccm.cache_l1().should.equal( cl1f );
        ccm.cache_l2().should.equal( cl2f );
        ccm.cache_l3().should.equal( cl3f );
    });
    
    it('should marked endpoints as secure', function(){
        ccm.register( as, 'myhttp', 'a:1.0', 'http://localhost:23456' );
        ccm._iface_info.myhttp.secure_channel.should.be.false;
        ccm.register( as, 'myhttps', 'a:1.0', 'https://localhost:23456' );
        ccm._iface_info.myhttps.secure_channel.should.be.true;
        ccm.register( as, 'myws', 'a:1.0', 'ws://localhost:23456' );
        ccm._iface_info.myws.secure_channel.should.be.false;
        ccm.register( as, 'mywss', 'a:1.0', 'wss://localhost:23456' );
        ccm._iface_info.mywss.secure_channel.should.be.true;
        ccm.register( as, 'mysechttp', 'a:1.0', 'secure+http://localhost:23456' );
        ccm._iface_info.mysechttp.secure_channel.should.be.true;
        ccm.register( as, 'mysecws', 'a:1.0', 'secure+ws://localhost:23456' );
        ccm._iface_info.mysecws.secure_channel.should.be.true;
        ccm.register( as, 'myunix', 'a:1.0', 'unix://localhost:23456' );
        ccm._iface_info.myunix.secure_channel.should.be.true;
    });
    
    it('should fail on missing iface registration', function(){
        assert.throws( function(){
            ccm.iface( 'missing' )
        }, 'InvokerError' );
    });
    
    it('should fail on missing iface unregistration', function(){
        assert.throws( function(){
            ccm.unRegister( 'missing' )
        }, 'InvokerError' );
    });
    
    it('should properly properly manage aliases', function(){
        ccm.register( as , 'myifacea', 'iface.a:1.0', 'http://localhost:23456' );
        ccm.register( as , 'myifaceb', 'iface.b:1.1', 'http://localhost:23456' );
        
        ccm.alias( 'myifacea', 'aiface1' );
        ccm.alias( 'myifacea', 'aiface2' );
        ccm.alias( 'myifacea', 'aiface3' );
        
        assert.throws( function(){
            ccm.alias( 'myifacea', 'aiface3' );
        }, 'InvokerError' );
        
        assert.throws( function(){
            ccm.alias( 'myifacec', 'aiface4' );
        }, 'InvokerError' );
        
        ccm.iface( 'myifacea' ).should.equal( ccm.iface( 'aiface1' ) );
        ccm.iface( 'myifacea' ).should.equal( ccm.iface( 'aiface2' ) );
        ccm.iface( 'myifacea' ).should.equal( ccm.iface( 'aiface3' ) );
        
        ccm.unRegister( 'aiface3' );
        
        assert.throws( function(){
            ccm.iface( 'aiface3' )
        }, 'InvokerError' );
        
        ccm.iface( 'myifacea' ).should.equal( ccm.iface( 'aiface2' ) );
        
        ccm.unRegister( 'myifacea' );
        
        assert.throws( function(){
            ccm.iface( 'myifacea' )
        }, 'InvokerError' );
        
        assert.throws( function(){
            ccm.iface( 'aiface2' )
        }, 'InvokerError' );
    });
    
    it('should fail on not implemented Burst API', function(){
        assert.throws( function(){
            ccm.burst();
        }, 'NotImplemented' );
    });
} );

describe( 'AdvancedCCM', function()
{
    beforeEach(function(){
        as = async_steps();
        var opts = {};
        opts[ invoker.AdvancedCCM.OPT_SPEC_DIRS ] = thisDir + '/specs';
        ccm = new invoker.AdvancedCCM( opts );
    });
    
    it('should register interface',
        function( done ){
            as.add(
                function( as )
                {
                    ccm.register( as , 'myiface', 'fileface.a:1.1', 'secure+http://localhost:23456' );
                },
                function( as, err )
                {
                    done( as.state.last_exception );
                }
            ).add( function( as ){
                done();
            } ).execute();
        }
    );
    
    it('should behave as cache miss on initFromCache',
        function( done )
        {
            as.add(
                function( as )
                {
                    ccm.initFromCache( as, 'http://localhost:23456' );
                    as.successStep();
                },
                function( as, err )
                {
                    ccm.register( as , 'myiface', 'fileface.a:1.1', 'http://localhost:23456' );
                    ccm.cacheInit( as );
                    as.successStep();
                    done();
                }
            );
            
            as.execute();
        }
    );
});

//============================================================================

var call_remotes_model_as = async_steps();
call_remotes_model_as.add(
    function(as){
        var iface = ccm.iface( 'myiface' );
        var is_ws = ( iface._raw_info.endpoint.split(':')[0] === 'ws' );
        var is_browser = ( iface._raw_info.endpoint.split(':')[0] === 'browser' );

        as.add(function(as){
            as.state.step = "testFunc";

            iface.call(
                as,
                'testFunc',
                {
                    a : "1",
                    n : 2.8,
                    o : { m : 3 },
                    i : 4
                }
            );
        }).add(function(as, res){
            res.res.should.equal('MY_RESULT');
            
            as.state.step = "noResult";
            
            iface.call(
                as,
                "noResult",
                {
                    a : "123"
                }
            );
        }).add(function(as, res){
            if ( iface._raw_info.funcs.noResult )
            {
                assert.strictEqual( undefined, res );
            }
            else
            {
                res.should.be.empty;
            }
            
            as.state.step = "call";

            iface.call(
                as,
                "call"
            );
        }).add(function(as, res){ try{
            if ( iface._raw_info.funcs.call )
            {
                assert.strictEqual( undefined, res );
            }
            else
            {
                res.should.be.empty;
            }
            
            as.state.step = "rawUploadFunc";
            
            if ( is_browser )
            {
                as.success( { ok : 'OK' } );
                return;
            }

            iface.call(
                as,
                "rawUploadFunc",
                {},
                "MY_UPLOAD"
            );
        } catch ( e ) {
            console.dir( e.stack );
            console.log( as.state.error_info );
            throw e;
        }} ).add(function(as, res){ try{
            res.ok.should.equal("OK");
            
            as.state.step = "rawUploadFuncParams";
            
            if ( is_browser )
            {
                as.success( { ok : 'OK' } );
                return;
            }

            iface.call(
                as,
                "rawUploadFuncParams",
                {
                    a : "123"
                },
                "MY_UPLOAD",
                null,
                3e3
            );
        } catch ( e ) {
            console.dir( e.stack );
            console.log( as.state.error_info );
            throw e;
        }}).add(function(as, res){
            res.ok.should.equal("OK");

            if ( is_ws || is_browser )
            {
                as.success( "MY_DOWNLOAD" );
                return;
            }
            
            as.state.step = "rawDownload";

            iface.call(
                as,
                "rawDownload"                
            );
        }).add(
            function(as, res){
                res.should.equal("MY_DOWNLOAD");
                
                as.state.step = "triggerError";

                iface.call(
                    as,
                    "triggerError"
                );
            },
            function( as, err )
            {
                err.should.equal("MY_ERROR");
                as.success( "YES" );
            }
        ).add(
            function(as, res){
                res.should.equal("YES");
                
                as.state.step = "wrongDataResult";
                
                if ( is_ws || is_browser )
                {
                    return;
                }
                
                iface.call(
                    as,
                    "wrongDataResult"
                );
            },
            function( as, err )
            {
                err.should.equal( "InternalError" );
                as.state.error_info.should.equal( "Raw result is not expected" );

                as.success();
            }
        ).add(
            function(as, res){
                if ( iface._raw_info.funcs.wrongDataResult )
                {
                    assert.strictEqual( undefined, res );
                }
                else if ( !is_ws && !is_browser )
                {
                    res.should.equal("MY_DOWNLOAD");
                }
                
                as.state.step = "missingResultVar";
                
                iface.call(
                    as,
                    "missingResultVar"
                );
            },
            function( as, err )
            {
                err.should.equal( "InternalError" );
                as.state.error_info.should.equal( "Missing result variables" );

                as.success();
            }
        ).add(
            function(as, res){
                if ( iface._raw_info.funcs.wrongDataResult )
                {
                    assert.strictEqual( undefined, res );
                }
                else
                {
                    res.ok.should.equal("OK");
                }
                
                as.state.step = "rawResultExpected";
                
                if ( is_ws || is_browser )
                {
                    return;
                }
                
                iface.call(
                    as,
                    "rawResultExpected"
                );
            },
            function( as, err )
            {
                err.should.equal( "InternalError" );
                as.state.error_info.should.equal( "Raw result is expected" );

                as.success();
            }
        ).add(
            function(as, res){
                if ( iface._raw_info.funcs.rawResultExpected )
                {
                    assert.strictEqual( undefined, res );
                }
                else if ( !is_ws && !is_browser )
                {
                    res.ok.should.equal("OK");
                }
                
                as.state.step = "wrongException";
                
                iface.call(
                    as,
                    "wrongException"
                );
            },
            function( as, err )
            {
                if ( iface._raw_info.funcs.wrongException )
                {
                    err.should.equal( "InternalError" );
                    as.state.error_info.should.equal( "Not expected exception from Executor" );
                }
                else
                {
                    err.should.equal( "MY_ERROR" );
                }

                as.success();
            }
        ).add(
            function(as, res){
                assert.strictEqual( undefined, res );
                
                as.state.step = "unknownFunc";
                
                iface.call(
                    as,
                    "unknownFunc"
                );
            },
            function( as, err )
            {
                if ( iface._raw_info.funcs.wrongException )
                {
                    err.should.equal( "InvokerError" );
                    as.state.error_info.should.equal( "Unknown interface function" );
                }
                else
                {
                    err.should.equal( "MY_ERROR" );
                }

                as.success();
            }
        ).add(
            function(as, res){
                assert.strictEqual( undefined, res );
                
                as.state.step = "unexpectedUpload";
                
                iface.call(
                    as,
                    "unexpectedUpload",
                    {},
                    "MY_UPLOAD"
                );
            },
            function( as, err )
            {
                err.should.equal( "InvokerError" );
                if ( is_browser && !iface._raw_info.funcs.unexpectedUpload )
                {
                    as.state.error_info.should.equal( "Upload data is allowed only for HTTP/WS endpoints" );
                }
                else
                {
                    as.state.error_info.should.equal( "Raw upload is not allowed" );
                }
                    

                as.success();
            }
        ).add(
            function(as, res){
                if ( iface._raw_info.funcs.unexpectedUpload || is_browser )
                {
                    assert.strictEqual( undefined, res );
                }
                else
                {
                    res.ok.should.equal("OK");
                }
                
                as.state.step = "noParams";
                
                iface.call(
                    as,
                    "noParams",
                    { a : "a" }
                );
            },
            function( as, err )
            {
                err.should.equal( "InvokerError" );
                as.state.error_info.should.equal( "No params are defined" );

                as.success();
            }
        ).add(
            function(as, res){
                if ( iface._raw_info.funcs.noParams )
                {
                    assert.strictEqual( undefined, res );
                }
                else
                {
                    res.ok.should.equal("OK");
                }
                
                as.state.step = "unknownParam";
                
                iface.call(
                    as,
                    "unknownParam",
                    { a : "a", b : "b" }
                );
            },
            function( as, err )
            {
                err.should.equal( "InvokerError" );
                as.state.error_info.should.equal( "Unknown parameter b" );

                as.success();
            }
        ).add(
            function(as, res){
                if ( iface._raw_info.funcs.noParams )
                {
                    assert.strictEqual( undefined, res );
                }
                else
                {
                    res.ok.should.equal("OK");
                }
                
                as.state.step = "missingParam";
                
                iface.call(
                    as,
                    "unknownParam",
                    {}
                );
            },
            function( as, err )
            {
                err.should.equal( "InvokerError" );
                as.state.error_info.should.equal( "Missing parameter a" );

                as.success();
            }
        ).add(
            function(as, res){
                if ( iface._raw_info.funcs.noParams )
                {
                    assert.strictEqual( undefined, res );
                }
                else
                {
                    res.ok.should.equal("OK");
                }
                
                as.state.step = "testUnicode";
                
                iface.call(
                    as,
                    "pingPong",
                    { ping : "Мои данные на русском un latviešu valodā" }
                );
            }
        ).add(
            function( as, res ){
                res.pong.should.equal( "Мои данные на русском un latviešu valodā" );
            }
        );
    },
    function( as, err )
    {
        as.state.done( new Error( err + ": " + as.state.error_info + " at "+as.state.step ) );
    }
).add( function( as ){
    as.state.done();
});;


var call_interceptors_model_as = async_steps();
call_interceptors_model_as.add(
    function(as){
        var iface = ccm.iface( 'myiface' );

        as.add(function(as){try{
            as.state.step = "testFunc";

            iface.testFunc(
                as,
                "1",
                2.8,
                { m : 3 },
                4
            );
        } catch ( e ){
            console.dir( e.stack );
            console.log( as.state.error_info );
            throw e;
        }}).add(function(as, res){
            res.res.should.equal('MY_RESULT');
            
            as.state.step = "noResult";
            
            iface.noResult(
                as,
                "123"
            );
        }).add(function(as, res){
            if ( iface._raw_info.funcs.noResult )
            {
                assert.strictEqual( undefined, res );
            }
            else
            {
                res.should.be.empty;
            }
            
            as.state.step = "rawDownload";

            iface.rawDownload( as );
        }).add(
            function(as, res){
                res.should.equal("MY_DOWNLOAD");
                
                as.state.step = "triggerError";

                iface.triggerError( as );
            },
            function( as, err )
            {
                err.should.equal("MY_ERROR");
                as.success( "YES" );
            }
        ).add(function(as, res){
            res.should.equal("YES");
            as.success();
        });
    },
    function( as, err )
    {
        as.state.done( new Error( err + ": " + as.state.error_info + "("+as.state.step+")" ) );
    }
).add( function( as ){
    as.state.done();
});;

//============================================================================
describe( 'NativeIface', function()
{
    describe('#ifaceInfo() - SimpleCCM', function(){
        beforeEach(function(){
            as = async_steps();
            
            var opts = {};
            opts[invoker.SimpleCCM.OPT_COMM_CONFIG_CB] = function( proto, agent_opts ) {
                if ( proto === 'http' )
                {
                    agent_opts.maxSockets = 3;
                }
            };
            
            ccm = new invoker.SimpleCCM( opts );
        });
        
        afterEach(function( done ){
            closeTestHttpServer( done );
        });
        
        it( 'should return ifaceInfo without details', function(){
            ccm.register( as , 'myiface', 'fileface.a:1.1', 'http://localhost:23456' );
            
            as.add( function( as )
            {
                var info = ccm.iface( 'myiface' ).ifaceInfo();
                ccm.iface( 'myiface' ).ifaceInfo().should.equal( info );
                
                info.name().should.equal( 'fileface.a' );
                info.version().should.equal( '1.1' );
                info.inherits().length.should.equal( 0 );
                _.isEmpty( info.funcs() ).should.be.true;
                _.isEmpty( info.constraints() ).should.be.true;
                
                var iface = ccm.iface( 'myiface' );
                
                iface.should.not.have.property( 'testFunc' );
                iface.should.not.have.property( 'rawUploadFunc' );
            } );
        });
        
        it( 'should call HTTP remotes', function( done ){
            as.add(
                function(as){
                    try {
                        ccm.register( as , 'myiface', 'fileface.a:1.1', 'secure+http://localhost:23456/ftn' );
                        
                        as.add(function( as ){
                            as.setTimeout( 100 );
                            createTestHttpServer( function(){ as.success(); } );
                        });
                    } catch ( e ){
                        console.dir( e.stack );
                        console.log( as.state.error_info );
                        throw e;
                    }
                },
                function( as, err )
                {
                    as.state.done( new Error( err + ": " + as.state.error_info ) );
                }
            );
            as.copyFrom( call_remotes_model_as );
            as.state.done = done;
            as.execute();
        });
        
        it( 'should call WS remotes', function( done ){
            as.add(
                function(as){
                    try {
                        ccm.register( as , 'myiface', 'fileface.a:1.1', 'secure+ws://localhost:23456/ftn' );
                        
                        as.add(function( as ){
                            as.setTimeout( 100 );
                            createTestHttpServer( function(){ as.success(); } );
                        });
                    } catch ( e ){
                        console.dir( e.stack );
                        console.log( as.state.error_info );
                        throw e;
                    }
                },
                function( as, err )
                {
                    as.state.done( new Error( err + ": " + as.state.error_info ) );
                }
            );
            as.copyFrom( call_remotes_model_as );
            as.state.done = done;
            as.execute();
        });
        
    if ( typeof window !== 'undefined' )
    {
        it( 'should call browser:// remotes', function( done ){
            as.add(
                function(as){
                    try {
                        ccm.register(
                                as , 'myiface', 'fileface.a:1.1',
                                'browser://server_frame', null,
                                { targetOrigin: 'http://localhost:8000' } );
                    } catch ( e ){
                        console.dir( e.stack );
                        console.log( as.state.error_info );
                        throw e;
                    }
                },
                function( as, err )
                {
                    as.state.done( new Error( err + ": " + as.state.error_info ) );
                }
            );
            as.copyFrom( call_remotes_model_as );
            as.state.done = done;
            as.execute();
        });
    }
        
        it( 'should fail with unknown scheme', function( done ){
            as.add(
                function(as){
                    ccm.register( as , 'myiface', 'fileface.a:1.1', 'unknown://localhost:23456/ftn' );
                },
                function( as, err )
                {
                    try
                    {
                        err.should.equal( 'InvokerError' );
                        as.state.error_info.should.match( /^Unknown endpoint schema/ );
                        done();
                    }
                    catch ( ex )
                    {
                        done( ex );
                    }
                }
            );
            as.execute();
        });
    });
    
    describe('#ifaceInfo() - AdvancedCCM', function(){
        beforeEach(function(){
            as = async_steps();
            var opts = {};
            opts[ invoker.AdvancedCCM.OPT_SPEC_DIRS ] = thisDir + '/specs';
            ccm = new invoker.AdvancedCCM( opts );
        });
        
        afterEach(function( done ){
            closeTestHttpServer( done );
        });
        
        it( 'should return ifaceInfo with details', function( done ){
            as.add(
                function( as )
                {
                    ccm.register( as , 'myiface', 'fileface.a:1.1', 'http://localhost:23456' );
                },
                function( as, err )
                {
                    if ( ( err === 'SecurityError' ) &&
                         ( as.state.error_info === "SecureChannel is required" )  )
                    {
                        as.success();
                        return;
                    }
                    done( as.state.last_exception );
                }
            ).add(
                function(as){
                    try {
                        ccm.register( as , 'myiface', 'fileface.a:1.1', 'secure+http://localhost:23456' );
                        as.successStep();
                    } catch ( e ){
                        console.dir( e.stack );
                        console.log( as.state.error_info );
                        throw e;
                    }
                },
                function( as, err )
                {
                    console.log( err + ": " + as.state.error_info );
                }
            ).add(
                function(as){
                    try {
                        var info = ccm.iface( 'myiface' ).ifaceInfo();
                        ccm.iface( 'myiface' ).ifaceInfo().should.equal( info );
                        
                        info.name().should.equal( 'fileface.a' );
                        info.version().should.equal( '1.1' );
                        info.inherits().length.should.equal( 1 );
                        _.isEmpty( info.funcs() ).should.be.false;
                        _.isEmpty( info.constraints() ).should.be.false;
                        
                        var iface = ccm.iface( 'myiface' );
                        
                        iface.should.have.property( 'testFunc' );
                        iface.should.not.have.property( 'rawUploadFunc' );
                        
                        assert.throws( function(){
                            iface.burst();
                        }, 'InvokerError' );
                        
                        assert.throws( function(){
                            iface.bindDerivedKey();
                        }, 'InvokerError' );
                        
                        done();
                        as.success();
                    } catch ( e ){
                        console.dir( e.stack );
                        console.log( as.state.error_info );
                        throw e;
                    }
                },
                function( as, err )
                {
                    console.log( err + ": " + as.state.error_info );
                }
            );
            as.execute();
        });
        
        it( 'should call HTTP remotes', function( done ){
            as.add(
                function(as){
                    try {
                        ccm.register( as , 'myiface', 'fileface.a:1.1', 'secure+http://localhost:23456/ftn' );
                        
                        as.add(function( as ){
                            as.setTimeout( 100 );
                            createTestHttpServer( function(){ as.success(); } );
                        });
                    } catch ( e ){
                        console.dir( e.stack );
                        console.log( as.state.error_info );
                        throw e;
                    }
                },
                function( as, err )
                {
                    as.state.done( new Error( err + ": " + as.state.error_info ) );
                }
            );
            as.copyFrom( call_remotes_model_as );
            as.state.done = done;
            as.execute();
        });
        
        it( 'should call WS remotes', function( done ){
            as.add(
                function(as){
                    try {
                        ccm.register( as , 'myiface', 'fileface.a:1.1', 'secure+ws://localhost:23456/ftn' );
                        
                        as.add(function( as ){
                            as.setTimeout( 100 );
                            createTestHttpServer( function(){ as.success(); } );
                        });
                    } catch ( e ){
                        console.dir( e.stack );
                        console.log( as.state.error_info );
                        throw e;
                    }
                },
                function( as, err )
                {
                    as.state.done( new Error( err + ": " + as.state.error_info ) );
                }
            );
            as.copyFrom( call_remotes_model_as );
            as.state.done = done;
            as.execute();
        });
        
    if ( typeof window !== 'undefined' )
    {
        it( 'should call browser:// remotes', function( done ){
            as.add(
                function(as){
                    try {
                        ccm.register(
                                as , 'myiface', 'fileface.a:1.1',
                                'browser://server_frame', null,
                                { targetOrigin: 'http://localhost:8000' } );

                    } catch ( e ){
                        console.dir( e.stack );
                        console.log( as.state.error_info );
                        throw e;
                    }
                },
                function( as, err )
                {
                    as.state.done( new Error( err + ": " + as.state.error_info ) );
                }
            );
            as.copyFrom( call_remotes_model_as );
            as.state.done = done;
            as.execute();
        });
    }
        
        it( 'should call WS remotes through interceptors', function( done ){
            as.add(
                function(as){
                    try {
                        ccm.register( as , 'myiface', 'fileface.a:1.1', 'secure+ws://localhost:23456/ftn' );
                        
                        as.add(function( as ){
                            as.setTimeout( 100 );
                            createTestHttpServer( function(){ as.success(); } );
                        });
                    } catch ( e ){
                        console.dir( e.stack );
                        console.log( as.state.error_info );
                        throw e;
                    }
                },
                function( as, err )
                {
                    as.state.done( new Error( err + ": " + as.state.error_info ) );
                }
            );
            as.copyFrom( call_interceptors_model_as );
            as.state.done = done;
            as.execute();
        });
        
        it( 'should check secure channel', function( done ){
            as.add(
                function(as){
                    ccm.register( as , 'myiface', 'fileface.a:1.1', 'ws://localhost:23456/ftn' );
                    
                    as.add(function( as ){
                        as.setTimeout( 100 );
                        createTestHttpServer( function(){ as.success(); } );
                    });
                    as.add(function( as ) {
                        ccm.iface('myiface').call( as, 'missingResultVar' );
                    });
                },
                function( as, err )
                {
                    try
                    {
                        err.should.equal( 'SecurityError' );
                        as.state.error_info.should.equal( "SecureChannel is required"  );
                        done();
                    }
                    catch ( ex )
                    {
                        done( ex );
                    }
                    as.state.done( new Error( err + ": " + as.state.error_info ) );
                }
            );

            as.execute();
        });
        
        it( 'should throw on not implemented UNIX transport', function( done ){
            as.add(
                function(as)
                {
                    ccm.register( as , 'myiface', 'fileface.a:1.1', 'unix://tmp.sock/' );
                    as.successStep();
                },
                function( as, err )
                {
                    done( new Error( err + ": " + as.state.error_info ) );
                }
            ).add(
                function(as)
                {
                    ccm.iface('myiface').call(
                        as,
                        "noResult",
                        {
                            a : "123"
                        }
                    );
                },
                function( as, err )
                {
                    err.should.equal( "InvokerError" );
                    done();
                }
            );
            as.execute();
        });
        
        it( 'should throw on missing spec', function( done ){
            as.add(
                function(as)
                {
                    ccm.register( as , 'myiface', 'fileface.missign:1.1', 'unix://tmp.sock/' );
                    as.successStep();
                },
                function( as, err )
                {
                    err.should.equal( "InternalError" );
                    done();
                }
            );
            as.execute();
        });
    });
});
