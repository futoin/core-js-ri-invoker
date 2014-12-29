[![Build Status](https://travis-ci.org/futoin/core-js-ri-invoker.svg?branch=master)](https://travis-ci.org/futoin/core-js-ri-invoker)

# FutoIn reference implementation

Reference implementation of:
 
    FTN7: FutoIn Invoker Concept
    Version: 1.2
    
Spec: [FTN7: Interface Invoker Concept v1.x](http://specs.futoin.org/final/preview/ftn7_iface_invoker_concept-1.html)

[Web Site](http://futoin.org/)


    
# API documentation

The concept is described in FutoIn specification: [FTN7: Interface Invoker Concept v1.x](http://specs.futoin.org/final/preview/ftn7_iface_invoker_concept-1.html)

#Index

**Modules**

* [futoin-invoker](#module_futoin-invoker)
  * [class: futoin-invoker.SimpleCCM](#module_futoin-invoker.SimpleCCM)
    * [new futoin-invoker.SimpleCCM([options])](#new_module_futoin-invoker.SimpleCCM)
  * [class: futoin-invoker.AdvancedCCM](#module_futoin-invoker.AdvancedCCM)
    * [new futoin-invoker.AdvancedCCM()](#new_module_futoin-invoker.AdvancedCCM)
  * [class: futoin-invoker.FutoInError](#module_futoin-invoker.FutoInError)
    * [new futoin-invoker.FutoInError()](#new_module_futoin-invoker.FutoInError)
  * [class: futoin-invoker.NativeIface](#module_futoin-invoker.NativeIface)
    * [new futoin-invoker.NativeIface()](#new_module_futoin-invoker.NativeIface)
  * [class: futoin-invoker.InterfaceInfo](#module_futoin-invoker.InterfaceInfo)
    * [new futoin-invoker.InterfaceInfo()](#new_module_futoin-invoker.InterfaceInfo)

**Classes**

* [class: spectools](#spectools)
  * [new spectools()](#new_spectools)
* [class: InterfaceInfo](#InterfaceInfo)
  * [new InterfaceInfo()](#new_InterfaceInfo)
  * [interfaceInfo.name()](#InterfaceInfo#name)
  * [interfaceInfo.version()](#InterfaceInfo#version)
  * [interfaceInfo.inherits()](#InterfaceInfo#inherits)
  * [interfaceInfo.funcs()](#InterfaceInfo#funcs)
  * [interfaceInfo.constraints()](#InterfaceInfo#constraints)
* [class: NativeIface](#NativeIface)
  * [new NativeIface()](#new_NativeIface)
  * [nativeIface.call(as, name, params, upload_data, [download_stream], [timeout])](#NativeIface#call)
  * [nativeIface.ifaceInfo()](#NativeIface#ifaceInfo)
  * [nativeIface.burst()](#NativeIface#burst)
  * [nativeIface.bindDerivedKey()](#NativeIface#bindDerivedKey)

**Members**

* [SimpleCCM](#SimpleCCM)
  * [SimpleCCM.OPT_CALL_TIMEOUT_MS](#SimpleCCM.OPT_CALL_TIMEOUT_MS)
  * [SimpleCCM.OPT_X509_VERIFY](#SimpleCCM.OPT_X509_VERIFY)
  * [SimpleCCM.OPT_PROD_MODE](#SimpleCCM.OPT_PROD_MODE)
  * [SimpleCCM.OPT_COMM_CONFIG_CB](#SimpleCCM.OPT_COMM_CONFIG_CB)
* [AdvancedCCM](#AdvancedCCM)
  * [AdvancedCCM.OPT_SPEC_DIRS](#AdvancedCCM.OPT_SPEC_DIRS)
* [Invoker](#Invoker)
 
<a name="module_futoin-invoker"></a>
#futoin-invoker
**Members**

* [futoin-invoker](#module_futoin-invoker)
  * [class: futoin-invoker.SimpleCCM](#module_futoin-invoker.SimpleCCM)
    * [new futoin-invoker.SimpleCCM([options])](#new_module_futoin-invoker.SimpleCCM)
  * [class: futoin-invoker.AdvancedCCM](#module_futoin-invoker.AdvancedCCM)
    * [new futoin-invoker.AdvancedCCM()](#new_module_futoin-invoker.AdvancedCCM)
  * [class: futoin-invoker.FutoInError](#module_futoin-invoker.FutoInError)
    * [new futoin-invoker.FutoInError()](#new_module_futoin-invoker.FutoInError)
  * [class: futoin-invoker.NativeIface](#module_futoin-invoker.NativeIface)
    * [new futoin-invoker.NativeIface()](#new_module_futoin-invoker.NativeIface)
  * [class: futoin-invoker.InterfaceInfo](#module_futoin-invoker.InterfaceInfo)
    * [new futoin-invoker.InterfaceInfo()](#new_module_futoin-invoker.InterfaceInfo)

<a name="module_futoin-invoker.SimpleCCM"></a>
##class: futoin-invoker.SimpleCCM
**Members**

* [class: futoin-invoker.SimpleCCM](#module_futoin-invoker.SimpleCCM)
  * [new futoin-invoker.SimpleCCM([options])](#new_module_futoin-invoker.SimpleCCM)

<a name="new_module_futoin-invoker.SimpleCCM"></a>
###new futoin-invoker.SimpleCCM([options])
Simple CCM - Reference Implementation

**Params**

- \[options\] `object` - map of OPT_* named variables  

<a name="module_futoin-invoker.AdvancedCCM"></a>
##class: futoin-invoker.AdvancedCCM
**Members**

* [class: futoin-invoker.AdvancedCCM](#module_futoin-invoker.AdvancedCCM)
  * [new futoin-invoker.AdvancedCCM()](#new_module_futoin-invoker.AdvancedCCM)

<a name="new_module_futoin-invoker.AdvancedCCM"></a>
###new futoin-invoker.AdvancedCCM()
Advanced CCM - Reference Implementation

<a name="module_futoin-invoker.FutoInError"></a>
##class: futoin-invoker.FutoInError
**Members**

* [class: futoin-invoker.FutoInError](#module_futoin-invoker.FutoInError)
  * [new futoin-invoker.FutoInError()](#new_module_futoin-invoker.FutoInError)

<a name="new_module_futoin-invoker.FutoInError"></a>
###new futoin-invoker.FutoInError()
Easy access of futoin-asyncsteps.FutoInError errors, which may be extended in the future

<a name="module_futoin-invoker.NativeIface"></a>
##class: futoin-invoker.NativeIface
**Members**

* [class: futoin-invoker.NativeIface](#module_futoin-invoker.NativeIface)
  * [new futoin-invoker.NativeIface()](#new_module_futoin-invoker.NativeIface)

<a name="new_module_futoin-invoker.NativeIface"></a>
###new futoin-invoker.NativeIface()
Useful base for custom implementation of NativeIface

<a name="module_futoin-invoker.InterfaceInfo"></a>
##class: futoin-invoker.InterfaceInfo
**Members**

* [class: futoin-invoker.InterfaceInfo](#module_futoin-invoker.InterfaceInfo)
  * [new futoin-invoker.InterfaceInfo()](#new_module_futoin-invoker.InterfaceInfo)

<a name="new_module_futoin-invoker.InterfaceInfo"></a>
###new futoin-invoker.InterfaceInfo()
NativeInterface.ifaceInfo() class for custom implementations of NativeIface

<a name="spectools"></a>
#class: spectools
**Members**

* [class: spectools](#spectools)
  * [new spectools()](#new_spectools)

<a name="new_spectools"></a>
##new spectools()
SpecTools

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
<a name="NativeIface"></a>
#class: NativeIface
**Members**

* [class: NativeIface](#NativeIface)
  * [new NativeIface()](#new_NativeIface)
  * [nativeIface.call(as, name, params, upload_data, [download_stream], [timeout])](#NativeIface#call)
  * [nativeIface.ifaceInfo()](#NativeIface#ifaceInfo)
  * [nativeIface.burst()](#NativeIface#burst)
  * [nativeIface.bindDerivedKey()](#NativeIface#bindDerivedKey)

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
<a name="NativeIface#burst"></a>
##nativeIface.burst()
Returns extended API interface as defined in [FTN10 Burst Calls][]

**Returns**: `object`  
<a name="NativeIface#bindDerivedKey"></a>
##nativeIface.bindDerivedKey()
Results with DerivedKeyAccessor through as.success()

<a name="SimpleCCM"></a>
#SimpleCCM
Browser-only reference to futoin-asyncsteps.SimpleCCM

<a name="AdvancedCCM"></a>
#AdvancedCCM
Browser-only reference to futoin-asyncsteps.AdvancedCCM

<a name="Invoker"></a>
#Invoker
Browser-only reference to futoin-invoker module




*documented by [jsdoc-to-markdown](https://github.com/75lb/jsdoc-to-markdown)*.


