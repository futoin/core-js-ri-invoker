
  [![NPM Version](https://img.shields.io/npm/v/futoin-invoker.svg?style=flat)](https://www.npmjs.com/package/futoin-invoker)
  [![NPM Downloads](https://img.shields.io/npm/dm/futoin-invoker.svg?style=flat)](https://www.npmjs.com/package/futoin-invoker)
  [![Build Status](https://travis-ci.org/futoin/core-js-ri-invoker.svg?branch=master)](https://travis-ci.org/futoin/core-js-ri-invoker)
  [![stable](https://img.shields.io/badge/stability-stable-green.svg?style=flat)](https://www.npmjs.com/package/futoin-asyncsteps)

  [![NPM](https://nodei.co/npm/futoin-invoker.png?downloads=true&downloadRank=true&stars=true)](https://nodei.co/npm/futoin-invoker/)

**[Stability: 3 - Stable](http://nodejs.org/api/documentation.html)**

# FutoIn reference implementation

Reference implementation of:
 
    FTN7: FutoIn Invoker Concept
    Version: 1.4
    
    FTN3: FutoIn Interface Definition
    Version: 1.2

    FTN5: FutoIn HTTP integration
    Version: 1.2

    FTN9: FutoIn Interface - AuditLog
    Version: 1.0 (client)

    FTN14: FutoIn Cache
    Version: 1.0 (client)
    
* Spec: [FTN7: Interface Invoker Concept v1.x](http://specs.futoin.org/final/preview/ftn7_iface_invoker_concept-1.html)
* Spec: [FTN3: FutoIn Interface Definition v1.x](http://specs.futoin.org/final/preview/ftn3_iface_definition.html)
* Spec: [FTN5: FutoIn HTTP integration v1.x](http://specs.futoin.org/final/preview/ftn5_iface_http_integration.html)
* Spec: [FTN9: FutoIn Interface - AuditLog v1.x](http://specs.futoin.org/final/preview/ftn9_if_auditlog.html)
* Spec: [FTN14: FutoIn Cache v1.x](http://specs.futoin.org/final/preview/ftn14_cache.html)

[Web Site](http://futoin.org/)

# About

FutoIn Invoker is a peer which initiates a request - invokes a FutoIn interface method
as described in [FTN3: FutoIn Interface Definition](http://specs.futoin.org/final/preview/ftn3_iface_definition.html).
It is not necessary a client - e.g. server may initiate request for event delivery to client.

The method can be implemented locally or remotely - it is transparent to invoking code.
A similar concept can be found in CORBA and other more heavy request brokers.

Strict FutoIn interface (iface) definition and transport protocol is defined in FTN3 spec mentioned above.
**As it is based on JSON, both client and server can be implemented in a few minutes almost in
any technology.** *However, Invoker and Executor concept provide significant benefits for 
efficiency, reliability and error control.*

**The core of invoker is CCM - Connection and Credentials Manager**.
It has the following advantages:

* A single place to configure & hold sensitive data (like credentials)
* Transparent connection management (no need for special connect/request/response/disconnect logic)
* Efficient use of communications (keep-alive, persistent WebSockets channels,
    channel-based instead of message-based security, etc.)
* Inversion of Control / Dependency Injection - implementations are referenced by 
    static names like "mymodule.some.service" in code. The rest is hidden in CCM configuration.
* Easy HMAC-based message signature and user authentication
* Security enforcement

The primary communication channel is WebSockets. Large raw data upload and download
is also supported through automatic fallback to HTTP(S).

SimpleCCM - a light version without heavy processing of iface definition (ideal for browser)
AdvancedCCM - full featured CCM (extends SimpleCCM)

Communication methods:

* HTTP/HTTPS - remote calls
* WS/WSS - WebSockets remote calls with bi-directional sockets
* HTML5 Web Messaging - same- and cross-origin local calls **inside Browser through window.postMessage() API**
* Same Process - optimized for single instance deployment

*Note: Invoker and Executor are platform/technology-neutral concepts. The implementation
is already available in JS and PHP. Hopefully, others are upcoming*


# Installation for Node.js

Command line:
```sh
$ npm install futoin-invoker --save
```

All public classes can be accessed through module:
```javascript
var AdvancedCCM = require('futoin-invoker').AdvancedCCM;
```

or included modular way, e.g.:
```javascript
var AdvancedCCM = require('futoin-invoker/AdvancedCCM');
```

# Installation for Browser

```sh
$ bower install futoin-invoker --save
```

Please note that browser build is available under in dist/ folder in sources generated
with [pure-sjc](https://github.com/RReverser/pure-cjs). It includes modular parts of
[lodash](https://www.npmjs.com/package/lodash).

*Note: there are the following globals available*:

* SimpleCCM - global reference to futoin-invoker.SimpleCCM class
* AdvancedCCM - global reference to futoin-invoker.AdvancedCCM class
* futoin.Invoker - global reference to futoin-invoker module

# Examples

NOTE: more complex examples should be found in (futoin-executor)[https://github.com/futoin/core-js-ri-executor/]

## Call remote function with SimpleCCM

```javascript
var async_steps = require( 'futoin-asyncsteps' );
var invoker = require( 'futoin-invoker' );

var ccm = new invoker.SimpleCCM();

async_steps()
.add(
    function( as ){
        ccm.register( as, 'localone', 'some.iface:1.0', 'https://localhost/some/path' );
        ccm.register( as, 'localtwo', 'other.iface:1.0', 'https://localhost/some/path' );

        as.add( function( as ){
            var localone = ccm.iface( 'localone' );
            var localtwo = ccm.iface( 'localtwo' );
            
            localone.call( as, 'somefunc', {
                arg1 : 1,
                arg2 : 'abc',
                arg3 : true,
            } );
            
            as.add( function( as, res ){
                console.log( res.result1, res.result2 );
            } );
        } );
    },
    function( as, err )
    {
        console.log( err + ': ' + as.state.error_info );
        console.log( as.state.last_exception.stack );
    }
)
.execute();
```

## Call remote function with AdvancedCCM

```javascript
var async_steps = require( 'futoin-asyncsteps' );
var invoker = require( 'futoin-invoker' );

var some_iface_v1_0 = {
    "iface" : "some.iface",
    "version" : "1.0",
    "ftn3rev" : "1.1",
    "funcs" : {
        "get" : {
            "params" : {
                "arg1" : {
                    "type" : "integer"
                },
                "arg2" : {
                    "type" : "string"
                },
                "arg3" : {
                    "type" : "boolean"
                }
            },
            "result" : {
                "result1" : {
                    "type" : "number"
                },
                "result2" : {
                    "type" : "any"
                }
            },
            "throws" : [
                "MyError"
            ]
        }
    },
    "requires" : [
        "SecureChannel",
        "AllowAnonymous"
    ]
};

var ccm = new invoker.AdvancedCCM({
    specDirs : [ __dirname + '/specs', some_iface_v1_0 ]
});

async_steps()
.add(
    function( as ){
        ccm.register( as, 'localone', 'some.iface:1.0', 'https://localhost/some/path' );
        ccm.register( as, 'localtwo', 'other.iface:1.0', 'https://localhost/some/path' );

        as.add( function( as ){
            var localone = ccm.iface( 'localone' );
            var localtwo = ccm.iface( 'localtwo' );
            
            localone.call( as, 'somefunc', {
                arg1 : 1,
                arg2 : 'abc',
                arg3 : true,
            } );
            
            as.add( function( as, res ){
                console.log( res.result1, res.result2 );
            } );
        } );
    },
    function( as, err )
    {
        console.log( err + ': ' + as.state.error_info );
        console.log( as.state.last_exception.stack );
    }
)
.execute();
```
    
# API documentation

The concept is described in FutoIn specification: [FTN7: Interface Invoker Concept v1.x](http://specs.futoin.org/final/preview/ftn7_iface_invoker_concept-1.html)

#Index

**Modules**

* [futoin-invoker](#module_futoin-invoker)

**Classes**

* [class: AdvancedCCM](#AdvancedCCM)
  * [new AdvancedCCM()](#new_AdvancedCCM)
  * [advancedCCM.register(as, name, ifacever, endpoint, [credentials], [options])](#AdvancedCCM#register)
  * [advancedCCM.iface(name)](#AdvancedCCM#iface)
  * [advancedCCM.unRegister(name)](#AdvancedCCM#unRegister)
  * [advancedCCM.defense()](#AdvancedCCM#defense)
  * [advancedCCM.log()](#AdvancedCCM#log)
  * [advancedCCM.cache()](#AdvancedCCM#cache)
  * [advancedCCM.assertIface(name, ifacever)](#AdvancedCCM#assertIface)
  * [advancedCCM.alias(name, alias)](#AdvancedCCM#alias)
  * [advancedCCM.close()](#AdvancedCCM#close)
  * [event: "register"](#AdvancedCCM#event_register)
  * [event: "unregister"](#AdvancedCCM#event_unregister)
  * [event: "close"](#AdvancedCCM#event_close)
* [class: CacheFace](#CacheFace)
  * [new CacheFace()](#new_CacheFace)
  * [CacheFace.ifacespec](#CacheFace.ifacespec)
  * [CacheFace.register()](#CacheFace.register)
  * [cacheFace.getOrSet(as, key_prefix, callable, params, ttl_ms)](#CacheFace#getOrSet)
  * [cacheFace.call(as, name, params, upload_data, [download_stream], [timeout])](#CacheFace#call)
  * [cacheFace.ifaceInfo()](#CacheFace#ifaceInfo)
  * [cacheFace.bindDerivedKey()](#CacheFace#bindDerivedKey)
  * [event: "connect"](#CacheFace#event_connect)
  * [event: "disconnect"](#CacheFace#event_disconnect)
  * [event: "close"](#CacheFace#event_close)
  * [event: "commError"](#CacheFace#event_commError)
* [class: InterfaceInfo](#InterfaceInfo)
  * [new InterfaceInfo()](#new_InterfaceInfo)
  * [interfaceInfo.name()](#InterfaceInfo#name)
  * [interfaceInfo.version()](#InterfaceInfo#version)
  * [interfaceInfo.inherits()](#InterfaceInfo#inherits)
  * [interfaceInfo.funcs()](#InterfaceInfo#funcs)
  * [interfaceInfo.constraints()](#InterfaceInfo#constraints)
* [class: LogFace](#LogFace)
  * [new LogFace()](#new_LogFace)
  * [LogFace.ifacespec](#LogFace.ifacespec)
  * [LogFace.register()](#LogFace.register)
  * [logFace.msg(lvl, txt)](#LogFace#msg)
  * [logFace.hexdump(lvl, txt, data)](#LogFace#hexdump)
  * [logFace.debug(txt)](#LogFace#debug)
  * [logFace.info(txt)](#LogFace#info)
  * [logFace.warn(txt)](#LogFace#warn)
  * [logFace.error(txt)](#LogFace#error)
  * [logFace.security(txt)](#LogFace#security)
  * [logFace.call(as, name, params, upload_data, [download_stream], [timeout])](#LogFace#call)
  * [logFace.ifaceInfo()](#LogFace#ifaceInfo)
  * [logFace.bindDerivedKey()](#LogFace#bindDerivedKey)
  * [const: LogFace.LVL_DEBUG](#LogFace.LVL_DEBUG)
  * [const: LogFace.LVL_INFO](#LogFace.LVL_INFO)
  * [const: LogFace.LVL_WARN](#LogFace.LVL_WARN)
  * [const: LogFace.LVL_ERROR](#LogFace.LVL_ERROR)
  * [const: LogFace.LVL_SECURITY](#LogFace.LVL_SECURITY)
  * [event: "connect"](#LogFace#event_connect)
  * [event: "disconnect"](#LogFace#event_disconnect)
  * [event: "close"](#LogFace#event_close)
  * [event: "commError"](#LogFace#event_commError)
* [class: NativeIface](#NativeIface)
  * [new NativeIface()](#new_NativeIface)
  * [nativeIface.call(as, name, params, upload_data, [download_stream], [timeout])](#NativeIface#call)
  * [nativeIface.ifaceInfo()](#NativeIface#ifaceInfo)
  * [nativeIface.bindDerivedKey()](#NativeIface#bindDerivedKey)
  * [event: "connect"](#NativeIface#event_connect)
  * [event: "disconnect"](#NativeIface#event_disconnect)
  * [event: "close"](#NativeIface#event_close)
  * [event: "commError"](#NativeIface#event_commError)
* [class: SimpleCCM](#SimpleCCM)
  * [new SimpleCCM([options])](#new_SimpleCCM)
  * [simpleCCM.register(as, name, ifacever, endpoint, [credentials], [options])](#SimpleCCM#register)
  * [simpleCCM.iface(name)](#SimpleCCM#iface)
  * [simpleCCM.unRegister(name)](#SimpleCCM#unRegister)
  * [simpleCCM.defense()](#SimpleCCM#defense)
  * [simpleCCM.log()](#SimpleCCM#log)
  * [simpleCCM.cache()](#SimpleCCM#cache)
  * [simpleCCM.assertIface(name, ifacever)](#SimpleCCM#assertIface)
  * [simpleCCM.alias(name, alias)](#SimpleCCM#alias)
  * [simpleCCM.close()](#SimpleCCM#close)
  * [const: SimpleCCM.SAFE_PAYLOAD_LIMIT](#SimpleCCM.SAFE_PAYLOAD_LIMIT)
  * [const: SimpleCCM.SVC_RESOLVER](#SimpleCCM.SVC_RESOLVER)
  * [const: SimpleCCM.SVC_AUTH](#SimpleCCM.SVC_AUTH)
  * [const: SimpleCCM.SVC_DEFENSE](#SimpleCCM.SVC_DEFENSE)
  * [const: SimpleCCM.SVC_ACL](#SimpleCCM.SVC_ACL)
  * [const: SimpleCCM.SVC_LOG](#SimpleCCM.SVC_LOG)
  * [const: SimpleCCM.SVC_CACHE_](#SimpleCCM.SVC_CACHE_)
  * [event: "register"](#SimpleCCM#event_register)
  * [event: "unregister"](#SimpleCCM#event_unregister)
  * [event: "close"](#SimpleCCM#event_close)
* [class: SpecTools](#SpecTools)
  * [new SpecTools()](#new_SpecTools)
  * [SpecTools.loadIface(as, info, specdirs)](#SpecTools.loadIface)
  * [SpecTools.parseIface(as, info, specdirs, raw_spec)](#SpecTools.parseIface)
  * [SpecTools.checkConsistency(as, info)](#SpecTools.checkConsistency)
  * [SpecTools.checkType(info, type, val)](#SpecTools.checkType)
  * [SpecTools.checkParameterType(info, funcname, varname, value)](#SpecTools.checkParameterType)
  * [SpecTools.checkResultType(as, info, funcname, varname, value)](#SpecTools.checkResultType)
  * [SpecTools.genHMAC(as, info, ftnreq)](#SpecTools.genHMAC)
  * [const: SpecTools.standard_errors](#SpecTools.standard_errors)
* [class: AdvancedCCMOptions](#AdvancedCCMOptions)
  * [new AdvancedCCMOptions()](#new_AdvancedCCMOptions)
  * [AdvancedCCMOptions.specDirs](#AdvancedCCMOptions.specDirs)
  * [AdvancedCCMOptions.hmacKey](#AdvancedCCMOptions.hmacKey)
  * [AdvancedCCMOptions.hmacAlgo](#AdvancedCCMOptions.hmacAlgo)
* [class: SimpleCCMOptions](#SimpleCCMOptions)
  * [new SimpleCCMOptions()](#new_SimpleCCMOptions)
  * [SimpleCCMOptions.callTimeoutMS](#SimpleCCMOptions.callTimeoutMS)
  * [SimpleCCMOptions.prodMode](#SimpleCCMOptions.prodMode)
  * [SimpleCCMOptions.commConfigCallback](#SimpleCCMOptions.commConfigCallback)
  * [SimpleCCMOptions.executor](#SimpleCCMOptions.executor)
  * [SimpleCCMOptions.targetOrigin](#SimpleCCMOptions.targetOrigin)
  * [SimpleCCMOptions.retryCount](#SimpleCCMOptions.retryCount)
  * [SimpleCCMOptions.messageSniffer()](#SimpleCCMOptions.messageSniffer)
  * [SimpleCCMOptions.disconnectSniffer()](#SimpleCCMOptions.disconnectSniffer)

**Members**

* [SimpleCCM](#SimpleCCM)
  * [simpleCCM.register(as, name, ifacever, endpoint, [credentials], [options])](#SimpleCCM#register)
  * [simpleCCM.iface(name)](#SimpleCCM#iface)
  * [simpleCCM.unRegister(name)](#SimpleCCM#unRegister)
  * [simpleCCM.defense()](#SimpleCCM#defense)
  * [simpleCCM.log()](#SimpleCCM#log)
  * [simpleCCM.cache()](#SimpleCCM#cache)
  * [simpleCCM.assertIface(name, ifacever)](#SimpleCCM#assertIface)
  * [simpleCCM.alias(name, alias)](#SimpleCCM#alias)
  * [simpleCCM.close()](#SimpleCCM#close)
  * [const: SimpleCCM.SAFE_PAYLOAD_LIMIT](#SimpleCCM.SAFE_PAYLOAD_LIMIT)
  * [const: SimpleCCM.SVC_RESOLVER](#SimpleCCM.SVC_RESOLVER)
  * [const: SimpleCCM.SVC_AUTH](#SimpleCCM.SVC_AUTH)
  * [const: SimpleCCM.SVC_DEFENSE](#SimpleCCM.SVC_DEFENSE)
  * [const: SimpleCCM.SVC_ACL](#SimpleCCM.SVC_ACL)
  * [const: SimpleCCM.SVC_LOG](#SimpleCCM.SVC_LOG)
  * [const: SimpleCCM.SVC_CACHE_](#SimpleCCM.SVC_CACHE_)
  * [event: "register"](#SimpleCCM#event_register)
  * [event: "unregister"](#SimpleCCM#event_unregister)
  * [event: "close"](#SimpleCCM#event_close)
* [AdvancedCCM](#AdvancedCCM)
  * [advancedCCM.register(as, name, ifacever, endpoint, [credentials], [options])](#AdvancedCCM#register)
  * [advancedCCM.iface(name)](#AdvancedCCM#iface)
  * [advancedCCM.unRegister(name)](#AdvancedCCM#unRegister)
  * [advancedCCM.defense()](#AdvancedCCM#defense)
  * [advancedCCM.log()](#AdvancedCCM#log)
  * [advancedCCM.cache()](#AdvancedCCM#cache)
  * [advancedCCM.assertIface(name, ifacever)](#AdvancedCCM#assertIface)
  * [advancedCCM.alias(name, alias)](#AdvancedCCM#alias)
  * [advancedCCM.close()](#AdvancedCCM#close)
  * [event: "register"](#AdvancedCCM#event_register)
  * [event: "unregister"](#AdvancedCCM#event_unregister)
  * [event: "close"](#AdvancedCCM#event_close)
* [Invoker](#Invoker)
* [FutoInInvoker](#FutoInInvoker)
* [SimpleCCM](#SimpleCCM)
  * [simpleCCM.register(as, name, ifacever, endpoint, [credentials], [options])](#SimpleCCM#register)
  * [simpleCCM.iface(name)](#SimpleCCM#iface)
  * [simpleCCM.unRegister(name)](#SimpleCCM#unRegister)
  * [simpleCCM.defense()](#SimpleCCM#defense)
  * [simpleCCM.log()](#SimpleCCM#log)
  * [simpleCCM.cache()](#SimpleCCM#cache)
  * [simpleCCM.assertIface(name, ifacever)](#SimpleCCM#assertIface)
  * [simpleCCM.alias(name, alias)](#SimpleCCM#alias)
  * [simpleCCM.close()](#SimpleCCM#close)
  * [const: SimpleCCM.SAFE_PAYLOAD_LIMIT](#SimpleCCM.SAFE_PAYLOAD_LIMIT)
  * [const: SimpleCCM.SVC_RESOLVER](#SimpleCCM.SVC_RESOLVER)
  * [const: SimpleCCM.SVC_AUTH](#SimpleCCM.SVC_AUTH)
  * [const: SimpleCCM.SVC_DEFENSE](#SimpleCCM.SVC_DEFENSE)
  * [const: SimpleCCM.SVC_ACL](#SimpleCCM.SVC_ACL)
  * [const: SimpleCCM.SVC_LOG](#SimpleCCM.SVC_LOG)
  * [const: SimpleCCM.SVC_CACHE_](#SimpleCCM.SVC_CACHE_)
  * [event: "register"](#SimpleCCM#event_register)
  * [event: "unregister"](#SimpleCCM#event_unregister)
  * [event: "close"](#SimpleCCM#event_close)
 
<a name="module_futoin-invoker"></a>
#futoin-invoker
<a name="AdvancedCCM"></a>
#class: AdvancedCCM
**Extends**: `SimpleCCM`  
**Members**

* [class: AdvancedCCM](#AdvancedCCM)
  * [new AdvancedCCM()](#new_AdvancedCCM)
  * [advancedCCM.register(as, name, ifacever, endpoint, [credentials], [options])](#AdvancedCCM#register)
  * [advancedCCM.iface(name)](#AdvancedCCM#iface)
  * [advancedCCM.unRegister(name)](#AdvancedCCM#unRegister)
  * [advancedCCM.defense()](#AdvancedCCM#defense)
  * [advancedCCM.log()](#AdvancedCCM#log)
  * [advancedCCM.cache()](#AdvancedCCM#cache)
  * [advancedCCM.assertIface(name, ifacever)](#AdvancedCCM#assertIface)
  * [advancedCCM.alias(name, alias)](#AdvancedCCM#alias)
  * [advancedCCM.close()](#AdvancedCCM#close)
  * [event: "register"](#AdvancedCCM#event_register)
  * [event: "unregister"](#AdvancedCCM#event_unregister)
  * [event: "close"](#AdvancedCCM#event_close)

<a name="new_AdvancedCCM"></a>
##new AdvancedCCM()
Advanced CCM - Reference Implementation

**Extends**: `SimpleCCM`  
<a name="AdvancedCCM#register"></a>
##advancedCCM.register(as, name, ifacever, endpoint, [credentials], [options])
Register standard MasterService end-point (adds steps to *as*)

**Params**

- as `AsyncSteps` - AsyncSteps instance as registration may be waiting for external resources  
- name `string` - unique identifier in scope of CCM instance  
- ifacever `string` - interface identifier and its version separated by colon  
- endpoint `string` - URI
     OR any other resource identifier of function( ccmimpl, info )
         returning iface implementing peer, accepted by CCM implementation
     OR instance of Executor  
- \[credentials\] `string` - optional, authentication credentials:
'master' - enable MasterService authentication logic (Advanced CCM only)
'{user}:{clear-text-password}' - send as is in the 'sec' section
NOTE: some more reserved words and/or patterns can appear in the future  
- \[options\] `object` - fine tune global CCM options per endpoint  

**Fires**

- [register](#SimpleCCM#event_register)

<a name="AdvancedCCM#iface"></a>
##advancedCCM.iface(name)
Get native interface wrapper for invocation of iface methods

**Params**

- name `string` - see register()  

**Returns**: `NativeInterface` - - native interface  
<a name="AdvancedCCM#unRegister"></a>
##advancedCCM.unRegister(name)
Unregister previously registered interface (should not be used, unless really needed)

**Params**

- name `string` - see register()  

**Fires**

- [unregister](#SimpleCCM#event_unregister)

<a name="AdvancedCCM#defense"></a>
##advancedCCM.defense()
Shortcut to iface( "#defense" )

<a name="AdvancedCCM#log"></a>
##advancedCCM.log()
Returns extended API interface as defined in FTN9 IF AuditLogService

**Returns**: `object`  
<a name="AdvancedCCM#cache"></a>
##advancedCCM.cache()
Returns extended API interface as defined in [FTN14 Cache][]

**Returns**: `object`  
<a name="AdvancedCCM#assertIface"></a>
##advancedCCM.assertIface(name, ifacever)
Assert that interface registered by name matches major version and minor is not less than required.
This function must generate fatal error and forbid any further execution

**Params**

- name `string` - unique identifier in scope of CCM instance  
- ifacever `string` - interface identifier and its version separated by colon  

<a name="AdvancedCCM#alias"></a>
##advancedCCM.alias(name, alias)
Alias interface name with another name

**Params**

- name `string` - unique identifier in scope of CCM instance  
- alias `string` - alternative name for registered interface  

**Fires**

- [register](#SimpleCCM#event_register)

<a name="AdvancedCCM#close"></a>
##advancedCCM.close()
Shutdown CCM (close all active comms)

**Fires**

- [close](#SimpleCCM#event_close)

<a name="AdvancedCCM#event_register"></a>
##event: "register"
CCM regiser event. Fired on new interface registration.
( name, ifacever, info )

<a name="AdvancedCCM#event_unregister"></a>
##event: "unregister"
CCM regiser event. Fired on interface unregistration.
( name, info )

<a name="AdvancedCCM#event_close"></a>
##event: "close"
CCM close event. Fired on CCM shutdown.

<a name="CacheFace"></a>
#class: CacheFace
**Extends**: `NativeIface`  
**Members**

* [class: CacheFace](#CacheFace)
  * [new CacheFace()](#new_CacheFace)
  * [CacheFace.ifacespec](#CacheFace.ifacespec)
  * [CacheFace.register()](#CacheFace.register)
  * [cacheFace.getOrSet(as, key_prefix, callable, params, ttl_ms)](#CacheFace#getOrSet)
  * [cacheFace.call(as, name, params, upload_data, [download_stream], [timeout])](#CacheFace#call)
  * [cacheFace.ifaceInfo()](#CacheFace#ifaceInfo)
  * [cacheFace.bindDerivedKey()](#CacheFace#bindDerivedKey)
  * [event: "connect"](#CacheFace#event_connect)
  * [event: "disconnect"](#CacheFace#event_disconnect)
  * [event: "close"](#CacheFace#event_close)
  * [event: "commError"](#CacheFace#event_commError)

<a name="new_CacheFace"></a>
##new CacheFace()
Cache Native interface

Register with CacheFace.register()

NOTE: it is not directly available in Invoker module
interface, include separately

**Extends**: `NativeIface`  
<a name="CacheFace.ifacespec"></a>
##CacheFace.ifacespec
Embedded spec for FutoIn CacheFace

<a name="CacheFace.register"></a>
##CacheFace.register()
AuditLog Native interface registration helper

<a name="CacheFace#getOrSet"></a>
##cacheFace.getOrSet(as, key_prefix, callable, params, ttl_ms)
Get or Set cached value

NOTE: the actual cache key is formed with concatenation of *key_prefix* and join
  of *params* values

**Params**

- as `AsyncSteps`  
- key_prefix `string` - unique key prefix  
- callable `function` - func( as, params.. ) - a callable
     which is called to generated value on cache miss  
- params `Array` - parameters to be passed to *callable*  
- ttl_ms `integer` - time to live in ms to use, if value is set on cache miss  

<a name="CacheFace#call"></a>
##cacheFace.call(as, name, params, upload_data, [download_stream], [timeout])
Generic FutoIn function call interface
Result is passed through AsyncSteps.success() as a map.

**Params**

- as `AsyncSteps` - AsyncSteps object  
- name `string` - FutoIn iface function name  
- params `object` - map of func parameters  
- upload_data `string` | `stream.Readable` - raw upload data or input stram  
- \[download_stream\] `stream.Writable` - output stream for raw download data  
- \[timeout\] `int` - if provided, overrides the default. <=0 - disables timeout  

<a name="CacheFace#ifaceInfo"></a>
##cacheFace.ifaceInfo()
Get interface info

**Returns**: `object`  
<a name="CacheFace#bindDerivedKey"></a>
##cacheFace.bindDerivedKey()
Results with DerivedKeyAccessor through as.success()

<a name="CacheFace#event_connect"></a>
##event: "connect"
Fired when interface establishes connection.

<a name="CacheFace#event_disconnect"></a>
##event: "disconnect"
Fired when interface connection is closed.

<a name="CacheFace#event_close"></a>
##event: "close"
Interface close event. Fired on interface unregistration.

<a name="CacheFace#event_commError"></a>
##event: "commError"
Interface communication error. Fired during call processing.
( error_info, rawreq )

<a name="InterfaceInfo"></a>
#class: InterfaceInfo
**Members**

* [class: InterfaceInfo](#InterfaceInfo)
  * [new InterfaceInfo()](#new_InterfaceInfo)
  * [interfaceInfo.name()](#InterfaceInfo#name)
  * [interfaceInfo.version()](#InterfaceInfo#version)
  * [interfaceInfo.inherits()](#InterfaceInfo#inherits)
  * [interfaceInfo.funcs()](#InterfaceInfo#funcs)
  * [interfaceInfo.constraints()](#InterfaceInfo#constraints)

<a name="new_InterfaceInfo"></a>
##new InterfaceInfo()
FutoIn interface info

<a name="InterfaceInfo#name"></a>
##interfaceInfo.name()
Get FutoIn interface type

**Returns**: `string`  
<a name="InterfaceInfo#version"></a>
##interfaceInfo.version()
Get FutoIn interface version

**Returns**: `string`  
<a name="InterfaceInfo#inherits"></a>
##interfaceInfo.inherits()
Get list of inherited interfaces starting from the most derived, may be null

**Returns**: `object`  
<a name="InterfaceInfo#funcs"></a>
##interfaceInfo.funcs()
Get list of available functions, may be null

**Returns**: `object`  
<a name="InterfaceInfo#constraints"></a>
##interfaceInfo.constraints()
Get list of interface constraints, may be null

**Returns**: `object`  
<a name="LogFace"></a>
#class: LogFace
**Extends**: `NativeIface`  
**Members**

* [class: LogFace](#LogFace)
  * [new LogFace()](#new_LogFace)
  * [LogFace.ifacespec](#LogFace.ifacespec)
  * [LogFace.register()](#LogFace.register)
  * [logFace.msg(lvl, txt)](#LogFace#msg)
  * [logFace.hexdump(lvl, txt, data)](#LogFace#hexdump)
  * [logFace.debug(txt)](#LogFace#debug)
  * [logFace.info(txt)](#LogFace#info)
  * [logFace.warn(txt)](#LogFace#warn)
  * [logFace.error(txt)](#LogFace#error)
  * [logFace.security(txt)](#LogFace#security)
  * [logFace.call(as, name, params, upload_data, [download_stream], [timeout])](#LogFace#call)
  * [logFace.ifaceInfo()](#LogFace#ifaceInfo)
  * [logFace.bindDerivedKey()](#LogFace#bindDerivedKey)
  * [const: LogFace.LVL_DEBUG](#LogFace.LVL_DEBUG)
  * [const: LogFace.LVL_INFO](#LogFace.LVL_INFO)
  * [const: LogFace.LVL_WARN](#LogFace.LVL_WARN)
  * [const: LogFace.LVL_ERROR](#LogFace.LVL_ERROR)
  * [const: LogFace.LVL_SECURITY](#LogFace.LVL_SECURITY)
  * [event: "connect"](#LogFace#event_connect)
  * [event: "disconnect"](#LogFace#event_disconnect)
  * [event: "close"](#LogFace#event_close)
  * [event: "commError"](#LogFace#event_commError)

<a name="new_LogFace"></a>
##new LogFace()
AuditLog Native interface

Register with LogFace.register().

NOTE: it is not directly available Invoker module
interface, include separately

**Extends**: `NativeIface`  
<a name="LogFace.ifacespec"></a>
##LogFace.ifacespec
Embedded spec for FutoIn LogFace

<a name="LogFace.register"></a>
##LogFace.register()
AuditLog Native interface registration helper

<a name="LogFace#msg"></a>
##logFace.msg(lvl, txt)
Log message

**Params**

- lvl `string` - debug|info|warn|error|security  
- txt `string` - message to log  

<a name="LogFace#hexdump"></a>
##logFace.hexdump(lvl, txt, data)
Log message

**Params**

- lvl `string` - debug|info|warn|error|security  
- txt `string` - message to log  
- data `string` - raw data  

<a name="LogFace#debug"></a>
##logFace.debug(txt)
Log message in debug level

**Params**

- txt `string` - message to log  

<a name="LogFace#info"></a>
##logFace.info(txt)
Log message in info level

**Params**

- txt `string` - message to log  

<a name="LogFace#warn"></a>
##logFace.warn(txt)
Log message in warn level

**Params**

- txt `string` - message to log  

<a name="LogFace#error"></a>
##logFace.error(txt)
Log message in error level

**Params**

- txt `string` - message to log  

<a name="LogFace#security"></a>
##logFace.security(txt)
Log message in security level

**Params**

- txt `string` - message to log  

<a name="LogFace#call"></a>
##logFace.call(as, name, params, upload_data, [download_stream], [timeout])
Generic FutoIn function call interface
Result is passed through AsyncSteps.success() as a map.

**Params**

- as `AsyncSteps` - AsyncSteps object  
- name `string` - FutoIn iface function name  
- params `object` - map of func parameters  
- upload_data `string` | `stream.Readable` - raw upload data or input stram  
- \[download_stream\] `stream.Writable` - output stream for raw download data  
- \[timeout\] `int` - if provided, overrides the default. <=0 - disables timeout  

<a name="LogFace#ifaceInfo"></a>
##logFace.ifaceInfo()
Get interface info

**Returns**: `object`  
<a name="LogFace#bindDerivedKey"></a>
##logFace.bindDerivedKey()
Results with DerivedKeyAccessor through as.success()

<a name="LogFace.LVL_DEBUG"></a>
##const: LogFace.LVL_DEBUG
Debug log level

<a name="LogFace.LVL_INFO"></a>
##const: LogFace.LVL_INFO
Info log level

<a name="LogFace.LVL_WARN"></a>
##const: LogFace.LVL_WARN
Warn log level

<a name="LogFace.LVL_ERROR"></a>
##const: LogFace.LVL_ERROR
Error log level

<a name="LogFace.LVL_SECURITY"></a>
##const: LogFace.LVL_SECURITY
Security log level

<a name="LogFace#event_connect"></a>
##event: "connect"
Fired when interface establishes connection.

<a name="LogFace#event_disconnect"></a>
##event: "disconnect"
Fired when interface connection is closed.

<a name="LogFace#event_close"></a>
##event: "close"
Interface close event. Fired on interface unregistration.

<a name="LogFace#event_commError"></a>
##event: "commError"
Interface communication error. Fired during call processing.
( error_info, rawreq )

<a name="NativeIface"></a>
#class: NativeIface
**Members**

* [class: NativeIface](#NativeIface)
  * [new NativeIface()](#new_NativeIface)
  * [nativeIface.call(as, name, params, upload_data, [download_stream], [timeout])](#NativeIface#call)
  * [nativeIface.ifaceInfo()](#NativeIface#ifaceInfo)
  * [nativeIface.bindDerivedKey()](#NativeIface#bindDerivedKey)
  * [event: "connect"](#NativeIface#event_connect)
  * [event: "disconnect"](#NativeIface#event_disconnect)
  * [event: "close"](#NativeIface#event_close)
  * [event: "commError"](#NativeIface#event_commError)

<a name="new_NativeIface"></a>
##new NativeIface()
Native Interface for FutoIn ifaces

<a name="NativeIface#call"></a>
##nativeIface.call(as, name, params, upload_data, [download_stream], [timeout])
Generic FutoIn function call interface
Result is passed through AsyncSteps.success() as a map.

**Params**

- as `AsyncSteps` - AsyncSteps object  
- name `string` - FutoIn iface function name  
- params `object` - map of func parameters  
- upload_data `string` | `stream.Readable` - raw upload data or input stram  
- \[download_stream\] `stream.Writable` - output stream for raw download data  
- \[timeout\] `int` - if provided, overrides the default. <=0 - disables timeout  

<a name="NativeIface#ifaceInfo"></a>
##nativeIface.ifaceInfo()
Get interface info

**Returns**: `object`  
<a name="NativeIface#bindDerivedKey"></a>
##nativeIface.bindDerivedKey()
Results with DerivedKeyAccessor through as.success()

<a name="NativeIface#event_connect"></a>
##event: "connect"
Fired when interface establishes connection.

<a name="NativeIface#event_disconnect"></a>
##event: "disconnect"
Fired when interface connection is closed.

<a name="NativeIface#event_close"></a>
##event: "close"
Interface close event. Fired on interface unregistration.

<a name="NativeIface#event_commError"></a>
##event: "commError"
Interface communication error. Fired during call processing.
( error_info, rawreq )

<a name="SimpleCCM"></a>
#class: SimpleCCM
**Members**

* [class: SimpleCCM](#SimpleCCM)
  * [new SimpleCCM([options])](#new_SimpleCCM)
  * [simpleCCM.register(as, name, ifacever, endpoint, [credentials], [options])](#SimpleCCM#register)
  * [simpleCCM.iface(name)](#SimpleCCM#iface)
  * [simpleCCM.unRegister(name)](#SimpleCCM#unRegister)
  * [simpleCCM.defense()](#SimpleCCM#defense)
  * [simpleCCM.log()](#SimpleCCM#log)
  * [simpleCCM.cache()](#SimpleCCM#cache)
  * [simpleCCM.assertIface(name, ifacever)](#SimpleCCM#assertIface)
  * [simpleCCM.alias(name, alias)](#SimpleCCM#alias)
  * [simpleCCM.close()](#SimpleCCM#close)
  * [const: SimpleCCM.SAFE_PAYLOAD_LIMIT](#SimpleCCM.SAFE_PAYLOAD_LIMIT)
  * [const: SimpleCCM.SVC_RESOLVER](#SimpleCCM.SVC_RESOLVER)
  * [const: SimpleCCM.SVC_AUTH](#SimpleCCM.SVC_AUTH)
  * [const: SimpleCCM.SVC_DEFENSE](#SimpleCCM.SVC_DEFENSE)
  * [const: SimpleCCM.SVC_ACL](#SimpleCCM.SVC_ACL)
  * [const: SimpleCCM.SVC_LOG](#SimpleCCM.SVC_LOG)
  * [const: SimpleCCM.SVC_CACHE_](#SimpleCCM.SVC_CACHE_)
  * [event: "register"](#SimpleCCM#event_register)
  * [event: "unregister"](#SimpleCCM#event_unregister)
  * [event: "close"](#SimpleCCM#event_close)

<a name="new_SimpleCCM"></a>
##new SimpleCCM([options])
Simple CCM - Reference Implementation

Base Connection and Credentials Manager with limited error control

**Params**

- \[options\] `object` - map of options  

<a name="SimpleCCM#register"></a>
##simpleCCM.register(as, name, ifacever, endpoint, [credentials], [options])
Register standard MasterService end-point (adds steps to *as*)

**Params**

- as `AsyncSteps` - AsyncSteps instance as registration may be waiting for external resources  
- name `string` - unique identifier in scope of CCM instance  
- ifacever `string` - interface identifier and its version separated by colon  
- endpoint `string` - URI
     OR any other resource identifier of function( ccmimpl, info )
         returning iface implementing peer, accepted by CCM implementation
     OR instance of Executor  
- \[credentials\] `string` - optional, authentication credentials:
'master' - enable MasterService authentication logic (Advanced CCM only)
'{user}:{clear-text-password}' - send as is in the 'sec' section
NOTE: some more reserved words and/or patterns can appear in the future  
- \[options\] `object` - fine tune global CCM options per endpoint  

**Fires**

- [register](#SimpleCCM#event_register)

<a name="SimpleCCM#iface"></a>
##simpleCCM.iface(name)
Get native interface wrapper for invocation of iface methods

**Params**

- name `string` - see register()  

**Returns**: `NativeInterface` - - native interface  
<a name="SimpleCCM#unRegister"></a>
##simpleCCM.unRegister(name)
Unregister previously registered interface (should not be used, unless really needed)

**Params**

- name `string` - see register()  

**Fires**

- [unregister](#SimpleCCM#event_unregister)

<a name="SimpleCCM#defense"></a>
##simpleCCM.defense()
Shortcut to iface( "#defense" )

<a name="SimpleCCM#log"></a>
##simpleCCM.log()
Returns extended API interface as defined in FTN9 IF AuditLogService

**Returns**: `object`  
<a name="SimpleCCM#cache"></a>
##simpleCCM.cache()
Returns extended API interface as defined in [FTN14 Cache][]

**Returns**: `object`  
<a name="SimpleCCM#assertIface"></a>
##simpleCCM.assertIface(name, ifacever)
Assert that interface registered by name matches major version and minor is not less than required.
This function must generate fatal error and forbid any further execution

**Params**

- name `string` - unique identifier in scope of CCM instance  
- ifacever `string` - interface identifier and its version separated by colon  

<a name="SimpleCCM#alias"></a>
##simpleCCM.alias(name, alias)
Alias interface name with another name

**Params**

- name `string` - unique identifier in scope of CCM instance  
- alias `string` - alternative name for registered interface  

**Fires**

- [register](#SimpleCCM#event_register)

<a name="SimpleCCM#close"></a>
##simpleCCM.close()
Shutdown CCM (close all active comms)

**Fires**

- [close](#SimpleCCM#event_close)

<a name="SimpleCCM.SAFE_PAYLOAD_LIMIT"></a>
##const: SimpleCCM.SAFE_PAYLOAD_LIMIT
Maximum FutoIn message payload size (not related to raw data)

**Default**: `65536`  
<a name="SimpleCCM.SVC_RESOLVER"></a>
##const: SimpleCCM.SVC_RESOLVER
Runtime iface resolution v1.x

<a name="SimpleCCM.SVC_AUTH"></a>
##const: SimpleCCM.SVC_AUTH
AuthService v1.x

<a name="SimpleCCM.SVC_DEFENSE"></a>
##const: SimpleCCM.SVC_DEFENSE
Defense system v1.x

<a name="SimpleCCM.SVC_ACL"></a>
##const: SimpleCCM.SVC_ACL
Access Control system v1.x

<a name="SimpleCCM.SVC_LOG"></a>
##const: SimpleCCM.SVC_LOG
Audit Logging v1.x

<a name="SimpleCCM.SVC_CACHE_"></a>
##const: SimpleCCM.SVC_CACHE_
cache v1.x iface name prefix

<a name="SimpleCCM#event_register"></a>
##event: "register"
CCM regiser event. Fired on new interface registration.
( name, ifacever, info )

<a name="SimpleCCM#event_unregister"></a>
##event: "unregister"
CCM regiser event. Fired on interface unregistration.
( name, info )

<a name="SimpleCCM#event_close"></a>
##event: "close"
CCM close event. Fired on CCM shutdown.

<a name="SpecTools"></a>
#class: SpecTools
**Members**

* [class: SpecTools](#SpecTools)
  * [new SpecTools()](#new_SpecTools)
  * [SpecTools.loadIface(as, info, specdirs)](#SpecTools.loadIface)
  * [SpecTools.parseIface(as, info, specdirs, raw_spec)](#SpecTools.parseIface)
  * [SpecTools.checkConsistency(as, info)](#SpecTools.checkConsistency)
  * [SpecTools.checkType(info, type, val)](#SpecTools.checkType)
  * [SpecTools.checkParameterType(info, funcname, varname, value)](#SpecTools.checkParameterType)
  * [SpecTools.checkResultType(as, info, funcname, varname, value)](#SpecTools.checkResultType)
  * [SpecTools.genHMAC(as, info, ftnreq)](#SpecTools.genHMAC)
  * [const: SpecTools.standard_errors](#SpecTools.standard_errors)

<a name="new_SpecTools"></a>
##new SpecTools()
SpecTools

<a name="SpecTools.loadIface"></a>
##SpecTools.loadIface(as, info, specdirs)
Load FutoIn iface definition.

NOTE: Browser uses XHR to load specs, Node.js searches in local fs.

**Params**

- as `AsyncSteps`  
- info `Object` - destination object with "iface" and "version" fields already set  
- specdirs `Array` - each element - search path/url (string) or raw iface (object)  

<a name="SpecTools.parseIface"></a>
##SpecTools.parseIface(as, info, specdirs, raw_spec)
Parse raw futoin spec (preloaded)

**Params**

- as `AsyncSteps`  
- info `Object` - destination object with "iface" and "version" fields already set  
- specdirs `Array` - each element - search path/url (string) or raw iface (object)  
- raw_spec `Object` - iface definition object  

<a name="SpecTools.checkConsistency"></a>
##SpecTools.checkConsistency(as, info)
Deeply check consistency of loaded interface.

NOTE: not yet implemented

**Params**

- as `AsyncSteps`  
- info `Object` - previously loaded iface  

<a name="SpecTools.checkType"></a>
##SpecTools.checkType(info, type, val)
Check if value matches required type

**Params**

- info `Object` - previously loaded iface  
- type `string` - standard or custom iface type  
- val `*` - value to check  

**Returns**: `Boolean`  
<a name="SpecTools.checkParameterType"></a>
##SpecTools.checkParameterType(info, funcname, varname, value)
Check if parameter value matches required type

**Params**

- info `Object` - previously loaded iface  
- funcname `string` - function name  
- varname `string` - parameter name  
- value `*` - value to check  

<a name="SpecTools.checkResultType"></a>
##SpecTools.checkResultType(as, info, funcname, varname, value)
Check if result value matches required type

**Params**

- as `AsyncSteps`  
- info `Object` - previously loaded iface  
- funcname `string` - function name  
- varname `string` - result variable name  
- value `*` - value to check  

<a name="SpecTools.genHMAC"></a>
##SpecTools.genHMAC(as, info, ftnreq)
Generate HMAC

NOTE: for simplicity, 'sec' field must not be present

**Params**

- as `AsyncSteps`  
- info `object` - Interface raw info object  
- ftnreq `object` - Request Object  

**Returns**: `Buffer` - Binary HMAC signature  
<a name="SpecTools.standard_errors"></a>
##const: SpecTools.standard_errors
Enumeration of standard errors

<a name="AdvancedCCMOptions"></a>
#class: AdvancedCCMOptions
**Extends**: `SimpleCCMOptions`  
**Members**

* [class: AdvancedCCMOptions](#AdvancedCCMOptions)
  * [new AdvancedCCMOptions()](#new_AdvancedCCMOptions)
  * [AdvancedCCMOptions.specDirs](#AdvancedCCMOptions.specDirs)
  * [AdvancedCCMOptions.hmacKey](#AdvancedCCMOptions.hmacKey)
  * [AdvancedCCMOptions.hmacAlgo](#AdvancedCCMOptions.hmacAlgo)

<a name="new_AdvancedCCMOptions"></a>
##new AdvancedCCMOptions()
This is a pseudo-class for documentation purposes

NOTE: Each option can be set on global level and overriden per interface.

**Extends**: `SimpleCCMOptions`  
<a name="AdvancedCCMOptions.specDirs"></a>
##AdvancedCCMOptions.specDirs
Search dirs for spec definition or spec instance directly. It can
be single value or array of values. Each value is either path/URL (string) or
iface spec instance (object).

**Default**: `[]`  
<a name="AdvancedCCMOptions.hmacKey"></a>
##AdvancedCCMOptions.hmacKey
Base64 encoded key for HMAC generation. See FTN6/FTN7

<a name="AdvancedCCMOptions.hmacAlgo"></a>
##AdvancedCCMOptions.hmacAlgo
Hash algorithm for HMAC generation:
MD5(default), SHA224, SHA256, SHA384, SHA256

**Default**: `MD5`  
<a name="SimpleCCMOptions"></a>
#class: SimpleCCMOptions
**Members**

* [class: SimpleCCMOptions](#SimpleCCMOptions)
  * [new SimpleCCMOptions()](#new_SimpleCCMOptions)
  * [SimpleCCMOptions.callTimeoutMS](#SimpleCCMOptions.callTimeoutMS)
  * [SimpleCCMOptions.prodMode](#SimpleCCMOptions.prodMode)
  * [SimpleCCMOptions.commConfigCallback](#SimpleCCMOptions.commConfigCallback)
  * [SimpleCCMOptions.executor](#SimpleCCMOptions.executor)
  * [SimpleCCMOptions.targetOrigin](#SimpleCCMOptions.targetOrigin)
  * [SimpleCCMOptions.retryCount](#SimpleCCMOptions.retryCount)
  * [SimpleCCMOptions.messageSniffer()](#SimpleCCMOptions.messageSniffer)
  * [SimpleCCMOptions.disconnectSniffer()](#SimpleCCMOptions.disconnectSniffer)

<a name="new_SimpleCCMOptions"></a>
##new SimpleCCMOptions()
This is a pseudo-class for documentation purposes.

NOTE: Each option can be set on global level and overriden per interface.

<a name="SimpleCCMOptions.callTimeoutMS"></a>
##SimpleCCMOptions.callTimeoutMS
Overall call timeout (int)

**Default**: `3000`  
<a name="SimpleCCMOptions.prodMode"></a>
##SimpleCCMOptions.prodMode
Production mode - disables some checks without compomising security

**Default**: `false`  
<a name="SimpleCCMOptions.commConfigCallback"></a>
##SimpleCCMOptions.commConfigCallback
Communication configuration callback( type, specific-args )

**Default**: `null`  
<a name="SimpleCCMOptions.executor"></a>
##SimpleCCMOptions.executor
Client-side executor for bi-directional communication channels

<a name="SimpleCCMOptions.targetOrigin"></a>
##SimpleCCMOptions.targetOrigin
*browser-only.* Origin of target for *window.postMessage()*

<a name="SimpleCCMOptions.retryCount"></a>
##SimpleCCMOptions.retryCount
How many times to retry the call on CommError.
NOTE: actual attempt count is retryCount + 1

**Default**: `1`  
<a name="SimpleCCMOptions.messageSniffer"></a>
##SimpleCCMOptions.messageSniffer()
Message sniffer callback( iface_info, msg, is_incomming ).
Useful for audit logging.

**Default**: `dummy`  
<a name="SimpleCCMOptions.disconnectSniffer"></a>
##SimpleCCMOptions.disconnectSniffer()
Bi-directional channel disconnect sniffer callback( iface_info ).
Useful for audit logging.

**Default**: `dummy`  
<a name="SimpleCCM"></a>
#SimpleCCM
**window.SimpleCCM** - Browser-only reference to futoin-asyncsteps.SimpleCCM

<a name="AdvancedCCM"></a>
#AdvancedCCM
**window.AdvancedCCM** - Browser-only reference to futoin-asyncsteps.AdvancedCCM

<a name="Invoker"></a>
#Invoker
**futoin.Invoker** - Browser-only reference to futoin-invoker module

<a name="FutoInInvoker"></a>
#FutoInInvoker
**window.FutoInInvoker** - Browser-only reference to futoin-invoker module

<a name="SimpleCCM"></a>
#SimpleCCM
**window.SimpleCCM** - Browser-only reference to futoin-asyncsteps.SimpleCCM




*documented by [jsdoc-to-markdown](https://github.com/75lb/jsdoc-to-markdown)*.


