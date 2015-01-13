(function (factory) {
    if (typeof define === 'function' && define.amd) {
        define([
            'futoin-asyncsteps',
            'lodash'
        ], factory);
    } else if (typeof exports === 'object') {
        module.exports = factory(require('futoin-asyncsteps'), require('lodash'));
    } else {
        this.FutoInInvoker = factory($as, _);
    }
}(function (__external_$as, __external__) {
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
            var optname = common.Options;
            var simpleccm_impl = _require(6);
            exports = module.exports = function (options) {
                return new module.exports.AdvancedCCMImpl(options);
            };
            function AdvancedCCMImpl(options) {
                options = options || {};
                var spec_dirs = options[optname.OPT_SPEC_DIRS] || [];
                if (!(spec_dirs instanceof Array)) {
                    spec_dirs = [spec_dirs];
                }
                options[optname.OPT_SPEC_DIRS] = spec_dirs;
                simpleccm_impl.SimpleCCMImpl.call(this, options);
            }
            AdvancedCCMImpl.prototype = {
                onRegister: function (as, info) {
                    spectools.loadIface(as, info, info.options[optname.OPT_SPEC_DIRS]);
                    if (!info.options[optname.OPT_PROD_MODE]) {
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
                        as.error(FutoInError.InvokerError, 'Unknown interface function');
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
                            as.error(FutoInError.InvokerError, 'Unknown parameter ' + k);
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
                    if (!ctx.info.options[optname.OPT_PROD_MODE]) {
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
                performCommon: simpleccm_impl.SimpleCCMImpl.prototype.performCommon,
                perfomHTTP: simpleccm_impl.SimpleCCMImpl.prototype.perfomHTTP,
                perfomWebSocket: simpleccm_impl.SimpleCCMImpl.prototype.perfomWebSocket,
                perfomUNIX: simpleccm_impl.SimpleCCMImpl.prototype.perfomUNIX,
                perfomBrowser: simpleccm_impl.SimpleCCMImpl.prototype.perfomBrowser
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
            var EventEmitter = _require(11);
            var common = _require(3);
            var FutoInError = common.FutoInError;
            var optname = common.Options;
            var MyWebSocket = WebSocket;
            exports.HTTPComms = function () {
            };
            exports.HTTPComms.prototype = {
                perform: function (as, ctx, req) {
                    var _this = this;
                    as.add(function (as) {
                        _this._perform(as, ctx, req);
                    });
                },
                _perform: function (as, ctx, req) {
                    var sniffer = ctx.options[optname.OPT_MSG_SNIFFER];
                    var httpreq = new XMLHttpRequest();
                    var url = ctx.endpoint;
                    var rawreq = ctx.upload_data;
                    var content_type;
                    if (rawreq || rawreq === '') {
                        content_type = 'application/octet-stream';
                        if (url.charAt(url.length - 1) !== '/') {
                            url += '/';
                        }
                        url += req.f.replace(/:/g, '/') + '/';
                        if ('sec' in req) {
                            url += req.sec + '/';
                        }
                        var params = [];
                        for (var k in req.p) {
                            params.push(encodeURIComponent(k) + '=' + encodeURIComponent(req.p[k]));
                        }
                        url += '?' + params.join('&');
                    } else {
                        content_type = 'application/futoin+json';
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
                                sniffer(ctx.info, response, true);
                                as.success(response, this.getResponseHeader('content-type'));
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
                    httpreq.send(rawreq);
                    if (!ctx.expect_response) {
                        as.success();
                    }
                }
            };
            exports.WSComms = function () {
                this.rid = 1;
                this.reqas = {};
                this.evt = new EventEmitter();
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
                    var sniffer = opts[optname.OPT_MSG_SNIFFER];
                    this.sniffer = sniffer;
                    var send_executor_rsp = function (rsp) {
                        var rawrsp = executor.packPayloadJSON(rsp);
                        ws.send(rawrsp);
                    };
                    var cleanup = function (event) {
                        opts[optname.OPT_DISCONNECT_SNIFFER](info);
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
                    };
                    ws.onclose = cleanup;
                    ws.onerror = cleanup;
                    ws.onopen = function (event) {
                        void event;
                        _this._waiting_open = false;
                        _this.evt.emit('open');
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
                                reqas[rid].success(rsp, 'application/futoin+json');
                                delete reqas[rid];
                            } else if (rid.charAt(0) === 'S' && executor) {
                                executor.onEndpointRequest(info, rsp, send_executor_rsp);
                            }
                        }
                    };
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
                                _this.evt.removeListener('open', on_open);
                            });
                        });
                    }
                    as.add(function (as) {
                        _this._perform(as, ctx, req);
                    });
                },
                _perform: function (as, ctx, req) {
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
                    var sniffer = opts[optname.OPT_MSG_SNIFFER];
                    this.sniffer = sniffer;
                    var send_executor_rsp = function (rsp) {
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
                                reqas[rid].success(rsp, 'application/futoin+json');
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
                },
                perform: function (as, ctx, req) {
                    if (ctx.upload_data || ctx.download_stream) {
                        as.error(FutoInError.CommError, 'Raw Data is not supported by Web Messaging yet');
                    }
                    if (!('target' in this)) {
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
            var async_steps = _require(9);
            exports.AsyncSteps = async_steps;
            exports.FutoInError = async_steps.FutoInError;
            exports.Options = {
                OPT_CALL_TIMEOUT_MS: 'callTimeoutMS',
                OPT_X509_VERIFY: 'X509_VERIFY',
                OPT_PROD_MODE: 'PROD_MODE',
                OPT_COMM_CONFIG_CB: 'COMM_CONFIG_CB',
                OPT_MSG_SNIFFER: 'MSG_SNIFFER',
                OPT_DISCONNECT_SNIFFER: 'DISCONNECT_SNIFFER',
                OPT_SPEC_DIRS: 'specDirs',
                OPT_EXECUTOR: 'executor',
                OPT_TARGET_ORIGIN: 'targetOrigin',
                OPT_RETRY_COUNT: 'retryCount',
                SAFE_PAYLOAD_LIMIT: 65536
            };
            exports._ifacever_pattern = /^(([a-z][a-z0-9]*)(\.[a-z][a-z0-9]*)*):(([0-9]+)\.([0-9]+))$/;
        },
        function (module, exports) {
            'use strict';
            var common = _require(3);
            var futoin_error = common.FutoInError;
            var native_iface = _require(5);
            var _ = _require(10);
            var simple_ccm = _require(6);
            var advanced_ccm = _require(0);
            var spectools = _require(7);
            var SimpleCCMPublic = {
                    SVC_RESOLVER: '#resolver',
                    SVC_AUTH: '#auth',
                    SVC_DEFENSE: '#defense',
                    SVC_ACL: '#acl',
                    SVC_LOG: '#log',
                    SVC_CACHE_: '#cache.'
                };
            _.extend(SimpleCCMPublic, common.Options);
            function SimpleCCM(options) {
                this._iface_info = {};
                this._iface_impl = {};
                this._impl = simple_ccm(options);
            }
            _.extend(SimpleCCM, SimpleCCMPublic);
            var SimpleCCMProto = {
                    _secure_replace: /^secure\+/,
                    _secure_test: /^(https|wss|unix):\/\//,
                    _native_iface_builder: function (ccmimpl, info) {
                        return native_iface(ccmimpl, info);
                    }
                };
            _.extend(SimpleCCMProto, SimpleCCMPublic);
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
                } else {
                    secure_channel = true;
                    impl = endpoint;
                    endpoint = null;
                    endpoint_scheme = null;
                    is_bidirect = true;
                }
                options = options || {};
                _.defaults(options, this._impl.options);
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
                    impl = info.impl(this._impl, info);
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
                    delete this._iface_impl[regname];
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
            };
            SimpleCCM.prototype = SimpleCCMProto;
            function AdvancedCCM(options) {
                this._iface_info = {};
                this._iface_impl = {};
                this._impl = advanced_ccm(options);
            }
            _.extend(AdvancedCCM, SimpleCCMPublic);
            var AdvancedCCMProto = {};
            _.extend(AdvancedCCMProto, SimpleCCMProto);
            AdvancedCCMProto.initFromCache = function (as, cache_l1_endpoint) {
                void cache_l1_endpoint;
                as.error(futoin_error.NotImplemented, 'Caching is not supported yet');
            };
            AdvancedCCMProto.cacheInit = function (as) {
                void as;
            };
            AdvancedCCM.prototype = AdvancedCCMProto;
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
            var invoker = _require(4);
            var _ = _require(10);
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
            NativeIface.prototype = {
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
                    as.add(function (as, req) {
                        if (typeof timeout !== 'number') {
                            timeout = ctx.info.options[invoker.SimpleCCM.OPT_CALL_TIMEOUT_MS];
                        }
                        if (timeout > 0) {
                            as.setTimeout(timeout);
                        }
                        var scheme = raw_info.endpoint_scheme;
                        if (scheme === 'http' || scheme === 'https') {
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
                            as.error(invoker.FutoInError.InvokerError, 'Upload data is allowed only for HTTP/WS endpoints');
                        } else if (ctx.download_stream) {
                            as.error(invoker.FutoInError.InvokerError, 'Download stream is allowed only for HTTP/WS endpoints');
                        } else if (scheme === 'browser') {
                            ccmimpl.perfomBrowser(as, ctx, req);
                        } else if (scheme === 'unix') {
                            ccmimpl.perfomUNIX(as, ctx, req);
                        } else if (scheme === 'callback') {
                            ctx.endpoint(as, ctx, req);
                        } else {
                            as.error(invoker.FutoInError.InvokerError, 'Unknown endpoint scheme');
                        }
                        as.add(function (as, rsp, content_type) {
                            if (!ctx.expect_response) {
                                as.success();
                            } else if (ctx.download_stream) {
                                as.success(true);
                            } else if (content_type === 'application/futoin+json') {
                                if (typeof rsp === 'string') {
                                    try {
                                        rsp = JSON.parse(rsp);
                                    } catch (e) {
                                        as.error(invoker.FutoInError.CommError, 'JSON:' + e.message);
                                    }
                                }
                                ccmimpl.onMessageResponse(as, ctx, rsp);
                            } else {
                                ccmimpl.onDataResponse(as, ctx, rsp);
                            }
                        });
                    });
                },
                _member_call_intercept: function (as, name, finfo, args) {
                    var arginfo = finfo.params;
                    var keys = Object.keys(arginfo);
                    if (args.length > keys.length) {
                        as.error(invoker.FutoInError.InvokerError, 'Unknown parameters');
                    } else if (args.length < finfo.min_args) {
                        as.error(invoker.FutoInError.InvokerError, 'Missing parameters');
                    } else if (args.length < keys.length) {
                        keys = keys.splice(0, args.length);
                    }
                    var params = _.object(keys, args);
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
                burst: function () {
                    throw new Error(invoker.FutoInError.InvokerError, 'Not Implemented');
                },
                bindDerivedKey: function () {
                    throw new Error(invoker.FutoInError.InvokerError, 'Not Implemented');
                }
            };
            exports.NativeIface = NativeIface;
        },
        function (module, exports) {
            'use strict';
            var common = _require(3);
            var FutoInError = common.FutoInError;
            var optname = common.Options;
            var isNode = _require(8);
            var _ = _require(10);
            var comms;
            if (isNode) {
                var hidereq = require;
                comms = hidereq('./node_comms');
            } else {
                comms = _require(2);
            }
            exports = module.exports = function (options) {
                return new module.exports.SimpleCCMImpl(options);
            };
            function SimpleCCMImpl(options) {
                options = options || {};
                var defopts = {};
                defopts[optname.OPT_CALL_TIMEOUT] = 30000;
                defopts[optname.OPT_X509_VERIFY] = true;
                defopts[optname.OPT_PROD_MODE] = false;
                defopts[optname.OPT_COMM_CONFIG_CB] = null;
                defopts[optname.OPT_RETRY_COUNT] = 1;
                defopts[optname.OPT_MSG_SNIFFER] = function () {
                };
                defopts[optname.OPT_DISCONNECT_SNIFFER] = function () {
                };
                _.defaults(options, defopts);
                this.options = options;
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
                                as.continue();
                            }
                        });
                    }).add(function (as) {
                        as.success(msg, content_type);
                    });
                },
                perfomHTTP: function (as, ctx, req) {
                    var native_iface = ctx.native_iface;
                    if (!('_httpcomms' in native_iface)) {
                        native_iface._httpcomms = new comms.HTTPComms();
                    }
                    this.performCommon(as, ctx, req, native_iface._httpcomms);
                },
                perfomWebSocket: function (as, ctx, req) {
                    var native_iface = ctx.native_iface;
                    if (!('_wscomms' in native_iface)) {
                        native_iface._wscomms = new comms.WSComms();
                    }
                    this.performCommon(as, ctx, req, native_iface._wscomms);
                },
                perfomUNIX: function (as, ctx, req) {
                    void ctx;
                    void req;
                    as.error(FutoInError.InvokerError, 'Not implemented unix:// scheme');
                },
                perfomBrowser: function (as, ctx, req) {
                    var native_iface = ctx.native_iface;
                    if (!('_browser_comms' in native_iface)) {
                        if (!('BrowserComms' in comms)) {
                            as.error(FutoInError.InvokerError, 'Not implemented browser:// scheme');
                        }
                        native_iface._browser_comms = new comms.BrowserComms();
                    }
                    native_iface._browser_comms.perform(as, ctx, req);
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
            var _ = _require(10);
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
                            info.funcs = _.cloneDeep(raw_spec.funcs || {});
                            info.types = _.cloneDeep(raw_spec.types || {});
                        }
                        spectools._parseFuncs(as, info);
                        spectools._parseTypes(as, info);
                        if ('requires' in raw_spec) {
                            var requires = raw_spec.requires;
                            if (!Array.isArray(requires)) {
                                as.error(FutoInError.InternalError, '"requires" is not array');
                            }
                            info.constraints = _.object(requires, requires);
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
                                finfo.throws = _.object(throws, throws);
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
                        if (_.difference(Object.keys(sup_info.constraints), raw_spec.requires).length) {
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
            module.exports = __external_$as;
        },
        function (module, exports) {
            module.exports = __external__;
        },
        function (module, exports) {
            ;
            (function () {
                'use strict';
                function EventEmitter() {
                }
                var proto = EventEmitter.prototype;
                var exports = this;
                var originalGlobalValue = exports.EventEmitter;
                function indexOfListener(listeners, listener) {
                    var i = listeners.length;
                    while (i--) {
                        if (listeners[i].listener === listener) {
                            return i;
                        }
                    }
                    return -1;
                }
                function alias(name) {
                    return function aliasClosure() {
                        return this[name].apply(this, arguments);
                    };
                }
                proto.getListeners = function getListeners(evt) {
                    var events = this._getEvents();
                    var response;
                    var key;
                    if (evt instanceof RegExp) {
                        response = {};
                        for (key in events) {
                            if (events.hasOwnProperty(key) && evt.test(key)) {
                                response[key] = events[key];
                            }
                        }
                    } else {
                        response = events[evt] || (events[evt] = []);
                    }
                    return response;
                };
                proto.flattenListeners = function flattenListeners(listeners) {
                    var flatListeners = [];
                    var i;
                    for (i = 0; i < listeners.length; i += 1) {
                        flatListeners.push(listeners[i].listener);
                    }
                    return flatListeners;
                };
                proto.getListenersAsObject = function getListenersAsObject(evt) {
                    var listeners = this.getListeners(evt);
                    var response;
                    if (listeners instanceof Array) {
                        response = {};
                        response[evt] = listeners;
                    }
                    return response || listeners;
                };
                proto.addListener = function addListener(evt, listener) {
                    var listeners = this.getListenersAsObject(evt);
                    var listenerIsWrapped = typeof listener === 'object';
                    var key;
                    for (key in listeners) {
                        if (listeners.hasOwnProperty(key) && indexOfListener(listeners[key], listener) === -1) {
                            listeners[key].push(listenerIsWrapped ? listener : {
                                listener: listener,
                                once: false
                            });
                        }
                    }
                    return this;
                };
                proto.on = alias('addListener');
                proto.addOnceListener = function addOnceListener(evt, listener) {
                    return this.addListener(evt, {
                        listener: listener,
                        once: true
                    });
                };
                proto.once = alias('addOnceListener');
                proto.defineEvent = function defineEvent(evt) {
                    this.getListeners(evt);
                    return this;
                };
                proto.defineEvents = function defineEvents(evts) {
                    for (var i = 0; i < evts.length; i += 1) {
                        this.defineEvent(evts[i]);
                    }
                    return this;
                };
                proto.removeListener = function removeListener(evt, listener) {
                    var listeners = this.getListenersAsObject(evt);
                    var index;
                    var key;
                    for (key in listeners) {
                        if (listeners.hasOwnProperty(key)) {
                            index = indexOfListener(listeners[key], listener);
                            if (index !== -1) {
                                listeners[key].splice(index, 1);
                            }
                        }
                    }
                    return this;
                };
                proto.off = alias('removeListener');
                proto.addListeners = function addListeners(evt, listeners) {
                    return this.manipulateListeners(false, evt, listeners);
                };
                proto.removeListeners = function removeListeners(evt, listeners) {
                    return this.manipulateListeners(true, evt, listeners);
                };
                proto.manipulateListeners = function manipulateListeners(remove, evt, listeners) {
                    var i;
                    var value;
                    var single = remove ? this.removeListener : this.addListener;
                    var multiple = remove ? this.removeListeners : this.addListeners;
                    if (typeof evt === 'object' && !(evt instanceof RegExp)) {
                        for (i in evt) {
                            if (evt.hasOwnProperty(i) && (value = evt[i])) {
                                if (typeof value === 'function') {
                                    single.call(this, i, value);
                                } else {
                                    multiple.call(this, i, value);
                                }
                            }
                        }
                    } else {
                        i = listeners.length;
                        while (i--) {
                            single.call(this, evt, listeners[i]);
                        }
                    }
                    return this;
                };
                proto.removeEvent = function removeEvent(evt) {
                    var type = typeof evt;
                    var events = this._getEvents();
                    var key;
                    if (type === 'string') {
                        delete events[evt];
                    } else if (evt instanceof RegExp) {
                        for (key in events) {
                            if (events.hasOwnProperty(key) && evt.test(key)) {
                                delete events[key];
                            }
                        }
                    } else {
                        delete this._events;
                    }
                    return this;
                };
                proto.removeAllListeners = alias('removeEvent');
                proto.emitEvent = function emitEvent(evt, args) {
                    var listeners = this.getListenersAsObject(evt);
                    var listener;
                    var i;
                    var key;
                    var response;
                    for (key in listeners) {
                        if (listeners.hasOwnProperty(key)) {
                            i = listeners[key].length;
                            while (i--) {
                                listener = listeners[key][i];
                                if (listener.once === true) {
                                    this.removeListener(evt, listener.listener);
                                }
                                response = listener.listener.apply(this, args || []);
                                if (response === this._getOnceReturnValue()) {
                                    this.removeListener(evt, listener.listener);
                                }
                            }
                        }
                    }
                    return this;
                };
                proto.trigger = alias('emitEvent');
                proto.emit = function emit(evt) {
                    var args = Array.prototype.slice.call(arguments, 1);
                    return this.emitEvent(evt, args);
                };
                proto.setOnceReturnValue = function setOnceReturnValue(value) {
                    this._onceReturnValue = value;
                    return this;
                };
                proto._getOnceReturnValue = function _getOnceReturnValue() {
                    if (this.hasOwnProperty('_onceReturnValue')) {
                        return this._onceReturnValue;
                    } else {
                        return true;
                    }
                };
                proto._getEvents = function _getEvents() {
                    return this._events || (this._events = {});
                };
                EventEmitter.noConflict = function noConflict() {
                    exports.EventEmitter = originalGlobalValue;
                    return EventEmitter;
                };
                if (typeof define === 'function' && define.amd) {
                    define(function () {
                        return EventEmitter;
                    });
                } else if (typeof module === 'object' && module.exports) {
                    module.exports = EventEmitter;
                } else {
                    exports.EventEmitter = EventEmitter;
                }
            }.call(this));
        }
    ];
    return _require(1);
}));
//# sourceMappingURL=futoin-invoker.js.map