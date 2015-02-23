
  [![NPM Version](https://img.shields.io/npm/v/futoin-invoker.svg?style=flat)](https://www.npmjs.com/package/futoin-invoker)
  [![NPM Downloads](https://img.shields.io/npm/dm/futoin-invoker.svg?style=flat)](https://www.npmjs.com/package/futoin-invoker)
  [![Build Status](https://travis-ci.org/futoin/core-js-ri-invoker.svg?branch=master)](https://travis-ci.org/futoin/core-js-ri-invoker)

  [![NPM](https://nodei.co/npm/futoin-invoker.png?downloads=true&downloadRank=true&stars=true)](https://nodei.co/npm/futoin-invoker/)

**[Stability: 2 - Unstable](http://nodejs.org/api/documentation.html)**

# WARNING

This project is in **active development** and *is not feature-complete yet*, but is already **mature enough**.
The documentation of this specific implementation is not complete either.

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

# Installation for Browser

```sh
$ bower install futoin-invoker --save
```

Please note that browser build is available under in dist/ folder in sources generated
with [pure-sjc](https://github.com/RReverser/pure-cjs). It depends on
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

**Members**

* [SimpleCCM](#SimpleCCM)
  * [SimpleCCM.OPT_COMM_CONFIG_CB](#SimpleCCM.OPT_COMM_CONFIG_CB)
  * [const: SimpleCCM.OPT_CALL_TIMEOUT_MS](#SimpleCCM.OPT_CALL_TIMEOUT_MS)
  * [const: SimpleCCM.OPT_PROD_MODE](#SimpleCCM.OPT_PROD_MODE)
  * [const: SimpleCCM.OPT_SPEC_DIRS](#SimpleCCM.OPT_SPEC_DIRS)
  * [const: SimpleCCM.OPT_TARGET_ORIGIN](#SimpleCCM.OPT_TARGET_ORIGIN)
  * [const: SimpleCCM.OPT_RETRY_COUNT](#SimpleCCM.OPT_RETRY_COUNT)
  * [const: SimpleCCM.OPT_HMAC_KEY](#SimpleCCM.OPT_HMAC_KEY)
  * [const: SimpleCCM.OPT_HMAC_ALGO](#SimpleCCM.OPT_HMAC_ALGO)
  * [const: SimpleCCM.SAFE_PAYLOAD_LIMIT](#SimpleCCM.SAFE_PAYLOAD_LIMIT)
  * [const: SimpleCCM.SVC_RESOLVER](#SimpleCCM.SVC_RESOLVER)
  * [const: SimpleCCM.SVC_AUTH](#SimpleCCM.SVC_AUTH)
  * [const: SimpleCCM.SVC_DEFENSE](#SimpleCCM.SVC_DEFENSE)
  * [const: SimpleCCM.SVC_ACL](#SimpleCCM.SVC_ACL)
  * [const: SimpleCCM.SVC_LOG](#SimpleCCM.SVC_LOG)
  * [const: SimpleCCM.SVC_CACHE_](#SimpleCCM.SVC_CACHE_)
* [AdvancedCCM](#AdvancedCCM)
  * [const: AdvancedCCM.OPT_SPEC_DIRS](#AdvancedCCM.OPT_SPEC_DIRS)
* [Invoker](#Invoker)
* [FutoInInvoker](#FutoInInvoker)
 
<a name="module_futoin-invoker"></a>
#futoin-invoker
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




*documented by [jsdoc-to-markdown](https://github.com/75lb/jsdoc-to-markdown)*.


