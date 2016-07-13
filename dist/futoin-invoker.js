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
            var _clone = _require(133);
            var common = _require(9);
            var futoin_error = common.FutoInError;
            var _extend = _require(138);
            var AdvancedCCMImpl = _require(5);
            var SimpleCCM = _require(3);
            var ee = _require(26);
            var AdvancedCCMPublic = common.Options;
            function AdvancedCCM(options) {
                ee(this);
                this._iface_info = {};
                this._iface_impl = {};
                this._impl = new AdvancedCCMImpl(options);
            }
            _extend(AdvancedCCM, AdvancedCCMPublic);
            var AdvancedCCMProto = _clone(SimpleCCM.prototype);
            AdvancedCCM.prototype = AdvancedCCMProto;
            AdvancedCCMProto.initFromCache = function (as, cache_l1_endpoint) {
                void cache_l1_endpoint;
                as.error(futoin_error.NotImplemented, 'Caching is not supported yet');
            };
            AdvancedCCMProto.cacheInit = function (as) {
                void as;
            };
            module.exports = AdvancedCCM;
        },
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
            var common = _require(9);
            var futoin_error = common.FutoInError;
            var _zipObject = _require(158);
            var ee = _require(26);
            var async_steps = _require(27);
            var InterfaceInfo = _require(1);
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
            var common = _require(9);
            var futoin_error = common.FutoInError;
            var NativeIface = _require(2);
            var _extend = _require(138);
            var _defaults = _require(135);
            var SimpleCCMImpl = _require(6);
            var ee = _require(26);
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
            var common = _require(9);
            var FutoInError = common.FutoInError;
            var fs;
            var request;
            var isNode = _require(12);
            var _cloneDeep = _require(134);
            var _zipObject = _require(158);
            var _difference = _require(136);
            var _extend = _require(138);
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
                    _ifacever_pattern: common._ifacever_pattern,
                    _max_supported_v1_minor: 3,
                    loadIface: function (as, info, specdirs, load_cache) {
                        var raw_spec = null;
                        var fn = info.iface + '-' + info.version + '-iface.json';
                        var cached_info;
                        var cache_key;
                        if (load_cache) {
                            cache_key = info.iface + ':' + info.version + (info._invoker_use ? ':i' : ':e');
                            cached_info = load_cache[cache_key];
                            if (cached_info) {
                                _extend(info, cached_info);
                                return;
                            }
                            cached_info = { _invoker_use: info._invoker_use };
                        } else {
                            cached_info = info;
                        }
                        as.forEach(specdirs, function (as, k, v) {
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
                            spectools.parseIface(as, cached_info, specdirs, raw_spec);
                        });
                        if (load_cache) {
                            as.add(function (as) {
                                void as;
                                load_cache[cache_key] = cached_info;
                                _extend(info, cached_info);
                            });
                        }
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
                                    as.error(FutoInError.InternalError, 'Missing ftn3rev or wrong field for FTN3 v1.1 features');
                                }
                            }
                            if (mnr < 2) {
                                if ('MessageSignature' in info.constraints) {
                                    as.error(FutoInError.InternalError, 'Missing ftn3rev or wrong field for FTN3 v1.2 features');
                                }
                            }
                            if (mnr < 3) {
                                for (var f in info.funcs) {
                                    if (info.funcs[f].seclvl) {
                                        as.error(FutoInError.InternalError, 'Missing ftn3rev or wrong field for FTN3 v1.3 features');
                                    }
                                }
                            }
                            if (mnr < 4) {
                            }
                            if (!info._invoker_use && mnr > spectools._max_supported_v1_minor) {
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
                            if (fdef.seclvl !== info.funcs[f].seclvl) {
                                as.error(FutoInError.InternalError, '\'seclvl\' mismatch for \'' + f + '\'');
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
                    checkParameterType: function (info, funcname, varname, value) {
                        return spectools.checkType(info, info.funcs[funcname].params[varname].type, value);
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
                    },
                    genHMAC: function (as, info, ftnreq) {
                        void as;
                        void info;
                        void ftnreq;
                        as.error(FutoInError.InvalidRequest, 'HMAC generation is supported only for server environment');
                    }
                };
            if (isNode) {
                hidereq('./lib/node/spectools_hmac')(spectools);
            }
            module.exports = spectools;
        },
        function (module, exports) {
            'use strict';
            var common = _require(9);
            var FutoInError = common.FutoInError;
            var SimpleCCMImpl = _require(6);
            var SpecTools = _require(4);
            var _defaults = _require(135);
            var AdvancedCCMOptions = {
                    specDirs: [],
                    hmacKey: null,
                    hmacAlgo: 'MD5',
                    sendOnBehalfOf: true
                };
            function AdvancedCCMImpl(options) {
                options = options || {};
                _defaults(options, AdvancedCCMOptions);
                var spec_dirs = options.specDirs || [];
                if (!(spec_dirs instanceof Array)) {
                    spec_dirs = [spec_dirs];
                }
                options.specDirs = spec_dirs;
                SimpleCCMImpl.call(this, options);
                this._load_cache = {};
            }
            var SCCMImpProto = SimpleCCMImpl.prototype;
            AdvancedCCMImpl.prototype = {
                onRegister: function (as, info) {
                    if ((info.creds_master || info.creds_hmac) && !SpecTools.checkHMAC) {
                        as.error(FutoInError.InvokerError, 'Master/HMAC is not supported in this environment yet');
                    }
                    SpecTools.loadIface(as, info, info.options.specDirs, this._load_cache);
                    if (!info.options.prodMode) {
                        SpecTools.checkConsistency(as, info);
                    }
                },
                checkParams: function (as, ctx, params) {
                    var info = ctx.info;
                    var name = ctx.name;
                    var k;
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
                        if (!SpecTools.checkParameterType(info, name, k, params[k])) {
                            as.error(FutoInError.InvalidRequest, 'Type mismatch for parameter: ' + k);
                        }
                    }
                    for (k in finfo.params) {
                        if (!params.hasOwnProperty(k) && !finfo.params[k].hasOwnProperty('default')) {
                            as.error(FutoInError.InvokerError, 'Missing parameter ' + k);
                        }
                    }
                },
                createMessage: function (as, ctx, params) {
                    var info = ctx.info;
                    var options = info.options;
                    if (!options.prodMode) {
                        this.checkParams(as, ctx, params);
                    }
                    var req = {
                            f: info.iface + ':' + info.version + ':' + ctx.name,
                            p: params
                        };
                    if (options.sendOnBehalfOf) {
                        var reqinfo = as.state.reqinfo;
                        if (reqinfo) {
                            var reqinfo_info = reqinfo.info;
                            var user_info = reqinfo_info.USER_INFO;
                            if (user_info) {
                                req.obf = {
                                    lid: user_info.localID(),
                                    gid: user_info.globalID(),
                                    slvl: reqinfo_info.SECURITY_LEVEL
                                };
                            } else {
                                req.obf = { slvl: 'Anonymous' };
                            }
                        }
                    }
                    ctx.expect_response = info.funcs[ctx.name].expect_result;
                    if (info.creds !== null) {
                        if (info.creds_master) {
                            as.error(FutoInError.InvokerError, 'MasterService support is not implemented');
                            ctx.signMessage = function (req) {
                                void req;
                            };
                        } else if (info.creds_hmac) {
                            ctx.signMessage = function (req) {
                                req.sec = info.creds + ':' + options.hmacAlgo + ':' + SpecTools.genHMAC(as, info.options, req).toString('base64');
                            };
                        } else {
                            req.sec = info.creds;
                        }
                    }
                    as.success(req);
                },
                onMessageResponse: function (as, ctx, rsp) {
                    var info = ctx.info;
                    var name = ctx.name;
                    var func_info = info.funcs[name];
                    if (info.creds_master) {
                        as.error(FutoInError.InvokerError, 'MasterService support is not implemented');
                    } else if (info.creds_hmac) {
                        var rsp_sec;
                        try {
                            rsp_sec = new Buffer(rsp.sec, 'base64');
                        } catch (e) {
                            as.error(FutoInError.SecurityError, 'Missing response HMAC');
                        }
                        delete rsp.sec;
                        var required_sec = SpecTools.genHMAC(as, info.options, rsp);
                        if (!SpecTools.checkHMAC(rsp_sec, required_sec)) {
                            as.error(FutoInError.SecurityError, 'Response HMAC mismatch');
                        }
                    }
                    if ('e' in rsp) {
                        var e = rsp.e;
                        if (e in func_info.throws || e in SpecTools.standard_errors) {
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
                            SpecTools.checkResultType(as, info, name, k, rsp.r[k]);
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
                getComms: SCCMImpProto.getComms,
                performCommon: SCCMImpProto.performCommon,
                perfomHTTP: SCCMImpProto.perfomHTTP,
                perfomWebSocket: SCCMImpProto.perfomWebSocket,
                perfomUNIX: SCCMImpProto.perfomUNIX,
                perfomBrowser: SCCMImpProto.perfomBrowser
            };
            module.exports = AdvancedCCMImpl;
        },
        function (module, exports) {
            'use strict';
            var common = _require(9);
            var FutoInError = common.FutoInError;
            var isNode = _require(12);
            var _defaults = _require(135);
            var comms_impl;
            if (isNode) {
                var hidereq = require;
                comms_impl = hidereq('./node/comms');
            } else {
                comms_impl = _require(8);
            }
            var SimpleCCMOptions = {
                    callTimeoutMS: 30000,
                    prodMode: false,
                    commConfigCallback: null,
                    messageSniffer: function () {
                    },
                    disconnectSniffer: function () {
                    },
                    executor: null,
                    targetOrigin: null,
                    retryCount: 1
                };
            function SimpleCCMImpl(options) {
                options = options || {};
                _defaults(options, SimpleCCMOptions);
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
            (function (window) {
                'use strict';
                var futoin = window.FutoIn || {};
                if (typeof futoin.Invoker === 'undefined') {
                    var FutoInInvoker = _require(10);
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
            var ee = _require(26);
            var common = _require(9);
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
            'use strict';
            var async_steps = _require(27);
            exports.AsyncSteps = async_steps;
            exports.FutoInError = async_steps.FutoInError;
            exports.Options = {
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
            var common = _require(9);
            exports.SimpleCCM = _require(3);
            exports.AdvancedCCM = _require(0);
            exports.FutoInError = common.FutoInError;
            exports.InterfaceInfo = _require(1);
            exports.NativeIface = _require(2);
            exports.SpecTools = _require(4);
        },
        function (module, exports) {
            'use strict';
            var assign = _require(13), normalizeOpts = _require(20), isCallable = _require(16), contains = _require(23), d;
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
            module.exports = false;
            try {
                module.exports = Object.prototype.toString.call(global.process) === '[object process]';
            } catch (e) {
            }
        },
        function (module, exports) {
            'use strict';
            module.exports = _require(14)() ? Object.assign : _require(15);
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
            var keys = _require(17), value = _require(22), max = Math.max;
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
            module.exports = _require(18)() ? Object.keys : _require(19);
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
            module.exports = _require(24)() ? String.prototype.contains : _require(25);
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
            'use strict';
            var d = _require(11), callable = _require(21), apply = Function.prototype.apply, call = Function.prototype.call, create = Object.create, defineProperty = Object.defineProperty, defineProperties = Object.defineProperties, hasOwnProperty = Object.prototype.hasOwnProperty, descriptor = {
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
            module.exports = __external_$as;
        },
        function (module, exports) {
            var getNative = _require(86), root = _require(121);
            var DataView = getNative(root, 'DataView');
            module.exports = DataView;
        },
        function (module, exports) {
            var hashClear = _require(91), hashDelete = _require(92), hashGet = _require(93), hashHas = _require(94), hashSet = _require(95);
            function Hash(entries) {
                var index = -1, length = entries ? entries.length : 0;
                this.clear();
                while (++index < length) {
                    var entry = entries[index];
                    this.set(entry[0], entry[1]);
                }
            }
            Hash.prototype.clear = hashClear;
            Hash.prototype['delete'] = hashDelete;
            Hash.prototype.get = hashGet;
            Hash.prototype.has = hashHas;
            Hash.prototype.set = hashSet;
            module.exports = Hash;
        },
        function (module, exports) {
            var listCacheClear = _require(109), listCacheDelete = _require(110), listCacheGet = _require(111), listCacheHas = _require(112), listCacheSet = _require(113);
            function ListCache(entries) {
                var index = -1, length = entries ? entries.length : 0;
                this.clear();
                while (++index < length) {
                    var entry = entries[index];
                    this.set(entry[0], entry[1]);
                }
            }
            ListCache.prototype.clear = listCacheClear;
            ListCache.prototype['delete'] = listCacheDelete;
            ListCache.prototype.get = listCacheGet;
            ListCache.prototype.has = listCacheHas;
            ListCache.prototype.set = listCacheSet;
            module.exports = ListCache;
        },
        function (module, exports) {
            var getNative = _require(86), root = _require(121);
            var Map = getNative(root, 'Map');
            module.exports = Map;
        },
        function (module, exports) {
            var mapCacheClear = _require(114), mapCacheDelete = _require(115), mapCacheGet = _require(116), mapCacheHas = _require(117), mapCacheSet = _require(118);
            function MapCache(entries) {
                var index = -1, length = entries ? entries.length : 0;
                this.clear();
                while (++index < length) {
                    var entry = entries[index];
                    this.set(entry[0], entry[1]);
                }
            }
            MapCache.prototype.clear = mapCacheClear;
            MapCache.prototype['delete'] = mapCacheDelete;
            MapCache.prototype.get = mapCacheGet;
            MapCache.prototype.has = mapCacheHas;
            MapCache.prototype.set = mapCacheSet;
            module.exports = MapCache;
        },
        function (module, exports) {
            var getNative = _require(86), root = _require(121);
            var Promise = getNative(root, 'Promise');
            module.exports = Promise;
        },
        function (module, exports) {
            var root = _require(121);
            var Reflect = root.Reflect;
            module.exports = Reflect;
        },
        function (module, exports) {
            var getNative = _require(86), root = _require(121);
            var Set = getNative(root, 'Set');
            module.exports = Set;
        },
        function (module, exports) {
            var MapCache = _require(32), setCacheAdd = _require(122), setCacheHas = _require(123);
            function SetCache(values) {
                var index = -1, length = values ? values.length : 0;
                this.__data__ = new MapCache();
                while (++index < length) {
                    this.add(values[index]);
                }
            }
            SetCache.prototype.add = SetCache.prototype.push = setCacheAdd;
            SetCache.prototype.has = setCacheHas;
            module.exports = SetCache;
        },
        function (module, exports) {
            var ListCache = _require(30), stackClear = _require(125), stackDelete = _require(126), stackGet = _require(127), stackHas = _require(128), stackSet = _require(129);
            function Stack(entries) {
                this.__data__ = new ListCache(entries);
            }
            Stack.prototype.clear = stackClear;
            Stack.prototype['delete'] = stackDelete;
            Stack.prototype.get = stackGet;
            Stack.prototype.has = stackHas;
            Stack.prototype.set = stackSet;
            module.exports = Stack;
        },
        function (module, exports) {
            var root = _require(121);
            var Symbol = root.Symbol;
            module.exports = Symbol;
        },
        function (module, exports) {
            var root = _require(121);
            var Uint8Array = root.Uint8Array;
            module.exports = Uint8Array;
        },
        function (module, exports) {
            var getNative = _require(86), root = _require(121);
            var WeakMap = getNative(root, 'WeakMap');
            module.exports = WeakMap;
        },
        function (module, exports) {
            function addMapEntry(map, pair) {
                map.set(pair[0], pair[1]);
                return map;
            }
            module.exports = addMapEntry;
        },
        function (module, exports) {
            function addSetEntry(set, value) {
                set.add(value);
                return set;
            }
            module.exports = addSetEntry;
        },
        function (module, exports) {
            function apply(func, thisArg, args) {
                var length = args.length;
                switch (length) {
                case 0:
                    return func.call(thisArg);
                case 1:
                    return func.call(thisArg, args[0]);
                case 2:
                    return func.call(thisArg, args[0], args[1]);
                case 3:
                    return func.call(thisArg, args[0], args[1], args[2]);
                }
                return func.apply(thisArg, args);
            }
            module.exports = apply;
        },
        function (module, exports) {
            function arrayEach(array, iteratee) {
                var index = -1, length = array ? array.length : 0;
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
            var baseIndexOf = _require(60);
            function arrayIncludes(array, value) {
                var length = array ? array.length : 0;
                return !!length && baseIndexOf(array, value, 0) > -1;
            }
            module.exports = arrayIncludes;
        },
        function (module, exports) {
            function arrayIncludesWith(array, value, comparator) {
                var index = -1, length = array ? array.length : 0;
                while (++index < length) {
                    if (comparator(value, array[index])) {
                        return true;
                    }
                }
                return false;
            }
            module.exports = arrayIncludesWith;
        },
        function (module, exports) {
            function arrayMap(array, iteratee) {
                var index = -1, length = array ? array.length : 0, result = Array(length);
                while (++index < length) {
                    result[index] = iteratee(array[index], index, array);
                }
                return result;
            }
            module.exports = arrayMap;
        },
        function (module, exports) {
            function arrayPush(array, values) {
                var index = -1, length = values.length, offset = array.length;
                while (++index < length) {
                    array[offset + index] = values[index];
                }
                return array;
            }
            module.exports = arrayPush;
        },
        function (module, exports) {
            function arrayReduce(array, iteratee, accumulator, initAccum) {
                var index = -1, length = array ? array.length : 0;
                if (initAccum && length) {
                    accumulator = array[++index];
                }
                while (++index < length) {
                    accumulator = iteratee(accumulator, array[index], index, array);
                }
                return accumulator;
            }
            module.exports = arrayReduce;
        },
        function (module, exports) {
            var eq = _require(137);
            var objectProto = Object.prototype;
            var hasOwnProperty = objectProto.hasOwnProperty;
            function assignInDefaults(objValue, srcValue, key, object) {
                if (objValue === undefined || eq(objValue, objectProto[key]) && !hasOwnProperty.call(object, key)) {
                    return srcValue;
                }
                return objValue;
            }
            module.exports = assignInDefaults;
        },
        function (module, exports) {
            var eq = _require(137);
            var objectProto = Object.prototype;
            var hasOwnProperty = objectProto.hasOwnProperty;
            function assignValue(object, key, value) {
                var objValue = object[key];
                if (!(hasOwnProperty.call(object, key) && eq(objValue, value)) || value === undefined && !(key in object)) {
                    object[key] = value;
                }
            }
            module.exports = assignValue;
        },
        function (module, exports) {
            var eq = _require(137);
            function assocIndexOf(array, key) {
                var length = array.length;
                while (length--) {
                    if (eq(array[length][0], key)) {
                        return length;
                    }
                }
                return -1;
            }
            module.exports = assocIndexOf;
        },
        function (module, exports) {
            var copyObject = _require(79), keys = _require(150);
            function baseAssign(object, source) {
                return object && copyObject(source, keys(source), object);
            }
            module.exports = baseAssign;
        },
        function (module, exports) {
            var Stack = _require(37), arrayEach = _require(44), assignValue = _require(51), baseAssign = _require(53), cloneBuffer = _require(71), copyArray = _require(78), copySymbols = _require(80), getAllKeys = _require(83), getTag = _require(89), initCloneArray = _require(98), initCloneByTag = _require(99), initCloneObject = _require(100), isArray = _require(140), isBuffer = _require(143), isHostObject = _require(102), isObject = _require(146), keys = _require(150);
            var argsTag = '[object Arguments]', arrayTag = '[object Array]', boolTag = '[object Boolean]', dateTag = '[object Date]', errorTag = '[object Error]', funcTag = '[object Function]', genTag = '[object GeneratorFunction]', mapTag = '[object Map]', numberTag = '[object Number]', objectTag = '[object Object]', regexpTag = '[object RegExp]', setTag = '[object Set]', stringTag = '[object String]', symbolTag = '[object Symbol]', weakMapTag = '[object WeakMap]';
            var arrayBufferTag = '[object ArrayBuffer]', dataViewTag = '[object DataView]', float32Tag = '[object Float32Array]', float64Tag = '[object Float64Array]', int8Tag = '[object Int8Array]', int16Tag = '[object Int16Array]', int32Tag = '[object Int32Array]', uint8Tag = '[object Uint8Array]', uint8ClampedTag = '[object Uint8ClampedArray]', uint16Tag = '[object Uint16Array]', uint32Tag = '[object Uint32Array]';
            var cloneableTags = {};
            cloneableTags[argsTag] = cloneableTags[arrayTag] = cloneableTags[arrayBufferTag] = cloneableTags[dataViewTag] = cloneableTags[boolTag] = cloneableTags[dateTag] = cloneableTags[float32Tag] = cloneableTags[float64Tag] = cloneableTags[int8Tag] = cloneableTags[int16Tag] = cloneableTags[int32Tag] = cloneableTags[mapTag] = cloneableTags[numberTag] = cloneableTags[objectTag] = cloneableTags[regexpTag] = cloneableTags[setTag] = cloneableTags[stringTag] = cloneableTags[symbolTag] = cloneableTags[uint8Tag] = cloneableTags[uint8ClampedTag] = cloneableTags[uint16Tag] = cloneableTags[uint32Tag] = true;
            cloneableTags[errorTag] = cloneableTags[funcTag] = cloneableTags[weakMapTag] = false;
            function baseClone(value, isDeep, isFull, customizer, key, object, stack) {
                var result;
                if (customizer) {
                    result = object ? customizer(value, key, object, stack) : customizer(value);
                }
                if (result !== undefined) {
                    return result;
                }
                if (!isObject(value)) {
                    return value;
                }
                var isArr = isArray(value);
                if (isArr) {
                    result = initCloneArray(value);
                    if (!isDeep) {
                        return copyArray(value, result);
                    }
                } else {
                    var tag = getTag(value), isFunc = tag == funcTag || tag == genTag;
                    if (isBuffer(value)) {
                        return cloneBuffer(value, isDeep);
                    }
                    if (tag == objectTag || tag == argsTag || isFunc && !object) {
                        if (isHostObject(value)) {
                            return object ? value : {};
                        }
                        result = initCloneObject(isFunc ? {} : value);
                        if (!isDeep) {
                            return copySymbols(value, baseAssign(result, value));
                        }
                    } else {
                        if (!cloneableTags[tag]) {
                            return object ? value : {};
                        }
                        result = initCloneByTag(value, tag, baseClone, isDeep);
                    }
                }
                stack || (stack = new Stack());
                var stacked = stack.get(value);
                if (stacked) {
                    return stacked;
                }
                stack.set(value, result);
                if (!isArr) {
                    var props = isFull ? getAllKeys(value) : keys(value);
                }
                arrayEach(props || value, function (subValue, key) {
                    if (props) {
                        key = subValue;
                        subValue = value[key];
                    }
                    assignValue(result, key, baseClone(subValue, isDeep, isFull, customizer, key, value, stack));
                });
                return result;
            }
            module.exports = baseClone;
        },
        function (module, exports) {
            var isObject = _require(146);
            var objectCreate = Object.create;
            function baseCreate(proto) {
                return isObject(proto) ? objectCreate(proto) : {};
            }
            module.exports = baseCreate;
        },
        function (module, exports) {
            var SetCache = _require(36), arrayIncludes = _require(45), arrayIncludesWith = _require(46), arrayMap = _require(47), baseUnary = _require(66), cacheHas = _require(68);
            var LARGE_ARRAY_SIZE = 200;
            function baseDifference(array, values, iteratee, comparator) {
                var index = -1, includes = arrayIncludes, isCommon = true, length = array.length, result = [], valuesLength = values.length;
                if (!length) {
                    return result;
                }
                if (iteratee) {
                    values = arrayMap(values, baseUnary(iteratee));
                }
                if (comparator) {
                    includes = arrayIncludesWith;
                    isCommon = false;
                } else if (values.length >= LARGE_ARRAY_SIZE) {
                    includes = cacheHas;
                    isCommon = false;
                    values = new SetCache(values);
                }
                outer:
                    while (++index < length) {
                        var value = array[index], computed = iteratee ? iteratee(value) : value;
                        value = comparator || value !== 0 ? value : 0;
                        if (isCommon && computed === computed) {
                            var valuesIndex = valuesLength;
                            while (valuesIndex--) {
                                if (values[valuesIndex] === computed) {
                                    continue outer;
                                }
                            }
                            result.push(value);
                        } else if (!includes(values, computed, comparator)) {
                            result.push(value);
                        }
                    }
                return result;
            }
            module.exports = baseDifference;
        },
        function (module, exports) {
            var arrayPush = _require(48), isFlattenable = _require(101);
            function baseFlatten(array, depth, predicate, isStrict, result) {
                var index = -1, length = array.length;
                predicate || (predicate = isFlattenable);
                result || (result = []);
                while (++index < length) {
                    var value = array[index];
                    if (depth > 0 && predicate(value)) {
                        if (depth > 1) {
                            baseFlatten(value, depth - 1, predicate, isStrict, result);
                        } else {
                            arrayPush(result, value);
                        }
                    } else if (!isStrict) {
                        result[result.length] = value;
                    }
                }
                return result;
            }
            module.exports = baseFlatten;
        },
        function (module, exports) {
            var arrayPush = _require(48), isArray = _require(140);
            function baseGetAllKeys(object, keysFunc, symbolsFunc) {
                var result = keysFunc(object);
                return isArray(object) ? result : arrayPush(result, symbolsFunc(object));
            }
            module.exports = baseGetAllKeys;
        },
        function (module, exports) {
            var getPrototype = _require(87);
            var objectProto = Object.prototype;
            var hasOwnProperty = objectProto.hasOwnProperty;
            function baseHas(object, key) {
                return object != null && (hasOwnProperty.call(object, key) || typeof object == 'object' && key in object && getPrototype(object) === null);
            }
            module.exports = baseHas;
        },
        function (module, exports) {
            var indexOfNaN = _require(97);
            function baseIndexOf(array, value, fromIndex) {
                if (value !== value) {
                    return indexOfNaN(array, fromIndex);
                }
                var index = fromIndex - 1, length = array.length;
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
            var isFunction = _require(144), isHostObject = _require(102), isMasked = _require(106), isObject = _require(146), toSource = _require(130);
            var reRegExpChar = /[\\^$.*+?()[\]{}|]/g;
            var reIsHostCtor = /^\[object .+?Constructor\]$/;
            var objectProto = Object.prototype;
            var funcToString = Function.prototype.toString;
            var hasOwnProperty = objectProto.hasOwnProperty;
            var reIsNative = RegExp('^' + funcToString.call(hasOwnProperty).replace(reRegExpChar, '\\$&').replace(/hasOwnProperty|(function).*?(?=\\\()| for .+?(?=\\\])/g, '$1.*?') + '$');
            function baseIsNative(value) {
                if (!isObject(value) || isMasked(value)) {
                    return false;
                }
                var pattern = isFunction(value) || isHostObject(value) ? reIsNative : reIsHostCtor;
                return pattern.test(toSource(value));
            }
            module.exports = baseIsNative;
        },
        function (module, exports) {
            var nativeKeys = Object.keys;
            function baseKeys(object) {
                return nativeKeys(Object(object));
            }
            module.exports = baseKeys;
        },
        function (module, exports) {
            var Reflect = _require(34), iteratorToArray = _require(108);
            var objectProto = Object.prototype;
            var enumerate = Reflect ? Reflect.enumerate : undefined, propertyIsEnumerable = objectProto.propertyIsEnumerable;
            function baseKeysIn(object) {
                object = object == null ? object : Object(object);
                var result = [];
                for (var key in object) {
                    result.push(key);
                }
                return result;
            }
            if (enumerate && !propertyIsEnumerable.call({ 'valueOf': 1 }, 'valueOf')) {
                baseKeysIn = function (object) {
                    return iteratorToArray(enumerate(object));
                };
            }
            module.exports = baseKeysIn;
        },
        function (module, exports) {
            function baseProperty(key) {
                return function (object) {
                    return object == null ? undefined : object[key];
                };
            }
            module.exports = baseProperty;
        },
        function (module, exports) {
            function baseTimes(n, iteratee) {
                var index = -1, result = Array(n);
                while (++index < n) {
                    result[index] = iteratee(index);
                }
                return result;
            }
            module.exports = baseTimes;
        },
        function (module, exports) {
            function baseUnary(func) {
                return function (value) {
                    return func(value);
                };
            }
            module.exports = baseUnary;
        },
        function (module, exports) {
            function baseZipObject(props, values, assignFunc) {
                var index = -1, length = props.length, valsLength = values.length, result = {};
                while (++index < length) {
                    var value = index < valsLength ? values[index] : undefined;
                    assignFunc(result, props[index], value);
                }
                return result;
            }
            module.exports = baseZipObject;
        },
        function (module, exports) {
            function cacheHas(cache, key) {
                return cache.has(key);
            }
            module.exports = cacheHas;
        },
        function (module, exports) {
            function checkGlobal(value) {
                return value && value.Object === Object ? value : null;
            }
            module.exports = checkGlobal;
        },
        function (module, exports) {
            var Uint8Array = _require(39);
            function cloneArrayBuffer(arrayBuffer) {
                var result = new arrayBuffer.constructor(arrayBuffer.byteLength);
                new Uint8Array(result).set(new Uint8Array(arrayBuffer));
                return result;
            }
            module.exports = cloneArrayBuffer;
        },
        function (module, exports) {
            function cloneBuffer(buffer, isDeep) {
                if (isDeep) {
                    return buffer.slice();
                }
                var result = new buffer.constructor(buffer.length);
                buffer.copy(result);
                return result;
            }
            module.exports = cloneBuffer;
        },
        function (module, exports) {
            var cloneArrayBuffer = _require(70);
            function cloneDataView(dataView, isDeep) {
                var buffer = isDeep ? cloneArrayBuffer(dataView.buffer) : dataView.buffer;
                return new dataView.constructor(buffer, dataView.byteOffset, dataView.byteLength);
            }
            module.exports = cloneDataView;
        },
        function (module, exports) {
            var addMapEntry = _require(41), arrayReduce = _require(49), mapToArray = _require(119);
            function cloneMap(map, isDeep, cloneFunc) {
                var array = isDeep ? cloneFunc(mapToArray(map), true) : mapToArray(map);
                return arrayReduce(array, addMapEntry, new map.constructor());
            }
            module.exports = cloneMap;
        },
        function (module, exports) {
            var reFlags = /\w*$/;
            function cloneRegExp(regexp) {
                var result = new regexp.constructor(regexp.source, reFlags.exec(regexp));
                result.lastIndex = regexp.lastIndex;
                return result;
            }
            module.exports = cloneRegExp;
        },
        function (module, exports) {
            var addSetEntry = _require(42), arrayReduce = _require(49), setToArray = _require(124);
            function cloneSet(set, isDeep, cloneFunc) {
                var array = isDeep ? cloneFunc(setToArray(set), true) : setToArray(set);
                return arrayReduce(array, addSetEntry, new set.constructor());
            }
            module.exports = cloneSet;
        },
        function (module, exports) {
            var Symbol = _require(38);
            var symbolProto = Symbol ? Symbol.prototype : undefined, symbolValueOf = symbolProto ? symbolProto.valueOf : undefined;
            function cloneSymbol(symbol) {
                return symbolValueOf ? Object(symbolValueOf.call(symbol)) : {};
            }
            module.exports = cloneSymbol;
        },
        function (module, exports) {
            var cloneArrayBuffer = _require(70);
            function cloneTypedArray(typedArray, isDeep) {
                var buffer = isDeep ? cloneArrayBuffer(typedArray.buffer) : typedArray.buffer;
                return new typedArray.constructor(buffer, typedArray.byteOffset, typedArray.length);
            }
            module.exports = cloneTypedArray;
        },
        function (module, exports) {
            function copyArray(source, array) {
                var index = -1, length = source.length;
                array || (array = Array(length));
                while (++index < length) {
                    array[index] = source[index];
                }
                return array;
            }
            module.exports = copyArray;
        },
        function (module, exports) {
            var assignValue = _require(51);
            function copyObject(source, props, object, customizer) {
                object || (object = {});
                var index = -1, length = props.length;
                while (++index < length) {
                    var key = props[index];
                    var newValue = customizer ? customizer(object[key], source[key], key, object, source) : source[key];
                    assignValue(object, key, newValue);
                }
                return object;
            }
            module.exports = copyObject;
        },
        function (module, exports) {
            var copyObject = _require(79), getSymbols = _require(88);
            function copySymbols(source, object) {
                return copyObject(source, getSymbols(source), object);
            }
            module.exports = copySymbols;
        },
        function (module, exports) {
            var root = _require(121);
            var coreJsData = root['__core-js_shared__'];
            module.exports = coreJsData;
        },
        function (module, exports) {
            var isIterateeCall = _require(104), rest = _require(152);
            function createAssigner(assigner) {
                return rest(function (object, sources) {
                    var index = -1, length = sources.length, customizer = length > 1 ? sources[length - 1] : undefined, guard = length > 2 ? sources[2] : undefined;
                    customizer = assigner.length > 3 && typeof customizer == 'function' ? (length--, customizer) : undefined;
                    if (guard && isIterateeCall(sources[0], sources[1], guard)) {
                        customizer = length < 3 ? undefined : customizer;
                        length = 1;
                    }
                    object = Object(object);
                    while (++index < length) {
                        var source = sources[index];
                        if (source) {
                            assigner(object, source, index, customizer);
                        }
                    }
                    return object;
                });
            }
            module.exports = createAssigner;
        },
        function (module, exports) {
            var baseGetAllKeys = _require(58), getSymbols = _require(88), keys = _require(150);
            function getAllKeys(object) {
                return baseGetAllKeys(object, keys, getSymbols);
            }
            module.exports = getAllKeys;
        },
        function (module, exports) {
            var baseProperty = _require(64);
            var getLength = baseProperty('length');
            module.exports = getLength;
        },
        function (module, exports) {
            var isKeyable = _require(105);
            function getMapData(map, key) {
                var data = map.__data__;
                return isKeyable(key) ? data[typeof key == 'string' ? 'string' : 'hash'] : data.map;
            }
            module.exports = getMapData;
        },
        function (module, exports) {
            var baseIsNative = _require(61), getValue = _require(90);
            function getNative(object, key) {
                var value = getValue(object, key);
                return baseIsNative(value) ? value : undefined;
            }
            module.exports = getNative;
        },
        function (module, exports) {
            var nativeGetPrototype = Object.getPrototypeOf;
            function getPrototype(value) {
                return nativeGetPrototype(Object(value));
            }
            module.exports = getPrototype;
        },
        function (module, exports) {
            var stubArray = _require(153);
            var getOwnPropertySymbols = Object.getOwnPropertySymbols;
            function getSymbols(object) {
                return getOwnPropertySymbols(Object(object));
            }
            if (!getOwnPropertySymbols) {
                getSymbols = stubArray;
            }
            module.exports = getSymbols;
        },
        function (module, exports) {
            var DataView = _require(28), Map = _require(31), Promise = _require(33), Set = _require(35), WeakMap = _require(40), toSource = _require(130);
            var mapTag = '[object Map]', objectTag = '[object Object]', promiseTag = '[object Promise]', setTag = '[object Set]', weakMapTag = '[object WeakMap]';
            var dataViewTag = '[object DataView]';
            var objectProto = Object.prototype;
            var objectToString = objectProto.toString;
            var dataViewCtorString = toSource(DataView), mapCtorString = toSource(Map), promiseCtorString = toSource(Promise), setCtorString = toSource(Set), weakMapCtorString = toSource(WeakMap);
            function getTag(value) {
                return objectToString.call(value);
            }
            if (DataView && getTag(new DataView(new ArrayBuffer(1))) != dataViewTag || Map && getTag(new Map()) != mapTag || Promise && getTag(Promise.resolve()) != promiseTag || Set && getTag(new Set()) != setTag || WeakMap && getTag(new WeakMap()) != weakMapTag) {
                getTag = function (value) {
                    var result = objectToString.call(value), Ctor = result == objectTag ? value.constructor : undefined, ctorString = Ctor ? toSource(Ctor) : undefined;
                    if (ctorString) {
                        switch (ctorString) {
                        case dataViewCtorString:
                            return dataViewTag;
                        case mapCtorString:
                            return mapTag;
                        case promiseCtorString:
                            return promiseTag;
                        case setCtorString:
                            return setTag;
                        case weakMapCtorString:
                            return weakMapTag;
                        }
                    }
                    return result;
                };
            }
            module.exports = getTag;
        },
        function (module, exports) {
            function getValue(object, key) {
                return object == null ? undefined : object[key];
            }
            module.exports = getValue;
        },
        function (module, exports) {
            var nativeCreate = _require(120);
            function hashClear() {
                this.__data__ = nativeCreate ? nativeCreate(null) : {};
            }
            module.exports = hashClear;
        },
        function (module, exports) {
            function hashDelete(key) {
                return this.has(key) && delete this.__data__[key];
            }
            module.exports = hashDelete;
        },
        function (module, exports) {
            var nativeCreate = _require(120);
            var HASH_UNDEFINED = '__lodash_hash_undefined__';
            var objectProto = Object.prototype;
            var hasOwnProperty = objectProto.hasOwnProperty;
            function hashGet(key) {
                var data = this.__data__;
                if (nativeCreate) {
                    var result = data[key];
                    return result === HASH_UNDEFINED ? undefined : result;
                }
                return hasOwnProperty.call(data, key) ? data[key] : undefined;
            }
            module.exports = hashGet;
        },
        function (module, exports) {
            var nativeCreate = _require(120);
            var objectProto = Object.prototype;
            var hasOwnProperty = objectProto.hasOwnProperty;
            function hashHas(key) {
                var data = this.__data__;
                return nativeCreate ? data[key] !== undefined : hasOwnProperty.call(data, key);
            }
            module.exports = hashHas;
        },
        function (module, exports) {
            var nativeCreate = _require(120);
            var HASH_UNDEFINED = '__lodash_hash_undefined__';
            function hashSet(key, value) {
                var data = this.__data__;
                data[key] = nativeCreate && value === undefined ? HASH_UNDEFINED : value;
                return this;
            }
            module.exports = hashSet;
        },
        function (module, exports) {
            var baseTimes = _require(65), isArguments = _require(139), isArray = _require(140), isLength = _require(145), isString = _require(148);
            function indexKeys(object) {
                var length = object ? object.length : undefined;
                if (isLength(length) && (isArray(object) || isString(object) || isArguments(object))) {
                    return baseTimes(length, String);
                }
                return null;
            }
            module.exports = indexKeys;
        },
        function (module, exports) {
            function indexOfNaN(array, fromIndex, fromRight) {
                var length = array.length, index = fromIndex + (fromRight ? 1 : -1);
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
                var length = array.length, result = array.constructor(length);
                if (length && typeof array[0] == 'string' && hasOwnProperty.call(array, 'index')) {
                    result.index = array.index;
                    result.input = array.input;
                }
                return result;
            }
            module.exports = initCloneArray;
        },
        function (module, exports) {
            var cloneArrayBuffer = _require(70), cloneDataView = _require(72), cloneMap = _require(73), cloneRegExp = _require(74), cloneSet = _require(75), cloneSymbol = _require(76), cloneTypedArray = _require(77);
            var boolTag = '[object Boolean]', dateTag = '[object Date]', mapTag = '[object Map]', numberTag = '[object Number]', regexpTag = '[object RegExp]', setTag = '[object Set]', stringTag = '[object String]', symbolTag = '[object Symbol]';
            var arrayBufferTag = '[object ArrayBuffer]', dataViewTag = '[object DataView]', float32Tag = '[object Float32Array]', float64Tag = '[object Float64Array]', int8Tag = '[object Int8Array]', int16Tag = '[object Int16Array]', int32Tag = '[object Int32Array]', uint8Tag = '[object Uint8Array]', uint8ClampedTag = '[object Uint8ClampedArray]', uint16Tag = '[object Uint16Array]', uint32Tag = '[object Uint32Array]';
            function initCloneByTag(object, tag, cloneFunc, isDeep) {
                var Ctor = object.constructor;
                switch (tag) {
                case arrayBufferTag:
                    return cloneArrayBuffer(object);
                case boolTag:
                case dateTag:
                    return new Ctor(+object);
                case dataViewTag:
                    return cloneDataView(object, isDeep);
                case float32Tag:
                case float64Tag:
                case int8Tag:
                case int16Tag:
                case int32Tag:
                case uint8Tag:
                case uint8ClampedTag:
                case uint16Tag:
                case uint32Tag:
                    return cloneTypedArray(object, isDeep);
                case mapTag:
                    return cloneMap(object, isDeep, cloneFunc);
                case numberTag:
                case stringTag:
                    return new Ctor(object);
                case regexpTag:
                    return cloneRegExp(object);
                case setTag:
                    return cloneSet(object, isDeep, cloneFunc);
                case symbolTag:
                    return cloneSymbol(object);
                }
            }
            module.exports = initCloneByTag;
        },
        function (module, exports) {
            var baseCreate = _require(55), getPrototype = _require(87), isPrototype = _require(107);
            function initCloneObject(object) {
                return typeof object.constructor == 'function' && !isPrototype(object) ? baseCreate(getPrototype(object)) : {};
            }
            module.exports = initCloneObject;
        },
        function (module, exports) {
            var isArguments = _require(139), isArray = _require(140);
            function isFlattenable(value) {
                return isArray(value) || isArguments(value);
            }
            module.exports = isFlattenable;
        },
        function (module, exports) {
            function isHostObject(value) {
                var result = false;
                if (value != null && typeof value.toString != 'function') {
                    try {
                        result = !!(value + '');
                    } catch (e) {
                    }
                }
                return result;
            }
            module.exports = isHostObject;
        },
        function (module, exports) {
            var MAX_SAFE_INTEGER = 9007199254740991;
            var reIsUint = /^(?:0|[1-9]\d*)$/;
            function isIndex(value, length) {
                length = length == null ? MAX_SAFE_INTEGER : length;
                return !!length && (typeof value == 'number' || reIsUint.test(value)) && (value > -1 && value % 1 == 0 && value < length);
            }
            module.exports = isIndex;
        },
        function (module, exports) {
            var eq = _require(137), isArrayLike = _require(141), isIndex = _require(103), isObject = _require(146);
            function isIterateeCall(value, index, object) {
                if (!isObject(object)) {
                    return false;
                }
                var type = typeof index;
                if (type == 'number' ? isArrayLike(object) && isIndex(index, object.length) : type == 'string' && index in object) {
                    return eq(object[index], value);
                }
                return false;
            }
            module.exports = isIterateeCall;
        },
        function (module, exports) {
            function isKeyable(value) {
                var type = typeof value;
                return type == 'string' || type == 'number' || type == 'symbol' || type == 'boolean' ? value !== '__proto__' : value === null;
            }
            module.exports = isKeyable;
        },
        function (module, exports) {
            var coreJsData = _require(81);
            var maskSrcKey = function () {
                    var uid = /[^.]+$/.exec(coreJsData && coreJsData.keys && coreJsData.keys.IE_PROTO || '');
                    return uid ? 'Symbol(src)_1.' + uid : '';
                }();
            function isMasked(func) {
                return !!maskSrcKey && maskSrcKey in func;
            }
            module.exports = isMasked;
        },
        function (module, exports) {
            var objectProto = Object.prototype;
            function isPrototype(value) {
                var Ctor = value && value.constructor, proto = typeof Ctor == 'function' && Ctor.prototype || objectProto;
                return value === proto;
            }
            module.exports = isPrototype;
        },
        function (module, exports) {
            function iteratorToArray(iterator) {
                var data, result = [];
                while (!(data = iterator.next()).done) {
                    result.push(data.value);
                }
                return result;
            }
            module.exports = iteratorToArray;
        },
        function (module, exports) {
            function listCacheClear() {
                this.__data__ = [];
            }
            module.exports = listCacheClear;
        },
        function (module, exports) {
            var assocIndexOf = _require(52);
            var arrayProto = Array.prototype;
            var splice = arrayProto.splice;
            function listCacheDelete(key) {
                var data = this.__data__, index = assocIndexOf(data, key);
                if (index < 0) {
                    return false;
                }
                var lastIndex = data.length - 1;
                if (index == lastIndex) {
                    data.pop();
                } else {
                    splice.call(data, index, 1);
                }
                return true;
            }
            module.exports = listCacheDelete;
        },
        function (module, exports) {
            var assocIndexOf = _require(52);
            function listCacheGet(key) {
                var data = this.__data__, index = assocIndexOf(data, key);
                return index < 0 ? undefined : data[index][1];
            }
            module.exports = listCacheGet;
        },
        function (module, exports) {
            var assocIndexOf = _require(52);
            function listCacheHas(key) {
                return assocIndexOf(this.__data__, key) > -1;
            }
            module.exports = listCacheHas;
        },
        function (module, exports) {
            var assocIndexOf = _require(52);
            function listCacheSet(key, value) {
                var data = this.__data__, index = assocIndexOf(data, key);
                if (index < 0) {
                    data.push([
                        key,
                        value
                    ]);
                } else {
                    data[index][1] = value;
                }
                return this;
            }
            module.exports = listCacheSet;
        },
        function (module, exports) {
            var Hash = _require(29), ListCache = _require(30), Map = _require(31);
            function mapCacheClear() {
                this.__data__ = {
                    'hash': new Hash(),
                    'map': new (Map || ListCache)(),
                    'string': new Hash()
                };
            }
            module.exports = mapCacheClear;
        },
        function (module, exports) {
            var getMapData = _require(85);
            function mapCacheDelete(key) {
                return getMapData(this, key)['delete'](key);
            }
            module.exports = mapCacheDelete;
        },
        function (module, exports) {
            var getMapData = _require(85);
            function mapCacheGet(key) {
                return getMapData(this, key).get(key);
            }
            module.exports = mapCacheGet;
        },
        function (module, exports) {
            var getMapData = _require(85);
            function mapCacheHas(key) {
                return getMapData(this, key).has(key);
            }
            module.exports = mapCacheHas;
        },
        function (module, exports) {
            var getMapData = _require(85);
            function mapCacheSet(key, value) {
                getMapData(this, key).set(key, value);
                return this;
            }
            module.exports = mapCacheSet;
        },
        function (module, exports) {
            function mapToArray(map) {
                var index = -1, result = Array(map.size);
                map.forEach(function (value, key) {
                    result[++index] = [
                        key,
                        value
                    ];
                });
                return result;
            }
            module.exports = mapToArray;
        },
        function (module, exports) {
            var getNative = _require(86);
            var nativeCreate = getNative(Object, 'create');
            module.exports = nativeCreate;
        },
        function (module, exports) {
            var checkGlobal = _require(69);
            var freeGlobal = checkGlobal(typeof global == 'object' && global);
            var freeSelf = checkGlobal(typeof self == 'object' && self);
            var thisGlobal = checkGlobal(typeof this == 'object' && this);
            var root = freeGlobal || freeSelf || thisGlobal || Function('return this')();
            module.exports = root;
        },
        function (module, exports) {
            var HASH_UNDEFINED = '__lodash_hash_undefined__';
            function setCacheAdd(value) {
                this.__data__.set(value, HASH_UNDEFINED);
                return this;
            }
            module.exports = setCacheAdd;
        },
        function (module, exports) {
            function setCacheHas(value) {
                return this.__data__.has(value);
            }
            module.exports = setCacheHas;
        },
        function (module, exports) {
            function setToArray(set) {
                var index = -1, result = Array(set.size);
                set.forEach(function (value) {
                    result[++index] = value;
                });
                return result;
            }
            module.exports = setToArray;
        },
        function (module, exports) {
            var ListCache = _require(30);
            function stackClear() {
                this.__data__ = new ListCache();
            }
            module.exports = stackClear;
        },
        function (module, exports) {
            function stackDelete(key) {
                return this.__data__['delete'](key);
            }
            module.exports = stackDelete;
        },
        function (module, exports) {
            function stackGet(key) {
                return this.__data__.get(key);
            }
            module.exports = stackGet;
        },
        function (module, exports) {
            function stackHas(key) {
                return this.__data__.has(key);
            }
            module.exports = stackHas;
        },
        function (module, exports) {
            var ListCache = _require(30), MapCache = _require(32);
            var LARGE_ARRAY_SIZE = 200;
            function stackSet(key, value) {
                var cache = this.__data__;
                if (cache instanceof ListCache && cache.__data__.length == LARGE_ARRAY_SIZE) {
                    cache = this.__data__ = new MapCache(cache.__data__);
                }
                cache.set(key, value);
                return this;
            }
            module.exports = stackSet;
        },
        function (module, exports) {
            var funcToString = Function.prototype.toString;
            function toSource(func) {
                if (func != null) {
                    try {
                        return funcToString.call(func);
                    } catch (e) {
                    }
                    try {
                        return func + '';
                    } catch (e) {
                    }
                }
                return '';
            }
            module.exports = toSource;
        },
        function (module, exports) {
            var assignValue = _require(51), copyObject = _require(79), createAssigner = _require(82), isArrayLike = _require(141), isPrototype = _require(107), keysIn = _require(151);
            var objectProto = Object.prototype;
            var propertyIsEnumerable = objectProto.propertyIsEnumerable;
            var nonEnumShadows = !propertyIsEnumerable.call({ 'valueOf': 1 }, 'valueOf');
            var assignIn = createAssigner(function (object, source) {
                    if (nonEnumShadows || isPrototype(source) || isArrayLike(source)) {
                        copyObject(source, keysIn(source), object);
                        return;
                    }
                    for (var key in source) {
                        assignValue(object, key, source[key]);
                    }
                });
            module.exports = assignIn;
        },
        function (module, exports) {
            var copyObject = _require(79), createAssigner = _require(82), keysIn = _require(151);
            var assignInWith = createAssigner(function (object, source, srcIndex, customizer) {
                    copyObject(source, keysIn(source), object, customizer);
                });
            module.exports = assignInWith;
        },
        function (module, exports) {
            var baseClone = _require(54);
            function clone(value) {
                return baseClone(value, false, true);
            }
            module.exports = clone;
        },
        function (module, exports) {
            var baseClone = _require(54);
            function cloneDeep(value) {
                return baseClone(value, true, true);
            }
            module.exports = cloneDeep;
        },
        function (module, exports) {
            var apply = _require(43), assignInDefaults = _require(50), assignInWith = _require(132), rest = _require(152);
            var defaults = rest(function (args) {
                    args.push(undefined, assignInDefaults);
                    return apply(assignInWith, undefined, args);
                });
            module.exports = defaults;
        },
        function (module, exports) {
            var baseDifference = _require(56), baseFlatten = _require(57), isArrayLikeObject = _require(142), rest = _require(152);
            var difference = rest(function (array, values) {
                    return isArrayLikeObject(array) ? baseDifference(array, baseFlatten(values, 1, isArrayLikeObject, true)) : [];
                });
            module.exports = difference;
        },
        function (module, exports) {
            function eq(value, other) {
                return value === other || value !== value && other !== other;
            }
            module.exports = eq;
        },
        function (module, exports) {
            module.exports = _require(131);
        },
        function (module, exports) {
            var isArrayLikeObject = _require(142);
            var argsTag = '[object Arguments]';
            var objectProto = Object.prototype;
            var hasOwnProperty = objectProto.hasOwnProperty;
            var objectToString = objectProto.toString;
            var propertyIsEnumerable = objectProto.propertyIsEnumerable;
            function isArguments(value) {
                return isArrayLikeObject(value) && hasOwnProperty.call(value, 'callee') && (!propertyIsEnumerable.call(value, 'callee') || objectToString.call(value) == argsTag);
            }
            module.exports = isArguments;
        },
        function (module, exports) {
            var isArray = Array.isArray;
            module.exports = isArray;
        },
        function (module, exports) {
            var getLength = _require(84), isFunction = _require(144), isLength = _require(145);
            function isArrayLike(value) {
                return value != null && isLength(getLength(value)) && !isFunction(value);
            }
            module.exports = isArrayLike;
        },
        function (module, exports) {
            var isArrayLike = _require(141), isObjectLike = _require(147);
            function isArrayLikeObject(value) {
                return isObjectLike(value) && isArrayLike(value);
            }
            module.exports = isArrayLikeObject;
        },
        function (module, exports) {
            var root = _require(121), stubFalse = _require(154);
            var freeExports = typeof exports == 'object' && exports;
            var freeModule = freeExports && typeof module == 'object' && module;
            var moduleExports = freeModule && freeModule.exports === freeExports;
            var Buffer = moduleExports ? root.Buffer : undefined;
            var isBuffer = !Buffer ? stubFalse : function (value) {
                    return value instanceof Buffer;
                };
            module.exports = isBuffer;
        },
        function (module, exports) {
            var isObject = _require(146);
            var funcTag = '[object Function]', genTag = '[object GeneratorFunction]';
            var objectProto = Object.prototype;
            var objectToString = objectProto.toString;
            function isFunction(value) {
                var tag = isObject(value) ? objectToString.call(value) : '';
                return tag == funcTag || tag == genTag;
            }
            module.exports = isFunction;
        },
        function (module, exports) {
            var MAX_SAFE_INTEGER = 9007199254740991;
            function isLength(value) {
                return typeof value == 'number' && value > -1 && value % 1 == 0 && value <= MAX_SAFE_INTEGER;
            }
            module.exports = isLength;
        },
        function (module, exports) {
            function isObject(value) {
                var type = typeof value;
                return !!value && (type == 'object' || type == 'function');
            }
            module.exports = isObject;
        },
        function (module, exports) {
            function isObjectLike(value) {
                return !!value && typeof value == 'object';
            }
            module.exports = isObjectLike;
        },
        function (module, exports) {
            var isArray = _require(140), isObjectLike = _require(147);
            var stringTag = '[object String]';
            var objectProto = Object.prototype;
            var objectToString = objectProto.toString;
            function isString(value) {
                return typeof value == 'string' || !isArray(value) && isObjectLike(value) && objectToString.call(value) == stringTag;
            }
            module.exports = isString;
        },
        function (module, exports) {
            var isObjectLike = _require(147);
            var symbolTag = '[object Symbol]';
            var objectProto = Object.prototype;
            var objectToString = objectProto.toString;
            function isSymbol(value) {
                return typeof value == 'symbol' || isObjectLike(value) && objectToString.call(value) == symbolTag;
            }
            module.exports = isSymbol;
        },
        function (module, exports) {
            var baseHas = _require(59), baseKeys = _require(62), indexKeys = _require(96), isArrayLike = _require(141), isIndex = _require(103), isPrototype = _require(107);
            function keys(object) {
                var isProto = isPrototype(object);
                if (!(isProto || isArrayLike(object))) {
                    return baseKeys(object);
                }
                var indexes = indexKeys(object), skipIndexes = !!indexes, result = indexes || [], length = result.length;
                for (var key in object) {
                    if (baseHas(object, key) && !(skipIndexes && (key == 'length' || isIndex(key, length))) && !(isProto && key == 'constructor')) {
                        result.push(key);
                    }
                }
                return result;
            }
            module.exports = keys;
        },
        function (module, exports) {
            var baseKeysIn = _require(63), indexKeys = _require(96), isIndex = _require(103), isPrototype = _require(107);
            var objectProto = Object.prototype;
            var hasOwnProperty = objectProto.hasOwnProperty;
            function keysIn(object) {
                var index = -1, isProto = isPrototype(object), props = baseKeysIn(object), propsLength = props.length, indexes = indexKeys(object), skipIndexes = !!indexes, result = indexes || [], length = result.length;
                while (++index < propsLength) {
                    var key = props[index];
                    if (!(skipIndexes && (key == 'length' || isIndex(key, length))) && !(key == 'constructor' && (isProto || !hasOwnProperty.call(object, key)))) {
                        result.push(key);
                    }
                }
                return result;
            }
            module.exports = keysIn;
        },
        function (module, exports) {
            var apply = _require(43), toInteger = _require(156);
            var FUNC_ERROR_TEXT = 'Expected a function';
            var nativeMax = Math.max;
            function rest(func, start) {
                if (typeof func != 'function') {
                    throw new TypeError(FUNC_ERROR_TEXT);
                }
                start = nativeMax(start === undefined ? func.length - 1 : toInteger(start), 0);
                return function () {
                    var args = arguments, index = -1, length = nativeMax(args.length - start, 0), array = Array(length);
                    while (++index < length) {
                        array[index] = args[start + index];
                    }
                    switch (start) {
                    case 0:
                        return func.call(this, array);
                    case 1:
                        return func.call(this, args[0], array);
                    case 2:
                        return func.call(this, args[0], args[1], array);
                    }
                    var otherArgs = Array(start + 1);
                    index = -1;
                    while (++index < start) {
                        otherArgs[index] = args[index];
                    }
                    otherArgs[start] = array;
                    return apply(func, this, otherArgs);
                };
            }
            module.exports = rest;
        },
        function (module, exports) {
            function stubArray() {
                return [];
            }
            module.exports = stubArray;
        },
        function (module, exports) {
            function stubFalse() {
                return false;
            }
            module.exports = stubFalse;
        },
        function (module, exports) {
            var toNumber = _require(157);
            var INFINITY = 1 / 0, MAX_INTEGER = 1.7976931348623157e+308;
            function toFinite(value) {
                if (!value) {
                    return value === 0 ? value : 0;
                }
                value = toNumber(value);
                if (value === INFINITY || value === -INFINITY) {
                    var sign = value < 0 ? -1 : 1;
                    return sign * MAX_INTEGER;
                }
                return value === value ? value : 0;
            }
            module.exports = toFinite;
        },
        function (module, exports) {
            var toFinite = _require(155);
            function toInteger(value) {
                var result = toFinite(value), remainder = result % 1;
                return result === result ? remainder ? result - remainder : result : 0;
            }
            module.exports = toInteger;
        },
        function (module, exports) {
            var isFunction = _require(144), isObject = _require(146), isSymbol = _require(149);
            var NAN = 0 / 0;
            var reTrim = /^\s+|\s+$/g;
            var reIsBadHex = /^[-+]0x[0-9a-f]+$/i;
            var reIsBinary = /^0b[01]+$/i;
            var reIsOctal = /^0o[0-7]+$/i;
            var freeParseInt = parseInt;
            function toNumber(value) {
                if (typeof value == 'number') {
                    return value;
                }
                if (isSymbol(value)) {
                    return NAN;
                }
                if (isObject(value)) {
                    var other = isFunction(value.valueOf) ? value.valueOf() : value;
                    value = isObject(other) ? other + '' : other;
                }
                if (typeof value != 'string') {
                    return value === 0 ? value : +value;
                }
                value = value.replace(reTrim, '');
                var isBinary = reIsBinary.test(value);
                return isBinary || reIsOctal.test(value) ? freeParseInt(value.slice(2), isBinary ? 2 : 8) : reIsBadHex.test(value) ? NAN : +value;
            }
            module.exports = toNumber;
        },
        function (module, exports) {
            var assignValue = _require(51), baseZipObject = _require(67);
            function zipObject(props, values) {
                return baseZipObject(props || [], values || [], assignValue);
            }
            module.exports = zipObject;
        }
    ];
    return _require(7);
}));
//# sourceMappingURL=futoin-invoker.js.map