var async_steps = require( 'futoin-asyncsteps' );
var invoker = require( 'futoin-invoker' );

var ccm = new invoker.SimpleCCM();

async_steps()
.add(
    function( as ){
        ccm.register( as, 'localone', 'some.iface:1.0', 'https://localhost/some/path' );
        ccm.register( as, 'localtwo', 'other.iface:1.0', 'https://localhost/some/path' );

        as.add( function( as ){
            var localone = ccm.iface( 'localone' );
            var localtwo = ccm.iface( 'localtwo' );
            
            localone.call( as, 'somefunc', {
                arg1 : 1,
                arg2 : 'abc',
                arg3 : true,
            } );
            
            as.add( function( as, res ){
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