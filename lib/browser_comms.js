"use strict";

var EventEmitter = require( 'wolfy87-eventemitter' );

var common = require( './common' );
var FutoInError = common.FutoInError;
var optname = common.Options;
var MyWebSocket = WebSocket; // jshint ignore:line

/**
 * Browser HTTP communication backend
 * @private
 */
exports.HTTPComms = function()
{
};

exports.HTTPComms.prototype =
{
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
        var httpreq = new XMLHttpRequest(); // jshint ignore:line
        var url = ctx.endpoint;

        // ---
        var rawreq = ctx.upload_data;
        var content_type;

        if ( rawreq ||
             ( rawreq === '' ) )
        {
            content_type = 'application/octet-stream';

            if ( url.charAt( url.length - 1 ) !== '/' )
            {
                url += "/";
            }

            // Note: we force end slashes here compared to node_comms by intention
            // to test both cases in real life
            url += req.f.replace( /:/g, '/' ) + '/';

            if ( 'sec' in req )
            {
                url += req.sec + '/';
            }

            var params = [];

            for ( var k in req.p )
            {
                params.push( encodeURIComponent( k ) + "=" + encodeURIComponent( req.p[k] ) );
            }

            url += "?" + params.join( '&' );
        }
        else
        {
            content_type = 'application/futoin+json';
            rawreq = JSON.stringify( req );
        }

        // ---
        if ( ctx.expect_response )
        {
            if ( ctx.download_stream )
            {
                httpreq.responseType = ctx.download_stream;
            }

            httpreq.onreadystatechange = function()
            {
                if ( this.readyState !== this.DONE )
                {
                    return;
                }

                var response = ctx.download_stream ?
                        this.response  :
                        this.responseText;

                if ( response )
                {
                    as.success(
                            response,
                            this.getResponseHeader( 'content-type' )
                    );
                }
                else
                {
                    try
                    {
                        as.error( FutoInError.CommError, "Low error" );
                    }
                    catch ( ex )
                    {}
                }
            };

            as.setCancel(
                function()
                {
                    httpreq.abort();
                }
            );
        }

        // ---
        httpreq.open( 'POST', url, true );
        httpreq.setRequestHeader( 'Content-Type', content_type );
        httpreq.send( rawreq );

        if ( !ctx.expect_response )
        {
            as.success();
        }
    }
};

/**
 * Browser WebSocket communication backend
 * @private
 */
exports.WSComms = function()
{
    this.rid = 1;
    this.reqas = {};
    this.evt = new EventEmitter();
};

exports.WSComms.prototype =
{
    _waiting_open : false,

    init : function( as, ctx )
    {
        var opts = {};

        // Call concfig callback
        var optcb = ctx.options[ optname.OPT_COMM_CONFIG_CB ];

        if ( optcb )
        {
            optcb( ctx.endpoint.match( /^(wss?)/ )[1], opts );
        }

        var ws = new MyWebSocket( ctx.endpoint );
        this.ws = ws;
        this._waiting_open = true;

        var reqas = this.reqas;
        var executor = opts.futoin_executor;
        var info = ctx.info;
        var _this = this;

        var send_executor_rsp = function( rsp )
        {
            ws.send( JSON.stringify( rsp ) );
        };

        var cleanup = function( event )
        {
            ws.close();
            delete _this.ws;

            for ( var k in reqas )
            {
                try
                {
                    reqas[ k ].error( FutoInError.CommError, event.wasClean ? "Cleanup" : "Error" );
                }
                catch ( ex )
                {}
            }

            delete _this.reqas;
            _this.reqas = {};

            _this._waiting_open = false;
        };

        ws.onclose = cleanup;
        ws.onerror = cleanup;

        ws.onopen = function( event )
        {
            void event;
            _this._waiting_open = false;
            _this.evt.emit( 'open' );
        };

        ws.onmessage = function( event )
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
        };
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

                _this.evt.once( 'open', on_open );

                as.setCancel( function()
                {
                    _this.evt.removeListener( 'open', on_open );
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

        req.rid = rid;
        this.ws.send( JSON.stringify( req ) );
    }
};
