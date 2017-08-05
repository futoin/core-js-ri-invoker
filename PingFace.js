
/* jshint esversion:6 */

const NativeFace = require( './NativeIface' );

class PingFace extends NativeFace {
    ping( as, echo )
    {
        this.call( as, 'ping', { echo } );
        as.add( function( as, rsp )
        {
            as.success( rsp.echo );
        } );
    }

    /**
     * Register ping interface
     */
    static register( as, ccm, name, endpoint, credentials=null, options={} )
    {
        const ifacever = options.version || '1.0';
        const iface = this.spec( ifacever );

        options.nativeImpl = this;
        options.specDirs = [ iface ];

        ccm.register(
                as,
                name,
                iface.iface + ':' + ifacever,
                endpoint,
                credentials,
                options
        );
    }
}

module.exports = PingFace;

const specs = {};
PingFace._specs = specs;

PingFace._specs['1.0'] = {
  "iface" : "futoin.ping",
  "version" : "1.0",
  "ftn3rev" : "1.1",
  "funcs" : {
    "ping" : {
      "params" : {
        "echo" : {
          "type" : "integer",
          "desc" : "Arbitrary integer"
        }
      },
      "result" : {
        "echo" : {
          "type" : "integer",
          "desc" : "See params"
        }
      },
      "desc" : "Check if peer is accessible"
    }
  },
  "desc" : "Ping-pong interface"
};
