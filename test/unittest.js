
var assert = require('assert');
var async_steps = require( 'futoin-asyncsteps' );
var invoker;
var as;
var ccm;

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
                ccm.register( as , 'myiface', 'iface.a:1.1', 'http://localhost:12345' );
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
        ccm.register( as , 'myiface', 'iface.a:1.1', 'http://localhost:12345' );
        ccm.register( as , 'otherface', 'iface.b:1.2', 'http://localhost:12345' );
        
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
        ccm.register( as , 'myiface', 'iface.a:1.1', 'http://localhost:12345' );
        ccm.register( as , 'otherface', 'iface.b:1.2', 'http://localhost:12345' );
        
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
                ccm.register( as , 'myiface', 'iface.a:1.1', 'http://localhost:12345' );
                as.state.fire_reg = true;
                ccm.register( as , 'myiface', 'iface.a:1.1', 'http://localhost:12345' );
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
            ccm.register( as , 'myiface', 'iface.a:1.', 'http://localhost:12345' );
        }, 'InvokerError' );
        
        assert.throws(function(){
            ccm.register( as , 'myiface', 'iface.a.1.0', 'http://localhost:12345' );
        }, 'InvokerError' );
        
        assert.throws(function(){
            ccm.register( as , 'myiface', 'iface$%$%.a.1.0', 'http://localhost:12345' );
        }, 'InvokerError' );
        
        ccm.register( as , 'myiface', 'iface.a:1.1', 'http://localhost:12345' );
        
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
        ccm.register( as, 'myhttp', 'a:1.0', 'http://localhost:12345' );
        ccm._iface_info.myhttp.secure_channel.should.be.false;
        ccm.register( as, 'myhttps', 'a:1.0', 'https://localhost:12345' );
        ccm._iface_info.myhttps.secure_channel.should.be.true;
        ccm.register( as, 'myws', 'a:1.0', 'ws://localhost:12345' );
        ccm._iface_info.myws.secure_channel.should.be.false;
        ccm.register( as, 'mywss', 'a:1.0', 'wss://localhost:12345' );
        ccm._iface_info.mywss.secure_channel.should.be.true;
        ccm.register( as, 'mysechttp', 'a:1.0', 'secure+http://localhost:12345' );
        ccm._iface_info.mysechttp.secure_channel.should.be.true;
        ccm.register( as, 'mysecws', 'a:1.0', 'secure+ws://localhost:12345' );
        ccm._iface_info.mysecws.secure_channel.should.be.true;
        ccm.register( as, 'myunix', 'a:1.0', 'unix://localhost:12345' );
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
        ccm.register( as , 'myifacea', 'iface.a:1.0', 'http://localhost:12345' );
        ccm.register( as , 'myifaceb', 'iface.b:1.1', 'http://localhost:12345' );
        
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
                ccm.register( as , 'myiface', 'fileface.a:1.1', 'http://localhost:12345' );
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
                    ccm.initFromCache( as, 'http://localhost:12345' );
                },
                function( as, err )
                {
                    ccm.register( as , 'myiface', 'fileface.a:1.1', 'http://localhost:12345' );
                    ccm.cacheInit( as );
                    done();
                }
            );
            
            as.execute();
        }
    );
});
