
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
});
