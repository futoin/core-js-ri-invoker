'use strict';

var common = require( './common' );
var FutoInError = common.FutoInError;
var crypto = require( 'crypto' );

module.exports = function( spectools )
{
    spectools.genHMAC = function( as, options, ftnreq )
    {
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
            hmacAlgoRaw = this.getRawAlgo( as, options.hmacAlgo );
            options.hmacAlgoRaw = hmacAlgoRaw;
        }
        else
        {
            hmacAlgoRaw = options.hmacAlgoRaw;
        }

        return this.genHMACRaw( hmacAlgoRaw, hmacKeyRaw, ftnreq );
    };

    spectools.getRawAlgo = function( as, algo )
    {
        switch ( algo )
        {
            case 'MD5':
            case 'SHA224':
            case 'SHA256':
            case 'SHA384':
            case 'SHA512':
                return algo.toLowerCase();

            default:
                as.error( FutoInError.InvalidRequest, "Not supported HMAC hash" );
        }
    };

    // Gen HMAC through .update()
    // ----
    spectools._genHMACU = function( hmacAlgoRaw, hmacKeyRaw, ftnreq )
    {
        // this.hmacbase = '';
        var hmac = crypto.createHmac( hmacAlgoRaw, hmacKeyRaw );
        this._hmacUpdate( hmac, ftnreq );
        return hmac.digest();
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

    // Gen HMAC through .join()
    // ----
    spectools._genHMACJ = function( hmacAlgoRaw, hmacKeyRaw, ftnreq )
    {
        // this.hmacbase = '';
        var hmac = crypto.createHmac( hmacAlgoRaw, hmacKeyRaw );
        var hmac_base = [];
        this._hmacBase( hmac_base, ftnreq );
        hmac.update( hmac_base.join( '' ) );
        return hmac.digest();
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

    // Based on benchmark
    // ----
    spectools.genHMACRaw = spectools._genHMACJ;

    // Raw buffer comparison solutions
    // ----
    spectools._checkHMAC = function( a, b )
    {
        return a.equals( b );
    };

    spectools._checkHMAC_legacy = function( a, b )
    {
        // Perhaps, there are faster approaches
        return a.toString( 'hex' ) === b.toString( 'hex' );
    };

    if ( Buffer.prototype.equals )
    {
        spectools.checkHMAC = spectools._checkHMAC;
    }
    else
    {
        spectools.checkHMAC = spectools._checkHMAC_legacy;
    }
};
