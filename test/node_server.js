var http = require('http');
var url = require( 'url' );
var WebSocketServer = require('ws').Server;
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
        freq = JSON.parse( data );
    }
    
    var func = freq.f.split(':');

    if ( func.length !== 3 )
    {
        return { e : 'InvalidReuquest' };
    }
    else if ( func[0] !== 'fileface.a' )
    {
        return { e : 'UnknownInterface' };
    }
    else if ( func[1] !== '1.1' )
    {
        return { e : 'NotSupportedVersion' };
    }
    
    switch ( func[2] )
    {
        case 'testFunc' :
            freq.p.a.should.equal( '1' );
            freq.p.n.should.equal( 2.8 );
            freq.p.i.should.equal( 4 );
            freq.p.o.m.should.equal( 3 );
            return { res : 'MY_RESULT' };
        
        case 'noResult' :
            freq.p.a.should.equal( '123' );
            return {};
            
        case "call" :
            freq.p.should.be.empty;
            return {};
            
        case "rawUploadFunc" :
            freq.p.should.be.empty;
            data.should.equal( "MY_UPLOAD" );
            return { ok : "OK" };

        case "rawUploadFuncParams" :
            freq.p.a.should.equal( '123' );
            data.should.equal( "MY_UPLOAD" );
            return { ok : "OK" };
            
        case "rawDownload" :
            freq.p.should.be.empty;
            return "MY_DOWNLOAD";
            
        case "wrongDataResult":
            freq.p.should.be.empty;
            return "MY_DOWNLOAD";
            
        case "missingResultVar":
        case "rawResultExpected":
        case "unexpectedUpload":
            freq.p.should.be.empty;
            return { ok : "OK" };
            
        case "unknownParam":
        case "noParams":
            return { ok : "OK" };
            
        case "triggerError":
        case "wrongException":
        case "unknownFunc":
            return { e : 'MY_ERROR' };
            
        case "pingPong":
            return { pong : freq.p.ping };
    }
    
    return { e : 'InvalidFunction' };
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
            
            var frsp = processTestServerRequest( request, freq );
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
            } );
            response.write( frsp, 'utf8' );
            response.end();
        });
    });
    httpsrv.listen( 23456, '127.0.0.1', 10, cb );
    
    wssrv = new WebSocketServer( { 
        server : httpsrv,
        path : '/ftn'
    } );
    
    wssrv.on('connection', function( ws ){
        ws.on('message', function( msg ){
            var frsp = processTestServerRequest( null, msg );
            
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
        wssrv.close();
        httpsrv.close( function(){ done(); } );
        httpsrv = null;
    }
    else
    {
        done();
    }
}

exports.createTestHttpServer = createTestHttpServer;
exports.closeTestHttpServer = closeTestHttpServer;