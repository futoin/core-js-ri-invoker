var async_steps = require( 'futoin-asyncsteps' );
var invoker = require( 'futoin-invoker' );

// Define interface, which should normally be put into 
// file named "some.iface-1.0-iface.json" and put into
// a folder added to the "specDirs" option.
var some_iface_v1_0 = {
    "iface" : "some.iface",
    "version" : "1.0",
    "ftn3rev" : "1.1",
    "funcs" : {
        "somefunc" : {
            "params" : {
                "arg1" : {
                    "type" : "integer"
                },
                "arg2" : {
                    "type" : "string"
                },
                "arg3" : {
                    "type" : "boolean"
                }
            },
            "result" : {
                "result1" : {
                    "type" : "number"
                },
                "result2" : {
                    "type" : "any"
                }
            },
            "throws" : [
                "MyError"
            ]
        }
    },
    "requires" : [
        "SecureChannel",
        "AllowAnonymous"
    ]
};

var other_iface_v1_0 = {
    "iface" : "other.iface",
    "version" : "1.0",
    "ftn3rev" : "1.1"
}

// Initialize CCM. We provide interface definitions directly
var ccm = new invoker.AdvancedCCM({
    specDirs : [ __dirname + '/specs', some_iface_v1_0, other_iface_v1_0 ]
});

// AsyncSteps processing is required
async_steps()
.add(
    function( as ){
        // Register interfaces - it is done only once
        ccm.register( as, 'localone',
                      'some.iface:1.0', 'https://localhost/some/path' );
        ccm.register( as, 'localtwo',
                      'other.iface:1.0', 'https://localhost/some/path',
                      'user:pass' ); // optional credentials

        as.add( function( as ){
            // Get NativeIface representation of remote interface
            // after registration is complete
            var localone = ccm.iface( 'localone' );
            var localtwo = ccm.iface( 'localtwo' );
            
            localone.somefunc( as, 1, 'abc', true );
            
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