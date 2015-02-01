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
            var spectools = _require(7);
            var common = _require(3);
            var FutoInError = common.FutoInError;
            var simpleccm_impl = _require(6);
            exports = module.exports = function (options) {
                return new module.exports.AdvancedCCMImpl(options);
            };
            function AdvancedCCMImpl(options) {
                options = options || {};
                var spec_dirs = options.specDirs || [];
                if (!(spec_dirs instanceof Array)) {
                    spec_dirs = [spec_dirs];
                }
                options.specDirs = spec_dirs;
                simpleccm_impl.SimpleCCMImpl.call(this, options);
            }
            var SimpleCCMImplProt = simpleccm_impl.SimpleCCMImpl.prototype;
            AdvancedCCMImpl.prototype = {
                onRegister: function (as, info) {
                    spectools.loadIface(as, info, info.options.specDirs);
                    if (!info.options.prodMode) {
                        spectools.checkConsistency(as, info);
                    }
                },
                checkParams: function (as, ctx, params) {
                    var info = ctx.info;
                    var name = ctx.name;
                    var k;
                    if ('SecureChannel' in info.constraints && !info.secure_channel) {
                        as.error(FutoInError.SecurityError, 'Requires secure channel');
                    }
                    if (!('AllowAnonymous' in info.constraints) && !info.creds) {
                        as.error(FutoInError.SecurityError, 'Requires authenticated user');
                    }
                    if (!(name in info.funcs)) {
                        as.error(FutoInError.InvokerError, 'Unknown interface function: ' + name);
                    }
                    var finfo = info.funcs[name];
                    if (ctx.upload_data && !finfo.rawupload) {
                        as.error(FutoInError.InvokerError, 'Raw upload is not allowed');
                    }
                    if (!Object.keys(finfo.params).length && Object.keys(params).length) {
                        as.error(FutoInError.InvokerError, 'No params are defined');
                    }
                    for (k in params) {
                        if (!finfo.params.hasOwnProperty(k)) {
                            as.error(FutoInError.InvokerError, 'Unknown parameter: ' + k);
                        }
                        spectools.checkParameterType(as, info, name, k, params[k]);
                    }
                    for (k in finfo.params) {
                        if (!params.hasOwnProperty(k) && !finfo.params[k].hasOwnProperty('default')) {
                            as.error(FutoInError.InvokerError, 'Missing parameter ' + k);
                        }
                    }
                },
                createMessage: function (as, ctx, params) {
                    if (!ctx.info.options.prodMode) {
                        this.checkParams(as, ctx, params);
                    }
                    var info = ctx.info;
                    var req = {
                            f: info.iface + ':' + info.version + ':' + ctx.name,
                            p: params
                        };
                    if (info.creds !== null) {
                        if (info.creds === 'master') {
                        } else {
                            req.sec = info.creds;
                        }
                    }
                    ctx.expect_response = info.funcs[ctx.name].expect_result;
                    as.success(req);
                },
                onMessageResponse: function (as, ctx, rsp) {
                    var info = ctx.info;
                    var name = ctx.name;
                    var func_info = info.funcs[name];
                    if ('e' in rsp) {
                        var e = rsp.e;
                        if (e in func_info.throws || e in spectools.standard_errors) {
                            as.error(e, rsp.edesc);
                        } else {
                            as.error(FutoInError.InternalError, 'Not expected exception from Executor');
                        }
                    }
                    if (func_info.rawresult) {
                        as.error(FutoInError.InternalError, 'Raw result is expected');
                    }
                    if (info.creds === 'master') {
                    }
                    var resvars = func_info.result;
                    var rescount = Object.keys(resvars).length;
                    for (var k in rsp.r) {
                        if (resvars.hasOwnProperty(k)) {
                            spectools.checkResultType(as, info, name, k, rsp.r[k]);
                            --rescount;
                        }
                    }
                    if (rescount > 0) {
                        as.error(FutoInError.InternalError, 'Missing result variables');
                    }
                    as.success(rsp.r);
                },
                onDataResponse: function (as, ctx, rsp) {
                    if (ctx.info.funcs[ctx.name].rawresult) {
                        as.success(rsp);
                    } else {
                        as.error(FutoInError.InternalError, 'Raw result is not expected');
                    }
                },
                getComms: SimpleCCMImplProt.getComms,
                performCommon: SimpleCCMImplProt.performCommon,
                perfomHTTP: SimpleCCMImplProt.perfomHTTP,
                perfomWebSocket: SimpleCCMImplProt.perfomWebSocket,
                perfomUNIX: SimpleCCMImplProt.perfomUNIX,
                perfomBrowser: SimpleCCMImplProt.perfomBrowser
            };
            exports.AdvancedCCMImpl = AdvancedCCMImpl;
        },
        function (module, exports) {
            (function (window) {
                'use strict';
                var futoin = window.FutoIn || {};
                if (typeof futoin.Invoker === 'undefined') {
                    var FutoInInvoker = _require(4);
                    var SimpleCCM = FutoInInvoker.SimpleCCM;
                    window.SimpleCCM = SimpleCCM;
                    var AdvancedCCM = FutoInInvoker.AdvancedCCM;
                    window.AdvancedCCM = AdvancedCCM;
                    futoin.Invoker = FutoInInvoker;
                    window.FutoInInvoker = FutoInInvoker;
                    window.FutoIn = futoin;
                    if (module) {
                        module.exports = FutoInInvoker;
                    }
                }
            }(window));
        },
        function (module, exports) {
            'use strict';
            var ee = _require(9);
            var common = _require(3);
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
                            params.push(encodeURIComponent(k) + '=' + encodeURIComponent(req.p[k]));
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
                    if (ctx.expect_response) {
                        reqas[rid] = as;
                        as.setCancel(function () {
                            delete reqas[rid];
                        });
                    }
                    req.rid = rid;
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
                        if (ctx.expect_response) {
                            reqas[rid] = as;
                            as.setCancel(function (as) {
                                void as;
                                delete reqas[rid];
                            });
                        }
                        req.rid = rid;
                        _this.sniffer(ctx.info, req, false);
                        _this.target.postMessage(req, _this.opts.targetOrigin || '*');
                    });
                }
            };
        },
        function (module, exports) {
            'use strict';
            var async_steps = _require(24);
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
            'use strict';
            var common = _require(3);
            var futoin_error = common.FutoInError;
            var native_iface = _require(5);
            var _extend = _require(63);
            var _defaults = _require(62);
            var simple_ccm = _require(6);
            var advanced_ccm = _require(0);
            var spectools = _require(7);
            var ee = _require(9);
            var SimpleCCMPublic = common.Options;
            function SimpleCCM(options) {
                ee(this);
                this._iface_info = {};
                this._iface_impl = {};
                this._impl = simple_ccm(options);
                _extend(this, SimpleCCMProto);
            }
            _extend(SimpleCCM, SimpleCCMPublic);
            var SimpleCCMProto = {
                    _secure_replace: /^secure\+/,
                    _secure_test: /^(https|wss|unix):\/\//,
                    _native_iface_builder: function (ccmimpl, info) {
                        return native_iface(ccmimpl, info);
                    }
                };
            _extend(SimpleCCMProto, SimpleCCMPublic);
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
                if (name) {
                    this._iface_info[name] = info;
                }
                var _this = this;
                as.add(function (as) {
                    _this._impl.onRegister(as, info);
                    as.add(function (as) {
                        if ('SecureChannel' in info.constraints && !secure_channel) {
                            as.error(futoin_error.SecurityError, 'SecureChannel is required');
                        }
                        if ('BiDirectChannel' in info.constraints && !is_bidirect) {
                            as.error(futoin_error.InvokerError, 'BiDirectChannel is required');
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
            function AdvancedCCM(options) {
                ee(this);
                this._iface_info = {};
                this._iface_impl = {};
                this._impl = advanced_ccm(options);
                _extend(this, AdvancedCCMProto);
            }
            _extend(AdvancedCCM, SimpleCCMPublic);
            var AdvancedCCMProto = {};
            _extend(AdvancedCCMProto, SimpleCCMProto);
            AdvancedCCMProto.initFromCache = function (as, cache_l1_endpoint) {
                void cache_l1_endpoint;
                as.error(futoin_error.NotImplemented, 'Caching is not supported yet');
            };
            AdvancedCCMProto.cacheInit = function (as) {
                void as;
            };
            exports.SimpleCCM = SimpleCCM;
            exports.AdvancedCCM = AdvancedCCM;
            exports.FutoInError = futoin_error;
            exports.NativeIface = native_iface.NativeIface;
            exports.InterfaceInfo = native_iface.InterfaceInfo;
            exports.SpecTools = spectools;
            exports.SpecTools._ifacever_pattern = common._ifacever_pattern;
        },
        function (module, exports) {
            'use strict';
            var common = _require(3);
            var futoin_error = common.FutoInError;
            var _extend = _require(63);
            var _zipObject = _require(26);
            var ee = _require(9);
            var async_steps = _require(24);
            var FUTOIN_CONTENT_TYPE = common.Options.FUTOIN_CONTENT_TYPE;
            exports = module.exports = function (ccmimpl, info) {
                return new module.exports.NativeIface(ccmimpl, info);
            };
            function InterfaceInfo(raw_info) {
                this._raw_info = raw_info;
            }
            InterfaceInfo.prototype = {
                name: function () {
                    return this._raw_info.iface;
                },
                version: function () {
                    return this._raw_info.version;
                },
                inherits: function () {
                    return this._raw_info.inherits;
                },
                funcs: function () {
                    return this._raw_info.funcs;
                },
                constraints: function () {
                    return this._raw_info.constraints;
                }
            };
            exports.InterfaceInfo = InterfaceInfo;
            function NativeIface(ccmimpl, info) {
                this._ccmimpl = ccmimpl;
                this._raw_info = info;
                this._iface_info = null;
                this._comms = {};
                _extend(this, NativeIfaceProto);
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
            var NativeIfaceProto = {
                    call: function (as, name, params, upload_data, download_stream, timeout) {
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
                                expect_response: true
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
                    },
                    _member_call_intercept: function (as, name, finfo, args) {
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
                    },
                    _member_call_generate: function (name, finfo) {
                        return function (as) {
                            this._member_call_intercept(as, name, finfo, Array.prototype.slice.call(arguments, 1));
                        };
                    },
                    ifaceInfo: function () {
                        if (!this._iface_info) {
                            this._iface_info = new InterfaceInfo(this._raw_info);
                        }
                        return this._iface_info;
                    },
                    bindDerivedKey: function (as) {
                        void as;
                        throw new Error(futoin_error.InvokerError, 'Not Implemented');
                    },
                    _close: function () {
                        var comms = this._comms;
                        for (var k in comms) {
                            comms[k].close();
                        }
                        this.emit('close');
                    }
                };
            exports.NativeIface = NativeIface;
        },
        function (module, exports) {
            'use strict';
            var common = _require(3);
            var FutoInError = common.FutoInError;
            var isNode = _require(8);
            var _defaults = _require(62);
            var comms_impl;
            if (isNode) {
                var hidereq = require;
                comms_impl = hidereq('./node_comms');
            } else {
                comms_impl = _require(2);
            }
            exports = module.exports = function (options) {
                return new module.exports.SimpleCCMImpl(options);
            };
            var defopts = {
                    callTimeoutMS: 30000,
                    prodMode: false,
                    commConfigCallback: null,
                    retryCount: 1,
                    messageSniffer: function () {
                    },
                    disconnectSniffer: function () {
                    }
                };
            function SimpleCCMImpl(options) {
                options = options || {};
                _defaults(options, defopts);
                this.options = options;
                this.comms = {};
            }
            SimpleCCMImpl.prototype = {
                onRegister: function (as, info) {
                    info.funcs = {};
                    info.inherits = [];
                    info.constraints = {};
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
                    as.repeat(ctx.options.retryCount + 1, function (as) {
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
                                as.continue();
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
            exports.SimpleCCMImpl = SimpleCCMImpl;
        },
        function (module, exports) {
            'use strict';
            var common = _require(3);
            var FutoInError = common.FutoInError;
            var fs;
            var request;
            var isNode = _require(8);
            var _cloneDeep = _require(56);
            var _zipObject = _require(26);
            var _difference = _require(25);
            if (isNode) {
                var hidereq = require;
                fs = hidereq('fs');
                request = hidereq('request');
            }
            var spectools = {
                    standard_errors: {
                        UnknownInterface: true,
                        NotSupportedVersion: true,
                        NotImplemented: true,
                        Unauthorized: true,
                        InternalError: true,
                        InvalidRequest: true,
                        DefenseRejected: true,
                        PleaseReauth: true,
                        SecurityError: true
                    },
                    _ver_pattern: /^([0-9]+)\.([0-9]+)$/,
                    loadIface: function (as, info, specdirs) {
                        var raw_spec = null;
                        as.forEach(specdirs, function (as, k, v) {
                            var fn = info.iface + '-' + info.version + '-iface.json';
                            as.add(function (read_as) {
                                if (typeof v !== 'string' || !isNode) {
                                    return;
                                }
                                var uri = v + '/' + fn;
                                var on_read = function (data) {
                                    if (!read_as) {
                                        return;
                                    }
                                    try {
                                        v = JSON.parse(data);
                                        v._just_loaded = true;
                                        read_as.success();
                                        return;
                                    } catch (e) {
                                    }
                                    try {
                                        read_as.continue();
                                    } catch (e) {
                                    }
                                };
                                if (uri.substr(0, 4) === 'http') {
                                    request(uri, function (error, response, body) {
                                        on_read(body);
                                    });
                                } else {
                                    fs.readFile(uri, { encoding: 'utf8' }, function (err, data) {
                                        on_read(data);
                                    });
                                }
                                read_as.setCancel(function (as) {
                                    void as;
                                    read_as = null;
                                });
                            }).add(function (as) {
                                if (typeof v !== 'string' || isNode) {
                                    return;
                                }
                                var uri = v + '/' + fn;
                                var httpreq = new XMLHttpRequest();
                                httpreq.onreadystatechange = function () {
                                    if (this.readyState !== this.DONE) {
                                        return;
                                    }
                                    var response = this.responseText;
                                    if (response) {
                                        try {
                                            v = JSON.parse(response);
                                            v._just_loaded = true;
                                            as.success();
                                            return;
                                        } catch (e) {
                                        }
                                    }
                                    try {
                                        as.continue();
                                    } catch (ex) {
                                    }
                                };
                                httpreq.open('GET', uri, true);
                                httpreq.send();
                                as.setCancel(function (as) {
                                    void as;
                                    httpreq.abort();
                                });
                            }).add(function (as) {
                                if (typeof v === 'object' && v.iface === info.iface && v.version === info.version) {
                                    raw_spec = v;
                                    as.break();
                                }
                            });
                        }).add(function (as) {
                            if (raw_spec === null) {
                                as.error(FutoInError.InternalError, 'Failed to load valid spec for ' + info.iface + ':' + info.version);
                            }
                            spectools.parseIface(as, info, specdirs, raw_spec);
                        });
                    },
                    parseIface: function (as, info, specdirs, raw_spec) {
                        if (raw_spec._just_loaded) {
                            info.funcs = raw_spec.funcs || {};
                            info.types = raw_spec.types || {};
                        } else {
                            info.funcs = _cloneDeep(raw_spec.funcs || {});
                            info.types = _cloneDeep(raw_spec.types || {});
                        }
                        spectools._parseFuncs(as, info);
                        spectools._parseTypes(as, info);
                        if ('requires' in raw_spec) {
                            var requires = raw_spec.requires;
                            if (!Array.isArray(requires)) {
                                as.error(FutoInError.InternalError, '"requires" is not array');
                            }
                            info.constraints = _zipObject(requires, requires);
                        } else {
                            info.constraints = {};
                        }
                        spectools._checkFTN3Rev(as, info, raw_spec);
                        info.inherits = [];
                        if ('inherit' in raw_spec) {
                            var m = raw_spec.inherit.match(common._ifacever_pattern);
                            if (m === null) {
                                as.error(FutoInError.InvokerError, 'Invalid inherit ifacever: ' + raw_spec.inherit);
                            }
                            var sup_info = {};
                            sup_info.iface = m[1];
                            sup_info.version = m[4];
                            spectools.loadIface(as, sup_info, specdirs);
                            as.add(function (as) {
                                spectools._parseImportInherit(as, info, specdirs, raw_spec, sup_info);
                                info.inherits.push(raw_spec.inherit);
                                info.inherits = info.inherits.concat(sup_info.inherits);
                            });
                        }
                        if ('imports' in raw_spec) {
                            info.imports = raw_spec.imports.slice();
                            as.forEach(raw_spec.imports, function (as, k, v) {
                                var m = v.match(common._ifacever_pattern);
                                if (m === null) {
                                    as.error(FutoInError.InvokerError, 'Invalid import ifacever: ' + v);
                                }
                                var imp_info = {};
                                imp_info.iface = m[1];
                                imp_info.version = m[4];
                                spectools.loadIface(as, imp_info, specdirs);
                                as.add(function (as) {
                                    spectools._parseImportInherit(as, info, specdirs, raw_spec, imp_info);
                                    info.imports = info.imports.concat(imp_info.imports);
                                });
                            });
                        } else {
                            info.imports = [];
                        }
                    },
                    _checkFTN3Rev: function (as, info, raw_spec) {
                        var ftn3rev = raw_spec.ftn3rev || '1.0';
                        var rv = ftn3rev.match(spectools._ver_pattern);
                        if (rv === null) {
                            as.error(FutoInError.InternalError, 'Invalid ftn3rev field');
                        }
                        var mjr = parseInt(rv[1]);
                        var mnr = parseInt(rv[2]);
                        if (mjr === 1) {
                            if (mnr < 1) {
                                if (raw_spec.imports || raw_spec.types || 'BiDirectChannel' in info.constraints) {
                                    as.error(FutoInError.InternalError, 'Missing ftn3rev field when FTN3 v1.1 features are used');
                                }
                            }
                            if (mnr < 2) {
                            }
                            if (!info._invoker_use && mnr > 1) {
                                as.error(FutoInError.InternalError, 'Not supported FTN3 revision for Executor');
                            }
                        } else {
                            as.error(FutoInError.InternalError, 'Not supported FTN3 revision');
                        }
                    },
                    _parseFuncs: function (as, info) {
                        var finfo;
                        var pn;
                        for (var f in info.funcs) {
                            finfo = info.funcs[f];
                            finfo.min_args = 0;
                            if ('params' in finfo) {
                                var fparams = finfo.params;
                                if (typeof fparams !== 'object') {
                                    as.error(FutoInError.InternalError, 'Invalid params object');
                                }
                                for (pn in fparams) {
                                    var pinfo = fparams[pn];
                                    if (typeof pinfo !== 'object') {
                                        as.error(FutoInError.InternalError, 'Invalid param object');
                                    }
                                    if (!('type' in pinfo)) {
                                        as.error(FutoInError.InternalError, 'Missing type for params');
                                    }
                                    if (!('default' in pinfo)) {
                                        finfo.min_args += 1;
                                    }
                                }
                            } else {
                                finfo.params = {};
                            }
                            finfo.expect_result = false;
                            if ('result' in finfo) {
                                var fresult = finfo.result;
                                if (typeof fresult !== 'object') {
                                    as.error(FutoInError.InternalError, 'Invalid result object');
                                }
                                for (var rn in fresult) {
                                    var rinfo = fresult[rn];
                                    if (typeof rinfo !== 'object') {
                                        as.error(FutoInError.InternalError, 'Invalid resultvar object');
                                    }
                                    if (!('type' in rinfo)) {
                                        as.error(FutoInError.InternalError, 'Missing type for result');
                                    }
                                    finfo.expect_result = true;
                                }
                            } else {
                                finfo.result = {};
                            }
                            if (!('rawupload' in finfo)) {
                                finfo.rawupload = false;
                            }
                            if (!('rawresult' in finfo)) {
                                finfo.rawresult = false;
                            }
                            if (finfo.rawresult) {
                                finfo.expect_result = true;
                            }
                            if ('throws' in finfo) {
                                if (!finfo.expect_result) {
                                    as.error(FutoInError.InternalError, '"throws" without result');
                                }
                                var throws = finfo.throws;
                                if (!Array.isArray(throws)) {
                                    as.error(FutoInError.InternalError, '"throws" is not array');
                                }
                                finfo.throws = _zipObject(throws, throws);
                            } else {
                                finfo.throws = {};
                            }
                        }
                    },
                    _parseTypes: function (as, info) {
                        var tinfo;
                        for (var t in info.types) {
                            tinfo = info.types[t];
                            if (!('type' in tinfo)) {
                                as.error(FutoInError.InternalError, 'Missing "type" for custom type');
                            }
                            if (tinfo.type === 'map') {
                                if (!('fields' in tinfo)) {
                                    tinfo.fields = {};
                                    continue;
                                }
                                for (var f in tinfo.fields) {
                                    if (!('type' in tinfo.fields[f])) {
                                        as.error(FutoInError.InternalError, 'Missing "type" for custom type field');
                                    }
                                }
                            }
                        }
                    },
                    _parseImportInherit: function (as, info, specdirs, raw_spec, sup_info) {
                        var i;
                        var pn;
                        for (var t in sup_info.types) {
                            if (t in info.types) {
                                as.error(FutoInError.InternalError, 'Iface type redifintion: ' + t);
                                continue;
                            }
                            info.types[t] = sup_info.types[t];
                        }
                        for (var f in sup_info.funcs) {
                            var fdef = sup_info.funcs[f];
                            if (!(f in info.funcs)) {
                                info.funcs[f] = fdef;
                                continue;
                            }
                            var sup_params = fdef.params;
                            var params = info.funcs[f].params;
                            var sup_params_keys = Object.keys(sup_params);
                            var params_keys = Object.keys(params);
                            if (params_keys.length < sup_params_keys.length) {
                                as.error(FutoInError.InternalError, 'Invalid param count for \'' + f + '\'');
                            }
                            for (i = 0; i < sup_params_keys.length; ++i) {
                                pn = sup_params_keys[i];
                                if (pn !== params_keys[i]) {
                                    as.error(FutoInError.InternalError, 'Invalid param order for \'' + f + '/' + pn + '\'');
                                }
                                if (sup_params[pn].type !== params[pn].type) {
                                    as.error(FutoInError.InternalError, 'Param type mismatch \'' + f + '/' + pn + '\'');
                                }
                            }
                            for (; i < params_keys.length; ++i) {
                                pn = params_keys[i];
                                if (!(pn in sup_params) && !('default' in params[pn] || params[pn] === null)) {
                                    as.error(FutoInError.InternalError, 'Missing default for \'' + f + '/' + pn + '\'');
                                }
                            }
                            if (fdef.rawresult !== info.funcs[f].rawresult) {
                                as.error(FutoInError.InternalError, '\'rawresult\' flag mismatch for \'' + f + '\'');
                            }
                            if (fdef.rawupload && !info.funcs[f].rawupload) {
                                as.error(FutoInError.InternalError, '\'rawupload\' flag is missing for \'' + f + '\'');
                            }
                        }
                        if (_difference(Object.keys(sup_info.constraints), raw_spec.requires).length) {
                            as.error(FutoInError.InternalError, 'Missing constraints from inherited');
                        }
                    },
                    checkConsistency: function (as, info) {
                        void as;
                        void info;
                    },
                    checkType: function (info, type, val, _type_stack) {
                        if (val === null) {
                            return false;
                        }
                        switch (type) {
                        case 'any':
                            return true;
                        case 'boolean':
                        case 'string':
                        case 'number':
                            return typeof val === type;
                        case 'map':
                            return typeof val === 'object' && !(val instanceof Array);
                        case 'integer':
                            return typeof val === 'number' && (val | 0) === val;
                        case 'array':
                            return val instanceof Array;
                        default:
                            if (!('types' in info) || !(type in info.types)) {
                                return false;
                            }
                        }
                        if (type in info.types) {
                            var tdef = info.types[type];
                            _type_stack = _type_stack || {};
                            var base_type = tdef.type;
                            if (base_type in _type_stack) {
                                if (console) {
                                    console.log('[ERROR] Custom type recursion: ' + tdef);
                                }
                                throw new Error(FutoInError.InternalError);
                            }
                            _type_stack[type] = true;
                            if (!this.checkType(info, base_type, val, _type_stack)) {
                                return false;
                            }
                            switch (base_type) {
                            case 'integer':
                            case 'number':
                                if ('min' in tdef && val < tdef.min) {
                                    return false;
                                }
                                if ('max' in tdef && val > tdef.max) {
                                    return false;
                                }
                                return true;
                            case 'string':
                                if ('regex' in tdef) {
                                    var comp_regex;
                                    if ('_comp_regex' in info) {
                                        comp_regex = info._comp_regex;
                                    } else {
                                        comp_regex = {};
                                        info._comp_regex = comp_regex;
                                    }
                                    if (!(type in comp_regex)) {
                                        comp_regex[type] = new RegExp(tdef.regex);
                                    }
                                    return val.match(comp_regex[type]) !== null;
                                }
                                return true;
                            case 'array':
                                var val_len = val.length;
                                if ('minlen' in tdef && val_len < tdef.minlen) {
                                    return false;
                                }
                                if ('maxlen' in tdef && val_len > tdef.maxlen) {
                                    return false;
                                }
                                if ('elemtype' in tdef) {
                                    var elemtype = tdef.elemtype;
                                    for (var i = 0; i < val_len; ++i) {
                                        if (!this.checkType(info, elemtype, val[i], [])) {
                                            return false;
                                        }
                                    }
                                }
                                return true;
                            case 'map':
                                var fields = tdef.fields;
                                for (var f in fields) {
                                    var field_def = fields[f];
                                    if (!(f in val) || val[f] === null) {
                                        if (field_def.optional) {
                                            val[f] = null;
                                            return true;
                                        }
                                        return false;
                                    }
                                    if (!this.checkType(info, field_def.type, val[f], [])) {
                                        return false;
                                    }
                                }
                                return true;
                            }
                        }
                        return false;
                    },
                    checkParameterType: function (as, info, funcname, varname, value) {
                        if (!spectools.checkType(info, info.funcs[funcname].params[varname].type, value)) {
                            as.error(FutoInError.InvalidRequest, 'Type mismatch for parameter: ' + varname);
                        }
                    },
                    checkResultType: function (as, info, funcname, varname, value) {
                        if (!spectools.checkType(info, info.funcs[funcname].result[varname].type, value)) {
                            as.error(FutoInError.InvalidRequest, 'Type mismatch for result: ' + varname);
                        }
                    },
                    checkFutoInType: function (as, type, varname, value) {
                        if (!spectools.checkType({}, type, value)) {
                            as.error(FutoInError.InvalidRequest, 'Type mismatch for parameter: ' + varname);
                        }
                    }
                };
            module.exports = spectools;
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
            var d = _require(10), callable = _require(19), apply = Function.prototype.apply, call = Function.prototype.call, create = Object.create, defineProperty = Object.defineProperty, defineProperties = Object.defineProperties, hasOwnProperty = Object.prototype.hasOwnProperty, descriptor = {
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
            var assign = _require(11), normalizeOpts = _require(18), isCallable = _require(14), contains = _require(21), d;
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
            module.exports = _require(12)() ? Object.assign : _require(13);
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
            var keys = _require(15), value = _require(20), max = Math.max;
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
            module.exports = _require(16)() ? Object.keys : _require(17);
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
            var assign = _require(11), forEach = Array.prototype.forEach, create = Object.create, getPrototypeOf = Object.getPrototypeOf, process;
            process = function (src, obj) {
                var proto = getPrototypeOf(src);
                return assign(proto ? process(proto, obj) : obj, src);
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
            module.exports = _require(22)() ? String.prototype.contains : _require(23);
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
            var baseDifference = _require(34), baseFlatten = _require(35), isArguments = _require(57), isArray = _require(58);
            function difference() {
                var index = -1, length = arguments.length;
                while (++index < length) {
                    var value = arguments[index];
                    if (isArray(value) || isArguments(value)) {
                        break;
                    }
                }
                return baseDifference(value, baseFlatten(arguments, false, true, ++index));
            }
            module.exports = difference;
        },
        function (module, exports) {
            var isArray = _require(58);
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
            var cachePush = _require(43), isNative = _require(59);
            var Set = isNative(Set = global.Set) && Set;
            var nativeCreate = isNative(nativeCreate = Object.create) && nativeCreate;
            function SetCache(values) {
                var length = values ? values.length : 0;
                this.data = {
                    'hash': nativeCreate(null),
                    'set': new Set()
                };
                while (length--) {
                    this.push(values[length]);
                }
            }
            SetCache.prototype.push = cachePush;
            module.exports = SetCache;
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
            function arrayEach(array, iteratee) {
                var index = -1, length = array.length;
                while (++index < length) {
                    if (iteratee(array[index], index, array) === false) {
                        break;
                    }
                }
                return array;
            }
            module.exports = arrayEach;
        },
        function (module, exports) {
            function assignDefaults(objectValue, sourceValue) {
                return typeof objectValue == 'undefined' ? sourceValue : objectValue;
            }
            module.exports = assignDefaults;
        },
        function (module, exports) {
            var baseCopy = _require(33), keys = _require(64);
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
            var arrayCopy = _require(28), arrayEach = _require(29), baseCopy = _require(33), baseForOwn = _require(37), initCloneArray = _require(47), initCloneByTag = _require(48), initCloneObject = _require(49), isArray = _require(58), isObject = _require(60), keys = _require(64);
            var argsTag = '[object Arguments]', arrayTag = '[object Array]', boolTag = '[object Boolean]', dateTag = '[object Date]', errorTag = '[object Error]', funcTag = '[object Function]', mapTag = '[object Map]', numberTag = '[object Number]', objectTag = '[object Object]', regexpTag = '[object RegExp]', setTag = '[object Set]', stringTag = '[object String]', weakMapTag = '[object WeakMap]';
            var arrayBufferTag = '[object ArrayBuffer]', float32Tag = '[object Float32Array]', float64Tag = '[object Float64Array]', int8Tag = '[object Int8Array]', int16Tag = '[object Int16Array]', int32Tag = '[object Int32Array]', uint8Tag = '[object Uint8Array]', uint8ClampedTag = '[object Uint8ClampedArray]', uint16Tag = '[object Uint16Array]', uint32Tag = '[object Uint32Array]';
            var cloneableTags = {};
            cloneableTags[argsTag] = cloneableTags[arrayTag] = cloneableTags[arrayBufferTag] = cloneableTags[boolTag] = cloneableTags[dateTag] = cloneableTags[float32Tag] = cloneableTags[float64Tag] = cloneableTags[int8Tag] = cloneableTags[int16Tag] = cloneableTags[int32Tag] = cloneableTags[numberTag] = cloneableTags[objectTag] = cloneableTags[regexpTag] = cloneableTags[stringTag] = cloneableTags[uint8Tag] = cloneableTags[uint8ClampedTag] = cloneableTags[uint16Tag] = cloneableTags[uint32Tag] = true;
            cloneableTags[errorTag] = cloneableTags[funcTag] = cloneableTags[mapTag] = cloneableTags[setTag] = cloneableTags[weakMapTag] = false;
            var objectProto = Object.prototype;
            var objToString = objectProto.toString;
            function baseClone(value, isDeep, customizer, key, object, stackA, stackB) {
                var result;
                if (customizer) {
                    result = object ? customizer(value, key, object) : customizer(value);
                }
                if (typeof result != 'undefined') {
                    return result;
                }
                if (!isObject(value)) {
                    return value;
                }
                var isArr = isArray(value);
                if (isArr) {
                    result = initCloneArray(value);
                    if (!isDeep) {
                        return arrayCopy(value, result);
                    }
                } else {
                    var tag = objToString.call(value), isFunc = tag == funcTag;
                    if (tag == objectTag || tag == argsTag || isFunc && !object) {
                        result = initCloneObject(isFunc ? {} : value);
                        if (!isDeep) {
                            return baseCopy(value, result, keys(value));
                        }
                    } else {
                        return cloneableTags[tag] ? initCloneByTag(value, tag, isDeep) : object ? value : {};
                    }
                }
                stackA || (stackA = []);
                stackB || (stackB = []);
                var length = stackA.length;
                while (length--) {
                    if (stackA[length] == value) {
                        return stackB[length];
                    }
                }
                stackA.push(value);
                stackB.push(result);
                (isArr ? arrayEach : baseForOwn)(value, function (subValue, key) {
                    result[key] = baseClone(subValue, isDeep, customizer, key, value, stackA, stackB);
                });
                return result;
            }
            module.exports = baseClone;
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
            var baseIndexOf = _require(38), cacheIndexOf = _require(42), createCache = _require(45);
            function baseDifference(array, values) {
                var length = array ? array.length : 0, result = [];
                if (!length) {
                    return result;
                }
                var index = -1, indexOf = baseIndexOf, isCommon = true, cache = isCommon && values.length >= 200 && createCache(values), valuesLength = values.length;
                if (cache) {
                    indexOf = cacheIndexOf;
                    isCommon = false;
                    values = cache;
                }
                outer:
                    while (++index < length) {
                        var value = array[index];
                        if (isCommon && value === value) {
                            var valuesIndex = valuesLength;
                            while (valuesIndex--) {
                                if (values[valuesIndex] === value) {
                                    continue outer;
                                }
                            }
                            result.push(value);
                        } else if (indexOf(values, value) < 0) {
                            result.push(value);
                        }
                    }
                return result;
            }
            module.exports = baseDifference;
        },
        function (module, exports) {
            var isArguments = _require(57), isArray = _require(58), isLength = _require(52), isObjectLike = _require(53);
            function baseFlatten(array, isDeep, isStrict, fromIndex) {
                var index = (fromIndex || 0) - 1, length = array.length, resIndex = -1, result = [];
                while (++index < length) {
                    var value = array[index];
                    if (isObjectLike(value) && isLength(value.length) && (isArray(value) || isArguments(value))) {
                        if (isDeep) {
                            value = baseFlatten(value, isDeep, isStrict);
                        }
                        var valIndex = -1, valLength = value.length;
                        result.length += valLength;
                        while (++valIndex < valLength) {
                            result[++resIndex] = value[valIndex];
                        }
                    } else if (!isStrict) {
                        result[++resIndex] = value;
                    }
                }
                return result;
            }
            module.exports = baseFlatten;
        },
        function (module, exports) {
            var toObject = _require(55);
            function baseFor(object, iteratee, keysFunc) {
                var index = -1, iterable = toObject(object), props = keysFunc(object), length = props.length;
                while (++index < length) {
                    var key = props[index];
                    if (iteratee(iterable[key], key, iterable) === false) {
                        break;
                    }
                }
                return object;
            }
            module.exports = baseFor;
        },
        function (module, exports) {
            var baseFor = _require(36), keys = _require(64);
            function baseForOwn(object, iteratee) {
                return baseFor(object, iteratee, keys);
            }
            module.exports = baseForOwn;
        },
        function (module, exports) {
            var indexOfNaN = _require(46);
            function baseIndexOf(array, value, fromIndex) {
                if (value !== value) {
                    return indexOfNaN(array, fromIndex);
                }
                var index = (fromIndex || 0) - 1, length = array.length;
                while (++index < length) {
                    if (array[index] === value) {
                        return index;
                    }
                }
                return -1;
            }
            module.exports = baseIndexOf;
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
            var identity = _require(69);
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
            var constant = _require(68), isNative = _require(59);
            var ArrayBuffer = isNative(ArrayBuffer = global.ArrayBuffer) && ArrayBuffer, bufferSlice = isNative(bufferSlice = ArrayBuffer && new ArrayBuffer(0).slice) && bufferSlice, floor = Math.floor, Uint8Array = isNative(Uint8Array = global.Uint8Array) && Uint8Array;
            var Float64Array = function () {
                    try {
                        var func = isNative(func = global.Float64Array) && func, result = new func(new ArrayBuffer(10), 0, 1) && func;
                    } catch (e) {
                    }
                    return result;
                }();
            var FLOAT64_BYTES_PER_ELEMENT = Float64Array ? Float64Array.BYTES_PER_ELEMENT : 0;
            function bufferClone(buffer) {
                return bufferSlice.call(buffer, 0);
            }
            if (!bufferSlice) {
                bufferClone = !(ArrayBuffer && Uint8Array) ? constant(null) : function (buffer) {
                    var byteLength = buffer.byteLength, floatLength = Float64Array ? floor(byteLength / FLOAT64_BYTES_PER_ELEMENT) : 0, offset = floatLength * FLOAT64_BYTES_PER_ELEMENT, result = new ArrayBuffer(byteLength);
                    if (floatLength) {
                        var view = new Float64Array(result, 0, floatLength);
                        view.set(new Float64Array(buffer, 0, floatLength));
                    }
                    if (byteLength != offset) {
                        view = new Uint8Array(result, offset);
                        view.set(new Uint8Array(buffer, offset));
                    }
                    return result;
                };
            }
            module.exports = bufferClone;
        },
        function (module, exports) {
            var isObject = _require(60);
            function cacheIndexOf(cache, value) {
                var data = cache.data, result = typeof value == 'string' || isObject(value) ? data.set.has(value) : data.hash[value];
                return result ? 0 : -1;
            }
            module.exports = cacheIndexOf;
        },
        function (module, exports) {
            var isObject = _require(60);
            function cachePush(value) {
                var data = this.data;
                if (typeof value == 'string' || isObject(value)) {
                    data.set.add(value);
                } else {
                    data.hash[value] = true;
                }
            }
            module.exports = cachePush;
        },
        function (module, exports) {
            var bindCallback = _require(40), isIterateeCall = _require(51);
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
            var SetCache = _require(27), constant = _require(68), isNative = _require(59);
            var Set = isNative(Set = global.Set) && Set;
            var nativeCreate = isNative(nativeCreate = Object.create) && nativeCreate;
            var createCache = !(nativeCreate && Set) ? constant(null) : function (values) {
                    return new SetCache(values);
                };
            module.exports = createCache;
        },
        function (module, exports) {
            function indexOfNaN(array, fromIndex, fromRight) {
                var length = array.length, index = fromRight ? fromIndex || length : (fromIndex || 0) - 1;
                while (fromRight ? index-- : ++index < length) {
                    var other = array[index];
                    if (other !== other) {
                        return index;
                    }
                }
                return -1;
            }
            module.exports = indexOfNaN;
        },
        function (module, exports) {
            var objectProto = Object.prototype;
            var hasOwnProperty = objectProto.hasOwnProperty;
            function initCloneArray(array) {
                var length = array.length, result = new array.constructor(length);
                if (length && typeof array[0] == 'string' && hasOwnProperty.call(array, 'index')) {
                    result.index = array.index;
                    result.input = array.input;
                }
                return result;
            }
            module.exports = initCloneArray;
        },
        function (module, exports) {
            var bufferClone = _require(41);
            var boolTag = '[object Boolean]', dateTag = '[object Date]', numberTag = '[object Number]', regexpTag = '[object RegExp]', stringTag = '[object String]';
            var arrayBufferTag = '[object ArrayBuffer]', float32Tag = '[object Float32Array]', float64Tag = '[object Float64Array]', int8Tag = '[object Int8Array]', int16Tag = '[object Int16Array]', int32Tag = '[object Int32Array]', uint8Tag = '[object Uint8Array]', uint8ClampedTag = '[object Uint8ClampedArray]', uint16Tag = '[object Uint16Array]', uint32Tag = '[object Uint32Array]';
            var reFlags = /\w*$/;
            function initCloneByTag(object, tag, isDeep) {
                var Ctor = object.constructor;
                switch (tag) {
                case arrayBufferTag:
                    return bufferClone(object);
                case boolTag:
                case dateTag:
                    return new Ctor(+object);
                case float32Tag:
                case float64Tag:
                case int8Tag:
                case int16Tag:
                case int32Tag:
                case uint8Tag:
                case uint8ClampedTag:
                case uint16Tag:
                case uint32Tag:
                    var buffer = object.buffer;
                    return new Ctor(isDeep ? bufferClone(buffer) : buffer, object.byteOffset, object.length);
                case numberTag:
                case stringTag:
                    return new Ctor(object);
                case regexpTag:
                    var result = new Ctor(object.source, reFlags.exec(object));
                    result.lastIndex = object.lastIndex;
                }
                return result;
            }
            module.exports = initCloneByTag;
        },
        function (module, exports) {
            function initCloneObject(object) {
                var Ctor = object.constructor;
                if (!(typeof Ctor == 'function' && Ctor instanceof Ctor)) {
                    Ctor = Object;
                }
                return new Ctor();
            }
            module.exports = initCloneObject;
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
            var isIndex = _require(50), isLength = _require(52), isObject = _require(60);
            function isIterateeCall(value, index, object) {
                if (!isObject(object)) {
                    return false;
                }
                var type = typeof index;
                if (type == 'number') {
                    var length = object.length, prereq = isLength(length) && isIndex(index, length);
                } else {
                    prereq = type == 'string' && index in value;
                }
                return prereq && object[index] === value;
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
            var isArguments = _require(57), isArray = _require(58), isIndex = _require(50), isLength = _require(52), keysIn = _require(65), support = _require(67);
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
            var isObject = _require(60);
            function toObject(value) {
                return isObject(value) ? value : Object(value);
            }
            module.exports = toObject;
        },
        function (module, exports) {
            var baseClone = _require(32), bindCallback = _require(40);
            function cloneDeep(value, customizer, thisArg) {
                customizer = typeof customizer == 'function' && bindCallback(customizer, thisArg, 1);
                return baseClone(value, true, customizer);
            }
            module.exports = cloneDeep;
        },
        function (module, exports) {
            var isLength = _require(52), isObjectLike = _require(53);
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
            var isLength = _require(52), isNative = _require(59), isObjectLike = _require(53);
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
            var escapeRegExp = _require(66), isObjectLike = _require(53);
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
            var baseAssign = _require(31), createAssigner = _require(44);
            var assign = createAssigner(baseAssign);
            module.exports = assign;
        },
        function (module, exports) {
            var arrayCopy = _require(28), assign = _require(61), assignDefaults = _require(30);
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
            module.exports = _require(61);
        },
        function (module, exports) {
            var isLength = _require(52), isNative = _require(59), isObject = _require(60), shimKeys = _require(54);
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
            var isArguments = _require(57), isArray = _require(58), isIndex = _require(50), isLength = _require(52), isObject = _require(60), support = _require(67);
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
                var Ctor = object.constructor, index = -1, isProto = typeof Ctor == 'function' && Ctor.prototype == object, result = Array(length), skipIndexes = length > 0;
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
            var baseToString = _require(39);
            var reRegExpChars = /[.*+?^${}()|[\]\/\\]/g, reHasRegExpChars = RegExp(reRegExpChars.source);
            function escapeRegExp(string) {
                string = baseToString(string);
                return string && reHasRegExpChars.test(string) ? string.replace(reRegExpChars, '\\$&') : string;
            }
            module.exports = escapeRegExp;
        },
        function (module, exports) {
            var isNative = _require(59);
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
            function constant(value) {
                return function () {
                    return value;
                };
            }
            module.exports = constant;
        },
        function (module, exports) {
            function identity(value) {
                return value;
            }
            module.exports = identity;
        }
    ];
    return _require(1);
}));
//# sourceMappingURL=futoin-invoker.js.map