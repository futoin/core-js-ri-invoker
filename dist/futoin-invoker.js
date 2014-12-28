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
            var common = _require(3);
            var FutoInError = common.FutoInError;
            var optname = common.Options;
            var simpleccm_impl = _require(6);
            var fs;
            var isNode = _require(7);
            var _ = _require(9);
            if (isNode) {
                var hidereq = require;
                fs = hidereq('fs');
            }
            exports = module.exports = function (options) {
                return new module.exports.AdvancedCCMImpl(options);
            };
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
                    loadSpec: function (as, info, specdirs) {
                        var raw_spec = null;
                        var fn = info.iface + '-' + info.version + '-iface.json';
                        for (var i = 0, v; i < specdirs.length; ++i) {
                            v = specdirs[i];
                            if (typeof v === 'string') {
                                v = v + '/' + fn;
                                if (fs && fs.existsSync(v)) {
                                    v = fs.readFileSync(v, { encoding: 'utf8' });
                                    v = JSON.parse(v);
                                } else {
                                    continue;
                                }
                            }
                            if (typeof v === 'object' && v.iface === info.iface && v.version === info.version && 'funcs' in v) {
                                raw_spec = v;
                                break;
                            }
                        }
                        if (raw_spec === null) {
                            as.error(FutoInError.InternalError, 'Failed to load valid spec for ' + info.iface + ':' + info.version);
                        }
                        info.funcs = _.cloneDeep(raw_spec.funcs);
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
                        if ('requires' in raw_spec) {
                            var requires = raw_spec.requires;
                            if (!Array.isArray(requires)) {
                                as.error(FutoInError.InternalError, '"requires" is not array');
                            }
                            info.constraints = _.object(requires, requires);
                        } else {
                            info.constraints = {};
                        }
                        info.inherits = [];
                        if (!('inherit' in raw_spec)) {
                            return;
                        }
                        var sup_info = {};
                        var m = raw_spec.inherit.match(common._ifacever_pattern);
                        if (m === null) {
                            as.error(FutoInError.InvokerError, 'Invalid inherit ifacever: ' + raw_spec.inherit);
                        }
                        sup_info.iface = m[1];
                        sup_info.version = m[4];
                        spectools.loadSpec(as, sup_info, specdirs);
                        for (f in sup_info.funcs) {
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
                        info.inherits.push(raw_spec.inherit);
                        info.inherits = info.inherits.concat(sup_info.inherits);
                        if (_.difference(Object.keys(sup_info.constraints), raw_spec.requires).length) {
                            as.error(FutoInError.InternalError, 'Missing constraints from inherited');
                        }
                    },
                    checkFutoInType: function (as, type, varname, val) {
                        var rtype = '';
                        switch (type) {
                        case 'boolean':
                        case 'string':
                            rtype = type;
                            break;
                        case 'map':
                            rtype = 'object';
                            break;
                        case 'number':
                            rtype = 'number';
                            break;
                        case 'integer':
                            if (typeof val !== 'number' || (val | 0) !== val) {
                                as.error(FutoInError.InvalidRequest, 'Type mismatch for parameter: ' + varname);
                            }
                            return;
                        case 'array':
                            if (!(val instanceof Array)) {
                                as.error(FutoInError.InvalidRequest, 'Type mismatch for parameter: ' + varname);
                            }
                            return;
                        }
                        if (typeof val !== rtype) {
                            as.error(FutoInError.InvalidRequest, 'Type mismatch for parameter: ' + varname);
                        }
                    }
                };
            exports.SpecTools = spectools;
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
                    spectools.loadSpec(as, info, this.options[optname.OPT_SPEC_DIRS]);
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
                        spectools.checkFutoInType(as, finfo.params[k].type, k, params[k]);
                    }
                    for (k in finfo.params) {
                        if (!params.hasOwnProperty(k) && !finfo.params[k].hasOwnProperty('default')) {
                            as.error(FutoInError.InvokerError, 'Missing parameter ' + k);
                        }
                    }
                },
                createMessage: function (as, ctx, params) {
                    if (!this.options[optname.OPT_PROD_MODE]) {
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
                    var func_info = info.funcs[ctx.name];
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
                            spectools.checkFutoInType(as, resvars[k].type, k, rsp.r[k]);
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
                perfomHTTP: simpleccm_impl.SimpleCCMImpl.prototype.perfomHTTP,
                perfomWebSocket: simpleccm_impl.SimpleCCMImpl.prototype.perfomWebSocket,
                perfomUNIX: simpleccm_impl.SimpleCCMImpl.prototype.perfomUNIX
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
                    window.FutoIn = futoin;
                    if (module) {
                        module.exports = FutoInInvoker;
                    }
                }
            }(window));
        },
        function (module, exports) {
            'use strict';
            exports.HTTPComms = function () {
            };
            exports.HTTPComms.prototype = {
                perform: function () {
                }
            };
            exports.WSComms = function () {
            };
            exports.WSComms.prototype = {
                perform: function () {
                }
            };
        },
        function (module, exports) {
            'use strict';
            var async_steps = _require(8);
            exports.AsyncSteps = async_steps;
            exports.FutoInError = async_steps.FutoInError;
            exports.Options = {
                OPT_CALL_TIMEOUT_MS: 'CALL_TIMEOUT_MS',
                OPT_X509_VERIFY: 'X509_VERIFY',
                OPT_PROD_MODE: 'PROD_MODE',
                OPT_COMM_CONFIG_CB: 'COMM_CONFIG_CB',
                OPT_SPEC_DIRS: 'SPEC_DIRS'
            };
            exports._ifacever_pattern = /^(([a-z][a-z0-9]*)(\.[a-z][a-z0-9]*)*):(([0-9]+)\.([0-9]+))$/;
        },
        function (module, exports) {
            'use strict';
            var common = _require(3);
            var futoin_error = common.FutoInError;
            var native_iface = _require(5);
            var _ = _require(9);
            var simple_ccm = _require(6);
            var advanced_ccm = _require(0);
            var SimpleCCMPublic = {
                    SVC_RESOLVER: '#resolver',
                    SVC_AUTH: '#auth',
                    SVC_DEFENSE: '#defense',
                    SVC_ACL: '#acl',
                    SVC_LOG: '#log',
                    SVC_CACHE_L1: '#cachel1',
                    SVC_CACHE_L2: '#cachel2',
                    SVC_CACHE_L3: '#cachel3'
                };
            _.extend(SimpleCCMPublic, common.Options);
            function SimpleCCM(options) {
                this._iface_info = {};
                this._iface_impl = {};
                this._impl = simple_ccm(options);
            }
            _.extend(SimpleCCM, SimpleCCMPublic);
            var SimpleCCMProto = {
                    SVC_RESOLVER: '#resolver',
                    SVC_AUTH: '#auth',
                    SVC_DEFENSE: '#defense',
                    SVC_ACL: '#acl',
                    SVC_LOG: '#log',
                    SVC_CACHE_L1: '#cachel1',
                    SVC_CACHE_L2: '#cachel2',
                    SVC_CACHE_L3: '#cachel3',
                    _secure_replace: /^secure\+/,
                    _secure_test: /^(https|wss|unix):\/\//,
                    _native_iface_builder: function (ccmimpl, info) {
                        return native_iface(ccmimpl, info);
                    }
                };
            _.extend(SimpleCCMProto, SimpleCCMPublic);
            SimpleCCMProto.register = function (as, name, ifacever, endpoint, credentials, options) {
                if (name in this._iface_info) {
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
                if (typeof endpoint === 'string') {
                    if (this._secure_replace.test(endpoint)) {
                        secure_channel = true;
                        endpoint = endpoint.replace(this._secure_replace, '');
                    } else if (this._secure_test.test(endpoint)) {
                        secure_channel = true;
                    }
                    impl = this._native_iface_builder;
                } else {
                    impl = endpoint;
                    endpoint = null;
                }
                options = options || {};
                _.defaults(options, this._impl.options);
                var info = {
                        iface: iface,
                        version: mjrmnr,
                        mjrver: mjr,
                        mnrver: mnr,
                        endpoint: endpoint,
                        creds: credentials || null,
                        secure_channel: secure_channel,
                        impl: impl,
                        regname: name,
                        inherits: null,
                        funcs: null,
                        constraints: null,
                        options: options
                    };
                this._iface_info[name] = info;
                this._impl.onRegister(as, info);
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
            SimpleCCMProto.burst = function () {
                throw new Error(futoin_error.NotImplemented);
            };
            SimpleCCMProto.cache_l1 = function () {
                return this.iface(this.SVC_CACHE_L1);
            };
            SimpleCCMProto.cache_l2 = function () {
                return this.iface(this.SVC_CACHE_L2);
            };
            SimpleCCMProto.cache_l3 = function () {
                return this.iface(this.SVC_CACHE_L3);
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
            exports.SpecTools = advanced_ccm.SpecTools;
            exports.SpecTools._ifacever_pattern = common._ifacever_pattern;
        },
        function (module, exports) {
            'use strict';
            var invoker = _require(4);
            var _ = _require(9);
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
                    var ctx = {
                            ccmimpl: this._ccmimpl,
                            name: name,
                            info: this._raw_info,
                            upload_data: upload_data,
                            download_stream: download_stream,
                            rsp_content_type: null,
                            native_iface: this,
                            options: this._raw_info.options,
                            endpoint: this._raw_info.endpoint,
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
                        var schema = ctx.endpoint.split(':')[0];
                        if (schema === 'http' || schema === 'https') {
                            ccmimpl.perfomHTTP(as, ctx, req);
                        } else if (schema === 'ws' || schema === 'wss') {
                            var finfo;
                            if (ctx.upload_data || ctx.download_stream || ctx.info.funcs && (finfo = ctx.info.funcs[name]) && finfo.rawresult) {
                                ctx.endpoint = ctx.endpoint.replace('ws', 'http');
                                ccmimpl.perfomHTTP(as, ctx, req);
                            } else {
                                ccmimpl.perfomWebSocket(as, ctx, req);
                            }
                        } else if (ctx.upload_data) {
                            as.error(invoker.FutoInError.InvokerError, 'Upload data is allowed only for HTTP/WS endpoints');
                        } else if (ctx.download_stream) {
                            as.error(invoker.FutoInError.InvokerError, 'Download stream is allowed only for HTTP/WS endpoints');
                        } else if (schema === 'unix') {
                            ccmimpl.perfomUNIX(as, ctx, req);
                        } else {
                            as.error(invoker.FutoInError.InvokerError, 'Unknown endpoint schema');
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
            var isNode = _require(7);
            var _ = _require(9);
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
                perfomHTTP: function (as, ctx, req) {
                    var native_iface = ctx.native_iface;
                    if (!('_httpcomms' in native_iface)) {
                        native_iface._httpcomms = new comms.HTTPComms();
                    }
                    native_iface._httpcomms.perform(as, ctx, req);
                },
                perfomWebSocket: function (as, ctx, req) {
                    var native_iface = ctx.native_iface;
                    if (!('_wscomms' in native_iface)) {
                        native_iface._wscomms = new comms.WSComms();
                    }
                    native_iface._wscomms.perform(as, ctx, req);
                },
                perfomUNIX: function (as, ctx, req) {
                    void ctx;
                    void req;
                    as.error(FutoInError.InvokerError, 'Not Implemented');
                }
            };
            exports.SimpleCCMImpl = SimpleCCMImpl;
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
        }
    ];
    return _require(1);
}));
//# sourceMappingURL=futoin-invoker.js.map