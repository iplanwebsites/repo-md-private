---
title: "ServiceStack is on InfoQ! TL;DR and Links"
date: 2013-01-08
---

Adding to [ServiceStack's great run in 2012](http://www.servicestack.net/2012-report/) I was approached by [InfoQ](http://www.infoq.com) to find some details about ServiceStack vs WCF, why we created it, it's advantages over WCF and the philosophical differences in development styles and approach between ServiceStack and high-level Microsoft libraries and application frameworks. The resulting interview contains my thoughts on the best development and remote services practices, WCF's architecture, its use of SOAP/WS-\*, why heavy abstractions and artificial server-side programming models are not ideal, how pragmatic and simpler serialization formats are better suited for services, why message-based designs are preferred by most other frameworks, the state of .NET Open Source and much more.

The entire interview is quite long which ran to 8,000 words that as a result was split up and published in two articles. To make it easier to find and navigate the content, I've published a TL;DR summary, including related questions, table of contents and all embedded links used below:

### [Interview With Demis Bellot, Project Lead of ServiceStack - Part 1](http://www.infoq.com/articles/interview-servicestack):

**InfoQ: What problems do you see in Microsoft's approach to Services and how does ServiceStack try to tackle it?**

- Problems with Microsoft's approach to frameworks
- RPC method signatures

- [Differences between ServiceStack vs WCF](http://www.servicestack.net/files/slide-35.png)
- [Differences between ServiceStack vs WebApi](http://www.servicestack.net/files/slide-34.png)

- Remote Services Best Practices

- [Remote Facade](http://martinfowler.com/eaaCatalog/remoteFacade.html)
- [Data Transfer Object](http://martinfowler.com/eaaCatalog/dataTransferObject.html) ([MSDN](http://msdn.microsoft.com/en-us/library/ff650101.aspx))
- [The Gateway](http://martinfowler.com/eaaCatalog/gateway.html) ([MSDN](http://msdn.microsoft.com/en-us/library/ff650101.aspx))

- [ServiceStack's re-usable generic typed .NET Service Clients](https://github.com/ServiceStack/ServiceStack/wiki/Clients-overview)
- [Silverlight](https://github.com/ServiceStack/ServiceStack/wiki/SilverlightServiceClient), [JavaScript](https://github.com/ServiceStack/ServiceStack/wiki/Javascript-client), [Dart](https://github.com/ServiceStack/ServiceStack/wiki/Dart-Client) and [MQ Clients](https://github.com/ServiceStack/ServiceStack/wiki/Messaging-and-redis)
- [MessagePack format and Service Client](https://github.com/ServiceStack/ServiceStack/wiki/MessagePack-Format)
- [Protobuf format and Service Client](https://github.com/ServiceStack/ServiceStack/wiki/Protobuf-format)

- SOAP Web Services

- Problems with SOAP

- [Plain Old XML](http://en.wikipedia.org/wiki/Plain_Old_XML)

- SOAP vs Protocol Buffers

- [MessagePack RPC](http://wiki.msgpack.org/display/MSGPACK/Design+of+RPC)
- [Apache Thrift](http://thrift.apache.org/)

- JSON

- [JSON fallback implementation in JavaScript](https://github.com/douglascrockford/JSON-js/blob/master/json2.js)
- [Heresy & Heretical Open Source](http://www.infoq.com/presentations/Heretical-Open-Source)
- [ServiceStack's JSON Serializer 3x faster than other JSON Serializers when released](http://www.servicestack.net/mythz_blog/?p=344)
- [JSV Format](http://www.servicestack.net/mythz_blog/?p=176)

- [Supports Complex Object Graphs in QueryStrings and FormData](https://github.com/ServiceStack/ServiceStack/wiki/Serialization-deserialization)

- ServiceStack vs WCF Approach
- Simplicity and Tackling Complexity

- Problems with Abstractions

- Thin [IHttpRequest](https://github.com/ServiceStack/ServiceStack/blob/master/src/ServiceStack.Interfaces/ServiceHost/IHttpRequest.cs) and [IHttpResponse](https://github.com/ServiceStack/ServiceStack/blob/master/src/ServiceStack.Interfaces/ServiceHost/IHttpResponse.cs) abstractions
- [Easily customizing the HTTP Response](https://github.com/ServiceStack/ServiceStack/wiki/Serialization-deserialization)

- WCF's Abstractions

- [What happens when creating a new Abstractions to cover existing abstractions](http://xkcd.com/927/)
- [ServiceStack New API starts from ideal C#](https://github.com/ServiceStack/ServiceStack/wiki/New-Api)
- [ServiceStack's de-coupled architecture](https://github.com/ServiceStack/ServiceStack/wiki/Architecture-overview)

- Heavy Configuration

- [Complete applications smaller than typical WCF Configuration file](https://github.com/ServiceStack/ServiceStack.Examples/blob/master/src/Backbone.Todos/Global.asax.cs)

- Big Tooling

- [ServiceStack's great integration with ASP.NET MVC](http://www.servicestack.net/mvc-powerpack/)

- [Authentication Filters](https://github.com/ServiceStack/ServiceStack/wiki/Authentication-and-authorization)
- [Caching Providers](https://github.com/ServiceStack/ServiceStack/wiki/Caching)
- [Session Provider](https://github.com/ServiceStack/ServiceStack/wiki/Sessions)
- [Calling ServiceStack from MVC via a C# method call](https://github.com/ServiceStack/ServiceStack.UseCases/blob/master/CustomAuthenticationMvc/Controllers/HomeController.cs#L35-L37)

- ServiceStack's take on Complexity

- [ServiceStack's architecture fits on 1-page](https://github.com/ServiceStack/ServiceStack/wiki/Architecture-overview)
- [1-line of config](http://www.servicestack.net/ServiceStack.Hello/#rootpath)
- Conventions and Artficial Complexity

- [Code's worst enemy](http://steve-yegge.blogspot.com.au/2007/12/codes-worst-enemy.html)
- [ServiceStack allows returning any response](https://github.com/ServiceStack/ServiceStack/wiki/Service-return-types)

- Achieving simplicity

- [Custom filters and Event Hooks](https://github.com/ServiceStack/ServiceStack/wiki/Order-of-Operations)

- Avoid big tooling and code-gen

- [Using generic and re-usable Service Clients](https://github.com/ServiceStack/ServiceStack/wiki/Clients-overview)
- [ServiceStack's succinct, typed end-to-end API](https://github.com/ServiceStack/ServiceStack/wiki/New-Api)

- Testability

- [Same Unit Test also used as an XML, JSON, JSV and SOAP Integration Test](https://github.com/ServiceStack/ServiceStack/blob/master/tests/ServiceStack.WebHost.IntegrationTests/Tests/WebServicesTests.cs)

- Performance

- [Performance is the most important feature](https://github.com/mythz/ScalingDotNET)
- Fastest Serialization Formats

- [.NET's fastest JSON, JSV and CSV Text serialization formats](https://github.com/ServiceStack/ServiceStack.Text)
- [MessagePack](https://github.com/ServiceStack/ServiceStack/wiki/MessagePack-Format) and [Protocol Buffers](https://github.com/ServiceStack/ServiceStack/wiki/Protobuf-format) via [Plugins](https://github.com/ServiceStack/ServiceStack/wiki/Plugins)

- [Rich Caching Providers](https://github.com/ServiceStack/ServiceStack/wiki/Caching)
- Fixing .NET's performance problems

- [Fastest JSON Serializer released](http://www.servicestack.net/mythz_blog/?p=344)
- [Avoiding the degrading performance issue plaguing ASP.NET developers](http://stackoverflow.com/questions/3629709/i-just-discovered-why-all-asp-net-websites-are-slow-and-i-am-trying-to-work-out)
- [New Session Implementations](https://github.com/ServiceStack/ServiceStack/wiki/Sessions)

- Leading client for the fastest Distributed NoSQL DataStore

- [.NET's leading C# Redis Client](https://github.com/ServiceStack/ServiceStack.Redis)
- [Redis Benchmarks](http://redis.io/topics/benchmarks)
- [Redis](http://redis.io/)

### [Interview With Demis Bellot, Project Lead of ServiceStack - Part 2](http://www.infoq.com/articles/interview-servicestack-2)

**InfoQ: What exactly is a message-based Web service?**

- Comparison between Smalltalk or [Objective-C's message dispatch mechanism](http://stackoverflow.com/questions/982116/objective-c-message-dispatch-mechanism/982356#982356) vs a normal static C method call
- [Advantages of adopting a message-based design](https://github.com/ServiceStack/ServiceStack/wiki/Advantages-of-message-based-web-services)
- Message-based designs are adopted by most [leading distributed frameworks](http://www.servicestack.net/files/messaging.htm)

**InfoQ: You recently introduced a razor engine making ServiceStack a more complete web framework than just a web services framework - what was the motivation behind that?**

- HTML is just another Content-Type
- Render HTML with Razor in Self-Hosted HttpListener and Mono without ASP.NET MVC
- [Markdown Razor ViewEngine](https://github.com/ServiceStack/ServiceStack/wiki/Markdown-Razor)

- [ServiceStack Docs Markdown Razor Ajax site](http://www.servicestack.net/docs/)
- [Manage markdown content directly from GitHub repo](https://github.com/ServiceStack/ServiceStack.Examples/tree/master/src/Docs)
- [NancyFx - Alternative Open Source Web Framework](http://nancyfx.org/)

- [ServiceStack's Razor ViewEngine support](http://razor.servicestack.net/)

- [Cascading Layout Templates](http://razor.servicestack.net/#no-ceremony)
- [CSS, JS, LESS, CoffeeScript Bundler and minifier](https://github.com/ServiceStack/Bundler)

**InfoQ: Are there any scenarios where you think WCF/Web API/MVC might be better suited than ServiceStack?**

- MVC better at large write-heavy server-generated websites
- ServiceStack is optimizing for SPA's like [Backbone.js](http://backbonejs.org/), [AngularJS](http://angularjs.org/), [Dart Web Components](http://www.dartlang.org/articles/dart-web-components/), etc
- WebApi better choice for building server-side driven systems with HATEOS Restrictions
- ServiceStack better choice for maximum re-use and utility of your services
- MVP and Microsoft Gold Partners will want to continue to choose the prescribed Microsoft stacks
- ServiceStack will optimize for alternative platforms (e.g. Mono), Clouds (EC2, Google CE), RDBMS (Sqlite, MySql, Pgsql, etc), Redis/NoSQL

**InfoQ: Microsoft has collaborated with open source projects in the past (JQuery, NuGet for e.g.) and MS folks like Scott Hanselman seem quite open about adopting good open source solutions into the MS default stack wherever possible - do you foresee any such collaborations that could benefit the .NET community in general?**

- Microsoft only adopting Open Source libraries when competing attempts have failed, e.g. jQuery, JSON.NET
- [NuGet received criticism for lack of collaboration when released](http://www.developerfusion.com/news/92152/nuget-surprise-update-breaks-openwrap-open-standard-not-so-open/)
- NuGet has been a boon for using alternative libraries, [ServiceStack has had over 200k+ downloads in 18 months](https://nuget.org/profiles/mythz)
- Microsoft only adopted their fist OSS .NET library with JSON.NET this year, followed by DotNetOpenAuth
- Adopting libraries only creates "de-facto" standards and doesn't have halo effect that benefits the wider OSS .NET community

- #2 ServiceStack JSON serializer only 1/14 market share, #3 SimpleJson 1/110 market share
- ServiceStack only popular because its [.NET's fastest JSON Serializer](http://www.servicestack.net/benchmarks/#burningmonk-benchmarks), [used by StackOverflow](http://blog.stackoverflow.com/2012/02/stack-exchange-open-source-projects/)

- Microsoft releasing more .NET OSS thanks to Azure business model

- [F#](http://www.tryfsharp.org/) is completely Open Source, [works great on Mono/OSX](http://www.servicestack.net/mythz_blog/?p=765)
- [SignalR](https://github.com/SignalR) has been an instant hit, [#1 .NET OSS library on GitHub](https://github.com/languages/C%23/most_watched). [JabbR.net](http://jabbr.net/) is popular hangout for .NET OSS developers

- Existing Open Source frameworks are hurt most by competition from Microsoft

- [MonoRail MVC community deflated by ASP.NET MVC](http://whatupdave.com/post/1170718843/leaving-net)
- Entity Framework, negatively impacting previous leading ORMs despite being [several times slower than all other ORMs](http://www.servicestack.net/benchmarks/#dapper)

- .NET is unique ecosystem: Microsoft seen as authoritative voice for .NET, only uses their influence to validate their own libraries
- [Open Source C#/.NET is slipping off GitHub OSS charts](https://github.com/languages)

- [Mono project](http://www.mono-project.com/Main_Page) is brightest spark with most healthy and talented developer community providing a lot of value to .NET ecosystem
- [NancyFx](https://github.com/NancyFx/) and [ServiceStack](https://github.com/ServiceStack) next biggest .NET OSS Communities, more than 200 Contributors between them
- [MonoGame](https://github.com/mono/MonoGame) and [RavenDB](https://github.com/ravendb/ravendb) other notable .NET OSS projects with active communities

- Raising awareness is where some collaboration from Microsoft would provide most benefits

- [Scott Hanselman's personal blog](http://www.hanselman.com/blog/) currently most helpful channel promoting .NET Open Source
- [@gblock](https://twitter.com/gblock) another Microsoft evangelist seen tweeting about .NET OSS libs

- Microsoft should build business case to help .NET OSS

- Currently promotes [node.js](http://www.windowsazure.com/en-us/develop/nodejs/tutorials/web-app-with-express/), [Python](http://www.windowsazure.com/en-us/develop/python/tutorials/web-sites-with-django/) and [Java](https://www.windowsazure.com/en-us/develop/java/) OSS frameworks, but not any .NET OSS frameworks
- Failing support from Microsoft, the [Mono Project](http://www.mono-project.com/Main_Page) is best hope for encouraging more .NET devs to join Open Source

**InfoQ: You made a comment recently on one of the forums - "I'm hoping next year to be even better, as I have a few things planned that should pull us away from the other frameworks" - would you elaborate what features you have in mind for the future?**

ServiceStack set to make exciting new product announcements in 2013. Current road map includes:

- Merging the Async branch and its async pipeline
- Create new fast Async TCP Endpoints

- Enable fast, native adapters for node.js and Dart server processes

- Enable integration with more MQ Endpoints (i.e. RabbitMQ and ZeroMQ)
- VS.NET Integration and our improved solution for WCF's 'Add Service Reference'
- Integrated Development workflow and story for Mono/Linux

- Enable automated deployment story to Amazon EC2 and Google Compute Engine clouds

- Signed and Long-term stable commercial packages
- Starter templates around popular Single Page App Stacks: Backbone.js, AngularJS, Yeoman and Dart
- Starter templates for creating CRM and SharePoint-enabled support systems
- Website re-design and improved documentation

If you have the time I recommend reading the [entire interview](www.infoq.com/articles/interview-servicestack), otherwise hopefully these bulleted points can help you find the bits you're interested in sooner.
