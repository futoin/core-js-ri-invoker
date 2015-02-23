'use strict';

var common = require( './common' );
var FutoInError = common.FutoInError;
var crypto = require( 'crypto' );

module.exports = function( spectools )
{
    spectools.genHMAC = function( as, info, ftnreq )
    {
        var options = info.options;
        var hmacKeyRaw;
        var hmacAlgoRaw;

        // --
        if ( !options.hmacKeyRaw )
        {
            hmacKeyRaw = new Buffer( options.hmacKey, 'base64' ).toString( 'binary' );
            options.hmacKeyRaw = hmacKeyRaw;
        }
        else
        {
            hmacKeyRaw = options.hmacKeyRaw;
        }

        // --
        if ( !options.hmacAlgoRaw )
        {
            switch ( options.hmacAlgo )
            {
                case 'MD5':
                case 'SHA224':
                case 'SHA256':
                case 'SHA384':
                case 'SHA512':
                    hmacAlgoRaw = options.hmacAlgo.toLowerCase();
                    break;

                default:
                    as.error( FutoInError.InvalidRequest, "Not supported HMAC hash" );
            }

            options.hmacAlgoRaw = hmacAlgoRaw;
        }
        else
        {
            hmacAlgoRaw = options.hmacAlgoRaw;
        }

        return this._genHMAC( hmacAlgoRaw, hmacKeyRaw, ftnreq );
    };

    spectools._genHMACU = function( hmacAlgoRaw, hmacKeyRaw, ftnreq )
    {
        // this.hmacbase = '';
        var hmac = crypto.createHmac( hmacAlgoRaw, hmacKeyRaw );
        this._hmacUpdate( hmac, ftnreq );
        return hmac.digest( 'base64' );
    };

    spectools._hmacUpdate = function( hmac, o )
    {
        var keys = Object.keys( o ).sort();

        for ( var i = 0, c = keys.length; i < c; ++i )
        {
            var k = keys[ i ];
            var v = o[ k ];
            hmac.update( k );
            hmac.update( ':' );
            // this.hmacbase += k + ':';

            if ( typeof v === 'object' )
            {
                this._hmacUpdate( hmac, v );
            }
            else
            {
                if ( typeof v !== 'string' )
                {
                    v = JSON.stringify( v );
                }

                hmac.update( v );
                // this.hmacbase += v;
            }

            hmac.update( ';' );
            // this.hmacbase += ';';
        }
    };

    spectools._genHMACJ = function( hmacAlgoRaw, hmacKeyRaw, ftnreq )
    {
        // this.hmacbase = '';
        var hmac = crypto.createHmac( hmacAlgoRaw, hmacKeyRaw );
        var hmac_base = [];
        this._hmacBase( hmac_base, ftnreq );
        hmac.update( hmac_base.join() );
        return hmac.digest( 'base64' );
    };

    spectools._hmacBase = function( hmac_base, o )
    {
        var keys = Object.keys( o ).sort();

        for ( var i = 0, c = keys.length; i < c; ++i )
        {
            var k = keys[ i ];
            var v = o[ k ];
            hmac_base.push( k + ':' );

            if ( typeof v === 'object' )
            {
                this._hmacBase( hmac_base, v );
            }
            else
            {
                if ( typeof v !== 'string' )
                {
                    v = JSON.stringify( v );
                }

                hmac_base.push( v );
            }

            hmac_base.push( ';' );
        }
    };

    spectools._genHMAC = spectools._genHMACJ;
};
