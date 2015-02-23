(function (factory) {
    if (typeof define === 'function' && define.amd) {
        define(['futoin-asyncsteps'], factory);
    } else if (typeof exports === 'object') {
        module.exports = factory(require('futoin-asyncsteps'));
    } else {
        this.FutoInInvoker = factory($as);
    }
}(function (__external_$as) {
    var global = this, define;
    function _require(id) {
        var module = _require.cache[id];
        if (!module) {
            var exports = {};
            module = _require.cache[id] = {
                id: id,
                exports: exports
            };
            _require.modules[id].call(exports, module, exports);
        }
        return module.exports;
    }
    _require.cache = [];
    _require.modules = [
        function (module, exports) {
            'use strict';
            function InterfaceInfo(raw_info) {
                this._raw_info = raw_info;
            }
            var InterfaceInfoProto = {};
            InterfaceInfo.prototype = InterfaceInfoProto;
            InterfaceInfoProto.name = function () {
                return this._raw_info.iface;
            };
            InterfaceInfoProto.version = function () {
                return this._raw_info.version;
            };
            InterfaceInfoProto.inherits = function () {
                return this._raw_info.inherits;
            };
            InterfaceInfoProto.funcs = function () {
                return this._raw_info.funcs;
            };
            InterfaceInfoProto.constraints = function () {
                return this._raw_info.constraints;
            };
            module.exports = InterfaceInfo;
        },
        function (module, exports) {
            'use strict';
            var common = _require(6);
            var futoin_error = common.FutoInError;
            var _zipObject = _require(24);
            var ee = _require(8);
            var async_steps = _require(23);
            var InterfaceInfo = _require(0);
            var FUTOIN_CONTENT_TYPE = common.Options.FUTOIN_CONTENT_TYPE;
            function NativeIface(ccmimpl, info) {
                this._ccmimpl = ccmimpl;
                this._raw_info = info;
                this._iface_info = null;
                this._comms = {};
                ee(this);
                for (var fn in this._raw_info.funcs) {
                    var finfo = this._raw_info.funcs[fn];
                    if (finfo.rawupload) {
                        continue;
                    }
                    if (fn in this) {
                        continue;
                    }
                    this[fn] = this._member_call_generate(fn, finfo);
                }
            }
            var NativeIfaceProto = {};
            NativeIface.prototype = NativeIfaceProto;
            NativeIfaceProto.call = function (as, name, params, upload_data, download_stream, timeout) {
                params = params || {};
                var raw_info = this._raw_info;
                var ctx = {
                        ccmimpl: this._ccmimpl,
                        name: name,
                        info: raw_info,
                        upload_data: upload_data,
                        download_stream: download_stream,
                        rsp_content_type: null,
                        native_iface: this,
                        options: raw_info.options,
                        endpoint: raw_info.endpoint,
                        expect_response: true,
                        signMessage: this._signMessageDummy
                    };
                var ccmimpl = this._ccmimpl;
                as.add(function (as) {
                    ccmimpl.createMessage(as, ctx, params);
                });
                as.add(function (orig_as, req) {
                    var as;
                    if (ctx.expect_response) {
                        as = orig_as;
                        if (typeof timeout !== 'number') {
                            timeout = ctx.info.options.callTimeoutMS;
                        }
                        if (timeout > 0) {
                            as.setTimeout(timeout);
                        }
                    } else {
                        as = async_steps();
                    }
                    var scheme = raw_info.endpoint_scheme;
                    if (scheme === '#internal#') {
                        ctx.endpoint.onInternalRequest(as, raw_info, req, upload_data, download_stream);
                    } else if (scheme === 'http' || scheme === 'https') {
                        ccmimpl.perfomHTTP(as, ctx, req);
                    } else if (scheme === 'ws' || scheme === 'wss') {
                        var finfo;
                        var rawresult = ctx.download_stream || ctx.info.funcs && (finfo = ctx.info.funcs[name]) && finfo.rawresult;
                        if (ctx.upload_data || rawresult) {
                            ctx.endpoint = ctx.endpoint.replace('ws', 'http');
                            ctx.rawresult = rawresult;
                            ccmimpl.perfomHTTP(as, ctx, req);
                        } else {
                            ccmimpl.perfomWebSocket(as, ctx, req);
                        }
                    } else if (ctx.upload_data) {
                        as.error(futoin_error.InvokerError, 'Upload data is allowed only for HTTP/WS endpoints');
                    } else if (ctx.download_stream) {
                        as.error(futoin_error.InvokerError, 'Download stream is allowed only for HTTP/WS endpoints');
                    } else if (scheme === 'browser') {
                        ccmimpl.perfomBrowser(as, ctx, req);
                    } else if (scheme === 'unix') {
                        ccmimpl.perfomUNIX(as, ctx, req);
                    } else if (scheme === 'callback') {
                        ctx.endpoint(as, ctx, req);
                    } else {
                        as.error(futoin_error.InvokerError, 'Unknown endpoint scheme');
                    }
                    if (as !== orig_as) {
                        as.execute();
                        orig_as.success();
                    } else {
                        as.add(function (as, rsp, content_type) {
                            if (ctx.download_stream) {
                                as.success(true);
                            } else if (content_type === FUTOIN_CONTENT_TYPE || content_type === true) {
                                if (typeof rsp === 'string') {
                                    try {
                                        rsp = JSON.parse(rsp);
                                    } catch (e) {
                                        as.error(futoin_error.CommError, 'JSON:' + e.message);
                                    }
                                }
                                ccmimpl.onMessageResponse(as, ctx, rsp);
                            } else {
                                ccmimpl.onDataResponse(as, ctx, rsp);
                            }
                        });
                    }
                });
            };
            NativeIfaceProto._member_call_intercept = function (as, name, finfo, args) {
                var arginfo = finfo.params;
                var keys = Object.keys(arginfo);
                if (args.length > keys.length) {
                    as.error(futoin_error.InvokerError, 'Unknown parameters');
                } else if (args.length < finfo.min_args) {
                    as.error(futoin_error.InvokerError, 'Missing parameters');
                } else if (args.length < keys.length) {
                    keys = keys.splice(0, args.length);
                }
                var params = _zipObject(keys, args);
                this.call(as, name, params);
            };
            NativeIfaceProto._member_call_generate = function (name, finfo) {
                return function (as) {
                    this._member_call_intercept(as, name, finfo, Array.prototype.slice.call(arguments, 1));
                };
            };
            NativeIfaceProto.ifaceInfo = function () {
                if (!this._iface_info) {
                    this._iface_info = new InterfaceInfo(this._raw_info);
                }
                return this._iface_info;
            };
            NativeIfaceProto.bindDerivedKey = function (as) {
                void as;
                throw new Error(futoin_error.InvokerError, 'Not Implemented');
            };
            NativeIfaceProto._close = function () {
                var comms = this._comms;
                for (var k in comms) {
                    comms[k].close();
                }
                this.emit('close');
            };
            NativeIfaceProto._signMessageDummy = function () {
            };
            module.exports = NativeIface;
        },
        function (module, exports) {
            'use strict';
            var common = _require(6);
            var futoin_error = common.FutoInError;
            var NativeIface = _require(1);
            var _extend = _require(43);
            var _defaults = _require(42);
            var SimpleCCMImpl = _require(3);
            var ee = _require(8);
            var SimpleCCMPublic = common.Options;
            function SimpleCCM(options) {
                ee(this);
                this._iface_info = {};
                this._iface_impl = {};
                this._impl = new SimpleCCMImpl(options);
            }
            _extend(SimpleCCM, SimpleCCMPublic);
            var SimpleCCMProto = {};
            SimpleCCM.prototype = SimpleCCMProto;
            _extend(SimpleCCMProto, SimpleCCMPublic);
            SimpleCCMProto._secure_replace = /^secure\+/;
            SimpleCCMProto._secure_test = /^(https|wss|unix):\/\//;
            SimpleCCMProto._native_iface_builder = function (ccmimpl, info) {
                return new NativeIface(ccmimpl, info);
            };
            SimpleCCMProto.register = function (as, name, ifacever, endpoint, credentials, options) {
                var is_channel_reg = name === null;
                if (!is_channel_reg && name in this._iface_info) {
                    as.error(futoin_error.InvokerError, 'Already registered');
                }
                var m = ifacever.match(common._ifacever_pattern);
                if (m === null) {
                    as.error(futoin_error.InvokerError, 'Invalid ifacever');
                }
                var iface = m[1];
                var mjrmnr = m[4];
                var mjr = m[5];
                var mnr = m[6];
                var secure_channel = false;
                var impl = null;
                var endpoint_scheme;
                var is_bidirect = false;
                if (is_channel_reg) {
                    endpoint_scheme = 'callback';
                    is_bidirect = true;
                } else if (typeof endpoint === 'string') {
                    if (this._secure_replace.test(endpoint)) {
                        secure_channel = true;
                        endpoint = endpoint.replace(this._secure_replace, '');
                    } else if (this._secure_test.test(endpoint)) {
                        secure_channel = true;
                    }
                    impl = this._native_iface_builder;
                    endpoint_scheme = endpoint.split(':')[0];
                    switch (endpoint_scheme) {
                    case 'http':
                    case 'https':
                        break;
                    case 'ws':
                    case 'wss':
                    case 'unix':
                        is_bidirect = true;
                        break;
                    case 'browser':
                        if (options && options.targetOrigin) {
                            secure_channel = true;
                        }
                        is_bidirect = true;
                        break;
                    default:
                        as.error(futoin_error.InvokerError, 'Unknown endpoint schema');
                    }
                } else if ('onInternalRequest' in endpoint) {
                    secure_channel = true;
                    impl = this._native_iface_builder;
                    endpoint_scheme = '#internal#';
                    is_bidirect = true;
                } else {
                    secure_channel = true;
                    impl = endpoint;
                    endpoint = null;
                    endpoint_scheme = null;
                    is_bidirect = true;
                }
                options = options || {};
                _defaults(options, this._impl.options);
                var info = {
                        iface: iface,
                        version: mjrmnr,
                        mjrver: mjr,
                        mnrver: mnr,
                        endpoint: endpoint,
                        endpoint_scheme: endpoint_scheme,
                        creds: credentials || null,
                        creds_master: credentials === 'master',
                        creds_hmac: credentials && credentials.substr(0, 6) === '-hmac:',
                        secure_channel: secure_channel,
                        impl: impl,
                        regname: name,
                        inherits: null,
                        funcs: null,
                        constraints: null,
                        options: options,
                        _invoker_use: true,
                        _user_info: null
                    };
                if (info.creds_hmac && (!options.hmacKey || !options.hmacAlgo)) {
                    as.error(futoin_error.InvokerError, 'Missing options.hmacKey or options.hmacAlgo');
                }
                if (name) {
                    this._iface_info[name] = info;
                }
                var _this = this;
                as.add(function (as) {
                    _this._impl.onRegister(as, info);
                    as.add(function (as) {
                        if (!info.simple_req) {
                            if (!('AllowAnonymous' in info.constraints) && !info.creds) {
                                as.error(futoin_error.SecurityError, 'Requires authenticated user');
                            }
                            if ('SecureChannel' in info.constraints && !secure_channel) {
                                as.error(futoin_error.SecurityError, 'SecureChannel is required');
                            }
                            if ('MessageSignature' in info.constraints && !info.creds_master && !info.creds_hmac) {
                                as.error(futoin_error.SecurityError, 'SecureChannel is required');
                            }
                            if ('BiDirectChannel' in info.constraints && !is_bidirect) {
                                as.error(futoin_error.InvokerError, 'BiDirectChannel is required');
                            }
                        }
                        if (is_channel_reg) {
                            as.success(info, _this._native_iface_builder(_this._impl, info));
                        }
                        _this.emit('register', name, ifacever, info);
                    });
                }, function (as, err) {
                    void as;
                    void err;
                    if (name) {
                        delete _this._iface_info[name];
                    }
                });
            };
            SimpleCCMProto.iface = function (name) {
                var info = this._iface_info[name];
                if (!info) {
                    throw new Error(futoin_error.InvokerError);
                }
                var regname = info.regname;
                var impl = this._iface_impl[regname];
                if (!impl) {
                    var NativeImpl = info.options.nativeImpl;
                    if (NativeImpl) {
                        impl = new NativeImpl(this._impl, info);
                    } else {
                        impl = info.impl(this._impl, info);
                    }
                    this._iface_impl[regname] = impl;
                }
                return impl;
            };
            SimpleCCMProto.unRegister = function (name) {
                var info = this._iface_info[name];
                if (!info) {
                    throw new Error(futoin_error.InvokerError);
                }
                var regname = info.regname;
                if (regname === name) {
                    delete this._iface_info[regname];
                    var impl = this._iface_impl[regname];
                    if (impl) {
                        impl._close();
                        delete this._iface_impl[regname];
                    }
                    if (info.aliases) {
                        var aliases = info.aliases;
                        for (var i = 0; i < aliases.length; ++i) {
                            delete this._iface_info[aliases[i]];
                        }
                    }
                } else {
                    delete this._iface_info[name];
                    info.aliases.splice(info.aliases.indexOf(name), 0);
                }
                this.emit('unregister', name, info);
            };
            SimpleCCMProto.defense = function () {
                return this.iface(this.SVC_DEFENSE);
            };
            SimpleCCMProto.log = function () {
                return this.iface(this.SVC_LOG);
            };
            SimpleCCMProto.cache = function (bucket) {
                return this.iface(this.SVC_CACHE_ + (bucket || 'default'));
            };
            SimpleCCMProto.assertIface = function (name, ifacever) {
                var info = this._iface_info[name];
                if (!info) {
                    throw new Error(futoin_error.InvokerError);
                }
                var m = ifacever.match(common._ifacever_pattern);
                if (m === null) {
                    throw new Error(futoin_error.InvokerError);
                }
                var iface = m[1];
                var mjr = m[5];
                var mnr = m[6];
                if (info.iface !== iface || info.mjrver !== mjr || info.mnrver < mnr) {
                    throw new Error(futoin_error.InvokerError);
                }
            };
            SimpleCCMProto.alias = function (name, alias) {
                var info = this._iface_info[name];
                if (!info || this._iface_info[alias]) {
                    throw new Error(futoin_error.InvokerError);
                }
                this._iface_info[alias] = info;
                if (!info.aliases) {
                    info.aliases = [alias];
                } else {
                    info.aliases.push(alias);
                }
                this.emit('register', alias, info.iface + ':' + info.version, info);
            };
            SimpleCCMProto.close = function () {
                var impls = this._iface_impl;
                for (var n in impls) {
                    impls[n]._close();
                }
                var comms = this._impl.comms;
                for (var k in comms) {
                    comms[k].close();
                }
                this.emit('close');
            };
            module.exports = SimpleCCM;
        },
        function (module, exports) {
            'use strict';
            var common = _require(6);
            var FutoInError = common.FutoInError;
            var isNode = _require(7);
            var _defaults = _require(42);
            var comms_impl;
            if (isNode) {
                var hidereq = require;
                comms_impl = hidereq('./node/comms');
            } else {
                comms_impl = _require(4);
            }
            var defopts = {
                    callTimeoutMS: 30000,
                    prodMode: false,
                    commConfigCallback: null,
                    retryCount: 1,
                    messageSniffer: function () {
                    },
                    disconnectSniffer: function () {
                    },
                    hmacAlgo: 'MD5'
                };
            function SimpleCCMImpl(options) {
                options = options || {};
                _defaults(options, defopts);
                this.options = options;
                this.comms = {};
            }
            SimpleCCMImpl.prototype = {
                onRegister: function (as, info) {
                    if (info.creds_master || info.creds_hmac) {
                        as.error(FutoInError.InvokerError, 'Master/HMAC is supported only in AdvancedCCM');
                    }
                    info.funcs = {};
                    info.inherits = [];
                    info.constraints = {};
                    info.simple_req = true;
                },
                createMessage: function (as, ctx, params) {
                    var info = ctx.info;
                    var req = {
                            f: info.iface + ':' + info.version + ':' + ctx.name,
                            p: params,
                            forcersp: true
                        };
                    if (info.creds !== null && info.creds !== 'master') {
                        req.sec = info.creds;
                    }
                    as.success(req);
                },
                onMessageResponse: function (as, ctx, rsp) {
                    if ('e' in rsp) {
                        as.error(rsp.e, rsp.edesc);
                    } else {
                        as.success(rsp.r);
                    }
                },
                onDataResponse: function (as, ctx, rsp) {
                    as.success(rsp);
                },
                getComms: function (as, ctx, CommImpl, extra_key) {
                    var comms;
                    var key;
                    var ctxopts = ctx.options;
                    var globalopts = this.options;
                    if (ctxopts.executor !== globalopts.executor || ctxopts.messageSniffer !== globalopts.messageSniffer || ctxopts.disconnectSniffer !== globalopts.disconnectSniffer || ctxopts.commConfigCallback !== globalopts.commConfigCallback) {
                        comms = ctx.native_iface._comms;
                        key = ctx.info.endpoint_scheme;
                    } else {
                        comms = this.comms;
                        key = ctx.endpoint + '##' + (ctx.credentials || '') + '##' + (extra_key || '');
                    }
                    var c = comms[key];
                    if (!c) {
                        if (!CommImpl) {
                            as.error(FutoInError.InvokerError, 'Not implemented ' + ctx.info.endpoint_scheme + ' scheme');
                        }
                        c = new CommImpl();
                        comms[key] = c;
                    }
                    return c;
                },
                performCommon: function (as, ctx, req, comm) {
                    var msg;
                    var content_type;
                    var retries = ctx.options.retryCount;
                    as.repeat(retries + 1, function (as, attempt) {
                        as.add(function (as) {
                            comm.perform(as, ctx, req);
                            as.add(function (as, m, c) {
                                msg = m;
                                content_type = c;
                                as.break();
                            });
                        }, function (as, err) {
                            if (err === FutoInError.CommError) {
                                ctx.native_iface.emit('commError', as.state.error_info, req);
                                if (attempt < retries) {
                                    as.continue();
                                }
                            }
                        });
                    }).add(function (as) {
                        as.success(msg, content_type);
                    });
                },
                perfomHTTP: function (as, ctx, req) {
                    var comms = this.getComms(as, ctx, comms_impl.HTTPComms);
                    this.performCommon(as, ctx, req, comms);
                },
                perfomWebSocket: function (as, ctx, req) {
                    var comms = this.getComms(as, ctx, comms_impl.WSComms);
                    this.performCommon(as, ctx, req, comms);
                },
                perfomUNIX: function (as, ctx, req) {
                    void ctx;
                    void req;
                    as.error(FutoInError.InvokerError, 'Not implemented unix:// scheme');
                },
                perfomBrowser: function (as, ctx, req) {
                    var comms = this.getComms(as, ctx, comms_impl.BrowserComms, ctx.options.targetOrigin);
                    comms.perform(as, ctx, req);
                }
            };
            module.exports = SimpleCCMImpl;
        },
        function (module, exports) {
            'use strict';
            var ee = _require(8);
            var common = _require(6);
            var FutoInError = common.FutoInError;
            var MyWebSocket = WebSocket;
            var FUTOIN_CONTENT_TYPE = common.Options.FUTOIN_CONTENT_TYPE;
            exports.HTTPComms = function () {
            };
            exports.HTTPComms.prototype = {
                close: function () {
                },
                perform: function (as, ctx, req) {
                    var _this = this;
                    as.add(function (as) {
                        _this._perform(as, ctx, req);
                    });
                },
                _perform: function (as, ctx, req) {
                    ctx.signMessage(req);
                    var sniffer = ctx.options.messageSniffer;
                    var httpreq = new XMLHttpRequest();
                    var url = ctx.endpoint;
                    var rawreq = ctx.upload_data;
                    var content_type;
                    var auth_header;
                    if (rawreq || rawreq === '') {
                        content_type = 'application/octet-stream';
                        if (url.charAt(url.length - 1) !== '/') {
                            url += '/';
                        }
                        url += req.f.replace(/:/g, '/') + '/';
                        if ('sec' in req) {
                            if (req.sec === ctx.options.credentials) {
                                auth_header = 'Basic ' + window.btoa(req.sec);
                            } else {
                                url += req.sec + '/';
                            }
                        }
                        var params = [];
                        for (var k in req.p) {
                            var v = req.p[k];
                            if (typeof v !== 'string') {
                                v = JSON.stringify(v);
                            }
                            params.push(encodeURIComponent(k) + '=' + encodeURIComponent(v));
                        }
                        url += '?' + params.join('&');
                        sniffer(ctx.info, req, false);
                    } else {
                        content_type = FUTOIN_CONTENT_TYPE;
                        rawreq = JSON.stringify(req);
                        sniffer(ctx.info, rawreq, false);
                    }
                    if (ctx.expect_response) {
                        if (ctx.download_stream) {
                            httpreq.responseType = ctx.download_stream;
                        }
                        httpreq.onreadystatechange = function () {
                            if (this.readyState !== this.DONE) {
                                return;
                            }
                            var response = ctx.download_stream ? this.response : this.responseText;
                            if (response) {
                                var content_type = this.getResponseHeader('content-type');
                                if (content_type === FUTOIN_CONTENT_TYPE) {
                                    sniffer(ctx.info, response, true);
                                } else {
                                    sniffer(ctx.info, '%DATA%', true);
                                }
                                as.success(response, content_type);
                            } else {
                                try {
                                    as.error(FutoInError.CommError, 'Low error');
                                } catch (ex) {
                                }
                            }
                        };
                        as.setCancel(function () {
                            httpreq.abort();
                        });
                    }
                    httpreq.open('POST', url, true);
                    httpreq.setRequestHeader('Content-Type', content_type);
                    if (auth_header) {
                        httpreq.setRequestHeader('Authorization', auth_header);
                    }
                    httpreq.send(rawreq);
                    if (!ctx.expect_response) {
                        as.success();
                    }
                }
            };
            exports.WSComms = function () {
                this.rid = 1;
                this.reqas = {};
                this.evt = ee();
            };
            exports.WSComms.prototype = {
                _waiting_open: false,
                init: function (as, ctx) {
                    var opts = ctx.options;
                    var ws = new MyWebSocket(ctx.endpoint);
                    this.ws = ws;
                    this._waiting_open = true;
                    var reqas = this.reqas;
                    var executor = opts.executor || null;
                    var info = ctx.info;
                    var _this = this;
                    var sniffer = opts.messageSniffer;
                    this.sniffer = sniffer;
                    var send_executor_rsp = function (rsp) {
                        var rawrsp = executor.packPayloadJSON(rsp);
                        sniffer(info, rawrsp, false);
                        ws.send(rawrsp);
                    };
                    var cleanup = function (event) {
                        opts.disconnectSniffer(info);
                        ws.close();
                        delete _this.ws;
                        for (var k in reqas) {
                            try {
                                reqas[k].error(FutoInError.CommError, event.wasClean ? 'Cleanup' : 'Error');
                            } catch (ex) {
                            }
                        }
                        delete _this.reqas;
                        _this.reqas = {};
                        _this._waiting_open = false;
                        ctx.native_iface.emit('disconnect');
                    };
                    ws.onclose = cleanup;
                    ws.onerror = cleanup;
                    ws.onopen = function (event) {
                        void event;
                        _this._waiting_open = false;
                        _this.evt.emit('open');
                        ctx.native_iface.emit('connect');
                    };
                    ws.onmessage = function (event) {
                        sniffer(info, event.data, true);
                        var rsp;
                        try {
                            rsp = JSON.parse(event.data);
                        } catch (e) {
                            return;
                        }
                        if ('rid' in rsp) {
                            var rid = rsp.rid;
                            if (rid in reqas) {
                                reqas[rid].success(rsp, true);
                                delete reqas[rid];
                            } else if (rid.charAt(0) === 'S' && executor) {
                                executor.onEndpointRequest(info, rsp, send_executor_rsp);
                            }
                        }
                    };
                },
                close: function () {
                    if (this.ws) {
                        this.ws.close();
                    }
                },
                perform: function (as, ctx, req) {
                    var _this = this;
                    if (!('ws' in this)) {
                        _this.init(as, ctx);
                    }
                    if (this._waiting_open) {
                        as.add(function (as) {
                            if (!_this._waiting_open) {
                                return;
                            }
                            var on_open = function () {
                                as.success();
                            };
                            _this.evt.once('open', on_open);
                            as.setCancel(function () {
                                _this.evt.off('open', on_open);
                            });
                        });
                    }
                    as.add(function (as) {
                        _this._perform(as, ctx, req);
                    });
                },
                _perform: function (as, ctx, req) {
                    if (!('ws' in this)) {
                        as.error(FutoInError.CommError, 'Disconnect while in progress');
                    }
                    var reqas = this.reqas;
                    var rid = 'C' + this.rid++;
                    req.rid = rid;
                    ctx.signMessage(req);
                    if (ctx.expect_response) {
                        reqas[rid] = as;
                        as.setCancel(function () {
                            delete reqas[rid];
                        });
                    }
                    var rawreq = JSON.stringify(req);
                    this.sniffer(ctx.info, rawreq, false);
                    this.ws.send(rawreq);
                }
            };
            if (!MyWebSocket) {
                exports.WSComms = exports.HTTPComms;
            }
            exports.BrowserComms = function () {
                this.rid = 1;
                this.reqas = {};
            };
            exports.BrowserComms.prototype = {
                init: function (as, ctx) {
                    var opts = ctx.options;
                    this.opts = opts;
                    var target = ctx.endpoint.split('://', 2)[1];
                    var browser_window = window;
                    var iframe;
                    if (target === 'parent') {
                        target = browser_window.parent;
                    } else if (target in browser_window && 'postMessage' in browser_window[target]) {
                        target = browser_window[target];
                    } else {
                        var browser_document = document;
                        iframe = browser_document.getElementById(target);
                        if (iframe) {
                            target = iframe.contentWindow;
                        } else {
                            as.error(FutoInError.CommError, 'Unknown target: ' + target);
                        }
                    }
                    if (target === browser_window) {
                        as.error(FutoInError.CommError, 'Target matches current window');
                    }
                    this.target = target;
                    var reqas = this.reqas;
                    var executor = opts.executor || null;
                    var info = ctx.info;
                    var target_origin = opts.targetOrigin;
                    var sniffer = opts.messageSniffer;
                    this.sniffer = sniffer;
                    var send_executor_rsp = function (rsp) {
                        sniffer(target_origin, rsp, false);
                        target.postMessage(rsp, target_origin || '*');
                    };
                    var on_message = function (event) {
                        sniffer(info, event.data, true);
                        if (event.source && event.source !== target) {
                            return;
                        }
                        if (!target_origin) {
                        } else if (event.origin !== target_origin) {
                            console.log('Error: peer origin mismatch ');
                            console.log('Error >origin: ' + event.origin);
                            console.log('Error >required: ' + target_origin);
                            return;
                        }
                        var rsp = event.data;
                        if (typeof rsp !== 'object') {
                            console.log('Not object response: ' + rsp);
                            return;
                        }
                        if ('rid' in rsp) {
                            var rid = rsp.rid;
                            if (!('f' in rsp) && rid in reqas) {
                                reqas[rid].success(rsp, true);
                                delete reqas[rid];
                            } else if ('f' in rsp && rid.charAt(0) === 'S' && executor) {
                                executor.onEndpointRequest(info, rsp, send_executor_rsp);
                            } else {
                                return;
                            }
                            if (event.stopPropagation) {
                                event.stopPropagation();
                            }
                        }
                    };
                    browser_window.addEventListener('message', on_message, false);
                    ctx.native_iface.emit('connect');
                },
                close: function () {
                    if (this.target) {
                        this.target = null;
                    }
                },
                perform: function (as, ctx, req) {
                    if (ctx.upload_data || ctx.download_stream) {
                        as.error(FutoInError.CommError, 'Raw Data is not supported by Web Messaging yet');
                    }
                    if (!this.target) {
                        this.init(as, ctx);
                    }
                    var _this = this;
                    as.add(function (as) {
                        var reqas = _this.reqas;
                        var rid = 'C' + _this.rid++;
                        req.rid = rid;
                        ctx.signMessage(req);
                        if (ctx.expect_response) {
                            reqas[rid] = as;
                            as.setCancel(function (as) {
                                void as;
                                delete reqas[rid];
                            });
                        }
                        _this.sniffer(ctx.info, req, false);
                        _this.target.postMessage(req, _this.opts.targetOrigin || '*');
                    });
                }
            };
        },
        function (module, exports) {
            (function (window) {
                'use strict';
                window.SimpleCCM = _require(2);
                if (module) {
                    module.exports = window.SimpleCCM;
                }
            }(window));
        },
        function (module, exports) {
            'use strict';
            var async_steps = _require(23);
            exports.AsyncSteps = async_steps;
            exports.FutoInError = async_steps.FutoInError;
            exports.Options = {
                OPT_CALL_TIMEOUT_MS: 'callTimeoutMS',
                OPT_PROD_MODE: 'prodMode',
                OPT_COMM_CONFIG_CB: 'commConfigCallback',
                OPT_MSG_SNIFFER: 'messageSniffer',
                OPT_DISCONNECT_SNIFFER: 'disconnectSniffer',
                OPT_SPEC_DIRS: 'specDirs',
                OPT_EXECUTOR: 'executor',
                OPT_TARGET_ORIGIN: 'targetOrigin',
                OPT_RETRY_COUNT: 'retryCount',
                OPT_HMAC_KEY: 'hmacKey',
                OPT_HMAC_ALGO: 'hmacAlgo',
                SAFE_PAYLOAD_LIMIT: 65536,
                SVC_RESOLVER: '#resolver',
                SVC_AUTH: '#auth',
                SVC_DEFENSE: '#defense',
                SVC_ACL: '#acl',
                SVC_LOG: '#log',
                SVC_CACHE_: '#cache.',
                FUTOIN_CONTENT_TYPE: 'application/futoin+json'
            };
            exports._ifacever_pattern = /^(([a-z][a-z0-9]*)(\.[a-z][a-z0-9]*)*):(([0-9]+)\.([0-9]+))$/;
        },
        function (module, exports) {
            module.exports = false;
            try {
                module.exports = Object.prototype.toString.call(global.process) === '[object process]';
            } catch (e) {
            }
        },
        function (module, exports) {
            'use strict';
            var d = _require(9), callable = _require(18), apply = Function.prototype.apply, call = Function.prototype.call, create = Object.create, defineProperty = Object.defineProperty, defineProperties = Object.defineProperties, hasOwnProperty = Object.prototype.hasOwnProperty, descriptor = {
                    configurable: true,
                    enumerable: false,
                    writable: true
                }, on, once, off, emit, methods, descriptors, base;
            on = function (type, listener) {
                var data;
                callable(listener);
                if (!hasOwnProperty.call(this, '__ee__')) {
                    data = descriptor.value = create(null);
                    defineProperty(this, '__ee__', descriptor);
                    descriptor.value = null;
                } else {
                    data = this.__ee__;
                }
                if (!data[type])
                    data[type] = listener;
                else if (typeof data[type] === 'object')
                    data[type].push(listener);
                else
                    data[type] = [
                        data[type],
                        listener
                    ];
                return this;
            };
            once = function (type, listener) {
                var once, self;
                callable(listener);
                self = this;
                on.call(this, type, once = function () {
                    off.call(self, type, once);
                    apply.call(listener, this, arguments);
                });
                once.__eeOnceListener__ = listener;
                return this;
            };
            off = function (type, listener) {
                var data, listeners, candidate, i;
                callable(listener);
                if (!hasOwnProperty.call(this, '__ee__'))
                    return this;
                data = this.__ee__;
                if (!data[type])
                    return this;
                listeners = data[type];
                if (typeof listeners === 'object') {
                    for (i = 0; candidate = listeners[i]; ++i) {
                        if (candidate === listener || candidate.__eeOnceListener__ === listener) {
                            if (listeners.length === 2)
                                data[type] = listeners[i ? 0 : 1];
                            else
                                listeners.splice(i, 1);
                        }
                    }
                } else {
                    if (listeners === listener || listeners.__eeOnceListener__ === listener) {
                        delete data[type];
                    }
                }
                return this;
            };
            emit = function (type) {
                var i, l, listener, listeners, args;
                if (!hasOwnProperty.call(this, '__ee__'))
                    return;
                listeners = this.__ee__[type];
                if (!listeners)
                    return;
                if (typeof listeners === 'object') {
                    l = arguments.length;
                    args = new Array(l - 1);
                    for (i = 1; i < l; ++i)
                        args[i - 1] = arguments[i];
                    listeners = listeners.slice();
                    for (i = 0; listener = listeners[i]; ++i) {
                        apply.call(listener, this, args);
                    }
                } else {
                    switch (arguments.length) {
                    case 1:
                        call.call(listeners, this);
                        break;
                    case 2:
                        call.call(listeners, this, arguments[1]);
                        break;
                    case 3:
                        call.call(listeners, this, arguments[1], arguments[2]);
                        break;
                    default:
                        l = arguments.length;
                        args = new Array(l - 1);
                        for (i = 1; i < l; ++i) {
                            args[i - 1] = arguments[i];
                        }
                        apply.call(listeners, this, args);
                    }
                }
            };
            methods = {
                on: on,
                once: once,
                off: off,
                emit: emit
            };
            descriptors = {
                on: d(on),
                once: d(once),
                off: d(off),
                emit: d(emit)
            };
            base = defineProperties({}, descriptors);
            module.exports = exports = function (o) {
                return o == null ? create(base) : defineProperties(Object(o), descriptors);
            };
            exports.methods = methods;
        },
        function (module, exports) {
            'use strict';
            var assign = _require(10), normalizeOpts = _require(17), isCallable = _require(13), contains = _require(20), d;
            d = module.exports = function (dscr, value) {
                var c, e, w, options, desc;
                if (arguments.length < 2 || typeof dscr !== 'string') {
                    options = value;
                    value = dscr;
                    dscr = null;
                } else {
                    options = arguments[2];
                }
                if (dscr == null) {
                    c = w = true;
                    e = false;
                } else {
                    c = contains.call(dscr, 'c');
                    e = contains.call(dscr, 'e');
                    w = contains.call(dscr, 'w');
                }
                desc = {
                    value: value,
                    configurable: c,
                    enumerable: e,
                    writable: w
                };
                return !options ? desc : assign(normalizeOpts(options), desc);
            };
            d.gs = function (dscr, get, set) {
                var c, e, options, desc;
                if (typeof dscr !== 'string') {
                    options = set;
                    set = get;
                    get = dscr;
                    dscr = null;
                } else {
                    options = arguments[3];
                }
                if (get == null) {
                    get = undefined;
                } else if (!isCallable(get)) {
                    options = get;
                    get = set = undefined;
                } else if (set == null) {
                    set = undefined;
                } else if (!isCallable(set)) {
                    options = set;
                    set = undefined;
                }
                if (dscr == null) {
                    c = true;
                    e = false;
                } else {
                    c = contains.call(dscr, 'c');
                    e = contains.call(dscr, 'e');
                }
                desc = {
                    get: get,
                    set: set,
                    configurable: c,
                    enumerable: e
                };
                return !options ? desc : assign(normalizeOpts(options), desc);
            };
        },
        function (module, exports) {
            'use strict';
            module.exports = _require(11)() ? Object.assign : _require(12);
        },
        function (module, exports) {
            'use strict';
            module.exports = function () {
                var assign = Object.assign, obj;
                if (typeof assign !== 'function')
                    return false;
                obj = { foo: 'raz' };
                assign(obj, { bar: 'dwa' }, { trzy: 'trzy' });
                return obj.foo + obj.bar + obj.trzy === 'razdwatrzy';
            };
        },
        function (module, exports) {
            'use strict';
            var keys = _require(14), value = _require(19), max = Math.max;
            module.exports = function (dest, src) {
                var error, i, l = max(arguments.length, 2), assign;
                dest = Object(value(dest));
                assign = function (key) {
                    try {
                        dest[key] = src[key];
                    } catch (e) {
                        if (!error)
                            error = e;
                    }
                };
                for (i = 1; i < l; ++i) {
                    src = arguments[i];
                    keys(src).forEach(assign);
                }
                if (error !== undefined)
                    throw error;
                return dest;
            };
        },
        function (module, exports) {
            'use strict';
            module.exports = function (obj) {
                return typeof obj === 'function';
            };
        },
        function (module, exports) {
            'use strict';
            module.exports = _require(15)() ? Object.keys : _require(16);
        },
        function (module, exports) {
            'use strict';
            module.exports = function () {
                try {
                    Object.keys('primitive');
                    return true;
                } catch (e) {
                    return false;
                }
            };
        },
        function (module, exports) {
            'use strict';
            var keys = Object.keys;
            module.exports = function (object) {
                return keys(object == null ? object : Object(object));
            };
        },
        function (module, exports) {
            'use strict';
            var forEach = Array.prototype.forEach, create = Object.create;
            var process = function (src, obj) {
                var key;
                for (key in src)
                    obj[key] = src[key];
            };
            module.exports = function (options) {
                var result = create(null);
                forEach.call(arguments, function (options) {
                    if (options == null)
                        return;
                    process(Object(options), result);
                });
                return result;
            };
        },
        function (module, exports) {
            'use strict';
            module.exports = function (fn) {
                if (typeof fn !== 'function')
                    throw new TypeError(fn + ' is not a function');
                return fn;
            };
        },
        function (module, exports) {
            'use strict';
            module.exports = function (value) {
                if (value == null)
                    throw new TypeError('Cannot use null or undefined');
                return value;
            };
        },
        function (module, exports) {
            'use strict';
            module.exports = _require(21)() ? String.prototype.contains : _require(22);
        },
        function (module, exports) {
            'use strict';
            var str = 'razdwatrzy';
            module.exports = function () {
                if (typeof str.contains !== 'function')
                    return false;
                return str.contains('dwa') === true && str.contains('foo') === false;
            };
        },
        function (module, exports) {
            'use strict';
            var indexOf = String.prototype.indexOf;
            module.exports = function (searchString) {
                return indexOf.call(this, searchString, arguments[1]) > -1;
            };
        },
        function (module, exports) {
            module.exports = __external_$as;
        },
        function (module, exports) {
            var isArray = _require(38);
            function zipObject(props, values) {
                var index = -1, length = props ? props.length : 0, result = {};
                if (length && !values && !isArray(props[0])) {
                    values = [];
                }
                while (++index < length) {
                    var key = props[index];
                    if (values) {
                        result[key] = values[index];
                    } else if (key) {
                        result[key[0]] = key[1];
                    }
                }
                return result;
            }
            module.exports = zipObject;
        },
        function (module, exports) {
            function arrayCopy(source, array) {
                var index = -1, length = source.length;
                array || (array = Array(length));
                while (++index < length) {
                    array[index] = source[index];
                }
                return array;
            }
            module.exports = arrayCopy;
        },
        function (module, exports) {
            function assignDefaults(objectValue, sourceValue) {
                return typeof objectValue == 'undefined' ? sourceValue : objectValue;
            }
            module.exports = assignDefaults;
        },
        function (module, exports) {
            var baseCopy = _require(28), keys = _require(44);
            function baseAssign(object, source, customizer) {
                var props = keys(source);
                if (!customizer) {
                    return baseCopy(source, object, props);
                }
                var index = -1, length = props.length;
                while (++index < length) {
                    var key = props[index], value = object[key], result = customizer(value, source[key], key, object, source);
                    if ((result === result ? result !== value : value === value) || typeof value == 'undefined' && !(key in object)) {
                        object[key] = result;
                    }
                }
                return object;
            }
            module.exports = baseAssign;
        },
        function (module, exports) {
            function baseCopy(source, object, props) {
                if (!props) {
                    props = object;
                    object = {};
                }
                var index = -1, length = props.length;
                while (++index < length) {
                    var key = props[index];
                    object[key] = source[key];
                }
                return object;
            }
            module.exports = baseCopy;
        },
        function (module, exports) {
            function baseToString(value) {
                if (typeof value == 'string') {
                    return value;
                }
                return value == null ? '' : value + '';
            }
            module.exports = baseToString;
        },
        function (module, exports) {
            var identity = _require(48);
            function bindCallback(func, thisArg, argCount) {
                if (typeof func != 'function') {
                    return identity;
                }
                if (typeof thisArg == 'undefined') {
                    return func;
                }
                switch (argCount) {
                case 1:
                    return function (value) {
                        return func.call(thisArg, value);
                    };
                case 3:
                    return function (value, index, collection) {
                        return func.call(thisArg, value, index, collection);
                    };
                case 4:
                    return function (accumulator, value, index, collection) {
                        return func.call(thisArg, accumulator, value, index, collection);
                    };
                case 5:
                    return function (value, other, key, object, source) {
                        return func.call(thisArg, value, other, key, object, source);
                    };
                }
                return function () {
                    return func.apply(thisArg, arguments);
                };
            }
            module.exports = bindCallback;
        },
        function (module, exports) {
            var bindCallback = _require(30), isIterateeCall = _require(33);
            function createAssigner(assigner) {
                return function () {
                    var length = arguments.length, object = arguments[0];
                    if (length < 2 || object == null) {
                        return object;
                    }
                    if (length > 3 && isIterateeCall(arguments[1], arguments[2], arguments[3])) {
                        length = 2;
                    }
                    if (length > 3 && typeof arguments[length - 2] == 'function') {
                        var customizer = bindCallback(arguments[--length - 1], arguments[length--], 5);
                    } else if (length > 2 && typeof arguments[length - 1] == 'function') {
                        customizer = arguments[--length];
                    }
                    var index = 0;
                    while (++index < length) {
                        var source = arguments[index];
                        if (source) {
                            assigner(object, source, customizer);
                        }
                    }
                    return object;
                };
            }
            module.exports = createAssigner;
        },
        function (module, exports) {
            var MAX_SAFE_INTEGER = Math.pow(2, 53) - 1;
            function isIndex(value, length) {
                value = +value;
                length = length == null ? MAX_SAFE_INTEGER : length;
                return value > -1 && value % 1 == 0 && value < length;
            }
            module.exports = isIndex;
        },
        function (module, exports) {
            var isIndex = _require(32), isLength = _require(34), isObject = _require(40);
            function isIterateeCall(value, index, object) {
                if (!isObject(object)) {
                    return false;
                }
                var type = typeof index;
                if (type == 'number') {
                    var length = object.length, prereq = isLength(length) && isIndex(index, length);
                } else {
                    prereq = type == 'string' && index in object;
                }
                var other = object[index];
                return prereq && (value === value ? value === other : other !== other);
            }
            module.exports = isIterateeCall;
        },
        function (module, exports) {
            var MAX_SAFE_INTEGER = Math.pow(2, 53) - 1;
            function isLength(value) {
                return typeof value == 'number' && value > -1 && value % 1 == 0 && value <= MAX_SAFE_INTEGER;
            }
            module.exports = isLength;
        },
        function (module, exports) {
            function isObjectLike(value) {
                return value && typeof value == 'object' || false;
            }
            module.exports = isObjectLike;
        },
        function (module, exports) {
            var isArguments = _require(37), isArray = _require(38), isIndex = _require(32), isLength = _require(34), keysIn = _require(45), support = _require(47);
            var objectProto = Object.prototype;
            var hasOwnProperty = objectProto.hasOwnProperty;
            function shimKeys(object) {
                var props = keysIn(object), propsLength = props.length, length = propsLength && object.length;
                var allowIndexes = length && isLength(length) && (isArray(object) || support.nonEnumArgs && isArguments(object));
                var index = -1, result = [];
                while (++index < propsLength) {
                    var key = props[index];
                    if (allowIndexes && isIndex(key, length) || hasOwnProperty.call(object, key)) {
                        result.push(key);
                    }
                }
                return result;
            }
            module.exports = shimKeys;
        },
        function (module, exports) {
            var isLength = _require(34), isObjectLike = _require(35);
            var argsTag = '[object Arguments]';
            var objectProto = Object.prototype;
            var objToString = objectProto.toString;
            function isArguments(value) {
                var length = isObjectLike(value) ? value.length : undefined;
                return isLength(length) && objToString.call(value) == argsTag || false;
            }
            module.exports = isArguments;
        },
        function (module, exports) {
            var isLength = _require(34), isNative = _require(39), isObjectLike = _require(35);
            var arrayTag = '[object Array]';
            var objectProto = Object.prototype;
            var objToString = objectProto.toString;
            var nativeIsArray = isNative(nativeIsArray = Array.isArray) && nativeIsArray;
            var isArray = nativeIsArray || function (value) {
                    return isObjectLike(value) && isLength(value.length) && objToString.call(value) == arrayTag || false;
                };
            module.exports = isArray;
        },
        function (module, exports) {
            var escapeRegExp = _require(46), isObjectLike = _require(35);
            var funcTag = '[object Function]';
            var reHostCtor = /^\[object .+?Constructor\]$/;
            var objectProto = Object.prototype;
            var fnToString = Function.prototype.toString;
            var objToString = objectProto.toString;
            var reNative = RegExp('^' + escapeRegExp(objToString).replace(/toString|(function).*?(?=\\\()| for .+?(?=\\\])/g, '$1.*?') + '$');
            function isNative(value) {
                if (value == null) {
                    return false;
                }
                if (objToString.call(value) == funcTag) {
                    return reNative.test(fnToString.call(value));
                }
                return isObjectLike(value) && reHostCtor.test(value) || false;
            }
            module.exports = isNative;
        },
        function (module, exports) {
            function isObject(value) {
                var type = typeof value;
                return type == 'function' || value && type == 'object' || false;
            }
            module.exports = isObject;
        },
        function (module, exports) {
            var baseAssign = _require(27), createAssigner = _require(31);
            var assign = createAssigner(baseAssign);
            module.exports = assign;
        },
        function (module, exports) {
            var arrayCopy = _require(25), assign = _require(41), assignDefaults = _require(26);
            function defaults(object) {
                if (object == null) {
                    return object;
                }
                var args = arrayCopy(arguments);
                args.push(assignDefaults);
                return assign.apply(undefined, args);
            }
            module.exports = defaults;
        },
        function (module, exports) {
            module.exports = _require(41);
        },
        function (module, exports) {
            var isLength = _require(34), isNative = _require(39), isObject = _require(40), shimKeys = _require(36);
            var nativeKeys = isNative(nativeKeys = Object.keys) && nativeKeys;
            var keys = !nativeKeys ? shimKeys : function (object) {
                    if (object) {
                        var Ctor = object.constructor, length = object.length;
                    }
                    if (typeof Ctor == 'function' && Ctor.prototype === object || typeof object != 'function' && (length && isLength(length))) {
                        return shimKeys(object);
                    }
                    return isObject(object) ? nativeKeys(object) : [];
                };
            module.exports = keys;
        },
        function (module, exports) {
            var isArguments = _require(37), isArray = _require(38), isIndex = _require(32), isLength = _require(34), isObject = _require(40), support = _require(47);
            var objectProto = Object.prototype;
            var hasOwnProperty = objectProto.hasOwnProperty;
            function keysIn(object) {
                if (object == null) {
                    return [];
                }
                if (!isObject(object)) {
                    object = Object(object);
                }
                var length = object.length;
                length = length && isLength(length) && (isArray(object) || support.nonEnumArgs && isArguments(object)) && length || 0;
                var Ctor = object.constructor, index = -1, isProto = typeof Ctor == 'function' && Ctor.prototype === object, result = Array(length), skipIndexes = length > 0;
                while (++index < length) {
                    result[index] = index + '';
                }
                for (var key in object) {
                    if (!(skipIndexes && isIndex(key, length)) && !(key == 'constructor' && (isProto || !hasOwnProperty.call(object, key)))) {
                        result.push(key);
                    }
                }
                return result;
            }
            module.exports = keysIn;
        },
        function (module, exports) {
            var baseToString = _require(29);
            var reRegExpChars = /[.*+?^${}()|[\]\/\\]/g, reHasRegExpChars = RegExp(reRegExpChars.source);
            function escapeRegExp(string) {
                string = baseToString(string);
                return string && reHasRegExpChars.test(string) ? string.replace(reRegExpChars, '\\$&') : string;
            }
            module.exports = escapeRegExp;
        },
        function (module, exports) {
            var isNative = _require(39);
            var reThis = /\bthis\b/;
            var objectProto = Object.prototype;
            var document = (document = global.window) && document.document;
            var propertyIsEnumerable = objectProto.propertyIsEnumerable;
            var support = {};
            (function (x) {
                support.funcDecomp = !isNative(global.WinRTError) && reThis.test(function () {
                    return this;
                });
                support.funcNames = typeof Function.name == 'string';
                try {
                    support.dom = document.createDocumentFragment().nodeType === 11;
                } catch (e) {
                    support.dom = false;
                }
                try {
                    support.nonEnumArgs = !propertyIsEnumerable.call(arguments, 1);
                } catch (e) {
                    support.nonEnumArgs = true;
                }
            }(0, 0));
            module.exports = support;
        },
        function (module, exports) {
            function identity(value) {
                return value;
            }
            module.exports = identity;
        }
    ];
    return _require(5);
}));
//# sourceMappingURL=futoin-invoker-lite.js.map