---
title: ".NET’s new fast, compact Web Service endpoint: The JSV Format"
date: 2010-04-10
---

New! [Benchmarks graphs are now available](http://www.servicestack.net/benchmarks/) to better visualize the performance of ServiceStack's JSON and JSV text serializers.

[Service Stack’s](https://github.com/ServiceStack/ServiceStack) Git repo is still hot from the fresh check-in that has just added [TypeSerializer’s](https://github.com/ServiceStack/ServiceStack.Text) text-serialization format as a first class Web Service endpoint.

**JSV Format** (i.e. **J**SON-like **S**eparated **V**alues) is a JSON inspired format that uses **CSV**\-style escaping for the least overhead and optimal performance.

Service Stack’s emphasis has always been on creating high-performance, cross-platform web services with the least amount of effort. In order to maximize performance, our web services are effectively raw text/byte streams over light-weight IHttpHandler’s (Note: SOAP endpoints still use WCF bindings). This approach coupled with extensive use of cached-delegates (eliminating any runtime reflection) has proven to provide superior performance in itself.

### So why the new format?

Well up until now the de/serialization for all web service endpoints were done using the DataContract serializers in the [.NET BCL](http://en.wikipedia.org/wiki/Base_Class_Library). The XML DataContractSerializer looks to be a well written library providing good performance for serialization of XML. Unfortunately for reasons articulated in my previous post on the [history of web services](https://github.com/ServiceStack/ServiceStack/wiki/Service-Stack-Web-Services), XML although great for interoperability, does not make a good ‘programmatic fit’ for integrating with many programming language models – e.g. for AJAX applications JSON is a much more suitable format. The verbosity and strict-extensibility of XML also does not make it the ideal format in performance-critical, or bandwidth constrained environments.

The problem with JSON in .NET is that although being **2x more compact** than XML it is **1.5x slower** ([based on Northwind model benchmarks](http://www.servicestack.net/benchmarks/NorthwindDatabaseRowsSerialization.1000000-times.2010-02-06.html)). Unfortunately that is the fastest JSON implementation in the BCL there are others like [JavaScriptSerializer](http://msdn.microsoft.com/en-us/library/system.web.script.serialization.javascriptserializer.aspx) which are over **40x** slower still. The other blocker I encountered was that although the JSON implementation in .NET was slow, the equivalent one in [MONO](http://www.mono-project.com/Main_Page) just doesn’t work for anything but the most simple models. Effectively Mono users had no choice but to use the XML endpoints, which is clearly not a good story for bandwidth-constrained environments as found in [iPhone/MonoTouch](http://monotouch.net/) apps.

Quite simply if I want a fast, compact, cross-platform serialization format that’s ideal to use in bandwidth-constrained, performance-critical environments as found in iPhone networked applications I had to code it myself. Drawing on years of experience in handling different serialization formats I had a fair idea on what I thought the ideal text-format should be. Ultimately the core goals of being fast and compact is the major influence in the choice of syntax. It is based on the familiar JSON format but as it is **white-space significant**, does not require quotes for normal values, which made it the most compact text-format that was still lexically parseable.

Other key goals was that it should be non-invasive to work with any POCO-type. Due to the success of schema-less designs in supporting versioning by being resilient to schema-changes, it is a greedy format that tries to de-serialize as much as possible without error. Other features that sets it apart from existing formats makes it the best choice for serializing any [.NET POCO object](http://en.wikipedia.org/wiki/Plain_Old_CLR_Object).

- Fastest and most compact text-serializer for .NET ([5.3x quicker than JSON, 2.6x smaller than XML](http://www.servicestack.net/benchmarks/NorthwindDatabaseRowsSerialization.1000000-times.2010-02-06.html))
- Human readable and writeable, self-describing text format
- Non-invasive and configuration-free
- Resilient to schema changes (focused on deserializing as much as possible without error)
- Serializes / De-serializes any .NET data type (by convention)
    - Supports custom, compact serialization of structs by overriding ToString() and static T Parse(string) methods
    - Can serialize inherited, interface or ‘late-bound objects’ data types
    - Respects opt-in DataMember custom serialization for DataContract DTO types.

For these reasons it is the preferred choice to transparently store complex POCO types for [OrmLite](http://code.google.com/p/servicestack/wiki/OrmLite) (in RDBMS text blobs), POCO objects with [ServiceStacks’ C# Redis Client](http://code.google.com/p/servicestack/wiki/ServiceStackRedis) or the optimal serialization format in .NET to .NET web services.

### Simple API

Like most of the interfaces in Service Stack, the API is simple and descriptive. In most cases these are the only methods that you would commonly use:

\[csharp\]

string TypeSerializer.SerializeToString<T>(T value); void TypeSerializer.SerializeToWriter<T>(T value, TextWriter writer);

T TypeSerializer.DeserializeFromString<T>(string value); T TypeSerializer.DeserializeFromReader<T>(TextReader reader);

\[/csharp\]

Where **T** can be any .NET POCO type. That’s all there is - the API was intentionally left simple :)

By convention only public properties are serialized, unless the POCO is a DataContract in which case only DataMember properties will be serialized. Structs can provide custom (e.g. more compact) serialization value by overloading the _ToString()_ instance method and providing a _static TStruct.Parse(string)_.

### The JSV Web Service Endpoint

The home page for [TypeSerializer](https://github.com/ServiceStack/ServiceStack.Text) on code.google.com goes into more detail on the actual text-format. You can get a visual flavour of it with the screen shots below

[![](images/JsvFragment.png "JsvFragment")](http://www.servicestack.net/ServiceStack.Examples.Host.Web/ServiceStack/Jsv/SyncReply/GetNorthwindCustomerOrders?debug)

_Note: the results have been ‘pretty-formatted’ for readability, the actual format is white-space significant._

In comparison here is the equivalent data formatted in XML (under a nice syntax highlighter):

[![](images/XmlFragment.png "XmlFragment")](http://www.servicestack.net/ServiceStack.Examples.Host.Web/ServiceStack/Xml/SyncReply/GetNorthwindCustomerOrders)

### View JSV live Web Services

One of the major features of Service Stack is that because JSV is a supported out of the box endpoint, it doesn’t require any code for all your web services to take advantage of it. You can access all your web services with the JSV endpoint by simply changing the base URL. Below are live web service examples from the [Service Stack’s Examples project](http://servicestack.googlecode.com/files/ServiceStack.Examples.zip):

| GetNorthwindCustomerOrders | [XML](http://www.servicestack.net/ServiceStack.Examples.Host.Web/ServiceStack/Xml/SyncReply/GetNorthwindCustomerOrders) | [JSON](http://www.servicestack.net/ServiceStack.Examples.Host.Web/ServiceStack/Json/SyncReply/GetNorthwindCustomerOrders) | [JSV](http://www.servicestack.net/ServiceStack.Examples.Host.Web/ServiceStack/Jsv/SyncReply/GetNorthwindCustomerOrders) \| [debug](http://www.servicestack.net/ServiceStack.Examples.Host.Web/ServiceStack/Jsv/SyncReply/GetNorthwindCustomerOrders?debug) |
| --- | --- | --- | --- |
| GetFactorial?ForNumber=3 | [XML](http://www.servicestack.net/ServiceStack.Examples.Host.Web/ServiceStack/Xml/SyncReply/GetFactorial?ForNumber=3) | [JSON](http://www.servicestack.net/ServiceStack.Examples.Host.Web/ServiceStack/Json/SyncReply/GetFactorial?ForNumber=3) | [JSV](http://www.servicestack.net/ServiceStack.Examples.Host.Web/ServiceStack/Jsv/SyncReply/GetFactorial?ForNumber=3) \| [debug](http://www.servicestack.net/ServiceStack.Examples.Host.Web/ServiceStack/Xml/SyncReply/GetFactorial?ForNumber=3&debug) |
| GetFibonacciNumbers?Skip=5&Take=10 | [XML](http://www.servicestack.net/ServiceStack.Examples.Host.Web/ServiceStack/Xml/SyncReply/GetFibonacciNumbers?Skip=5&Take=10) | [JSON](http://www.servicestack.net/ServiceStack.Examples.Host.Web/ServiceStack/Json/SyncReply/GetFibonacciNumbers?Skip=5&Take=10) | [JSV](http://www.servicestack.net/ServiceStack.Examples.Host.Web/ServiceStack/Jsv/SyncReply/GetFibonacciNumbers?Skip=5&Take=10) \| [debug](http://www.servicestack.net/ServiceStack.Examples.Host.Web/ServiceStack/Jsv/SyncReply/GetFibonacciNumbers?Skip=5&Take=10&debug) |

_\*Live webservices hosted on CentOS / Nginx / Mono FastCGI_

You can view all web services available by going to Service Stack’s web service Metadata page:

[http://www.servicestack.net/ServiceStack.Examples.Host.Web/ServiceStack/Metadata](http://www.servicestack.net/ServiceStack.Examples.Host.Web/ServiceStack/Metadata)

## Download TypeSerializer for your own projects

The JSV-Format is provided by the TypeSerializer class in the ServiceStack.Text namespace. It is perfect for anywhere you want to serialize a .NET type, ideal for storing complex types as text blobs in a RDBMS. Like the rest of [Service Stack](http://www.servicestack.net) it is Open Source, released under the [New BSD Licence](http://www.opensource.org/licenses/bsd-license.php):

- Included as part of the Service Stack binaries -  [ServiceStack/downloads](https://github.com/ServiceStack/ServiceStack/downloads)
- As a standalone dll - [ServiceStack.Text/downloads](https://github.com/ServiceStack/ServiceStack.Text/downloads)
