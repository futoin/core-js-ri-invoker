
  [![NPM Version](https://img.shields.io/npm/v/futoin-invoker.svg?style=flat)](https://www.npmjs.com/package/futoin-invoker)
  [![NPM Downloads](https://img.shields.io/npm/dm/futoin-invoker.svg?style=flat)](https://www.npmjs.com/package/futoin-invoker)
  [![Build Status](https://travis-ci.org/futoin/core-js-ri-invoker.svg?branch=master)](https://travis-ci.org/futoin/core-js-ri-invoker)
  [![stable](https://img.shields.io/badge/stability-stable-green.svg?style=flat)](https://www.npmjs.com/package/futoin-invoker)

  [![NPM](https://nodei.co/npm/futoin-invoker.png?downloads=true&downloadRank=true&stars=true)](https://nodei.co/npm/futoin-invoker/)

**[Stability: 3 - Stable](http://nodejs.org/api/documentation.html)**

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
* CCM-wide request limit zones with both requests/period and max simultaneous limits

The primary communication channel is WebSockets. Large raw data upload and download
is also supported through automatic fallback to HTTP(S).

SimpleCCM - a light version without heavy processing of iface definition (ideal for browser)
AdvancedCCM - full featured CCM (extends SimpleCCM)

Communication methods:

* HTTP/HTTPS - remote calls
* WS/WSS - WebSockets remote calls with bi-directional sockets
* HTML5 Web Messaging - same- and cross-origin local calls **inside Browser through window.postMessage() API**
* Same Process - optimized for single instance deployment

Message coding formats:

* JSON - default and mandatory
* MessagePack (MPCK) - default for interfaces with `BinaryData` constraint
* CBOR - also available, but shows 10-100x worse performance compared to MessagePack even with `borc` fork

*Note: Invoker and Executor are platform/technology-neutral concepts. The implementation
is already available in JS and PHP.*


Reference implementation of:
 
    FTN7: FutoIn Invoker Concept
    Version: 1.7
    
    FTN3: FutoIn Interface Definition
    Version: 1.9

    FTN3.1: FutoIn Interface - Common Types
    Version: 1.0

    FTN5: FutoIn HTTP integration
    Version: 1.3

    FTN9: FutoIn Interface - AuditLog
    Version: 1.0 (client)

    FTN14: FutoIn Cache
    Version: 1.0 (client)
    
    FTN4: FutoIn Interface - Ping-Pong
    Version: 1.0 (client)

* Spec: [FTN7: Interface Invoker Concept v1.x](http://specs.futoin.org/final/preview/ftn7_iface_invoker_concept-1.html)
* Spec: [FTN3: FutoIn Interface Definition v1.x](http://specs.futoin.org/final/preview/ftn3_iface_definition.html)
* Spec: [FTN3.1: FutoIn Interface - Common Types v1.x](http://specs.futoin.org/final/preview/ftn3.1_if_common_types.html)
* Spec: [FTN5: FutoIn HTTP integration v1.x](http://specs.futoin.org/final/preview/ftn5_iface_http_integration.html)
* Spec: [FTN9: FutoIn Interface - AuditLog v1.x](http://specs.futoin.org/final/preview/ftn9_if_auditlog.html)
* Spec: [FTN14: FutoIn Cache v1.x](http://specs.futoin.org/final/preview/ftn14_cache.html)
* Spec: [FTN4: FutoIn Interface - Ping-Pong v1.x](http://specs.futoin.org/final/preview/ftn4_if_ping.html)

Author: [Andrey Galkin](mailto:andrey@futoin.org)

**Documentation** --> [FutoIn Guide](https://futoin.org/docs/asyncsteps/)


# Installation for Node.js

Command line:
```sh
$ npm install futoin-invoker --save
```
or
```sh
$ yarn add futoin-invoker
```

*Hint: checkout [FutoIn CID](https://github.com/futoin/cid-tool) for all tools setup.*

All public classes can be accessed through module:
```javascript
const AdvancedCCM = require('futoin-invoker').AdvancedCCM;
```

or included modular way, e.g.:
```javascript
const AdvancedCCM = require('futoin-invoker/AdvancedCCM');
```

# Browser installation

Pre-built ES5 CJS modules are available under `es5/`. These modules
can be used with `webpack` without transpiler - default "browser" entry point
points to ES5 version.

Webpack dists are also available under `dist/` folder, but their usage should be limited
to sites without build process.

*Warning: check AsyncSteps and AsyncEvent polyfill for older browsers.*

*The following globals are available*:

* SimpleCCM - global reference to futoin-invoker.SimpleCCM class
* AdvancedCCM - global reference to futoin-invoker.AdvancedCCM class
* futoin.Invoker - global reference to futoin-invoker module

# CVE-2018-3721 mitigation

To prevent attacks similar to CVE-2018-3721, SpecTools freeze Object.prototype.
More info:  https://hackerone.com/reports/310443

Please make global prototype modifications before loading FutoIn deps, if that's really needed.

# Examples

NOTE: more complex examples should be found in [futoin-executor](https://github.com/futoin/core-js-ri-executor/)

## Call remote function with SimpleCCM

```javascript
var async_steps = require( 'futoin-asyncsteps' );
var SimpleCCM = require( 'futoin-invoker/SimpleCCM' );

// Initalize CCM, no configuration is required
var ccm = new SimpleCCM();

async_steps()
.add(
    function( as ){
        // Register interfaces without loading their specs
        ccm.register( as, 'localone', 'some.iface:1.0',
                      'https://localhost/some/path' );
        ccm.register( as, 'localtwo', 'other.iface:1.0',
                      'https://localhost/some/path',
                      'user:pass' ); // optional credentials

        as.add( function( as ){
            // Get NativeIface representation of remote interface
            // after registration is complete
            var localone = ccm.iface( 'localone' );
            var localtwo = ccm.iface( 'localtwo' );
            
            // SimpleCCM is not aware of available functions.
            // It is the only way to perform a call.
            localone.call( as, 'somefunc', {
                arg1 : 1,
                arg2 : 'abc',
                arg3 : true,
            } );
            
            as.add( function( as, res ){
                // As function prototype is not know
                // all invalid HTTP 200 responses may
                // get returned as "raw data" in res
                // parameter.
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

// Define interface, which should normally be put into 
// file named "some.iface-1.0-iface.json" and put into
// a folder added to the "specDirs" option.
var some_iface_v1_0 = {
    "iface" : "some.iface",
    "version" : "1.0",
    "ftn3rev" : "1.1",
    "funcs" : {
        "somefunc" : {
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

var other_iface_v1_0 = {
    "iface" : "other.iface",
    "version" : "1.0",
    "ftn3rev" : "1.1"
}

// Initialize CCM. We provide interface definitions directly
var ccm = new invoker.AdvancedCCM({
    specDirs : [ __dirname + '/specs', some_iface_v1_0, other_iface_v1_0 ]
});

// AsyncSteps processing is required
async_steps()
.add(
    function( as ){
        // Register interfaces - it is done only once
        ccm.register( as, 'localone',
                      'some.iface:1.0', 'https://localhost/some/path' );
        ccm.register( as, 'localtwo',
                      'other.iface:1.0', 'https://localhost/some/path',
                      'user:pass' ); // optional credentials

        as.add( function( as ){
            // Get NativeIface representation of remote interface
            // after registration is complete
            var localone = ccm.iface( 'localone' );
            var localtwo = ccm.iface( 'localtwo' );
            
            localone.somefunc( as, 1, 'abc', true );
            
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

## Modules

<dl>
<dt><a href="#module_futoin-invoker">futoin-invoker</a></dt>
<dd></dd>
</dl>

## Classes

<dl>
<dt><a href="#AdvancedCCM">AdvancedCCM</a> ⇐ <code><a href="#SimpleCCM">SimpleCCM</a></code></dt>
<dd><p>Advanced CCM - Reference Implementation</p>
</dd>
<dt><a href="#CacheFace">CacheFace</a> ⇐ <code><a href="#NativeIface">NativeIface</a></code></dt>
<dd><p>Cache Native interface</p>
<p>Register with CacheFace.register()</p>
<p>NOTE: it is not directly available in Invoker module
interface, include separately</p>
</dd>
<dt><a href="#InterfaceInfo">InterfaceInfo</a></dt>
<dd><p>FutoIn interface info</p>
</dd>
<dt><a href="#LogFace">LogFace</a> ⇐ <code><a href="#NativeIface">NativeIface</a></code></dt>
<dd><p>AuditLog Native interface</p>
<p>Register with LogFace.register().</p>
<p>NOTE: it is not directly available Invoker module
interface, include separately</p>
</dd>
<dt><a href="#NativeIface">NativeIface</a></dt>
<dd><p>Native Interface for FutoIn ifaces</p>
</dd>
<dt><a href="#PingFace">PingFace</a></dt>
<dd><p>Base for FTN4 ping-based interfaces</p>
</dd>
<dt><a href="#SimpleCCM">SimpleCCM</a></dt>
<dd><p>Simple CCM - Reference Implementation</p>
<p>Base Connection and Credentials Manager with limited error control</p>
</dd>
<dt><a href="#SpecTools">SpecTools</a></dt>
<dd></dd>
<dt><a href="#AdvancedCCMOptions">AdvancedCCMOptions</a> ⇐ <code><a href="#SimpleCCMOptions">SimpleCCMOptions</a></code></dt>
<dd></dd>
<dt><a href="#SimpleCCMOptions">SimpleCCMOptions</a></dt>
<dd></dd>
</dl>

## Members

<dl>
<dt><a href="#SimpleCCM">SimpleCCM</a></dt>
<dd><p><strong>window.SimpleCCM</strong> - Browser-only reference to futoin-asyncsteps.SimpleCCM</p>
</dd>
<dt><a href="#SimpleCCM">SimpleCCM</a></dt>
<dd><p><strong>window.SimpleCCM</strong> - Browser-only reference to futoin-asyncsteps.SimpleCCM</p>
</dd>
<dt><a href="#SimpleCCM">SimpleCCM</a></dt>
<dd><p><strong>futoin.SimpleCCM</strong> - Browser-only reference to futoin-asyncsteps.SimpleCCM</p>
</dd>
<dt><a href="#AdvancedCCM">AdvancedCCM</a></dt>
<dd><p><strong>window.AdvancedCCM</strong> - Browser-only reference to futoin-asyncsteps.AdvancedCCM</p>
</dd>
<dt><a href="#AdvancedCCM">AdvancedCCM</a></dt>
<dd><p><strong>futoin.AdvancedCCM</strong> - Browser-only reference to futoin-asyncsteps.AdvancedCCM</p>
</dd>
<dt><a href="#Invoker">Invoker</a></dt>
<dd><p><strong>futoin.Invoker</strong> - Browser-only reference to futoin-invoker module</p>
</dd>
<dt><a href="#FutoInInvoker">FutoInInvoker</a></dt>
<dd><p><strong>window.FutoInInvoker</strong> - Browser-only reference to futoin-invoker module</p>
</dd>
</dl>

<a name="module_futoin-invoker"></a>

## futoin-invoker
<a name="AdvancedCCM"></a>

## AdvancedCCM ⇐ [<code>SimpleCCM</code>](#SimpleCCM)
Advanced CCM - Reference Implementation

**Kind**: global class  
**Extends**: [<code>SimpleCCM</code>](#SimpleCCM)  
**See**

- [FTN7: FutoIn Invoker Concept](http://specs.futoin.org/final/preview/ftn7_iface_invoker_concept-1.html)
- AdvancedCCMOptions


* [AdvancedCCM](#AdvancedCCM) ⇐ [<code>SimpleCCM</code>](#SimpleCCM)
    * [new AdvancedCCM(options)](#new_AdvancedCCM_new)
    * [.register(as, name, ifacever, endpoint, [credentials], [options])](#SimpleCCM+register)
    * [.iface(name)](#SimpleCCM+iface) ⇒ <code>NativeInterface</code>
    * [.unRegister(name)](#SimpleCCM+unRegister)
    * [.defense()](#SimpleCCM+defense) ⇒ <code>object</code>
    * [.log()](#SimpleCCM+log) ⇒ <code>object</code>
    * [.cache([bucket])](#SimpleCCM+cache) ⇒ <code>object</code>
    * [.assertIface(name, ifacever)](#SimpleCCM+assertIface)
    * [.alias(name, alias)](#SimpleCCM+alias)
    * [.close()](#SimpleCCM+close)
    * [.limitZone(name, options)](#SimpleCCM+limitZone)
    * ["register"](#SimpleCCM+event_register)
    * ["unregister"](#SimpleCCM+event_unregister)
    * ["close"](#SimpleCCM+event_close)

<a name="new_AdvancedCCM_new"></a>

### new AdvancedCCM(options)

| Param | Type | Description |
| --- | --- | --- |
| options | <code>object</code> | see AdvancedCCMOptions |

<a name="SimpleCCM+register"></a>

### advancedCCM.register(as, name, ifacever, endpoint, [credentials], [options])
Register standard MasterService end-point (adds steps to *as*)

**Kind**: instance method of [<code>AdvancedCCM</code>](#AdvancedCCM)  
**Emits**: [<code>register</code>](#SimpleCCM+event_register)  

| Param | Type | Description |
| --- | --- | --- |
| as | <code>AsyncSteps</code> | AsyncSteps instance as registration may be waiting for external resources |
| name | <code>string</code> | unique identifier in scope of CCM instance |
| ifacever | <code>string</code> | interface identifier and its version separated by colon |
| endpoint | <code>string</code> | URI      OR any other resource identifier of function( ccmimpl, info )          returning iface implementing peer, accepted by CCM implementation      OR instance of Executor |
| [credentials] | <code>string</code> | optional, authentication credentials: 'master' - enable MasterService authentication logic (Advanced CCM only) '{user}:{clear-text-password}' - send as is in the 'sec' section NOTE: some more reserved words and/or patterns can appear in the future |
| [options] | <code>object</code> | fine tune global CCM options per endpoint |

<a name="SimpleCCM+iface"></a>

### advancedCCM.iface(name) ⇒ <code>NativeInterface</code>
Get native interface wrapper for invocation of iface methods

**Kind**: instance method of [<code>AdvancedCCM</code>](#AdvancedCCM)  
**Returns**: <code>NativeInterface</code> - - native interface  

| Param | Type | Description |
| --- | --- | --- |
| name | <code>string</code> | see register() |

<a name="SimpleCCM+unRegister"></a>

### advancedCCM.unRegister(name)
Unregister previously registered interface (should not be used, unless really needed)

**Kind**: instance method of [<code>AdvancedCCM</code>](#AdvancedCCM)  
**Emits**: [<code>unregister</code>](#SimpleCCM+event_unregister)  

| Param | Type | Description |
| --- | --- | --- |
| name | <code>string</code> | see register() |

<a name="SimpleCCM+defense"></a>

### advancedCCM.defense() ⇒ <code>object</code>
Shortcut to iface( "#defense" )

**Kind**: instance method of [<code>AdvancedCCM</code>](#AdvancedCCM)  
**Returns**: <code>object</code> - native defense interface  
<a name="SimpleCCM+log"></a>

### advancedCCM.log() ⇒ <code>object</code>
Returns extended API interface as defined in FTN9 IF AuditLogService

**Kind**: instance method of [<code>AdvancedCCM</code>](#AdvancedCCM)  
**Returns**: <code>object</code> - FTN9 native face  
<a name="SimpleCCM+cache"></a>

### advancedCCM.cache([bucket]) ⇒ <code>object</code>
Returns extended API interface as defined in [FTN14 Cache][]

**Kind**: instance method of [<code>AdvancedCCM</code>](#AdvancedCCM)  
**Returns**: <code>object</code> - FTN14 native face  

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| [bucket] | <code>string</code> | <code>&quot;default&quot;</code> | cache bucket name |

<a name="SimpleCCM+assertIface"></a>

### advancedCCM.assertIface(name, ifacever)
Assert that interface registered by name matches major version and minor is not less than required.
This function must generate fatal error and forbid any further execution

**Kind**: instance method of [<code>AdvancedCCM</code>](#AdvancedCCM)  

| Param | Type | Description |
| --- | --- | --- |
| name | <code>string</code> | unique identifier in scope of CCM instance |
| ifacever | <code>string</code> | interface identifier and its version separated by colon |

<a name="SimpleCCM+alias"></a>

### advancedCCM.alias(name, alias)
Alias interface name with another name

**Kind**: instance method of [<code>AdvancedCCM</code>](#AdvancedCCM)  
**Emits**: [<code>register</code>](#SimpleCCM+event_register)  

| Param | Type | Description |
| --- | --- | --- |
| name | <code>string</code> | unique identifier in scope of CCM instance |
| alias | <code>string</code> | alternative name for registered interface |

<a name="SimpleCCM+close"></a>

### advancedCCM.close()
Shutdown CCM (close all active comms)

**Kind**: instance method of [<code>AdvancedCCM</code>](#AdvancedCCM)  
**Emits**: [<code>close</code>](#SimpleCCM+event_close)  
<a name="SimpleCCM+limitZone"></a>

### advancedCCM.limitZone(name, options)
Configure named AsyncSteps Limiter instance

**Kind**: instance method of [<code>AdvancedCCM</code>](#AdvancedCCM)  

| Param | Type | Description |
| --- | --- | --- |
| name | <code>string</code> | zone name |
| options | <code>object</code> | options to pass to Limiter c-tor |

<a name="SimpleCCM+event_register"></a>

### "register"
CCM regiser event. Fired on new interface registration.
( name, ifacever, info )

**Kind**: event emitted by [<code>AdvancedCCM</code>](#AdvancedCCM)  
<a name="SimpleCCM+event_unregister"></a>

### "unregister"
CCM regiser event. Fired on interface unregistration.
( name, info )

**Kind**: event emitted by [<code>AdvancedCCM</code>](#AdvancedCCM)  
<a name="SimpleCCM+event_close"></a>

### "close"
CCM close event. Fired on CCM shutdown.

**Kind**: event emitted by [<code>AdvancedCCM</code>](#AdvancedCCM)  
<a name="CacheFace"></a>

## CacheFace ⇐ [<code>NativeIface</code>](#NativeIface)
Cache Native interface

Register with CacheFace.register()

NOTE: it is not directly available in Invoker module
interface, include separately

**Kind**: global class  
**Extends**: [<code>NativeIface</code>](#NativeIface)  

* [CacheFace](#CacheFace) ⇐ [<code>NativeIface</code>](#NativeIface)
    * [new CacheFace(_ccm, info)](#new_CacheFace_new)
    * _instance_
        * [.getOrSet(as, key_prefix, callable, params, ttl_ms)](#CacheFace+getOrSet)
        * [.call(as, name, params, upload_data, [download_stream], [timeout])](#NativeIface+call)
        * [.ifaceInfo()](#NativeIface+ifaceInfo) ⇒ [<code>InterfaceInfo</code>](#InterfaceInfo)
        * [.bindDerivedKey(as)](#NativeIface+bindDerivedKey)
        * ["connect"](#NativeIface+event_connect)
        * ["disconnect"](#NativeIface+event_disconnect)
        * ["close"](#NativeIface+event_close)
        * ["commError"](#NativeIface+event_commError)
    * _static_
        * [.register(as, ccm, name, endpoint, [credentials], [options])](#CacheFace.register)

<a name="new_CacheFace_new"></a>

### new CacheFace(_ccm, info)

| Param | Type | Description |
| --- | --- | --- |
| _ccm | [<code>SimpleCCM</code>](#SimpleCCM) | CCM instance |
| info | <code>object</code> | internal info |

<a name="CacheFace+getOrSet"></a>

### cacheFace.getOrSet(as, key_prefix, callable, params, ttl_ms)
Get or Set cached value

NOTE: the actual cache key is formed with concatenation of *key_prefix* and join
  of *params* values

**Kind**: instance method of [<code>CacheFace</code>](#CacheFace)  

| Param | Type | Description |
| --- | --- | --- |
| as | <code>AsyncSteps</code> | step interface |
| key_prefix | <code>string</code> | unique key prefix |
| callable | <code>function</code> | func( as, params.. ) - a callable      which is called to generated value on cache miss |
| params | <code>Array</code> | parameters to be passed to *callable* |
| ttl_ms | <code>integer</code> | time to live in ms to use, if value is set on cache miss |

<a name="NativeIface+call"></a>

### cacheFace.call(as, name, params, upload_data, [download_stream], [timeout])
Generic FutoIn function call interface
Result is passed through AsyncSteps.success() as a map.

**Kind**: instance method of [<code>CacheFace</code>](#CacheFace)  

| Param | Type | Description |
| --- | --- | --- |
| as | <code>AsyncSteps</code> | AsyncSteps object |
| name | <code>string</code> | FutoIn iface function name |
| params | <code>object</code> | map of func parameters |
| upload_data | <code>string</code> \| <code>stream.Readable</code> | raw upload data or input stram |
| [download_stream] | <code>stream.Writable</code> | output stream for raw download data |
| [timeout] | <code>int</code> | if provided, overrides the default. <=0 - disables timeout |

<a name="NativeIface+ifaceInfo"></a>

### cacheFace.ifaceInfo() ⇒ [<code>InterfaceInfo</code>](#InterfaceInfo)
Get interface info

**Kind**: instance method of [<code>CacheFace</code>](#CacheFace)  
**Returns**: [<code>InterfaceInfo</code>](#InterfaceInfo) - - interface info  
<a name="NativeIface+bindDerivedKey"></a>

### cacheFace.bindDerivedKey(as)
Results with DerivedKeyAccessor through as.success()

**Kind**: instance method of [<code>CacheFace</code>](#CacheFace)  

| Param | Type | Description |
| --- | --- | --- |
| as | <code>AsyncSteps</code> | step interface |

<a name="NativeIface+event_connect"></a>

### "connect"
Fired when interface establishes connection.

**Kind**: event emitted by [<code>CacheFace</code>](#CacheFace)  
<a name="NativeIface+event_disconnect"></a>

### "disconnect"
Fired when interface connection is closed.

**Kind**: event emitted by [<code>CacheFace</code>](#CacheFace)  
<a name="NativeIface+event_close"></a>

### "close"
Interface close event. Fired on interface unregistration.

**Kind**: event emitted by [<code>CacheFace</code>](#CacheFace)  
<a name="NativeIface+event_commError"></a>

### "commError"
Interface communication error. Fired during call processing.
( error_info, rawreq )

**Kind**: event emitted by [<code>CacheFace</code>](#CacheFace)  
<a name="CacheFace.register"></a>

### CacheFace.register(as, ccm, name, endpoint, [credentials], [options])
Cache Native interface registration helper

**Kind**: static method of [<code>CacheFace</code>](#CacheFace)  

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| as | <code>AsyncSteps</code> |  | step interface |
| ccm | [<code>AdvancedCCM</code>](#AdvancedCCM) |  | CCM instance |
| name | <code>string</code> |  | registration name for CCM |
| endpoint | <code>string</code> |  | endpoint URL |
| [credentials] | <code>\*</code> | <code></code> | see CCM register() |
| [options] | <code>object</code> | <code>{}</code> | registration options |
| [options.version] | <code>string</code> | <code>&quot;1.0&quot;</code> | iface version |
| [options.ttl_ms] | <code>integer</code> | <code>1000</code> | default TTL |

<a name="InterfaceInfo"></a>

## InterfaceInfo
FutoIn interface info

**Kind**: global class  

* [InterfaceInfo](#InterfaceInfo)
    * [new InterfaceInfo(raw_info)](#new_InterfaceInfo_new)
    * [.name()](#InterfaceInfo+name) ⇒ <code>string</code>
    * [.version()](#InterfaceInfo+version) ⇒ <code>string</code>
    * [.inherits()](#InterfaceInfo+inherits) ⇒ <code>string</code>
    * [.funcs()](#InterfaceInfo+funcs) ⇒ <code>object</code>
    * [.constraints()](#InterfaceInfo+constraints) ⇒ <code>array</code>

<a name="new_InterfaceInfo_new"></a>

### new InterfaceInfo(raw_info)

| Param | Type | Description |
| --- | --- | --- |
| raw_info | <code>object</code> | futoin spec as is |

<a name="InterfaceInfo+name"></a>

### interfaceInfo.name() ⇒ <code>string</code>
Get FutoIn interface name

**Kind**: instance method of [<code>InterfaceInfo</code>](#InterfaceInfo)  
**Returns**: <code>string</code> - name  
<a name="InterfaceInfo+version"></a>

### interfaceInfo.version() ⇒ <code>string</code>
Get FutoIn interface version

**Kind**: instance method of [<code>InterfaceInfo</code>](#InterfaceInfo)  
**Returns**: <code>string</code> - version  
<a name="InterfaceInfo+inherits"></a>

### interfaceInfo.inherits() ⇒ <code>string</code>
Get list of inherited interfaces starting from the most derived, may be null

**Kind**: instance method of [<code>InterfaceInfo</code>](#InterfaceInfo)  
**Returns**: <code>string</code> - inherited interface name-ver  
<a name="InterfaceInfo+funcs"></a>

### interfaceInfo.funcs() ⇒ <code>object</code>
Get list of available functions, may be null

**Kind**: instance method of [<code>InterfaceInfo</code>](#InterfaceInfo)  
**Returns**: <code>object</code> - list of functions  
<a name="InterfaceInfo+constraints"></a>

### interfaceInfo.constraints() ⇒ <code>array</code>
Get list of interface constraints, may be null

**Kind**: instance method of [<code>InterfaceInfo</code>](#InterfaceInfo)  
**Returns**: <code>array</code> - list of constraints  
<a name="LogFace"></a>

## LogFace ⇐ [<code>NativeIface</code>](#NativeIface)
AuditLog Native interface

Register with LogFace.register().

NOTE: it is not directly available Invoker module
interface, include separately

**Kind**: global class  
**Extends**: [<code>NativeIface</code>](#NativeIface)  

* [LogFace](#LogFace) ⇐ [<code>NativeIface</code>](#NativeIface)
    * _instance_
        * [.msg(lvl, txt)](#LogFace+msg)
        * [.hexdump(lvl, txt, data)](#LogFace+hexdump)
        * [.debug(txt)](#LogFace+debug)
        * [.info(txt)](#LogFace+info)
        * [.warn(txt)](#LogFace+warn)
        * [.error(txt)](#LogFace+error)
        * [.security(txt)](#LogFace+security)
        * [.call(as, name, params, upload_data, [download_stream], [timeout])](#NativeIface+call)
        * [.ifaceInfo()](#NativeIface+ifaceInfo) ⇒ [<code>InterfaceInfo</code>](#InterfaceInfo)
        * [.bindDerivedKey(as)](#NativeIface+bindDerivedKey)
        * ["connect"](#NativeIface+event_connect)
        * ["disconnect"](#NativeIface+event_disconnect)
        * ["close"](#NativeIface+event_close)
        * ["commError"](#NativeIface+event_commError)
    * _static_
        * [.LVL_DEBUG](#LogFace.LVL_DEBUG)
        * [.LVL_INFO](#LogFace.LVL_INFO)
        * [.LVL_WARN](#LogFace.LVL_WARN)
        * [.LVL_ERROR](#LogFace.LVL_ERROR)
        * [.LVL_SECURITY](#LogFace.LVL_SECURITY)
        * [.register(as, ccm, endpoint, [credentials], [options])](#LogFace.register)

<a name="LogFace+msg"></a>

### logFace.msg(lvl, txt)
Log message

**Kind**: instance method of [<code>LogFace</code>](#LogFace)  

| Param | Type | Description |
| --- | --- | --- |
| lvl | <code>string</code> | debug|info|warn|error|security |
| txt | <code>string</code> | message to log |

<a name="LogFace+hexdump"></a>

### logFace.hexdump(lvl, txt, data)
Log message

**Kind**: instance method of [<code>LogFace</code>](#LogFace)  

| Param | Type | Description |
| --- | --- | --- |
| lvl | <code>string</code> | debug|info|warn|error|security |
| txt | <code>string</code> | message to log |
| data | <code>string</code> | raw data |

<a name="LogFace+debug"></a>

### logFace.debug(txt)
Log message in debug level

**Kind**: instance method of [<code>LogFace</code>](#LogFace)  

| Param | Type | Description |
| --- | --- | --- |
| txt | <code>string</code> | message to log |

<a name="LogFace+info"></a>

### logFace.info(txt)
Log message in info level

**Kind**: instance method of [<code>LogFace</code>](#LogFace)  

| Param | Type | Description |
| --- | --- | --- |
| txt | <code>string</code> | message to log |

<a name="LogFace+warn"></a>

### logFace.warn(txt)
Log message in warn level

**Kind**: instance method of [<code>LogFace</code>](#LogFace)  

| Param | Type | Description |
| --- | --- | --- |
| txt | <code>string</code> | message to log |

<a name="LogFace+error"></a>

### logFace.error(txt)
Log message in error level

**Kind**: instance method of [<code>LogFace</code>](#LogFace)  

| Param | Type | Description |
| --- | --- | --- |
| txt | <code>string</code> | message to log |

<a name="LogFace+security"></a>

### logFace.security(txt)
Log message in security level

**Kind**: instance method of [<code>LogFace</code>](#LogFace)  

| Param | Type | Description |
| --- | --- | --- |
| txt | <code>string</code> | message to log |

<a name="NativeIface+call"></a>

### logFace.call(as, name, params, upload_data, [download_stream], [timeout])
Generic FutoIn function call interface
Result is passed through AsyncSteps.success() as a map.

**Kind**: instance method of [<code>LogFace</code>](#LogFace)  

| Param | Type | Description |
| --- | --- | --- |
| as | <code>AsyncSteps</code> | AsyncSteps object |
| name | <code>string</code> | FutoIn iface function name |
| params | <code>object</code> | map of func parameters |
| upload_data | <code>string</code> \| <code>stream.Readable</code> | raw upload data or input stram |
| [download_stream] | <code>stream.Writable</code> | output stream for raw download data |
| [timeout] | <code>int</code> | if provided, overrides the default. <=0 - disables timeout |

<a name="NativeIface+ifaceInfo"></a>

### logFace.ifaceInfo() ⇒ [<code>InterfaceInfo</code>](#InterfaceInfo)
Get interface info

**Kind**: instance method of [<code>LogFace</code>](#LogFace)  
**Returns**: [<code>InterfaceInfo</code>](#InterfaceInfo) - - interface info  
<a name="NativeIface+bindDerivedKey"></a>

### logFace.bindDerivedKey(as)
Results with DerivedKeyAccessor through as.success()

**Kind**: instance method of [<code>LogFace</code>](#LogFace)  

| Param | Type | Description |
| --- | --- | --- |
| as | <code>AsyncSteps</code> | step interface |

<a name="NativeIface+event_connect"></a>

### "connect"
Fired when interface establishes connection.

**Kind**: event emitted by [<code>LogFace</code>](#LogFace)  
<a name="NativeIface+event_disconnect"></a>

### "disconnect"
Fired when interface connection is closed.

**Kind**: event emitted by [<code>LogFace</code>](#LogFace)  
<a name="NativeIface+event_close"></a>

### "close"
Interface close event. Fired on interface unregistration.

**Kind**: event emitted by [<code>LogFace</code>](#LogFace)  
<a name="NativeIface+event_commError"></a>

### "commError"
Interface communication error. Fired during call processing.
( error_info, rawreq )

**Kind**: event emitted by [<code>LogFace</code>](#LogFace)  
<a name="LogFace.LVL_DEBUG"></a>

### LogFace.LVL_DEBUG
Debug log level

**Kind**: static constant of [<code>LogFace</code>](#LogFace)  
<a name="LogFace.LVL_INFO"></a>

### LogFace.LVL_INFO
Info log level

**Kind**: static constant of [<code>LogFace</code>](#LogFace)  
<a name="LogFace.LVL_WARN"></a>

### LogFace.LVL_WARN
Warn log level

**Kind**: static constant of [<code>LogFace</code>](#LogFace)  
<a name="LogFace.LVL_ERROR"></a>

### LogFace.LVL_ERROR
Error log level

**Kind**: static constant of [<code>LogFace</code>](#LogFace)  
<a name="LogFace.LVL_SECURITY"></a>

### LogFace.LVL_SECURITY
Security log level

**Kind**: static constant of [<code>LogFace</code>](#LogFace)  
<a name="LogFace.register"></a>

### LogFace.register(as, ccm, endpoint, [credentials], [options])
AuditLog Native interface registration helper

**Kind**: static method of [<code>LogFace</code>](#LogFace)  

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| as | <code>AsyncSteps</code> |  | step interface |
| ccm | [<code>AdvancedCCM</code>](#AdvancedCCM) |  | CCM instance |
| endpoint | <code>string</code> |  | endpoint URL |
| [credentials] | <code>\*</code> | <code></code> | see CCM register() |
| [options] | <code>object</code> | <code>{}</code> | registration options |
| [options.version] | <code>string</code> | <code>&quot;1.0&quot;</code> | iface version |

<a name="NativeIface"></a>

## NativeIface
Native Interface for FutoIn ifaces

**Kind**: global class  

* [NativeIface](#NativeIface)
    * [new NativeIface(ccmimpl, info)](#new_NativeIface_new)
    * _instance_
        * [.call(as, name, params, upload_data, [download_stream], [timeout])](#NativeIface+call)
        * [.ifaceInfo()](#NativeIface+ifaceInfo) ⇒ [<code>InterfaceInfo</code>](#InterfaceInfo)
        * [.bindDerivedKey(as)](#NativeIface+bindDerivedKey)
        * ["connect"](#NativeIface+event_connect)
        * ["disconnect"](#NativeIface+event_disconnect)
        * ["close"](#NativeIface+event_close)
        * ["commError"](#NativeIface+event_commError)
    * _static_
        * [._specs](#NativeIface._specs)
        * [._specs_module_prefix](#NativeIface._specs_module_prefix)
        * [.spec(version)](#NativeIface.spec) ⇒ <code>object</code>

<a name="new_NativeIface_new"></a>

### new NativeIface(ccmimpl, info)

| Param | Type | Description |
| --- | --- | --- |
| ccmimpl | [<code>AdvancedCCMImpl</code>](#new_AdvancedCCMImpl_new) | CCM instance |
| info | [<code>InterfaceInfo</code>](#InterfaceInfo) | interface info |

<a name="NativeIface+call"></a>

### nativeIface.call(as, name, params, upload_data, [download_stream], [timeout])
Generic FutoIn function call interface
Result is passed through AsyncSteps.success() as a map.

**Kind**: instance method of [<code>NativeIface</code>](#NativeIface)  

| Param | Type | Description |
| --- | --- | --- |
| as | <code>AsyncSteps</code> | AsyncSteps object |
| name | <code>string</code> | FutoIn iface function name |
| params | <code>object</code> | map of func parameters |
| upload_data | <code>string</code> \| <code>stream.Readable</code> | raw upload data or input stram |
| [download_stream] | <code>stream.Writable</code> | output stream for raw download data |
| [timeout] | <code>int</code> | if provided, overrides the default. <=0 - disables timeout |

<a name="NativeIface+ifaceInfo"></a>

### nativeIface.ifaceInfo() ⇒ [<code>InterfaceInfo</code>](#InterfaceInfo)
Get interface info

**Kind**: instance method of [<code>NativeIface</code>](#NativeIface)  
**Returns**: [<code>InterfaceInfo</code>](#InterfaceInfo) - - interface info  
<a name="NativeIface+bindDerivedKey"></a>

### nativeIface.bindDerivedKey(as)
Results with DerivedKeyAccessor through as.success()

**Kind**: instance method of [<code>NativeIface</code>](#NativeIface)  

| Param | Type | Description |
| --- | --- | --- |
| as | <code>AsyncSteps</code> | step interface |

<a name="NativeIface+event_connect"></a>

### "connect"
Fired when interface establishes connection.

**Kind**: event emitted by [<code>NativeIface</code>](#NativeIface)  
<a name="NativeIface+event_disconnect"></a>

### "disconnect"
Fired when interface connection is closed.

**Kind**: event emitted by [<code>NativeIface</code>](#NativeIface)  
<a name="NativeIface+event_close"></a>

### "close"
Interface close event. Fired on interface unregistration.

**Kind**: event emitted by [<code>NativeIface</code>](#NativeIface)  
<a name="NativeIface+event_commError"></a>

### "commError"
Interface communication error. Fired during call processing.
( error_info, rawreq )

**Kind**: event emitted by [<code>NativeIface</code>](#NativeIface)  
<a name="NativeIface._specs"></a>

### NativeIface._specs
Must be object with version => spec pairs in child class, if set.

**Kind**: static property of [<code>NativeIface</code>](#NativeIface)  
<a name="NativeIface._specs_module_prefix"></a>

### NativeIface._specs_module_prefix
Must be module name prefix, example: 'MyModule/specs/name_'.

If version 1.0 is requested then spec is loaded from
'MyModule/specs/name_1_0'

**Kind**: static property of [<code>NativeIface</code>](#NativeIface)  
<a name="NativeIface.spec"></a>

### NativeIface.spec(version) ⇒ <code>object</code>
Get hardcoded iface definition, if available.

**Kind**: static method of [<code>NativeIface</code>](#NativeIface)  
**Returns**: <code>object</code> - interface spec of required version  
**Note**: this helper is designed for derived native interfaces
     which define _specs or _specs_module_prefix static members.  

| Param | Type | Description |
| --- | --- | --- |
| version | <code>string</code> | iface version |

<a name="PingFace"></a>

## PingFace
Base for FTN4 ping-based interfaces

**Kind**: global class  
<a name="PingFace.register"></a>

### PingFace.register(as, ccm, name, endpoint, [credentials], [options])
Register ping interface

**Kind**: static method of [<code>PingFace</code>](#PingFace)  
**Note**: Iface spec is embedded  

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| as | <code>AsyncSteps</code> |  | step interface |
| ccm | [<code>AdvancedCCM</code>](#AdvancedCCM) |  | CCM instance |
| name | <code>string</code> |  | registration name for CCM |
| endpoint | <code>string</code> |  | endpoint URL |
| [credentials] | <code>\*</code> | <code></code> | see CCM register() |
| [options] | <code>object</code> | <code>{}</code> | registration options |
| [options.version] | <code>string</code> | <code>&quot;1.0&quot;</code> | iface version |

<a name="SimpleCCM"></a>

## SimpleCCM
Simple CCM - Reference Implementation

Base Connection and Credentials Manager with limited error control

**Kind**: global class  
**See**

- [FTN7: FutoIn Invoker Concept](http://specs.futoin.org/final/preview/ftn7_iface_invoker_concept-1.html)
- SimpleCCMOptions


* [SimpleCCM](#SimpleCCM)
    * [new SimpleCCM([options])](#new_SimpleCCM_new)
    * _instance_
        * [.register(as, name, ifacever, endpoint, [credentials], [options])](#SimpleCCM+register)
        * [.iface(name)](#SimpleCCM+iface) ⇒ <code>NativeInterface</code>
        * [.unRegister(name)](#SimpleCCM+unRegister)
        * [.defense()](#SimpleCCM+defense) ⇒ <code>object</code>
        * [.log()](#SimpleCCM+log) ⇒ <code>object</code>
        * [.cache([bucket])](#SimpleCCM+cache) ⇒ <code>object</code>
        * [.assertIface(name, ifacever)](#SimpleCCM+assertIface)
        * [.alias(name, alias)](#SimpleCCM+alias)
        * [.close()](#SimpleCCM+close)
        * [.limitZone(name, options)](#SimpleCCM+limitZone)
        * ["register"](#SimpleCCM+event_register)
        * ["unregister"](#SimpleCCM+event_unregister)
        * ["close"](#SimpleCCM+event_close)
    * _static_
        * [.SAFE_PAYLOAD_LIMIT](#SimpleCCM.SAFE_PAYLOAD_LIMIT)
        * [.SVC_RESOLVER](#SimpleCCM.SVC_RESOLVER)
        * [.SVC_AUTH](#SimpleCCM.SVC_AUTH)
        * [.SVC_DEFENSE](#SimpleCCM.SVC_DEFENSE)
        * [.SVC_ACL](#SimpleCCM.SVC_ACL)
        * [.SVC_LOG](#SimpleCCM.SVC_LOG)
        * [.SVC_CACHE_](#SimpleCCM.SVC_CACHE_)

<a name="new_SimpleCCM_new"></a>

### new SimpleCCM([options])

| Param | Type | Description |
| --- | --- | --- |
| [options] | <code>object</code> | map of options |

<a name="SimpleCCM+register"></a>

### simpleCCM.register(as, name, ifacever, endpoint, [credentials], [options])
Register standard MasterService end-point (adds steps to *as*)

**Kind**: instance method of [<code>SimpleCCM</code>](#SimpleCCM)  
**Emits**: [<code>register</code>](#SimpleCCM+event_register)  

| Param | Type | Description |
| --- | --- | --- |
| as | <code>AsyncSteps</code> | AsyncSteps instance as registration may be waiting for external resources |
| name | <code>string</code> | unique identifier in scope of CCM instance |
| ifacever | <code>string</code> | interface identifier and its version separated by colon |
| endpoint | <code>string</code> | URI      OR any other resource identifier of function( ccmimpl, info )          returning iface implementing peer, accepted by CCM implementation      OR instance of Executor |
| [credentials] | <code>string</code> | optional, authentication credentials: 'master' - enable MasterService authentication logic (Advanced CCM only) '{user}:{clear-text-password}' - send as is in the 'sec' section NOTE: some more reserved words and/or patterns can appear in the future |
| [options] | <code>object</code> | fine tune global CCM options per endpoint |

<a name="SimpleCCM+iface"></a>

### simpleCCM.iface(name) ⇒ <code>NativeInterface</code>
Get native interface wrapper for invocation of iface methods

**Kind**: instance method of [<code>SimpleCCM</code>](#SimpleCCM)  
**Returns**: <code>NativeInterface</code> - - native interface  

| Param | Type | Description |
| --- | --- | --- |
| name | <code>string</code> | see register() |

<a name="SimpleCCM+unRegister"></a>

### simpleCCM.unRegister(name)
Unregister previously registered interface (should not be used, unless really needed)

**Kind**: instance method of [<code>SimpleCCM</code>](#SimpleCCM)  
**Emits**: [<code>unregister</code>](#SimpleCCM+event_unregister)  

| Param | Type | Description |
| --- | --- | --- |
| name | <code>string</code> | see register() |

<a name="SimpleCCM+defense"></a>

### simpleCCM.defense() ⇒ <code>object</code>
Shortcut to iface( "#defense" )

**Kind**: instance method of [<code>SimpleCCM</code>](#SimpleCCM)  
**Returns**: <code>object</code> - native defense interface  
<a name="SimpleCCM+log"></a>

### simpleCCM.log() ⇒ <code>object</code>
Returns extended API interface as defined in FTN9 IF AuditLogService

**Kind**: instance method of [<code>SimpleCCM</code>](#SimpleCCM)  
**Returns**: <code>object</code> - FTN9 native face  
<a name="SimpleCCM+cache"></a>

### simpleCCM.cache([bucket]) ⇒ <code>object</code>
Returns extended API interface as defined in [FTN14 Cache][]

**Kind**: instance method of [<code>SimpleCCM</code>](#SimpleCCM)  
**Returns**: <code>object</code> - FTN14 native face  

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| [bucket] | <code>string</code> | <code>&quot;default&quot;</code> | cache bucket name |

<a name="SimpleCCM+assertIface"></a>

### simpleCCM.assertIface(name, ifacever)
Assert that interface registered by name matches major version and minor is not less than required.
This function must generate fatal error and forbid any further execution

**Kind**: instance method of [<code>SimpleCCM</code>](#SimpleCCM)  

| Param | Type | Description |
| --- | --- | --- |
| name | <code>string</code> | unique identifier in scope of CCM instance |
| ifacever | <code>string</code> | interface identifier and its version separated by colon |

<a name="SimpleCCM+alias"></a>

### simpleCCM.alias(name, alias)
Alias interface name with another name

**Kind**: instance method of [<code>SimpleCCM</code>](#SimpleCCM)  
**Emits**: [<code>register</code>](#SimpleCCM+event_register)  

| Param | Type | Description |
| --- | --- | --- |
| name | <code>string</code> | unique identifier in scope of CCM instance |
| alias | <code>string</code> | alternative name for registered interface |

<a name="SimpleCCM+close"></a>

### simpleCCM.close()
Shutdown CCM (close all active comms)

**Kind**: instance method of [<code>SimpleCCM</code>](#SimpleCCM)  
**Emits**: [<code>close</code>](#SimpleCCM+event_close)  
<a name="SimpleCCM+limitZone"></a>

### simpleCCM.limitZone(name, options)
Configure named AsyncSteps Limiter instance

**Kind**: instance method of [<code>SimpleCCM</code>](#SimpleCCM)  

| Param | Type | Description |
| --- | --- | --- |
| name | <code>string</code> | zone name |
| options | <code>object</code> | options to pass to Limiter c-tor |

<a name="SimpleCCM+event_register"></a>

### "register"
CCM regiser event. Fired on new interface registration.
( name, ifacever, info )

**Kind**: event emitted by [<code>SimpleCCM</code>](#SimpleCCM)  
<a name="SimpleCCM+event_unregister"></a>

### "unregister"
CCM regiser event. Fired on interface unregistration.
( name, info )

**Kind**: event emitted by [<code>SimpleCCM</code>](#SimpleCCM)  
<a name="SimpleCCM+event_close"></a>

### "close"
CCM close event. Fired on CCM shutdown.

**Kind**: event emitted by [<code>SimpleCCM</code>](#SimpleCCM)  
<a name="SimpleCCM.SAFE_PAYLOAD_LIMIT"></a>

### SimpleCCM.SAFE_PAYLOAD_LIMIT
Maximum FutoIn message payload size (not related to raw data)

**Kind**: static constant of [<code>SimpleCCM</code>](#SimpleCCM)  
**Default**: <code>65536</code>  
<a name="SimpleCCM.SVC_RESOLVER"></a>

### SimpleCCM.SVC_RESOLVER
Runtime iface resolution v1.x

**Kind**: static constant of [<code>SimpleCCM</code>](#SimpleCCM)  
<a name="SimpleCCM.SVC_AUTH"></a>

### SimpleCCM.SVC_AUTH
AuthService v1.x

**Kind**: static constant of [<code>SimpleCCM</code>](#SimpleCCM)  
<a name="SimpleCCM.SVC_DEFENSE"></a>

### SimpleCCM.SVC_DEFENSE
Defense system v1.x

**Kind**: static constant of [<code>SimpleCCM</code>](#SimpleCCM)  
<a name="SimpleCCM.SVC_ACL"></a>

### SimpleCCM.SVC_ACL
Access Control system v1.x

**Kind**: static constant of [<code>SimpleCCM</code>](#SimpleCCM)  
<a name="SimpleCCM.SVC_LOG"></a>

### SimpleCCM.SVC_LOG
Audit Logging v1.x

**Kind**: static constant of [<code>SimpleCCM</code>](#SimpleCCM)  
<a name="SimpleCCM.SVC_CACHE_"></a>

### SimpleCCM.SVC_CACHE_
cache v1.x iface name prefix

**Kind**: static constant of [<code>SimpleCCM</code>](#SimpleCCM)  
<a name="SpecTools"></a>

## SpecTools
**Kind**: global class  

* [SpecTools](#SpecTools)
    * [new spectools()](#new_SpecTools_new)
    * [.standard_errors](#SpecTools.standard_errors)
    * [.loadIface(as, info, specdirs, [load_cache])](#SpecTools.loadIface)
    * [.parseIface(as, info, specdirs, raw_spec, [load_cache])](#SpecTools.parseIface)
    * [.checkConsistency(as, info)](#SpecTools.checkConsistency)
    * [.checkType(info, type, val)](#SpecTools.checkType) ⇒ <code>Boolean</code>
    * [.checkParameterType(info, funcname, varname, value)](#SpecTools.checkParameterType) ⇒ <code>boolean</code>
    * [.checkResultType(as, info, funcname, varname, value)](#SpecTools.checkResultType)
    * [.genHMAC(as, info, ftnreq)](#SpecTools.genHMAC) ⇒ <code>Buffer</code>
    * [.secureEquals(a, b)](#SpecTools.secureEquals) ⇒ <code>boolean</code>
    * [.secureEqualBuffer(a, b)](#SpecTools.secureEqualBuffer) ⇒ <code>boolean</code>
    * ["error"](#SpecTools.event_error)

<a name="new_SpecTools_new"></a>

### new spectools()
SpecTools

<a name="SpecTools.standard_errors"></a>

### SpecTools.standard_errors
Enumeration of standard errors

**Kind**: static constant of [<code>SpecTools</code>](#SpecTools)  
<a name="SpecTools.loadIface"></a>

### SpecTools.loadIface(as, info, specdirs, [load_cache])
Load FutoIn iface definition.

NOTE: Browser uses XHR to load specs, Node.js searches in local fs.

**Kind**: static method of [<code>SpecTools</code>](#SpecTools)  

| Param | Type | Description |
| --- | --- | --- |
| as | <code>AsyncSteps</code> | step interface |
| info | <code>Object</code> | destination object with "iface" and "version" fields already set |
| specdirs | <code>Array</code> | each element - search path/url (string) or raw iface (object) |
| [load_cache] | <code>Object</code> | arbitrary object to use for caching |

<a name="SpecTools.parseIface"></a>

### SpecTools.parseIface(as, info, specdirs, raw_spec, [load_cache])
Parse raw futoin spec (preloaded)

**Kind**: static method of [<code>SpecTools</code>](#SpecTools)  

| Param | Type | Description |
| --- | --- | --- |
| as | <code>AsyncSteps</code> | step interface |
| info | <code>Object</code> | destination object with "iface" and "version" fields already set |
| specdirs | <code>Array</code> | each element - search path/url (string) or raw iface (object) |
| raw_spec | <code>Object</code> | iface definition object |
| [load_cache] | <code>Object</code> | cache of already loaded interfaces |

<a name="SpecTools.checkConsistency"></a>

### SpecTools.checkConsistency(as, info)
Deeply check consistency of loaded interface.

NOTE: not yet implemented

**Kind**: static method of [<code>SpecTools</code>](#SpecTools)  

| Param | Type | Description |
| --- | --- | --- |
| as | <code>AsyncSteps</code> | step interface |
| info | <code>Object</code> | previously loaded iface |

<a name="SpecTools.checkType"></a>

### SpecTools.checkType(info, type, val) ⇒ <code>Boolean</code>
Check if value matches required type

**Kind**: static method of [<code>SpecTools</code>](#SpecTools)  
**Returns**: <code>Boolean</code> - true on success  

| Param | Type | Description |
| --- | --- | --- |
| info | <code>Object</code> | previously loaded iface |
| type | <code>string</code> | standard or custom iface type |
| val | <code>\*</code> | value to check |

<a name="SpecTools.checkParameterType"></a>

### SpecTools.checkParameterType(info, funcname, varname, value) ⇒ <code>boolean</code>
Check if parameter value matches required type

**Kind**: static method of [<code>SpecTools</code>](#SpecTools)  
**Returns**: <code>boolean</code> - true on success  

| Param | Type | Description |
| --- | --- | --- |
| info | <code>Object</code> | previously loaded iface |
| funcname | <code>string</code> | function name |
| varname | <code>string</code> | parameter name |
| value | <code>\*</code> | value to check |

<a name="SpecTools.checkResultType"></a>

### SpecTools.checkResultType(as, info, funcname, varname, value)
Check if result value matches required type

**Kind**: static method of [<code>SpecTools</code>](#SpecTools)  

| Param | Type | Description |
| --- | --- | --- |
| as | <code>AsyncSteps</code> | step interface |
| info | <code>Object</code> | previously loaded iface |
| funcname | <code>string</code> | function name |
| varname | <code>string</code> | result variable name |
| value | <code>\*</code> | value to check |

<a name="SpecTools.genHMAC"></a>

### SpecTools.genHMAC(as, info, ftnreq) ⇒ <code>Buffer</code>
Generate HMAC

NOTE: for simplicity, 'sec' field must not be present

**Kind**: static method of [<code>SpecTools</code>](#SpecTools)  
**Returns**: <code>Buffer</code> - Binary HMAC signature  
**Throws**:

- <code>FutoInError</code> 


| Param | Type | Description |
| --- | --- | --- |
| as | <code>AsyncSteps</code> | step interface |
| info | <code>object</code> | Interface raw info object |
| ftnreq | <code>object</code> | Request Object |

<a name="SpecTools.secureEquals"></a>

### SpecTools.secureEquals(a, b) ⇒ <code>boolean</code>
Secure compare to cover time-based side-channels for attacks

**Kind**: static method of [<code>SpecTools</code>](#SpecTools)  
**Returns**: <code>boolean</code> - true, if match  
**Note**: Pure JS is used in browser and crypto-based in Node.js  

| Param | Type | Description |
| --- | --- | --- |
| a | <code>string</code> | first string |
| b | <code>string</code> | second String |

<a name="SpecTools.secureEqualBuffer"></a>

### SpecTools.secureEqualBuffer(a, b) ⇒ <code>boolean</code>
Secure compare to cover time-based side-channels for attacks

**Kind**: static method of [<code>SpecTools</code>](#SpecTools)  
**Returns**: <code>boolean</code> - true, if match  

| Param | Type | Description |
| --- | --- | --- |
| a | <code>Buffer</code> | first buffer |
| b | <code>Buffer</code> | second buffer |

<a name="SpecTools.event_error"></a>

### "error"
On error message for details in debugging.

**Kind**: event emitted by [<code>SpecTools</code>](#SpecTools)  
<a name="AdvancedCCMOptions"></a>

## AdvancedCCMOptions ⇐ [<code>SimpleCCMOptions</code>](#SimpleCCMOptions)
**Kind**: global class  
**Extends**: [<code>SimpleCCMOptions</code>](#SimpleCCMOptions)  

* [AdvancedCCMOptions](#AdvancedCCMOptions) ⇐ [<code>SimpleCCMOptions</code>](#SimpleCCMOptions)
    * [new AdvancedCCMOptions()](#new_AdvancedCCMOptions_new)
    * [.specDirs](#AdvancedCCMOptions.specDirs)
    * [.hmacKey](#AdvancedCCMOptions.hmacKey)
    * [.hmacAlgo](#AdvancedCCMOptions.hmacAlgo)
    * [.sendOnBehalfOf](#AdvancedCCMOptions.sendOnBehalfOf)

<a name="new_AdvancedCCMOptions_new"></a>

### new AdvancedCCMOptions()
This is a pseudo-class for documentation purposes

NOTE: Each option can be set on global level and overriden per interface.

<a name="AdvancedCCMOptions.specDirs"></a>

### AdvancedCCMOptions.specDirs
Search dirs for spec definition or spec instance directly. It can
be single value or array of values. Each value is either path/URL (string) or
iface spec instance (object).

**Kind**: static property of [<code>AdvancedCCMOptions</code>](#AdvancedCCMOptions)  
**Default**: <code>[]</code>  
<a name="AdvancedCCMOptions.hmacKey"></a>

### AdvancedCCMOptions.hmacKey
Base64 encoded key for HMAC generation. See FTN6/FTN7

**Kind**: static property of [<code>AdvancedCCMOptions</code>](#AdvancedCCMOptions)  
<a name="AdvancedCCMOptions.hmacAlgo"></a>

### AdvancedCCMOptions.hmacAlgo
Hash algorithm for HMAC generation:
MD5(default), SHA224, SHA256, SHA384, SHA256

**Kind**: static property of [<code>AdvancedCCMOptions</code>](#AdvancedCCMOptions)  
**Default**: <code>MD5</code>  
<a name="AdvancedCCMOptions.sendOnBehalfOf"></a>

### AdvancedCCMOptions.sendOnBehalfOf
Send "obf" (On Behalf Of) user information as defined in FTN3 v1.3
when invoked from Executor's request processing task

**Kind**: static property of [<code>AdvancedCCMOptions</code>](#AdvancedCCMOptions)  
**Default**: <code>true</code>  
<a name="SimpleCCMOptions"></a>

## SimpleCCMOptions
**Kind**: global class  

* [SimpleCCMOptions](#SimpleCCMOptions)
    * [new SimpleCCMOptions()](#new_SimpleCCMOptions_new)
    * [.callTimeoutMS](#SimpleCCMOptions.callTimeoutMS)
    * [.prodMode](#SimpleCCMOptions.prodMode)
    * [.commConfigCallback](#SimpleCCMOptions.commConfigCallback)
    * [.executor](#SimpleCCMOptions.executor)
    * [.targetOrigin](#SimpleCCMOptions.targetOrigin)
    * [.retryCount](#SimpleCCMOptions.retryCount)
    * [.defaultCoder](#SimpleCCMOptions.defaultCoder)
    * [.binaryCoder](#SimpleCCMOptions.binaryCoder)
    * [.messageSniffer()](#SimpleCCMOptions.messageSniffer)
    * [.disconnectSniffer()](#SimpleCCMOptions.disconnectSniffer)

<a name="new_SimpleCCMOptions_new"></a>

### new SimpleCCMOptions()
This is a pseudo-class for documentation purposes.

NOTE: Each option can be set on global level and overriden per interface.

<a name="SimpleCCMOptions.callTimeoutMS"></a>

### SimpleCCMOptions.callTimeoutMS
Overall call timeout (int)

**Kind**: static property of [<code>SimpleCCMOptions</code>](#SimpleCCMOptions)  
**Default**: <code>3000</code>  
<a name="SimpleCCMOptions.prodMode"></a>

### SimpleCCMOptions.prodMode
Production mode - disables some checks without compomising security

**Kind**: static property of [<code>SimpleCCMOptions</code>](#SimpleCCMOptions)  
**Default**: <code>NODE_ENV &#x3D;&#x3D;&#x3D; &#x27;production&#x27;</code>  
<a name="SimpleCCMOptions.commConfigCallback"></a>

### SimpleCCMOptions.commConfigCallback
Communication configuration callback( type, specific-args )

**Kind**: static property of [<code>SimpleCCMOptions</code>](#SimpleCCMOptions)  
**Default**: <code></code>  
<a name="SimpleCCMOptions.executor"></a>

### SimpleCCMOptions.executor
Client-side executor for bi-directional communication channels

**Kind**: static property of [<code>SimpleCCMOptions</code>](#SimpleCCMOptions)  
<a name="SimpleCCMOptions.targetOrigin"></a>

### SimpleCCMOptions.targetOrigin
*browser-only.* Origin of target for *window.postMessage()*

**Kind**: static property of [<code>SimpleCCMOptions</code>](#SimpleCCMOptions)  
<a name="SimpleCCMOptions.retryCount"></a>

### SimpleCCMOptions.retryCount
How many times to retry the call on CommError.
NOTE: actual attempt count is retryCount + 1

**Kind**: static property of [<code>SimpleCCMOptions</code>](#SimpleCCMOptions)  
**Default**: <code>1</code>  
<a name="SimpleCCMOptions.defaultCoder"></a>

### SimpleCCMOptions.defaultCoder
Which message coder to use by default.

**Kind**: static property of [<code>SimpleCCMOptions</code>](#SimpleCCMOptions)  
**Default**: <code>JSON</code>  
<a name="SimpleCCMOptions.binaryCoder"></a>

### SimpleCCMOptions.binaryCoder
Which message coder to use for BinaryData interfaces.

**Kind**: static property of [<code>SimpleCCMOptions</code>](#SimpleCCMOptions)  
**Default**: <code>MPCK</code>  
<a name="SimpleCCMOptions.messageSniffer"></a>

### SimpleCCMOptions.messageSniffer()
Message sniffer callback( iface_info, msg, is_incomming ).
Useful for audit logging.

**Kind**: static method of [<code>SimpleCCMOptions</code>](#SimpleCCMOptions)  
**Default**: <code>dummy</code>  
<a name="SimpleCCMOptions.disconnectSniffer"></a>

### SimpleCCMOptions.disconnectSniffer()
Bi-directional channel disconnect sniffer callback( iface_info ).
Useful for audit logging.

**Kind**: static method of [<code>SimpleCCMOptions</code>](#SimpleCCMOptions)  
**Default**: <code>dummy</code>  
<a name="SimpleCCM"></a>

## SimpleCCM
**window.SimpleCCM** - Browser-only reference to futoin-asyncsteps.SimpleCCM

**Kind**: global variable  

* [SimpleCCM](#SimpleCCM)
    * [new SimpleCCM([options])](#new_SimpleCCM_new)
    * _instance_
        * [.register(as, name, ifacever, endpoint, [credentials], [options])](#SimpleCCM+register)
        * [.iface(name)](#SimpleCCM+iface) ⇒ <code>NativeInterface</code>
        * [.unRegister(name)](#SimpleCCM+unRegister)
        * [.defense()](#SimpleCCM+defense) ⇒ <code>object</code>
        * [.log()](#SimpleCCM+log) ⇒ <code>object</code>
        * [.cache([bucket])](#SimpleCCM+cache) ⇒ <code>object</code>
        * [.assertIface(name, ifacever)](#SimpleCCM+assertIface)
        * [.alias(name, alias)](#SimpleCCM+alias)
        * [.close()](#SimpleCCM+close)
        * [.limitZone(name, options)](#SimpleCCM+limitZone)
        * ["register"](#SimpleCCM+event_register)
        * ["unregister"](#SimpleCCM+event_unregister)
        * ["close"](#SimpleCCM+event_close)
    * _static_
        * [.SAFE_PAYLOAD_LIMIT](#SimpleCCM.SAFE_PAYLOAD_LIMIT)
        * [.SVC_RESOLVER](#SimpleCCM.SVC_RESOLVER)
        * [.SVC_AUTH](#SimpleCCM.SVC_AUTH)
        * [.SVC_DEFENSE](#SimpleCCM.SVC_DEFENSE)
        * [.SVC_ACL](#SimpleCCM.SVC_ACL)
        * [.SVC_LOG](#SimpleCCM.SVC_LOG)
        * [.SVC_CACHE_](#SimpleCCM.SVC_CACHE_)

<a name="new_SimpleCCM_new"></a>

### new SimpleCCM([options])

| Param | Type | Description |
| --- | --- | --- |
| [options] | <code>object</code> | map of options |

<a name="SimpleCCM+register"></a>

### simpleCCM.register(as, name, ifacever, endpoint, [credentials], [options])
Register standard MasterService end-point (adds steps to *as*)

**Kind**: instance method of [<code>SimpleCCM</code>](#SimpleCCM)  
**Emits**: [<code>register</code>](#SimpleCCM+event_register)  

| Param | Type | Description |
| --- | --- | --- |
| as | <code>AsyncSteps</code> | AsyncSteps instance as registration may be waiting for external resources |
| name | <code>string</code> | unique identifier in scope of CCM instance |
| ifacever | <code>string</code> | interface identifier and its version separated by colon |
| endpoint | <code>string</code> | URI      OR any other resource identifier of function( ccmimpl, info )          returning iface implementing peer, accepted by CCM implementation      OR instance of Executor |
| [credentials] | <code>string</code> | optional, authentication credentials: 'master' - enable MasterService authentication logic (Advanced CCM only) '{user}:{clear-text-password}' - send as is in the 'sec' section NOTE: some more reserved words and/or patterns can appear in the future |
| [options] | <code>object</code> | fine tune global CCM options per endpoint |

<a name="SimpleCCM+iface"></a>

### simpleCCM.iface(name) ⇒ <code>NativeInterface</code>
Get native interface wrapper for invocation of iface methods

**Kind**: instance method of [<code>SimpleCCM</code>](#SimpleCCM)  
**Returns**: <code>NativeInterface</code> - - native interface  

| Param | Type | Description |
| --- | --- | --- |
| name | <code>string</code> | see register() |

<a name="SimpleCCM+unRegister"></a>

### simpleCCM.unRegister(name)
Unregister previously registered interface (should not be used, unless really needed)

**Kind**: instance method of [<code>SimpleCCM</code>](#SimpleCCM)  
**Emits**: [<code>unregister</code>](#SimpleCCM+event_unregister)  

| Param | Type | Description |
| --- | --- | --- |
| name | <code>string</code> | see register() |

<a name="SimpleCCM+defense"></a>

### simpleCCM.defense() ⇒ <code>object</code>
Shortcut to iface( "#defense" )

**Kind**: instance method of [<code>SimpleCCM</code>](#SimpleCCM)  
**Returns**: <code>object</code> - native defense interface  
<a name="SimpleCCM+log"></a>

### simpleCCM.log() ⇒ <code>object</code>
Returns extended API interface as defined in FTN9 IF AuditLogService

**Kind**: instance method of [<code>SimpleCCM</code>](#SimpleCCM)  
**Returns**: <code>object</code> - FTN9 native face  
<a name="SimpleCCM+cache"></a>

### simpleCCM.cache([bucket]) ⇒ <code>object</code>
Returns extended API interface as defined in [FTN14 Cache][]

**Kind**: instance method of [<code>SimpleCCM</code>](#SimpleCCM)  
**Returns**: <code>object</code> - FTN14 native face  

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| [bucket] | <code>string</code> | <code>&quot;default&quot;</code> | cache bucket name |

<a name="SimpleCCM+assertIface"></a>

### simpleCCM.assertIface(name, ifacever)
Assert that interface registered by name matches major version and minor is not less than required.
This function must generate fatal error and forbid any further execution

**Kind**: instance method of [<code>SimpleCCM</code>](#SimpleCCM)  

| Param | Type | Description |
| --- | --- | --- |
| name | <code>string</code> | unique identifier in scope of CCM instance |
| ifacever | <code>string</code> | interface identifier and its version separated by colon |

<a name="SimpleCCM+alias"></a>

### simpleCCM.alias(name, alias)
Alias interface name with another name

**Kind**: instance method of [<code>SimpleCCM</code>](#SimpleCCM)  
**Emits**: [<code>register</code>](#SimpleCCM+event_register)  

| Param | Type | Description |
| --- | --- | --- |
| name | <code>string</code> | unique identifier in scope of CCM instance |
| alias | <code>string</code> | alternative name for registered interface |

<a name="SimpleCCM+close"></a>

### simpleCCM.close()
Shutdown CCM (close all active comms)

**Kind**: instance method of [<code>SimpleCCM</code>](#SimpleCCM)  
**Emits**: [<code>close</code>](#SimpleCCM+event_close)  
<a name="SimpleCCM+limitZone"></a>

### simpleCCM.limitZone(name, options)
Configure named AsyncSteps Limiter instance

**Kind**: instance method of [<code>SimpleCCM</code>](#SimpleCCM)  

| Param | Type | Description |
| --- | --- | --- |
| name | <code>string</code> | zone name |
| options | <code>object</code> | options to pass to Limiter c-tor |

<a name="SimpleCCM+event_register"></a>

### "register"
CCM regiser event. Fired on new interface registration.
( name, ifacever, info )

**Kind**: event emitted by [<code>SimpleCCM</code>](#SimpleCCM)  
<a name="SimpleCCM+event_unregister"></a>

### "unregister"
CCM regiser event. Fired on interface unregistration.
( name, info )

**Kind**: event emitted by [<code>SimpleCCM</code>](#SimpleCCM)  
<a name="SimpleCCM+event_close"></a>

### "close"
CCM close event. Fired on CCM shutdown.

**Kind**: event emitted by [<code>SimpleCCM</code>](#SimpleCCM)  
<a name="SimpleCCM.SAFE_PAYLOAD_LIMIT"></a>

### SimpleCCM.SAFE_PAYLOAD_LIMIT
Maximum FutoIn message payload size (not related to raw data)

**Kind**: static constant of [<code>SimpleCCM</code>](#SimpleCCM)  
**Default**: <code>65536</code>  
<a name="SimpleCCM.SVC_RESOLVER"></a>

### SimpleCCM.SVC_RESOLVER
Runtime iface resolution v1.x

**Kind**: static constant of [<code>SimpleCCM</code>](#SimpleCCM)  
<a name="SimpleCCM.SVC_AUTH"></a>

### SimpleCCM.SVC_AUTH
AuthService v1.x

**Kind**: static constant of [<code>SimpleCCM</code>](#SimpleCCM)  
<a name="SimpleCCM.SVC_DEFENSE"></a>

### SimpleCCM.SVC_DEFENSE
Defense system v1.x

**Kind**: static constant of [<code>SimpleCCM</code>](#SimpleCCM)  
<a name="SimpleCCM.SVC_ACL"></a>

### SimpleCCM.SVC_ACL
Access Control system v1.x

**Kind**: static constant of [<code>SimpleCCM</code>](#SimpleCCM)  
<a name="SimpleCCM.SVC_LOG"></a>

### SimpleCCM.SVC_LOG
Audit Logging v1.x

**Kind**: static constant of [<code>SimpleCCM</code>](#SimpleCCM)  
<a name="SimpleCCM.SVC_CACHE_"></a>

### SimpleCCM.SVC_CACHE_
cache v1.x iface name prefix

**Kind**: static constant of [<code>SimpleCCM</code>](#SimpleCCM)  
<a name="SimpleCCM"></a>

## SimpleCCM
**window.SimpleCCM** - Browser-only reference to futoin-asyncsteps.SimpleCCM

**Kind**: global variable  

* [SimpleCCM](#SimpleCCM)
    * [new SimpleCCM([options])](#new_SimpleCCM_new)
    * _instance_
        * [.register(as, name, ifacever, endpoint, [credentials], [options])](#SimpleCCM+register)
        * [.iface(name)](#SimpleCCM+iface) ⇒ <code>NativeInterface</code>
        * [.unRegister(name)](#SimpleCCM+unRegister)
        * [.defense()](#SimpleCCM+defense) ⇒ <code>object</code>
        * [.log()](#SimpleCCM+log) ⇒ <code>object</code>
        * [.cache([bucket])](#SimpleCCM+cache) ⇒ <code>object</code>
        * [.assertIface(name, ifacever)](#SimpleCCM+assertIface)
        * [.alias(name, alias)](#SimpleCCM+alias)
        * [.close()](#SimpleCCM+close)
        * [.limitZone(name, options)](#SimpleCCM+limitZone)
        * ["register"](#SimpleCCM+event_register)
        * ["unregister"](#SimpleCCM+event_unregister)
        * ["close"](#SimpleCCM+event_close)
    * _static_
        * [.SAFE_PAYLOAD_LIMIT](#SimpleCCM.SAFE_PAYLOAD_LIMIT)
        * [.SVC_RESOLVER](#SimpleCCM.SVC_RESOLVER)
        * [.SVC_AUTH](#SimpleCCM.SVC_AUTH)
        * [.SVC_DEFENSE](#SimpleCCM.SVC_DEFENSE)
        * [.SVC_ACL](#SimpleCCM.SVC_ACL)
        * [.SVC_LOG](#SimpleCCM.SVC_LOG)
        * [.SVC_CACHE_](#SimpleCCM.SVC_CACHE_)

<a name="new_SimpleCCM_new"></a>

### new SimpleCCM([options])

| Param | Type | Description |
| --- | --- | --- |
| [options] | <code>object</code> | map of options |

<a name="SimpleCCM+register"></a>

### simpleCCM.register(as, name, ifacever, endpoint, [credentials], [options])
Register standard MasterService end-point (adds steps to *as*)

**Kind**: instance method of [<code>SimpleCCM</code>](#SimpleCCM)  
**Emits**: [<code>register</code>](#SimpleCCM+event_register)  

| Param | Type | Description |
| --- | --- | --- |
| as | <code>AsyncSteps</code> | AsyncSteps instance as registration may be waiting for external resources |
| name | <code>string</code> | unique identifier in scope of CCM instance |
| ifacever | <code>string</code> | interface identifier and its version separated by colon |
| endpoint | <code>string</code> | URI      OR any other resource identifier of function( ccmimpl, info )          returning iface implementing peer, accepted by CCM implementation      OR instance of Executor |
| [credentials] | <code>string</code> | optional, authentication credentials: 'master' - enable MasterService authentication logic (Advanced CCM only) '{user}:{clear-text-password}' - send as is in the 'sec' section NOTE: some more reserved words and/or patterns can appear in the future |
| [options] | <code>object</code> | fine tune global CCM options per endpoint |

<a name="SimpleCCM+iface"></a>

### simpleCCM.iface(name) ⇒ <code>NativeInterface</code>
Get native interface wrapper for invocation of iface methods

**Kind**: instance method of [<code>SimpleCCM</code>](#SimpleCCM)  
**Returns**: <code>NativeInterface</code> - - native interface  

| Param | Type | Description |
| --- | --- | --- |
| name | <code>string</code> | see register() |

<a name="SimpleCCM+unRegister"></a>

### simpleCCM.unRegister(name)
Unregister previously registered interface (should not be used, unless really needed)

**Kind**: instance method of [<code>SimpleCCM</code>](#SimpleCCM)  
**Emits**: [<code>unregister</code>](#SimpleCCM+event_unregister)  

| Param | Type | Description |
| --- | --- | --- |
| name | <code>string</code> | see register() |

<a name="SimpleCCM+defense"></a>

### simpleCCM.defense() ⇒ <code>object</code>
Shortcut to iface( "#defense" )

**Kind**: instance method of [<code>SimpleCCM</code>](#SimpleCCM)  
**Returns**: <code>object</code> - native defense interface  
<a name="SimpleCCM+log"></a>

### simpleCCM.log() ⇒ <code>object</code>
Returns extended API interface as defined in FTN9 IF AuditLogService

**Kind**: instance method of [<code>SimpleCCM</code>](#SimpleCCM)  
**Returns**: <code>object</code> - FTN9 native face  
<a name="SimpleCCM+cache"></a>

### simpleCCM.cache([bucket]) ⇒ <code>object</code>
Returns extended API interface as defined in [FTN14 Cache][]

**Kind**: instance method of [<code>SimpleCCM</code>](#SimpleCCM)  
**Returns**: <code>object</code> - FTN14 native face  

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| [bucket] | <code>string</code> | <code>&quot;default&quot;</code> | cache bucket name |

<a name="SimpleCCM+assertIface"></a>

### simpleCCM.assertIface(name, ifacever)
Assert that interface registered by name matches major version and minor is not less than required.
This function must generate fatal error and forbid any further execution

**Kind**: instance method of [<code>SimpleCCM</code>](#SimpleCCM)  

| Param | Type | Description |
| --- | --- | --- |
| name | <code>string</code> | unique identifier in scope of CCM instance |
| ifacever | <code>string</code> | interface identifier and its version separated by colon |

<a name="SimpleCCM+alias"></a>

### simpleCCM.alias(name, alias)
Alias interface name with another name

**Kind**: instance method of [<code>SimpleCCM</code>](#SimpleCCM)  
**Emits**: [<code>register</code>](#SimpleCCM+event_register)  

| Param | Type | Description |
| --- | --- | --- |
| name | <code>string</code> | unique identifier in scope of CCM instance |
| alias | <code>string</code> | alternative name for registered interface |

<a name="SimpleCCM+close"></a>

### simpleCCM.close()
Shutdown CCM (close all active comms)

**Kind**: instance method of [<code>SimpleCCM</code>](#SimpleCCM)  
**Emits**: [<code>close</code>](#SimpleCCM+event_close)  
<a name="SimpleCCM+limitZone"></a>

### simpleCCM.limitZone(name, options)
Configure named AsyncSteps Limiter instance

**Kind**: instance method of [<code>SimpleCCM</code>](#SimpleCCM)  

| Param | Type | Description |
| --- | --- | --- |
| name | <code>string</code> | zone name |
| options | <code>object</code> | options to pass to Limiter c-tor |

<a name="SimpleCCM+event_register"></a>

### "register"
CCM regiser event. Fired on new interface registration.
( name, ifacever, info )

**Kind**: event emitted by [<code>SimpleCCM</code>](#SimpleCCM)  
<a name="SimpleCCM+event_unregister"></a>

### "unregister"
CCM regiser event. Fired on interface unregistration.
( name, info )

**Kind**: event emitted by [<code>SimpleCCM</code>](#SimpleCCM)  
<a name="SimpleCCM+event_close"></a>

### "close"
CCM close event. Fired on CCM shutdown.

**Kind**: event emitted by [<code>SimpleCCM</code>](#SimpleCCM)  
<a name="SimpleCCM.SAFE_PAYLOAD_LIMIT"></a>

### SimpleCCM.SAFE_PAYLOAD_LIMIT
Maximum FutoIn message payload size (not related to raw data)

**Kind**: static constant of [<code>SimpleCCM</code>](#SimpleCCM)  
**Default**: <code>65536</code>  
<a name="SimpleCCM.SVC_RESOLVER"></a>

### SimpleCCM.SVC_RESOLVER
Runtime iface resolution v1.x

**Kind**: static constant of [<code>SimpleCCM</code>](#SimpleCCM)  
<a name="SimpleCCM.SVC_AUTH"></a>

### SimpleCCM.SVC_AUTH
AuthService v1.x

**Kind**: static constant of [<code>SimpleCCM</code>](#SimpleCCM)  
<a name="SimpleCCM.SVC_DEFENSE"></a>

### SimpleCCM.SVC_DEFENSE
Defense system v1.x

**Kind**: static constant of [<code>SimpleCCM</code>](#SimpleCCM)  
<a name="SimpleCCM.SVC_ACL"></a>

### SimpleCCM.SVC_ACL
Access Control system v1.x

**Kind**: static constant of [<code>SimpleCCM</code>](#SimpleCCM)  
<a name="SimpleCCM.SVC_LOG"></a>

### SimpleCCM.SVC_LOG
Audit Logging v1.x

**Kind**: static constant of [<code>SimpleCCM</code>](#SimpleCCM)  
<a name="SimpleCCM.SVC_CACHE_"></a>

### SimpleCCM.SVC_CACHE_
cache v1.x iface name prefix

**Kind**: static constant of [<code>SimpleCCM</code>](#SimpleCCM)  
<a name="SimpleCCM"></a>

## SimpleCCM
**futoin.SimpleCCM** - Browser-only reference to futoin-asyncsteps.SimpleCCM

**Kind**: global variable  

* [SimpleCCM](#SimpleCCM)
    * [new SimpleCCM([options])](#new_SimpleCCM_new)
    * _instance_
        * [.register(as, name, ifacever, endpoint, [credentials], [options])](#SimpleCCM+register)
        * [.iface(name)](#SimpleCCM+iface) ⇒ <code>NativeInterface</code>
        * [.unRegister(name)](#SimpleCCM+unRegister)
        * [.defense()](#SimpleCCM+defense) ⇒ <code>object</code>
        * [.log()](#SimpleCCM+log) ⇒ <code>object</code>
        * [.cache([bucket])](#SimpleCCM+cache) ⇒ <code>object</code>
        * [.assertIface(name, ifacever)](#SimpleCCM+assertIface)
        * [.alias(name, alias)](#SimpleCCM+alias)
        * [.close()](#SimpleCCM+close)
        * [.limitZone(name, options)](#SimpleCCM+limitZone)
        * ["register"](#SimpleCCM+event_register)
        * ["unregister"](#SimpleCCM+event_unregister)
        * ["close"](#SimpleCCM+event_close)
    * _static_
        * [.SAFE_PAYLOAD_LIMIT](#SimpleCCM.SAFE_PAYLOAD_LIMIT)
        * [.SVC_RESOLVER](#SimpleCCM.SVC_RESOLVER)
        * [.SVC_AUTH](#SimpleCCM.SVC_AUTH)
        * [.SVC_DEFENSE](#SimpleCCM.SVC_DEFENSE)
        * [.SVC_ACL](#SimpleCCM.SVC_ACL)
        * [.SVC_LOG](#SimpleCCM.SVC_LOG)
        * [.SVC_CACHE_](#SimpleCCM.SVC_CACHE_)

<a name="new_SimpleCCM_new"></a>

### new SimpleCCM([options])

| Param | Type | Description |
| --- | --- | --- |
| [options] | <code>object</code> | map of options |

<a name="SimpleCCM+register"></a>

### simpleCCM.register(as, name, ifacever, endpoint, [credentials], [options])
Register standard MasterService end-point (adds steps to *as*)

**Kind**: instance method of [<code>SimpleCCM</code>](#SimpleCCM)  
**Emits**: [<code>register</code>](#SimpleCCM+event_register)  

| Param | Type | Description |
| --- | --- | --- |
| as | <code>AsyncSteps</code> | AsyncSteps instance as registration may be waiting for external resources |
| name | <code>string</code> | unique identifier in scope of CCM instance |
| ifacever | <code>string</code> | interface identifier and its version separated by colon |
| endpoint | <code>string</code> | URI      OR any other resource identifier of function( ccmimpl, info )          returning iface implementing peer, accepted by CCM implementation      OR instance of Executor |
| [credentials] | <code>string</code> | optional, authentication credentials: 'master' - enable MasterService authentication logic (Advanced CCM only) '{user}:{clear-text-password}' - send as is in the 'sec' section NOTE: some more reserved words and/or patterns can appear in the future |
| [options] | <code>object</code> | fine tune global CCM options per endpoint |

<a name="SimpleCCM+iface"></a>

### simpleCCM.iface(name) ⇒ <code>NativeInterface</code>
Get native interface wrapper for invocation of iface methods

**Kind**: instance method of [<code>SimpleCCM</code>](#SimpleCCM)  
**Returns**: <code>NativeInterface</code> - - native interface  

| Param | Type | Description |
| --- | --- | --- |
| name | <code>string</code> | see register() |

<a name="SimpleCCM+unRegister"></a>

### simpleCCM.unRegister(name)
Unregister previously registered interface (should not be used, unless really needed)

**Kind**: instance method of [<code>SimpleCCM</code>](#SimpleCCM)  
**Emits**: [<code>unregister</code>](#SimpleCCM+event_unregister)  

| Param | Type | Description |
| --- | --- | --- |
| name | <code>string</code> | see register() |

<a name="SimpleCCM+defense"></a>

### simpleCCM.defense() ⇒ <code>object</code>
Shortcut to iface( "#defense" )

**Kind**: instance method of [<code>SimpleCCM</code>](#SimpleCCM)  
**Returns**: <code>object</code> - native defense interface  
<a name="SimpleCCM+log"></a>

### simpleCCM.log() ⇒ <code>object</code>
Returns extended API interface as defined in FTN9 IF AuditLogService

**Kind**: instance method of [<code>SimpleCCM</code>](#SimpleCCM)  
**Returns**: <code>object</code> - FTN9 native face  
<a name="SimpleCCM+cache"></a>

### simpleCCM.cache([bucket]) ⇒ <code>object</code>
Returns extended API interface as defined in [FTN14 Cache][]

**Kind**: instance method of [<code>SimpleCCM</code>](#SimpleCCM)  
**Returns**: <code>object</code> - FTN14 native face  

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| [bucket] | <code>string</code> | <code>&quot;default&quot;</code> | cache bucket name |

<a name="SimpleCCM+assertIface"></a>

### simpleCCM.assertIface(name, ifacever)
Assert that interface registered by name matches major version and minor is not less than required.
This function must generate fatal error and forbid any further execution

**Kind**: instance method of [<code>SimpleCCM</code>](#SimpleCCM)  

| Param | Type | Description |
| --- | --- | --- |
| name | <code>string</code> | unique identifier in scope of CCM instance |
| ifacever | <code>string</code> | interface identifier and its version separated by colon |

<a name="SimpleCCM+alias"></a>

### simpleCCM.alias(name, alias)
Alias interface name with another name

**Kind**: instance method of [<code>SimpleCCM</code>](#SimpleCCM)  
**Emits**: [<code>register</code>](#SimpleCCM+event_register)  

| Param | Type | Description |
| --- | --- | --- |
| name | <code>string</code> | unique identifier in scope of CCM instance |
| alias | <code>string</code> | alternative name for registered interface |

<a name="SimpleCCM+close"></a>

### simpleCCM.close()
Shutdown CCM (close all active comms)

**Kind**: instance method of [<code>SimpleCCM</code>](#SimpleCCM)  
**Emits**: [<code>close</code>](#SimpleCCM+event_close)  
<a name="SimpleCCM+limitZone"></a>

### simpleCCM.limitZone(name, options)
Configure named AsyncSteps Limiter instance

**Kind**: instance method of [<code>SimpleCCM</code>](#SimpleCCM)  

| Param | Type | Description |
| --- | --- | --- |
| name | <code>string</code> | zone name |
| options | <code>object</code> | options to pass to Limiter c-tor |

<a name="SimpleCCM+event_register"></a>

### "register"
CCM regiser event. Fired on new interface registration.
( name, ifacever, info )

**Kind**: event emitted by [<code>SimpleCCM</code>](#SimpleCCM)  
<a name="SimpleCCM+event_unregister"></a>

### "unregister"
CCM regiser event. Fired on interface unregistration.
( name, info )

**Kind**: event emitted by [<code>SimpleCCM</code>](#SimpleCCM)  
<a name="SimpleCCM+event_close"></a>

### "close"
CCM close event. Fired on CCM shutdown.

**Kind**: event emitted by [<code>SimpleCCM</code>](#SimpleCCM)  
<a name="SimpleCCM.SAFE_PAYLOAD_LIMIT"></a>

### SimpleCCM.SAFE_PAYLOAD_LIMIT
Maximum FutoIn message payload size (not related to raw data)

**Kind**: static constant of [<code>SimpleCCM</code>](#SimpleCCM)  
**Default**: <code>65536</code>  
<a name="SimpleCCM.SVC_RESOLVER"></a>

### SimpleCCM.SVC_RESOLVER
Runtime iface resolution v1.x

**Kind**: static constant of [<code>SimpleCCM</code>](#SimpleCCM)  
<a name="SimpleCCM.SVC_AUTH"></a>

### SimpleCCM.SVC_AUTH
AuthService v1.x

**Kind**: static constant of [<code>SimpleCCM</code>](#SimpleCCM)  
<a name="SimpleCCM.SVC_DEFENSE"></a>

### SimpleCCM.SVC_DEFENSE
Defense system v1.x

**Kind**: static constant of [<code>SimpleCCM</code>](#SimpleCCM)  
<a name="SimpleCCM.SVC_ACL"></a>

### SimpleCCM.SVC_ACL
Access Control system v1.x

**Kind**: static constant of [<code>SimpleCCM</code>](#SimpleCCM)  
<a name="SimpleCCM.SVC_LOG"></a>

### SimpleCCM.SVC_LOG
Audit Logging v1.x

**Kind**: static constant of [<code>SimpleCCM</code>](#SimpleCCM)  
<a name="SimpleCCM.SVC_CACHE_"></a>

### SimpleCCM.SVC_CACHE_
cache v1.x iface name prefix

**Kind**: static constant of [<code>SimpleCCM</code>](#SimpleCCM)  
<a name="AdvancedCCM"></a>

## AdvancedCCM
**window.AdvancedCCM** - Browser-only reference to futoin-asyncsteps.AdvancedCCM

**Kind**: global variable  

* [AdvancedCCM](#AdvancedCCM)
    * [new AdvancedCCM(options)](#new_AdvancedCCM_new)
    * [.register(as, name, ifacever, endpoint, [credentials], [options])](#SimpleCCM+register)
    * [.iface(name)](#SimpleCCM+iface) ⇒ <code>NativeInterface</code>
    * [.unRegister(name)](#SimpleCCM+unRegister)
    * [.defense()](#SimpleCCM+defense) ⇒ <code>object</code>
    * [.log()](#SimpleCCM+log) ⇒ <code>object</code>
    * [.cache([bucket])](#SimpleCCM+cache) ⇒ <code>object</code>
    * [.assertIface(name, ifacever)](#SimpleCCM+assertIface)
    * [.alias(name, alias)](#SimpleCCM+alias)
    * [.close()](#SimpleCCM+close)
    * [.limitZone(name, options)](#SimpleCCM+limitZone)
    * ["register"](#SimpleCCM+event_register)
    * ["unregister"](#SimpleCCM+event_unregister)
    * ["close"](#SimpleCCM+event_close)

<a name="new_AdvancedCCM_new"></a>

### new AdvancedCCM(options)

| Param | Type | Description |
| --- | --- | --- |
| options | <code>object</code> | see AdvancedCCMOptions |

<a name="SimpleCCM+register"></a>

### advancedCCM.register(as, name, ifacever, endpoint, [credentials], [options])
Register standard MasterService end-point (adds steps to *as*)

**Kind**: instance method of [<code>AdvancedCCM</code>](#AdvancedCCM)  
**Emits**: [<code>register</code>](#SimpleCCM+event_register)  

| Param | Type | Description |
| --- | --- | --- |
| as | <code>AsyncSteps</code> | AsyncSteps instance as registration may be waiting for external resources |
| name | <code>string</code> | unique identifier in scope of CCM instance |
| ifacever | <code>string</code> | interface identifier and its version separated by colon |
| endpoint | <code>string</code> | URI      OR any other resource identifier of function( ccmimpl, info )          returning iface implementing peer, accepted by CCM implementation      OR instance of Executor |
| [credentials] | <code>string</code> | optional, authentication credentials: 'master' - enable MasterService authentication logic (Advanced CCM only) '{user}:{clear-text-password}' - send as is in the 'sec' section NOTE: some more reserved words and/or patterns can appear in the future |
| [options] | <code>object</code> | fine tune global CCM options per endpoint |

<a name="SimpleCCM+iface"></a>

### advancedCCM.iface(name) ⇒ <code>NativeInterface</code>
Get native interface wrapper for invocation of iface methods

**Kind**: instance method of [<code>AdvancedCCM</code>](#AdvancedCCM)  
**Returns**: <code>NativeInterface</code> - - native interface  

| Param | Type | Description |
| --- | --- | --- |
| name | <code>string</code> | see register() |

<a name="SimpleCCM+unRegister"></a>

### advancedCCM.unRegister(name)
Unregister previously registered interface (should not be used, unless really needed)

**Kind**: instance method of [<code>AdvancedCCM</code>](#AdvancedCCM)  
**Emits**: [<code>unregister</code>](#SimpleCCM+event_unregister)  

| Param | Type | Description |
| --- | --- | --- |
| name | <code>string</code> | see register() |

<a name="SimpleCCM+defense"></a>

### advancedCCM.defense() ⇒ <code>object</code>
Shortcut to iface( "#defense" )

**Kind**: instance method of [<code>AdvancedCCM</code>](#AdvancedCCM)  
**Returns**: <code>object</code> - native defense interface  
<a name="SimpleCCM+log"></a>

### advancedCCM.log() ⇒ <code>object</code>
Returns extended API interface as defined in FTN9 IF AuditLogService

**Kind**: instance method of [<code>AdvancedCCM</code>](#AdvancedCCM)  
**Returns**: <code>object</code> - FTN9 native face  
<a name="SimpleCCM+cache"></a>

### advancedCCM.cache([bucket]) ⇒ <code>object</code>
Returns extended API interface as defined in [FTN14 Cache][]

**Kind**: instance method of [<code>AdvancedCCM</code>](#AdvancedCCM)  
**Returns**: <code>object</code> - FTN14 native face  

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| [bucket] | <code>string</code> | <code>&quot;default&quot;</code> | cache bucket name |

<a name="SimpleCCM+assertIface"></a>

### advancedCCM.assertIface(name, ifacever)
Assert that interface registered by name matches major version and minor is not less than required.
This function must generate fatal error and forbid any further execution

**Kind**: instance method of [<code>AdvancedCCM</code>](#AdvancedCCM)  

| Param | Type | Description |
| --- | --- | --- |
| name | <code>string</code> | unique identifier in scope of CCM instance |
| ifacever | <code>string</code> | interface identifier and its version separated by colon |

<a name="SimpleCCM+alias"></a>

### advancedCCM.alias(name, alias)
Alias interface name with another name

**Kind**: instance method of [<code>AdvancedCCM</code>](#AdvancedCCM)  
**Emits**: [<code>register</code>](#SimpleCCM+event_register)  

| Param | Type | Description |
| --- | --- | --- |
| name | <code>string</code> | unique identifier in scope of CCM instance |
| alias | <code>string</code> | alternative name for registered interface |

<a name="SimpleCCM+close"></a>

### advancedCCM.close()
Shutdown CCM (close all active comms)

**Kind**: instance method of [<code>AdvancedCCM</code>](#AdvancedCCM)  
**Emits**: [<code>close</code>](#SimpleCCM+event_close)  
<a name="SimpleCCM+limitZone"></a>

### advancedCCM.limitZone(name, options)
Configure named AsyncSteps Limiter instance

**Kind**: instance method of [<code>AdvancedCCM</code>](#AdvancedCCM)  

| Param | Type | Description |
| --- | --- | --- |
| name | <code>string</code> | zone name |
| options | <code>object</code> | options to pass to Limiter c-tor |

<a name="SimpleCCM+event_register"></a>

### "register"
CCM regiser event. Fired on new interface registration.
( name, ifacever, info )

**Kind**: event emitted by [<code>AdvancedCCM</code>](#AdvancedCCM)  
<a name="SimpleCCM+event_unregister"></a>

### "unregister"
CCM regiser event. Fired on interface unregistration.
( name, info )

**Kind**: event emitted by [<code>AdvancedCCM</code>](#AdvancedCCM)  
<a name="SimpleCCM+event_close"></a>

### "close"
CCM close event. Fired on CCM shutdown.

**Kind**: event emitted by [<code>AdvancedCCM</code>](#AdvancedCCM)  
<a name="AdvancedCCM"></a>

## AdvancedCCM
**futoin.AdvancedCCM** - Browser-only reference to futoin-asyncsteps.AdvancedCCM

**Kind**: global variable  

* [AdvancedCCM](#AdvancedCCM)
    * [new AdvancedCCM(options)](#new_AdvancedCCM_new)
    * [.register(as, name, ifacever, endpoint, [credentials], [options])](#SimpleCCM+register)
    * [.iface(name)](#SimpleCCM+iface) ⇒ <code>NativeInterface</code>
    * [.unRegister(name)](#SimpleCCM+unRegister)
    * [.defense()](#SimpleCCM+defense) ⇒ <code>object</code>
    * [.log()](#SimpleCCM+log) ⇒ <code>object</code>
    * [.cache([bucket])](#SimpleCCM+cache) ⇒ <code>object</code>
    * [.assertIface(name, ifacever)](#SimpleCCM+assertIface)
    * [.alias(name, alias)](#SimpleCCM+alias)
    * [.close()](#SimpleCCM+close)
    * [.limitZone(name, options)](#SimpleCCM+limitZone)
    * ["register"](#SimpleCCM+event_register)
    * ["unregister"](#SimpleCCM+event_unregister)
    * ["close"](#SimpleCCM+event_close)

<a name="new_AdvancedCCM_new"></a>

### new AdvancedCCM(options)

| Param | Type | Description |
| --- | --- | --- |
| options | <code>object</code> | see AdvancedCCMOptions |

<a name="SimpleCCM+register"></a>

### advancedCCM.register(as, name, ifacever, endpoint, [credentials], [options])
Register standard MasterService end-point (adds steps to *as*)

**Kind**: instance method of [<code>AdvancedCCM</code>](#AdvancedCCM)  
**Emits**: [<code>register</code>](#SimpleCCM+event_register)  

| Param | Type | Description |
| --- | --- | --- |
| as | <code>AsyncSteps</code> | AsyncSteps instance as registration may be waiting for external resources |
| name | <code>string</code> | unique identifier in scope of CCM instance |
| ifacever | <code>string</code> | interface identifier and its version separated by colon |
| endpoint | <code>string</code> | URI      OR any other resource identifier of function( ccmimpl, info )          returning iface implementing peer, accepted by CCM implementation      OR instance of Executor |
| [credentials] | <code>string</code> | optional, authentication credentials: 'master' - enable MasterService authentication logic (Advanced CCM only) '{user}:{clear-text-password}' - send as is in the 'sec' section NOTE: some more reserved words and/or patterns can appear in the future |
| [options] | <code>object</code> | fine tune global CCM options per endpoint |

<a name="SimpleCCM+iface"></a>

### advancedCCM.iface(name) ⇒ <code>NativeInterface</code>
Get native interface wrapper for invocation of iface methods

**Kind**: instance method of [<code>AdvancedCCM</code>](#AdvancedCCM)  
**Returns**: <code>NativeInterface</code> - - native interface  

| Param | Type | Description |
| --- | --- | --- |
| name | <code>string</code> | see register() |

<a name="SimpleCCM+unRegister"></a>

### advancedCCM.unRegister(name)
Unregister previously registered interface (should not be used, unless really needed)

**Kind**: instance method of [<code>AdvancedCCM</code>](#AdvancedCCM)  
**Emits**: [<code>unregister</code>](#SimpleCCM+event_unregister)  

| Param | Type | Description |
| --- | --- | --- |
| name | <code>string</code> | see register() |

<a name="SimpleCCM+defense"></a>

### advancedCCM.defense() ⇒ <code>object</code>
Shortcut to iface( "#defense" )

**Kind**: instance method of [<code>AdvancedCCM</code>](#AdvancedCCM)  
**Returns**: <code>object</code> - native defense interface  
<a name="SimpleCCM+log"></a>

### advancedCCM.log() ⇒ <code>object</code>
Returns extended API interface as defined in FTN9 IF AuditLogService

**Kind**: instance method of [<code>AdvancedCCM</code>](#AdvancedCCM)  
**Returns**: <code>object</code> - FTN9 native face  
<a name="SimpleCCM+cache"></a>

### advancedCCM.cache([bucket]) ⇒ <code>object</code>
Returns extended API interface as defined in [FTN14 Cache][]

**Kind**: instance method of [<code>AdvancedCCM</code>](#AdvancedCCM)  
**Returns**: <code>object</code> - FTN14 native face  

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| [bucket] | <code>string</code> | <code>&quot;default&quot;</code> | cache bucket name |

<a name="SimpleCCM+assertIface"></a>

### advancedCCM.assertIface(name, ifacever)
Assert that interface registered by name matches major version and minor is not less than required.
This function must generate fatal error and forbid any further execution

**Kind**: instance method of [<code>AdvancedCCM</code>](#AdvancedCCM)  

| Param | Type | Description |
| --- | --- | --- |
| name | <code>string</code> | unique identifier in scope of CCM instance |
| ifacever | <code>string</code> | interface identifier and its version separated by colon |

<a name="SimpleCCM+alias"></a>

### advancedCCM.alias(name, alias)
Alias interface name with another name

**Kind**: instance method of [<code>AdvancedCCM</code>](#AdvancedCCM)  
**Emits**: [<code>register</code>](#SimpleCCM+event_register)  

| Param | Type | Description |
| --- | --- | --- |
| name | <code>string</code> | unique identifier in scope of CCM instance |
| alias | <code>string</code> | alternative name for registered interface |

<a name="SimpleCCM+close"></a>

### advancedCCM.close()
Shutdown CCM (close all active comms)

**Kind**: instance method of [<code>AdvancedCCM</code>](#AdvancedCCM)  
**Emits**: [<code>close</code>](#SimpleCCM+event_close)  
<a name="SimpleCCM+limitZone"></a>

### advancedCCM.limitZone(name, options)
Configure named AsyncSteps Limiter instance

**Kind**: instance method of [<code>AdvancedCCM</code>](#AdvancedCCM)  

| Param | Type | Description |
| --- | --- | --- |
| name | <code>string</code> | zone name |
| options | <code>object</code> | options to pass to Limiter c-tor |

<a name="SimpleCCM+event_register"></a>

### "register"
CCM regiser event. Fired on new interface registration.
( name, ifacever, info )

**Kind**: event emitted by [<code>AdvancedCCM</code>](#AdvancedCCM)  
<a name="SimpleCCM+event_unregister"></a>

### "unregister"
CCM regiser event. Fired on interface unregistration.
( name, info )

**Kind**: event emitted by [<code>AdvancedCCM</code>](#AdvancedCCM)  
<a name="SimpleCCM+event_close"></a>

### "close"
CCM close event. Fired on CCM shutdown.

**Kind**: event emitted by [<code>AdvancedCCM</code>](#AdvancedCCM)  
<a name="Invoker"></a>

## Invoker
**futoin.Invoker** - Browser-only reference to futoin-invoker module

**Kind**: global variable  
<a name="FutoInInvoker"></a>

## FutoInInvoker
**window.FutoInInvoker** - Browser-only reference to futoin-invoker module

**Kind**: global variable  


*documented by [jsdoc-to-markdown](https://github.com/75lb/jsdoc-to-markdown)*.


