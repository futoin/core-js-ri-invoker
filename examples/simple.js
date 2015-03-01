var async_steps = require( 'futoin-asyncsteps' );
var SimpleCCM = require( 'futoin-invoker/SimpleCCM' );

// Initalize CCM, no configuration is required
var ccm = new SimpleCCM();

async_steps()
.add(
    function( as ){
        // Register interfaces without loading their specs
        ccm.register( as, 'localone', 'some.iface:1.0',
                      'https://localhost/some/path' );
        ccm.register( as, 'localtwo', 'other.iface:1.0',
                      'https://localhost/some/path',
                      'user:pass' ); // optional credentials

        as.add( function( as ){
            // Get NativeIface representation of remote interface
            // after registration is complete
            var localone = ccm.iface( 'localone' );
            var localtwo = ccm.iface( 'localtwo' );
            
            // SimpleCCM is not aware of available functions.
            // It is the only way to perform a call.
            localone.call( as, 'somefunc', {
                arg1 : 1,
                arg2 : 'abc',
                arg3 : true,
            } );
            
            as.add( function( as, res ){
                // As function prototype is not know
                // all invalid HTTP 200 responses may
                // get returned as "raw data" in res
                // parameter.
                console.log( res.result1, res.result2 );
            } );
        } );
    },
    function( as, err )
    {
        console.log( err + ': ' + as.state.error_info );
        console.log( as.state.last_exception.stack );
    }
)
.execute();