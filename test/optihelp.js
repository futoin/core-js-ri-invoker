'use strict';

const $as = require( 'futoin-asyncsteps' );
const optihelp = require( '@futoin/optihelp' );
const child_process = require( 'child_process' );

const {
    SimpleCCM,
    AdvancedCCM,
} = require( '../lib/invoker' );

const child = child_process.fork( __dirname + '/node_server.js' );
child.send( { test: true } );
child.on( 'message', function() {
//-------------------------------------
    const internal_endpoint = {
        onInternalRequest : ( as, info, ftnreq ) => {
            as.add( ( as ) => {
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
    };

    const sccm = new SimpleCCM();
    sccm.limitZone( 'default', {
        concurrent: 0xFFFF,
        rate: 0xFFFF,
    } );

    const accm = new AdvancedCCM( {
        specDirs : `${__dirname}/specs`,
    } );
    accm.limitZone( 'default', {
        concurrent: 0xFFFF,
        rate: 0xFFFF,
    } );

    let siface_http;
    let aiface_http;
    let siface_ws;
    let aiface_ws;
    let siface_internal;
    let aiface_internal;

    const error_handler = ( as, err ) => {
        console.log( `${err}:${as.state.error_info}` );
    };

    const suite = optihelp( 'Invoker', {
        //do_profile: true,
    } )
        .test( 'SimpleCCM unregister-register', ( done ) => {
            $as()
                .add(
                    ( as ) => {
                        sccm.unRegister( 'httpJSON' );
                        sccm.register( as, 'httpJSON', 'fileface.a:1.1',
                            'secure+http://localhost:23456/ftn',
                            null );
                    }
                )
                .add( ( as ) => {
                    done();
                } )
                .execute();
        } )
        .test( 'AdvancedCCM unregister-register', ( done ) => {
            $as()
                .add( ( as ) => {
                    accm.unRegister( 'httpJSON' );
                    accm.register( as, 'httpJSON', 'fileface.a:1.1',
                        'secure+http://localhost:23456/ftn',
                        null );
                } )
                .add( ( as ) => {
                    done();
                } )
                .execute();
        } )
        .test( 'iface()', ( done ) => {
            siface_http = sccm.iface( 'httpJSON' );
            aiface_http = accm.iface( 'httpJSON' );
            done();
        } )
        .test( 'SimpleCCM INTERNAL call', ( done ) => {
            $as()
                .add( ( as ) => {
                    siface_internal.call(
                        as,
                        'testFunc',
                        {
                            a : "1",
                            n : 2.8,
                            o : { m : 3 },
                            i : 4,
                        }
                    );
                }, error_handler )
                .add( ( as ) => {
                    done();
                } )
                .execute();
        } )
        .test( 'AdvancedCCM INTERNAL call', ( done ) => {
            $as()
                .add( ( as ) => {
                    aiface_internal.call(
                        as,
                        'testFunc',
                        {
                            a : "1",
                            n : 2.8,
                            o : { m : 3 },
                            i : 4,
                        }
                    );
                }, error_handler )
                .add( ( as ) => {
                    done();
                } )
                .execute();
        } )
        .test( 'SimpleCCM HTTP call', ( done ) => {
            $as()
                .add( ( as ) => {
                    siface_http.call(
                        as,
                        'testFunc',
                        {
                            a : "1",
                            n : 2.8,
                            o : { m : 3 },
                            i : 4,
                        }
                    );
                }, error_handler )
                .add( ( as ) => {
                    done();
                } )
                .execute();
        } )
        .test( 'AdvancedCCM HTTP call', ( done ) => {
            $as()
                .add( ( as ) => {
                    aiface_http.call(
                        as,
                        'testFunc',
                        {
                            a : "1",
                            n : 2.8,
                            o : { m : 3 },
                            i : 4,
                        }
                    );
                }, error_handler )
                .add( ( as ) => {
                    done();
                } )
                .execute();
        } )
        .test( 'SimpleCCM WS call', ( done ) => {
            $as()
                .add( ( as ) => {
                    siface_ws.call(
                        as,
                        'testFunc',
                        {
                            a : "1",
                            n : 2.8,
                            o : { m : 3 },
                            i : 4,
                        }
                    );
                }, error_handler )
                .add( ( as ) => {
                    done();
                } )
                .execute();
        } )
        .test( 'AdvancedCCM WS call', ( done ) => {
            $as()
                .add( ( as ) => {
                    aiface_ws.call(
                        as,
                        'testFunc',
                        {
                            a : "1",
                            n : 2.8,
                            o : { m : 3 },
                            i : 4,
                        }
                    );
                }, error_handler )
                .add( ( as ) => {
                    done();
                } )
                .execute();
        } )
        .test( 'AdvancedCCM INTERNAL call with interceptor', ( done ) => {
            $as()
                .add( ( as ) => {
                    aiface_internal.testFunc(
                        as,
                        "1",
                        2.8,
                        { m : 3 },
                        4
                    );
                }, error_handler )
                .add( ( as ) => {
                    done();
                } )
                .execute();
        } )
        ;

    $as().add(
        ( as ) => {
            as.add( ( as ) => {
                sccm.register( as, 'httpJSON', 'fileface.a:1.1',
                    'secure+http://localhost:23456/ftn',
                    null );
                accm.register( as, 'httpJSON', 'fileface.a:1.1',
                    'secure+http://localhost:23456/ftn',
                    null );
                sccm.register( as, 'wsJSON', 'fileface.a:1.1',
                    'secure+ws://localhost:23456/ftn',
                    null );
                accm.register( as, 'wsJSON', 'fileface.a:1.1',
                    'secure+ws://localhost:23456/ftn',
                    null );
                sccm.register( as, 'internalJSON', 'fileface.a:1.1',
                    internal_endpoint );
                accm.register( as, 'internalJSON', 'fileface.a:1.1',
                    internal_endpoint );
            } );
            as.add( ( as ) => {
                siface_http = sccm.iface( 'httpJSON' );
                aiface_http = accm.iface( 'httpJSON' );
                siface_ws = sccm.iface( 'wsJSON' );
                aiface_ws = accm.iface( 'wsJSON' );
                siface_internal = sccm.iface( 'internalJSON' );
                aiface_internal = accm.iface( 'internalJSON' );
            } );
            as.add( ( as ) => {
                as.waitExternal();
                suite.start( ( result ) => {
                    as.success();
                } );
            } );
            as.add( ( as ) => {
                child.kill();
            } );
        },
        ( as, err ) => {
            child.kill();
            console.log( err );
            console.log( as.state.error_info );
        } )
        .execute();
//-------------------------------------
} );

