
var fail_next = false;

function processServerRequest( freq, data )
{
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
        case 'testFuncRetry' :
            fail_next = !fail_next;

            if ( fail_next )
            {
                return null;
            }
            
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

if ( typeof module !== 'undefined' )
{
    module.exports = processServerRequest;
}