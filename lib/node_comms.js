"use strict";

var http = require( 'http' );
var https = require( 'https' );
var url = require( 'url' );
var querystring = require( 'querystring' );
var _ = require( 'lodash' );
var stream = require( 'stream' );
var wsmod = require( 'ws' );

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

        // Call concfig callback
        var optcb = ctx.options[ optname.OPT_COMM_CONFIG_CB ];
        var agent_opts = {};

        if ( optcb )
        {
            optcb( parsed_url.protocol, agent_opts );
        }

        opts.agent = new this.http_impl.Agent( agent_opts );

        // In case comes from configuration callback
        if ( 'maxSockets' in opts )
        {
            opts.agent.maxSockets = opts.maxSockets;
        }

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

        if ( rawreq )
        {
            opts.headers['content-type'] = 'application/octet-stream';

            if ( rawreq.length !== undefined )
            {
                opts.headers['content-length'] = rawreq.length;
            }
            else
            {
                as.error( FutoInError.InvokerError, "Please set 'length' property even for stream.Readable" );
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
            opts.headers['content-length'] = rawreq.length;
        }

        var httpreq = this.http_impl.request( opts );

        var error_handler = function( e )
        {
            httpreq.removeListener( 'response', on_response );
            httpreq.removeListener( 'error', error_handler );

            try
            {
                as.error( FutoInError.CommError, "Low error: " + e.code + " = " + e.message );
            }
            catch ( ex )
            {}
        };

        var on_response = function( rsp )
        {
            var jsonrsp = [];

            if ( ctx.download_stream )
            {
                rsp.pipe( ctx.download_stream );
            }
            else
            {
                rsp.setEncoding( 'utf8' );

                var on_data_chunk = function( chunk )
                {
                    jsonrsp.push( chunk );
                };

                rsp.on( 'data', on_data_chunk );
            }

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
        };

        httpreq.on( 'response', on_response );
        httpreq.on( 'error', error_handler );

        if ( rawreq instanceof stream.Readable )
        {
            rawreq.pipe( httpreq );
        }
        else
        {
            httpreq.end( rawreq, 'utf8' );
        }

        as.setCancel(
            function()
            {
                httpreq.removeListener( 'response', on_response );
                httpreq.removeListener( 'error', error_handler );
                httpreq.abort();
            }
        );
    }
};

/**
 * Node.js WebSocket communication backend
 * @private
 */
exports.WSComms = function()
{
    this.rid = 0;
    this.reqas = {};
};

exports.WSComms.prototype =
{
    init : function( as, ctx )
    {
        if ( 'ws' in this )
        {
            return this.ws;
        }

        var parsed_url = url.parse( ctx.endpoint );
        parsed_url.protocol = parsed_url.protocol.replace( ':', '' );

        var opts =
        {
            futoin_executor : null,
        };

        // Call concfig callback
        var optcb = ctx.options[ optname.OPT_COMM_CONFIG_CB ];

        if ( optcb )
        {
            optcb( parsed_url.protocol, opts );
        }

        var ws = new wsmod.WebSocket( ctx.endpoint, opts );
        this.ws = ws;

        var reqas = this.reqas;
        var executor = opts.futoin_executor;
        var info = ctx.info;
        var _this = this;

        var send_executor_rsp = function( rsp )
        {
            ws.send( JSON.stringify( rsp ) );
        };

        var cleanup = function( arg1, arg2 )
        {
            ws.terminate();
            delete _this.ws;

            for ( var k in reqas )
            {
                try
                {
                    reqas[ k ].error( FutoInError.CommError, arg2 ? "Cleanup" : "Error" );
                }
                catch ( ex )
                {}
            }

            delete _this.reqas;
            _this.reqas = {};
        };

        ws.on( 'error', cleanup );
        ws.on( 'close', cleanup );

        ws.on( 'message', function( data, flags )
        {
            if ( flags.binary )
            {
                // Ignore
                return;
            }

            var rsp;

            try
            {
                rsp = JSON.parse( data );
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

        this.ws = ws;
        return ws;
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
        var ws = this.init( as, ctx );
        var reqas = this.reqas;

        var rid = 'C' + this.rid++;
        reqas[rid] = as;

        req.rid = rid;
        ws.send( JSON.stringify( req ) );

        as.setCancel(
            function( )
            {
                delete reqas[rid];
            }
        );
    }
};