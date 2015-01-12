"use strict";

var http = require( 'http' );
var https = require( 'https' );
var url = require( 'url' );
var querystring = require( 'querystring' );
var _ = require( 'lodash' );
var WebSocket = require( 'faye-websocket' );

if ( process.version.split( '.' )[ 1 ] >= 11 )
{
    var AgentKeepAlive = require( 'agentkeepalive' );
}
else
{
    var AgentKeepAlive = require( 'keep-alive-agent' );
}

var common = require( './common' );
var FutoInError = common.FutoInError;
var optname = common.Options;

/**
 * Node.js HTTP communication backend
 * @private
 */
exports.HTTPComms = function()
{
};

exports.HTTPComms.prototype =
{
    getGlobalAgent : function( as, ctx, is_https )
    {
        var agent_field = is_https ?
                '_globalHTTPSecureAgent' :
                '_globalHTTPAgent';
        var ccmimpl = ctx.ccmimpl;

        if ( ccmimpl[ agent_field ] )
        {
            return ccmimpl[ agent_field ];
        }

        var agent_opts = {
            keepAlive : true,
            keepAliveMsecs : 5e3,
            keepAliveTimeout : 30e3,
            maxFreeSockets : 8
        };

        // Call concfig callback
        var optcb = ctx.options[ optname.OPT_COMM_CONFIG_CB ];

        if ( optcb )
        {
            optcb( ( is_https ? 'https' : 'http' ), agent_opts );
        }

        var agent = is_https ?
                new AgentKeepAlive.Secure( agent_opts ) :
                new AgentKeepAlive( agent_opts );

        ccmimpl[ agent_field ] = agent;
        return agent;
    },

    init : function( as, ctx )
    {
        // Init options
        if ( 'opts' in this )
        {
            return this.opts;
        }

        var parsed_url = url.parse( ctx.endpoint );
        parsed_url.protocol = parsed_url.protocol.replace( ':', '' );
        var is_https = ( parsed_url.protocol === 'https' );

        if ( !parsed_url.port )
        {
            if ( is_https )
            {
                parsed_url.port = 443;
            }
            else
            {
                parsed_url.port = 80;
            }
        }

        var opts =
        {
            host : parsed_url.hostname,
            port : parsed_url.port,
            path : parsed_url.path,
        };

        if ( is_https )
        {
            this.http_impl = https;
        }
        else
        {
            this.http_impl = http;
        }

        opts.agent = this.getGlobalAgent( as, ctx, is_https );

        this.opts = opts;
        return opts;
    },

    perform : function( as, ctx, req )
    {
        var _this = this;

        // According to the "The Safety Rules of AsyncSteps helpers"
        as.add(
            function( as )
            {
                _this._perform( as, ctx, req );
            }
        );
    },

    _perform : function( as, ctx, req )
    {
        var opts = this.init( as, ctx );

        opts = _.clone( opts );
        opts.method = 'POST';
        opts.headers = {};

        var rawreq = ctx.upload_data;

        if ( rawreq ||
             ( rawreq === '' ) )
        {
            opts.headers['content-type'] = 'application/octet-stream';

            if ( typeof rawreq === "string" )
            {
                opts.headers['content-length'] = Buffer.byteLength( rawreq, 'utf8' );
            }
            else if ( rawreq instanceof Buffer )
            {
                opts.headers['content-length'] = rawreq.length;
            }
            else if ( 'lengthInBytes' in rawreq )
            {
                opts.headers['content-length'] = rawreq.lengthInBytes;
            }
            else
            {
                as.error( FutoInError.InvokerError, "Please set 'lengthInBytes' property for upload_data" );
            }

            var path = opts.path;

            if ( path.charAt( path.length - 1 ) !== '/' )
            {
                path += "/";
            }

            path += req.f.replace( /:/g, '/' );

            if ( 'sec' in req )
            {
                path += "/" + req.sec;
            }

            path += "?" + querystring.stringify( req.p );

            opts.path = path;
        }
        else
        {
            rawreq = JSON.stringify( req );
            opts.headers['content-type'] = 'application/futoin+json';
            var byte_length = Buffer.byteLength( rawreq, 'utf8' );

            if ( byte_length > optname.SAFE_PAYLOAD_LIMIT )
            {
                as.error( FutoInError.InvokerError, "FutoIn message exceeds safety limit" );
            }

            opts.headers['content-length'] = byte_length;
        }

        var httpreq = this.http_impl.request( opts );

        var on_response = null;
        var error_handler = function( e )
        {
            if ( on_response !== null )
            {
                httpreq.removeListener( 'response', on_response );
            }

            httpreq.removeListener( 'error', error_handler );

            try
            {
                as.error( FutoInError.CommError, "Low error: " + e.code + " = " + e.message );
            }
            catch ( ex )
            {}
        };

        httpreq.on( 'error', error_handler );

        as.setCancel(
            function()
            {
                httpreq.abort();
            }
        );

        if ( ctx.expect_response )
        {
            on_response = function( rsp )
            {
                if ( ctx.download_stream )
                {
                    var on_dl_end = function()
                    {
                        httpreq.removeListener( 'response', on_response );
                        httpreq.removeListener( 'error', error_handler );

                        as.success( true, rsp.headers['content-type'] );
                    };

                    rsp.on( 'end', on_dl_end );

                    rsp.pipe( ctx.download_stream );
                }
                else
                {
                    var jsonrsp = [];
                    var len = 0;
                    var limit_len = ctx.rawresult ?
                            false :
                            optname.SAFE_PAYLOAD_LIMIT;

                    rsp.setEncoding( 'utf8' );

                    var on_data_chunk = function( chunk )
                    {
                        len += chunk.length;

                        if ( limit_len &&
                             ( len > limit_len ) )
                        {
                            as.error( FutoInError.CommError, "Incoming FutoIn message exceeds limit" );

                            try
                            {
                                req.socket.destroy();
                            }
                            catch ( e )
                            {}
                        }

                        jsonrsp.push( chunk );
                    };

                    rsp.on( 'data', on_data_chunk );

                    var on_end = function()
                    {
                        httpreq.removeListener( 'response', on_response );
                        httpreq.removeListener( 'error', error_handler );

                        as.success(
                            Buffer.concat( jsonrsp ).toString( 'utf8' ),
                            rsp.headers['content-type']
                        );
                    };

                    rsp.on( 'end', on_end );
                }
            };

            httpreq.on( 'response', on_response );
        }

        if ( ( typeof rawreq === 'object' ) &&
             ( 'pipe' in rawreq ) )
        {
            rawreq.pipe( httpreq, { end : true } );
        }
        else if ( rawreq instanceof Buffer )
        {
            httpreq.end( rawreq );
        }
        else
        {
            httpreq.end( rawreq, 'utf8' );
        }

        if ( !ctx.expect_response )
        {
            as.success();
        }
    }
};

/**
 * Node.js WebSocket communication backend
 * @private
 */
exports.WSComms = function()
{
    this.rid = 1;
    this.reqas = {};
};

exports.WSComms.prototype =
{
    _waiting_open : false,

    init : function( as, ctx )
    {
        var parsed_url = url.parse( ctx.endpoint );
        parsed_url.protocol = parsed_url.protocol.replace( ':', '' );

        var opts = ctx.options;

        var ws = new WebSocket.Client(
                ctx.endpoint,
                null,
                {
                    maxLength : optname.SAFE_PAYLOAD_LIMIT
                }
        );
        this.ws = ws;
        this._waiting_open = true;

        var reqas = this.reqas;
        var executor = opts.executor || null;
        var info = ctx.info;
        var _this = this;

        var send_executor_rsp = function( rsp )
        {
            var rawrsp = executor.packPayloadJSON( rsp );
            ws.send( rawrsp );
        };

        var cleanup = function( arg1, arg2 )
        {
            ws.close();
            delete _this.ws;

            for ( var k in reqas )
            {
                try
                {
                    reqas[ k ].error( FutoInError.CommError, ( arg2 !== undefined ) ? "Cleanup" : "Error" );
                }
                catch ( ex )
                {}
            }

            delete _this.reqas;
            _this.reqas = {};

            _this._waiting_open = false;
        };

        ws.on( 'error', cleanup );
        ws.on( 'close', cleanup );

        ws.on( 'open', function()
        {
            _this._waiting_open = false;
        } );

        ws.on( 'message', function( event )
        {
            var rsp;

            try
            {
                rsp = JSON.parse( event.data );
            }
            catch ( e )
            {
                // Ignore
                return;
            }

            // Only multiplexing mode is expected for WebSockets
            if ( 'rid' in rsp )
            {
                var rid = rsp.rid;

                if ( rid in reqas )
                {
                    reqas[ rid ].success( rsp, 'application/futoin+json' );
                    delete reqas[ rid ];
                }
                else if ( ( rid.charAt( 0 ) === 'S' ) && executor )
                {
                    executor.onEndpointRequest(
                            info,
                            rsp,
                            send_executor_rsp
                    );
                }
            }
        } );
    },

    perform : function( as, ctx, req )
    {
        var _this = this;

        if ( !( 'ws' in this ) )
        {
            _this.init( as, ctx );
        }

        if ( this._waiting_open )
        {
            as.add( function( as )
            {
                if ( !_this._waiting_open )
                {
                    return; // already got opened
                }

                var on_open = function()
                {
                    as.success();
                };

                _this.ws.once( 'open', on_open );

                as.setCancel( function()
                {
                    _this.ws.removeListener( 'open', on_open );
                } );
            } );
        }

        // According to the "The Safety Rules of AsyncSteps helpers"
        as.add(
            function( as )
            {
                _this._perform( as, ctx, req );
            }
        );
    },

    _perform : function( as, ctx, req )
    {
        var reqas = this.reqas;

        var rid = 'C' + this.rid++;
        req.rid = rid;

        //
        if ( ctx.expect_response )
        {
            reqas[rid] = as;

            as.setCancel(
                function( )
                {
                    delete reqas[rid];
                }
            );
        }

        //
        this.ws.send( JSON.stringify( req ) );
    }
};
