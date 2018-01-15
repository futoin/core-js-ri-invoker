'use strict';

var expect;

if ( typeof chai !== 'undefined' ) {
    expect = chai.expect;
} else {
    expect = require( 'chai' ).expect;
}


var fail_next = false;
var log_count = 0;
var cached_value;

function processServerRequest( freq, data, coder ) {
    var func = freq.f.split( ':' );

    if ( func.length !== 3 ) {
        return { e : 'InvalidRequest' };
    } else if ( func[0] === 'futoin.log' &&
              func[1] === '1.0' ) {
        if ( freq.p.txt === 'sync' ) {
            if ( freq.p.lvl !== 'debug' ) {
                return null;
            }
        } else if ( freq.p.txt.toLowerCase() !== freq.p.lvl + 'msg' ) {
            return null;
        } else if ( func[2] === 'hexdump' &&
                freq.p.data.toString() !== new Buffer( 'HEXDATA' ).toString( 'base64' ) ) {
            return null;
        }

        ++log_count;

        return '';
    } else if ( func[0] === 'futoin.cache' &&
              func[1] === '1.0' ) {
        if ( freq.p.key === 'mykey1_2' &&
             ( func[2] === 'get' || freq.p.ttl === 10 ) ) {} else if ( freq.p.key === 'mykey' &&
             ( func[2] === 'get' || freq.p.ttl === 1000 ) ) {
            cached_value = null;
        } else {
            return { e : 'InvalidRequest',
                edesc: JSON.stringify( freq ) };
        }

        switch ( func[2] ) {
        case 'set':
            cached_value = freq.p.value;
            return {};

        case 'get':
            if ( cached_value ) {
                return { value: cached_value };
            } else {
                return { e: 'CacheMiss' };
            }
        }
    } else if ( func[0] === 'futoin.ping' &&
            func[1] === '1.0' ) {
        switch ( func[2] ) {
        case "ping":
            freq.p.echo.should.equal( 123 );
            return { echo : freq.p.echo };

        default:
            return { e : 'UnknownInterface' };
        }
    } else if ( func[0] === 'binaryface.a' && func[1] === '1.0' ) {
        // pass
    } else if ( func[0] !== 'fileface.a' ) {
        return { e : 'UnknownInterface' };
    } else if ( func[1] !== '1.1' ) {
        return { e : 'NotSupportedVersion' };
    }

    switch ( func[2] ) {
    case 'testFuncRetry' :
        fail_next = !fail_next;

        if ( fail_next ) {
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

    case 'customResult':
        return true;

    case "call" :
        freq.p.should.be.empty;
        return {};

    case "rawUploadFunc" :
        expect( freq.p ).to.be.empty;
        data.toString().should.equal( "MY_UPLOAD" );
        return { ok : "OK" };

    case "rawUploadFuncParams" :
        freq.p.a.should.equal( '123' );
        JSON.parse( freq.p.o ).b.should.equal( false );
        data.toString().should.equal( "MY_UPLOAD" );
        return { ok : "OK" };

    case "rawDownload" :
        expect( freq.p ).to.be.empty;
        return "MY_DOWNLOAD";

    case "wrongDataResult":
        expect( freq.p ).to.be.empty;
        return "MY_DOWNLOAD";

    case "missingResultVar":
    case "rawResultExpected":
    case "unexpectedUpload":
        expect( freq.p ).to.be.empty;
        return { ok : "OK" };

    case "unknownParam":
    case "noParams":
        return { ok : "OK" };

    case "triggerError":
    case "wrongException":
    case "unknownFunc":
        return { e : 'MY_ERROR' };

    case "binaryPingPong":
    case "pingPong":
        return { pong : freq.p.ping };

    case "getLogCount":
        return { count: log_count };
    case "getCoder":
        return { name: coder.name() };
    }

    return { e : 'InvalidFunction' };
}

if ( typeof module !== 'undefined' ) {
    module.exports = processServerRequest;
}
