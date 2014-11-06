
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
    
    it('should register interface', function( done ){
        ccm.register( as , 'myiface', 'iface.a:1.1', 'http://localhost:12345' );
        as.add(function(as){ done(); as.success(); });
        as.execute();
    });
    
    it('should unregister interface', function( done ){
        ccm.register( as , 'myiface', 'iface.a:1.1', 'http://localhost:12345' );
        ccm.register( as , 'otherface', 'iface.b:1.2', 'http://localhost:12345' );
        
        as.add(
            function(as){
                ccm.assertIface( 'myiface', 'iface.a:1.1' );
                ccm.assertIface( 'otherface', 'iface.b:1.2' );
                
                ccm.unRegister( 'myiface' );
                ccm.assertIface( 'otherface', 'iface.b:1.2' );
                
                assert.throws( function(){
                    ccm.assertIface( 'myiface', 'iface.a:1.1' );
                }, 'InvokerError' );
                
                as.success();
                done();
            },
            function( as, err )
            {
                console.log( err + ": " + as.state.error_info );
                done();
            }
        );
        as.execute();
    });

} );
