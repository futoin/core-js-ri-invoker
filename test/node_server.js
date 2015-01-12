var http = require('http');
var url = require( 'url' );
var WebSocket = require('faye-websocket');
var processServerRequest = require( './server_func' )
var httpsrv;
var wssrv;

function processTestServerRequest( request, data )
{
    var freq;

    if ( request && request.url !== '/ftn' )
    {
        var parsed_url = url.parse( request.url, true );
        var path = parsed_url.pathname.split('/');
        
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
        try
        {
            freq = JSON.parse( data );
        }
        catch ( e )
        {
            return { e : 'InvalidReuquest' };
        }
    }
    
    return processServerRequest( freq, data );
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
        
        request.connection.setTimeout( 100 );
        
        request.on( "data",function( chunk ) {
            freq.push( chunk );
        } );
        request.on( "end",function(){
            freq = Buffer.concat( freq ).toString( 'utf8' );
            var frsp;
            
            if ( request.method !== 'OPTIONS' )
            {
                frsp = processTestServerRequest( request, freq );

                if ( frsp === null )
                {
                    request.socket.destroy();
                    return;
                }
            }
            else
            {
                frsp = '';
            }
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
                'Access-Control-Allow-Origin' : '*',
                'Access-Control-Allow-Methods' : 'POST',
                'Access-Control-Allow-Headers' : 'Content-Type'
                
            } );
            response.write( frsp, 'utf8' );
            response.end();
        });
    });
    httpsrv.listen( 23456, '127.0.0.1', 10, cb );

    httpsrv.on( 'upgrade', function( req, sock, body )
    {
        if ( !req.url.match( /^\/ftn/ ) )
        {
            return;
        }
        
        var ws = new WebSocket( req, sock, body );
        
        var req_close = function()
        {
            ws.close();
        }
        
        httpsrv.once( 'close', req_close );
        httpsrv.once( 'preclose', req_close );
        ws.on('close', function(){
            if ( httpsrv )
            {
                httpsrv.removeListener( 'close', req_close );
                httpsrv.removeListener( 'preclose', req_close );
            }
        });

        ws.on('message', function( event ){
            var msg = event.data;
            var frsp = processTestServerRequest( null, msg );
            
            if ( frsp === null )
            {
                sock.destroy();
                return;
            }
            
            if ( typeof frsp !== "object" )
            {
                return;
            }
            
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
        try
        {
            httpsrv.emit( 'preclose' );
            httpsrv.close( function(){ done(); } );
            httpsrv = null;
        }
        catch ( e )
        {
            httpsrv = null;
            console.dir( e );
            done( e );
        }
    }
    else
    {
        done();
    }
}

exports.createTestHttpServer = createTestHttpServer;
exports.closeTestHttpServer = closeTestHttpServer;

if ( require.main === module )
{
    createTestHttpServer(function(){
        console.log('LISTENING');
    });
    var hidereq = require;
    hidereq( 'chai' ).should();
}