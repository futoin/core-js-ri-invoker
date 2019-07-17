'use strict';

require( './prepare' );

const http = require( 'http' );
const url = require( 'url' );
const WebSocket = require( 'ws' );
const processServerRequest = require( './server_func' );
const enableDestroy = require( 'server-destroy' );
var httpsrv = null;
var wssrv = null;

const MessageCoder = require( '../MessageCoder' );
const SpecTools = require( '../SpecTools' );
require( '../lib/JSONCoder' ).register();
require( '../lib/CBORCoder' ).register();
require( '../lib/MsgPackCoder' ).register();

function processTestServerRequest( request, data ) {
    let freq;
    let coder = MessageCoder.detect( data );

    if ( request && request.url !== '/ftn' ) {
        var parsed_url = url.parse( request.url, true );
        var path = parsed_url.pathname.split( '/' );

        freq = {
            f : path[2] + ':' + path[3] + ':' + path[4],
            p : parsed_url.query,
        };

        if ( path[5] ) {
            freq.sec = decodeURIComponent( path[5] );
        }
    } else {
        try {
            freq = coder.decode( data );
        } catch ( e ) {
            console.log( e );
            return { e : 'InvalidReuquest' };
        }
    }

    let macopt;

    if ( freq.sec && freq.sec.match( /^-[mhs]mac:/ ) ) {
        const sec = freq.sec.split( ':' );
        let algo;
        let sig;

        if ( sec[0] == '-mmac' ) {
            algo = sec[2];
            sig = sec[5];
        } else {
            algo = sec[2];
            sig = sec[3];
        }

        macopt = {
            macKey: '111222333444555666777888999',
            macAlgo : algo,
        };
        const tmp = Object.assign( {}, freq );

        if ( tmp.f === 'fileface.a:1.1:rawUploadFuncParams' ) {
            tmp.p = Object.assign( {}, tmp.p );
            tmp.p.o = JSON.parse( tmp.p.o );
        }

        const reqmac = SpecTools.genHMAC( {}, macopt, tmp ).toString( 'base64' );

        if ( reqmac !== sig ) {
            console.log( `MAC mismatch: ${reqmac} != ${sig}` );
            console.log( freq, macopt );
            return {
                frsp : {
                    e: 'SecurityError',
                    edesc: 'MAC mismatch',
                },
                freq,
                coder,
            };
        }
    }

    const frsp = processServerRequest( freq, data, coder );
    return {
        frsp,
        freq,
        coder,
        macopt,
    };
}

function createTestHttpServer( cb ) {
    if ( httpsrv ) {
        cb();
        return;
    }

    httpsrv = http.createServer( function( request, response ) {
        var freq = [];

        request.connection.setTimeout( 100 );

        request.on( "data", function( chunk ) {
            freq.push( chunk );
        } );
        request.on( "end", function() {
            freq = Buffer.concat( freq );

            let frsp;
            let coder;
            let macopt;

            if ( request.method !== 'OPTIONS' ) {
                let res = processTestServerRequest( request, freq );
                frsp = res.frsp;
                coder = res.coder;
                macopt = res.macopt;

                if ( frsp === null ) {
                    request.socket.destroy();
                    return;
                }
            } else {
                frsp = '';
                coder = MessageCoder.get( 'JSON' );
            }

            var content_type;

            if ( typeof frsp !== 'string' ) {
                if ( typeof frsp === 'boolean' ) {
                    frsp = { r : frsp };
                } else if ( typeof frsp !== "object" ) {
                    request.socket.destroy();
                    return;
                } else if ( !( 'e' in frsp ) ) {
                    frsp = { r : frsp };
                }

                if ( macopt ) {
                    frsp.sec = SpecTools.genHMAC( {}, macopt, frsp ).toString( 'base64' );
                }

                frsp = coder.encode( frsp );
                content_type = coder.contentType();
            } else {
                content_type = 'application/octet-stream';
            }

            response.writeHead( 200, {
                'Content-Type' : content_type,
                'Content-Length' : Buffer.byteLength( frsp, 'utf8' ),
                'Access-Control-Allow-Origin' : '*',
                'Access-Control-Allow-Methods' : 'POST',
                'Access-Control-Allow-Headers' : 'Content-Type',

            } );
            response.write( frsp, 'utf8' );
            response.end();
        } );
    } );
    httpsrv.listen( 23456, '127.0.0.1', 10, cb );

    const wss = new WebSocket.Server( { noServer: true } );

    httpsrv.on( 'upgrade', function( req, sock, body ) {
        if ( !httpsrv ) {
            return;
        }

        if ( !req.url.match( /^\/ftn/ ) ) {
            return;
        }

        wss.handleUpgrade( req, sock, body, ( _ws ) => {
            const ws = _ws;
            wss.emit( 'connection', ws, req );

            const req_close = function() {
                ws.terminate();
            };

            httpsrv.once( 'close', req_close );
            httpsrv.once( 'preclose', req_close );
            ws.on( 'close', function() {
                if ( httpsrv ) {
                    httpsrv.removeListener( 'close', req_close );
                    httpsrv.removeListener( 'preclose', req_close );
                }
            } );

            ws.on( 'message', function( msg ) {
                let { frsp, coder, freq, macopt } = processTestServerRequest( null, msg );

                if ( frsp === '' ) {
                    return;
                }

                if ( frsp === null ) {
                    sock.destroy();
                    return;
                }

                if ( typeof frsp === 'boolean' ) {
                    frsp = { r : frsp };
                } else if ( typeof frsp !== "object" ) {
                    sock.destroy();
                    return;
                } else if ( !( 'e' in frsp ) ) {
                    frsp = { r : frsp };
                }

                frsp.rid = freq.rid;

                if ( macopt ) {
                    frsp.sec = SpecTools.genHMAC( {}, macopt, frsp ).toString( 'base64' );
                }

                frsp = coder.encode( frsp );
                ws.send( frsp );
            } );
        } );
    } );

    enableDestroy( httpsrv );
}

function closeTestHttpServer( done ) {
    if ( httpsrv ) {
        try {
            httpsrv.emit( 'preclose' );
            httpsrv.close( function() {
                done();
            } );
            httpsrv.destroy();
            httpsrv = null;
        } catch ( e ) {
            httpsrv = null;
            console.dir( e );
            done( e );
        }
    } else {
        done();
    }
}

exports.createTestHttpServer = createTestHttpServer;
exports.closeTestHttpServer = closeTestHttpServer;

if ( require.main === module ) {
    createTestHttpServer( function() {
        console.log( 'LISTENING' );

        try {
            process.send( { ready : 'ok' } );
        } catch ( e ) {
            console.log( e );
        }
    } );
}
