"use strict";

var EventEmitter = require( 'wolfy87-eventemitter' );

var common = require( './common' );
var FutoInError = common.FutoInError;
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
        var opts = ctx.options;

        var ws = new MyWebSocket( ctx.endpoint );
        this.ws = ws;
        this._waiting_open = true;

        var reqas = this.reqas;
        var executor = opts.futoin_executor || null;
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

// Fallback to HTTP comms, if WebSocket suport is missing
if ( !MyWebSocket )
{
    exports.WSComms = exports.HTTPComms;
}

/**
 * Browser HTML5 Web Messaging communication backend
 * @private
 */
exports.BrowserComms = function()
{
    this.rid = 1;
    this.reqas = {};
};

exports.BrowserComms.prototype =
{
    init : function( as, ctx )
    {
        // --
        var opts = ctx.options;
        this.opts = opts;

        // --
        var target = ctx.endpoint.split( '://', 2 )[1];
        var browser_window = window; // jshint ignore:line
        var iframe;

        if ( target === 'parent' ) // redundant as the second if covers one
        {
            target = browser_window.parent;
        }
        else if ( ( target in browser_window ) &&
                  ( 'postMessage' in browser_window[target] ) )
        {
            target = browser_window[ target ];
        }
        else
        {
            var browser_document = document; // jshint ignore:line
            iframe = browser_document.getElementById( target );

            if ( iframe )
            {
                target = iframe.contentWindow;
            }
            else
            {
                as.error( FutoInError.CommError, 'Unknown target: ' + target );
            }
        }

        if ( target === browser_window )
        {
            as.error( FutoInError.CommError, 'Target matches current window' );
        }

        this.target = target;

        // --
        var reqas = this.reqas;
        var executor = opts.futoin_executor || null;
        var info = ctx.info;
        var target_origin = opts.targetOrigin;

        var send_executor_rsp = function( rsp )
        {
            target.postMessage( JSON.stringify( rsp ), target_origin );
        };

        var on_message = function( event )
        {
            // Security & Performance important
            if ( event.source &&
                 ( event.source !== target ) )
            {
                return;
            }

            if ( !target_origin )
            {
                // pass
            }
            else if ( event.origin !== target_origin )
            {
                console.log( 'Error: peer origin mismatch ' );
                console.log( 'Error >origin: ' + event.origin );
                console.log( 'Error >required: ' + target_origin );
                return;
            }

            // ---
            var rsp = event.data;

            if ( typeof rsp !== 'object' )
            {
                console.log( 'Not object response: ' + rsp );
                return;
            }

            // Only multiplexing mode is expected for HTML5 Web Messaging ecomms
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

        browser_window.addEventListener( "message", on_message, false );
    },

    perform : function( as, ctx, req )
    {
        if ( ctx.upload_data ||
             ctx.download_stream )
        {
            as.error( FutoInError.CommError, 'Raw Data is not supported by Web Messaging yet' );
        }

        if ( !( 'target' in this ) )
        {
            this.init( as, ctx );
        }

        var _this = this;

        as.add( function( as )
        {
            var reqas = _this.reqas;

            var rid = 'C' + _this.rid++;

            if ( ctx.expect_response )
            {
                reqas[rid] = as;

                as.setCancel(
                    function( as )
                    {
                        void as;
                        delete reqas[rid];
                    }
                );
            }

            req.rid = rid;
            _this.target.postMessage( req, _this.opts.targetOrigin || '*' );
        } );
    }
};
