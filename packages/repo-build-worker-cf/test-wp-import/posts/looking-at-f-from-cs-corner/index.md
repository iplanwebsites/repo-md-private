---
title: "A Look at F# from C#'s corner"
date: 2011-09-27
---

For a while now I've been hearing many great things that have been coming out of Microsoft Research's popular .NET language F#. For the unfamiliar, F# is a strongly-typed, functional-based language for .NET - originally created by [Don Syme](http://blogs.msdn.com/b/dsyme/) (better known to most as [the father of generics in .NET](http://blogs.msdn.com/b/dsyme/archive/2011/03/15/net-c-generics-history-some-photos-from-feb-1999.aspx)) it has now become a fully supported language in .NET with soon to be first-class support in VS.NET.

Despite being deeply inspired by its functional roots, it stands out from other languages in that it also supports imperative and OOP paradigms as well. Boasting both interactive and compile modes, it's been holding over C# lately, sporting a more succinct syntax and already comes complete with features like  [async workflows](http://msdn.microsoft.com/en-us/library/dd233250.aspx) and an interactive mode we wont see in C# until V.Next.

The [announcement of F# 3.0](http://blogs.msdn.com/b/fsharpteam/archive/2011/09/14/f-3-0-developer-preview-now-available.aspx) pushes the envelope even further where the new Type Providers promises to be even more productive by allowing you to build against a strong-typed API (with intelli-sense) against a runtime datasource.

So not wanting to fall too far behind a good thing I've made F# on this years must-learn-list. Before looking at F# I have to admit I thought C# was close to the perfect server-side language with its biggest weaknesses just being the lack of string interpolation and [Go's-like interfaces](http://www.airs.com/blog/archives/277). Given that, I was quite surprised to find how much more elegant F# is in a number of ways:

### Type Inference to the Max

Where some C# developers are still reluctant to use **var** in their works, F# takes type inference to the extreme where you can effectively omit type declarations whenever the type is not ambiguous and can be safely inferred.

### Less code, the better

I'm a firm believer [a smaller code base is a good one](http://blog.vivekhaldar.com/post/10669678292/size-is-the-best-predictor-of-code-quality) and we should be striving for a DRY, tight code-base where the solution permits. Having less code means there is less to maintain and less chance for something to go wrong, where a high signal-to-noise ratio is generally more readable as you're able to focus more on the solution and less on the needless abstractions that get in the way.

In addition to type inference, F# has many features to tackle code boat including:

- Language support for [tuples](http://en.wikibooks.org/wiki/F_Sharp_Programming/Tuples_and_Records)
- [Records](http://en.wikibooks.org/wiki/F_Sharp_Programming/Tuples_and_Records) and [Discriminated unions](http://en.wikibooks.org/wiki/F_Sharp_Programming/Discriminated_Unions) in-place of lightweight classes
- [Pattern matching](http://en.wikibooks.org/wiki/F_Sharp_Programming/Pattern_Matching_Basics) replacing heavy chained and nested **if** and **switch** statements.
- [Pipelining](http://lorgonblog.wordpress.com/2008/03/30/pipelining-in-f/) allowing for readable chained expressions.
- [Currying](http://en.wikibooks.org/wiki/F_Sharp_Programming/Higher_Order_Functions) allowing for functional composition instead of needless abstractions

Out of all its features I believe what promotes the least code bloat is the quality of F#'s community (see: [The Python Paradox](http://www.paulgraham.com/pypar.html)) and its preference to simple, elegant composable solutions.  This is contrast to C#'s abstraction fetish it copied from Java and its relentless need to cater for the lowest common Drag n' Drop developer and impress them with 5 minute demos. Although it's a subject for another post, this rarely leaves us with quality frameworks or APIs.

Functional vs Imperative

Even though F# allows for programming in procedural, Object Orientated and functional paradigms, its roots and optimized syntax lends itself towards functional-style of programming. In many ways functional programming provides more elegant and robust solutions. Luca Bolognese explains this best in his [excellent Intro to F#](http://channel9.msdn.com/Blogs/pdc2008/TL11), where the instincts of a C# programmer attempts to solve a problem imperatively resulting in mutable variables and disjointed logic allowing for moving parts to go wrong.  In his example Luca uses the **'sum of squares'** as an example where the budding C# developer would approach it into something like this:

\[csharp\] public int Square(int num) { return num \* num; }

public int SumOfSquares(IEnumerable<int> list) { var sum = 0; foreach (var num in list) { sum += Square(num); } return sum; }

var nums = Enumerable.Range(1,100); Console.WriteLine("Sum of squares of 1-100: {0}", SumOfSquares(nums)); \[/csharp\]

The F# functional approach would lend it more to the original question, i.e. **square the numbers, then sum them**:

\[csharp\] let squares x = x \* x let sumOfSquares nums = nums |> Seq.map squares |> Seq.sum

printfn "Sum of squares of 1-100: %d" (sumOfSquares \[1..100\]) \[/csharp\]

Although oddly enough despite its already succinctness, it can be even further reduced to:

\[csharp\] let sumOfSquares nums = nums |> Seq.sumBy squares \[/csharp\]

I recommend watching the rest of Luca's video as he goes on to show how the F# solution lends itself to easy parallelization, without interrupting the existing flow of logic.

In a real world problems closer to home, [@ayende](http://twitter.com/#!/ayende) recently posted one of his interview questions online asking for [example solutions to calculate israels tax](http://ayende.com/blog/108545/the-tax-calculation-challenge). As expected [most](http://pastebin.com/zJADQGdx) [C#](http://pastebin.com/NCmjVJE0) [solutions](https://gist.github.com/1237076) [were](https://gist.github.com/1237707) [similarly](https://gist.github.com/9cbe9ab68f75f52eebfb) written the same way complete with mutable variables, tightly coupled solutions - many of them having custom types and other artefacts.  Comparatively the [few](http://pastebin.com/g9UDu5vF) [F#](https://gist.github.com/1244370) [solutions](https://gist.github.com/1236106) posted had significantly less code, yet was easier to read and maintain.

My attempt at solving this problem in a purely functional style resulted in this [\[gist\]](https://gist.github.com/1236106):

\[csharp\] let taxOf salary taxRates = ((0m,0)::taxRates, taxRates) ||> Seq.zip |> Seq.map(fun ((\_, prevBand),(rate, band)) -> (prevBand, rate, band)) |> Seq.sumBy(fun (prevBand, rate, band) -> match salary with | x when x < prevBand -> 0m | x when x > band -> decimal(band - prevBand) \* rate | x -> decimal(x - prevBand) \* rate )

let israelTaxRates = \[ 0.10m, 5070; 0.14m, 8660; 0.23m, 14070; 0.30m, 21240; 0.33m, 40230; 0.45m, System.Int32.MaxValue\]

let taxOfIsrael salary = israelTaxRates |> taxOf salary

//Usage: taxOfIsrael 5800 \[/csharp\]

The nice aspects of this solution was having the tax rates and bands in an easily readable and maintainable collection optimized for the reader (like all other F# solutions) separate from its implementation. The internal logic is neatly coupled together into 3 readable scenarios, making it easy to work out how the tax was calculated.

Another nice feature is being able to easily combine the implementation and input tax rates to create a high order **taxOfIsrael** function that ultimately performs the task. This in-built ability to curry functions makes functional composition a breeze and after using it for a while I can quickly see how it's more elegant to OOP programming style in a lot of areas.

### Interactive Mode

Inside Visual Studio 2010 (or by using **fsi** on the command line) is F# Interactive mode which works very much like Ruby's irb or  Pythons interactive mode, it's just rare to see this from a typed .NET language, although [Boo was likely the first to do this](http://boo.codehaus.org/Interactive+Interpreter).

### F# open and F# everywhere!

Despite F# being the latest creation forged in the deep trenches of Microsoft's R&D department, F# is surprisingly and arguably the most open of all of Microsofts languages with their entire implementation [available on GitHub](https://github.com/fsharp/fsharp) and free to use, released under the liberal and OSS approved [Apache 2.0 licence](https://github.com/fsharp/fsharp/blob/master/LICENSE)! This wouldn't mean much if it didn't immediately work elsewhere however Don Syme and his team have done a good job actively supporting Mono, going as far as reporting blocking Mono bugs, ensuring it continues to work flawlessly. It's even being currently distributed with the latest release of Mono on OSX.

Being this open is a treat, we can finally [build GTK desktop applications](http://functional-variations.net/crossplatform/) with a typed, fast functional language using Open Source components end-to-end!

I'm actually surprised how well it works where I'm doing all current F# development on an OSX Macbook Air, deploying my finished solutions onto [http://www.servicestack.net](http://www.servicestack.net) CentOS linux server for hosting.

### Getting Started with F#

Although not mentioned here, it should be noted F# is great for concurrent programming tasks as well. It is also particular good at creating composable asynchronous work flows - which happened to be the source of inspiration for C#'s 5.0 async/await feature.

Getting started with F# is easy where if you have Visual Studio 2010 - you've already got it! Just create an F# project and your good to go. For all other platforms [follow this link](http://www.tryfsharp.org/Tools.aspx).

For the newbie budding developer, I recommend the following learning resources:

- [Luca Bolognese - Intro to F#](http://channel9.msdn.com/Blogs/pdc2008/TL11) - fun and entertaining
- [More F# Videos](http://www.tryfsharp.org/Resources/Videos.aspx) - both introductory and advanced
- [The F# Wiki](http://en.wikibooks.org/wiki/Programming:F_Sharp) - covers the essential language features
- [Any of the quality books on F#](http://www.tryfsharp.org/Resources/Books.aspx) - for dead tree lovers
- [HubFS](http://cs.hubfs.net/) \- The defacto F# Forum

#### Blogs

- [Don Syme](http://blogs.msdn.com/b/dsyme/) - The Master
- [MSDN F# Team Blog](http://blogs.msdn.com/b/fsharpteam/)
- [Inside F#](http://lorgonblog.wordpress.com/) - Brian McNamara from MSDN Team
- [Robert Pickering](http://strangelights.com/blog/) - Author of [Beginning F#](http://www.amazon.com/Beginning-F-Robert-Pickering/dp/1430223898)
- [Tomas Petricek](http://tomasp.net/blog/) - Co Author of [Real World Functional Programming](http://www.amazon.com/gp/product/1933988924/ref=as_li_tf_il?ie=UTF8&tag=httptomasnet-20&linkCode=as2&camp=217145&creative=399369&creativeASIN=1933988924) with Jon Skeet

### Next up: Easy Self Hosted, Cross Platform F# Web Services

Although not a surprise for a .NET language, I'm happy to report F# works flawlessly with [Service Stack](http://www.servicestack.net) where its thin API doesn't get in F#'s way - allowing it to easily create elegant self-hosted solutions. In my next instalment I'll show how you can easily create an **async+parallel cached twitter proxy** that works cross platform on Windows/OSX and Linux in =~ **100 LOC**.
