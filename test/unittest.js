
var assert = require('assert');
var http = require('http');
var url = require( 'url' );
var _ = require( 'lodash' );
var WebSocketServer = require('ws').Server;

var async_steps = require( 'futoin-asyncsteps' );
var invoker;
var as;
var ccm;
var httpsrv;
var wssrv;


describe( 'Invoker Basic', function()
{
    invoker = require('../lib/invoker.js');

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
            try
            {
                ccm.register( as , 'myiface', 'iface.a:1.1', 'http://localhost:23456' );
            }
            catch ( e )
            {
                console.log( as.state.error_info );
                throw e;
            }
            as.add(function(as){ done(); as.success(); });
            as.execute();
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

                assert.equal( ccm.iface('myiface'), ccm.iface('newname') );
                
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
        }, 'InvokerError' );
    });
} );

describe( 'AdvancedCCM', function()
{
    beforeEach(function(){
        as = async_steps();
        var opts = {};
        opts[ invoker.AdvancedCCM.OPT_SPEC_DIRS ] = __dirname + '/specs';
        ccm = new invoker.AdvancedCCM( opts );
    });
    
    it('should register interface',
        function( done ){
            try
            {
                ccm.register( as , 'myiface', 'fileface.a:1.1', 'http://localhost:23456' );
            }
            catch ( e )
            {
                console.log( as.state.error_info );
                throw e;
            }
            as.add(function(as){ done(); as.success(); });
            as.execute();
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
function processTestServerRequest( request, data )
{
    var freq;

    if ( request && request.url !== '/ftn' )
    {
        var parsed_url = url.parse( request.url, true );
        var path = parsed_url.path.split('/');
        
        freq = {
            f : path[2] + ':' + path[3] + ':' + path[4],
            p : parsed_url.query
        };
        
        if ( path[5] )
        {
            freq.sec = path[5];
        }
    }
    else
    {
        freq = JSON.parse( data );
    }
    
    var func = freq.f.split(':');

    if ( func.length !== 3 )
    {
        return { e : 'InvalidReuquest' };
    }
    else if ( func[0] !== 'fileface.a' )
    {
        return { e : 'UnknownInterface' };
    }
    else if ( func[1] !== '1.1' )
    {
        return { e : 'NotSupportedVersion' };
    }
    
    switch ( func[2] )
    {
        case 'testFunc' :
            freq.p.a.should.equal( '1' );
            freq.p.n.should.equal( 2 );
            freq.p.o.m.should.equal( 3 );
            return { res : 'MY_RESULT' };
        
        case 'noResult' :
            freq.p.a.should.equal( '123' );
            return {};
            
        case "call" :
            freq.p.should.be.empty;
            return {};
            
        case "rawUploadFunc" :
            freq.p.should.be.empty;
            data.should.equal( "MY_UPLOAD" );
            return { ok : "OK" };

        case "rawUploadFuncParams" :
            freq.p.a.should.equal( '123' );
            data.should.equal( "MY_UPLOAD" );
            return { ok : "OK" };
            
        case "rawDownload" :
            freq.p.should.be.empty;
            return "MY_DOWNLOAD";
            
        case "triggerError":
            return { e : 'MY_ERROR' };
    }
    
    return { e : 'InvalidFunction' };
}

function createTestHttpServer( cb )
{
    if ( httpsrv )
    {
        cb();
        return;
    }

    httpsrv = http.createServer(function (request, response) {
        var freq = [];
        
        request.on( "data",function( chunk ) {
            freq.push( chunk );
        } );
        request.on( "end",function(){
            freq = Buffer.concat( freq ).toString( 'utf8' );
            
            var frsp = processTestServerRequest( request, freq );
            var content_type;
            
            if ( typeof frsp !== 'string' )
            {
                if ( !( 'e' in frsp ) )
                {
                    frsp = { r : frsp };
                }
                
                frsp = JSON.stringify( frsp );
                content_type = 'application/futoin+json';
            }
            else
            {
                content_type = 'application/octet-stream';
            }
            
            response.writeHead( 200, {
                'Content-Type' : content_type,
                'Content-Length' : Buffer.byteLength( frsp, 'utf8' ),
            } );
            response.write( frsp, 'utf8' );
            response.end();
        });
    });
    httpsrv.listen( 23456, '127.0.0.1', 10, cb );
    
    wssrv = new WebSocketServer( { 
        server : httpsrv,
        path : '/ftn'
    } );
    
    wssrv.on('connection', function( ws ){
        ws.on('message', function( msg ){
            var frsp = processTestServerRequest( null, msg );
            
            if ( !( 'e' in frsp ) )
            {
                frsp = { r : frsp };
            }
            
            msg = JSON.parse( msg );
            frsp.rid = msg.rid;

            frsp = JSON.stringify( frsp );
            ws.send( frsp );
        });
    } );
}

function closeTestHttpServer( done )
{
    if ( httpsrv )
    {
        wssrv.close();
        httpsrv.close( function(){ done(); } );
        httpsrv = null;
    }
    else
    {
        done();
    }
}


var call_remotes_model_as = async_steps();
call_remotes_model_as.add(
    function(as){
        var iface = ccm.iface( 'myiface' );

        as.add(function(as){try{
            as.state.step = "testFunc";

            iface.call(
                as,
                'testFunc',
                {
                    a : "1",
                    n : 2,
                    o : { m : 3 }
                }
            );
        } catch ( e ){
            console.dir( e.stack );
            console.log( as.state.error_info );
            throw e;
        }}).add(function(as, res){
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

            iface.call(
                as,
                "rawUploadFuncParams",
                {
                    a : "123"
                },
                "MY_UPLOAD"
            );
        } catch ( e ) {
            console.dir( e.stack );
            console.log( as.state.error_info );
            throw e;
        }}).add(function(as, res){
            res.ok.should.equal("OK");

            if ( iface._raw_info.endpoint.split(':')[0] === 'ws' )
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
            ccm = new invoker.SimpleCCM( opts );
        });
        
        afterEach(function( done ){
            closeTestHttpServer( done );
        });
        
        it( 'should return ifaceInfo without details', function(){
            ccm.register( as , 'myiface', 'fileface.a:1.1', 'http://localhost:23456' );
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
        });
        
        it( 'should call HTTP remotes', function( done ){
            as.add(
                function(as){
                    try {
                        ccm.register( as , 'myiface', 'fileface.a:1.1', 'http://localhost:23456/ftn' );
                        
                        as.add(function( as ){
                            createTestHttpServer( function(){ as.success(); } );
                            as.setTimeout( 100 );
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
                        ccm.register( as , 'myiface', 'fileface.a:1.1', 'ws://localhost:23456/ftn' );
                        
                        as.add(function( as ){
                            createTestHttpServer( function(){ as.success(); } );
                            as.setTimeout( 100 );
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
    });
    
    describe('#ifaceInfo() - AdvancedCCM', function(){
        beforeEach(function(){
            as = async_steps();
            var opts = {};
            opts[ invoker.AdvancedCCM.OPT_SPEC_DIRS ] = __dirname + '/specs';
            ccm = new invoker.AdvancedCCM( opts );
        });
        
        afterEach(function( done ){
            closeTestHttpServer( done );
        });
        
        it( 'should return ifaceInfo with details', function( done ){
            as.add(
                function(as){
                    try {
                        ccm.register( as , 'myiface', 'fileface.a:1.1', 'http://localhost:23456' );
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
                        info.inherits().length.should.equal( 0 );
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
                        ccm.register( as , 'myiface', 'fileface.a:1.1', 'http://localhost:23456/ftn' );
                        
                        as.add(function( as ){
                            createTestHttpServer( function(){ as.success(); } );
                            as.setTimeout( 100 );
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
                        ccm.register( as , 'myiface', 'fileface.a:1.1', 'ws://localhost:23456/ftn' );
                        
                        as.add(function( as ){
                            createTestHttpServer( function(){ as.success(); } );
                            as.setTimeout( 100 );
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
    });
});
