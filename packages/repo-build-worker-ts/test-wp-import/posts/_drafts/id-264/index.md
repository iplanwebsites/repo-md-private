---
title: "ASP.NET MVC - not perfect"
draft: true
---

Anyway rather than go through all its features and advantages over  traditional ASP.NET I'm just going to go through my initial impressions and list any list any criticisms I have. Note some criticisms I have are just personal annoyances and personal style preferences rather than major flaws.

### Getting started with MVC

One of the best things about using technology from Microsoft is that it usually comes with great tooling and VS.NET IDE support. MVC2 is no exception as **File->New Project->ASP.NET MVC2 Web Application** is all you need to get started with a blank MVC2 solution.

[![](images/mvc2-empty-project.png "mvc2-empty-project")](http://ww2.servicestack.net/wp-uploads/2010/06/mvc2-empty-project.png)

What you get is the default project layout with the top-level folders **Content/** **Controllers/** **Models/** **Scripts/** and **Views/**. Now I understand the need for top-level Models, Views and Controllers folders (this is of course MVC), what I don't get why a .css file is made to live in a generic **Content/** folder while .js files live in their own special **Scripts/**directory? (my personal preference btw which I've used for every website I've developed in the last 10 years to have the conventional **css/** **js/** **img/** folders)

Not that its a big deal but this separation and the fact that the **Scripts/** folder is littered with \*-vsdoc.js files leads me to believe that **Scripts/** is a special-named folder that may be important for intelli-sense or something. So my first action was include 'jquery-1.4.1.js' in my Site.Master template and test to see if JavaScript intelli-sense works, it didn't. Now what irks me about this is not that I don't have JavaScript intelli-sense but the fact that the project layout is structured in a way that gives JavaScript special prominence with a special top-level Scripts/ folder and an accompanying \*-vsdoc.js file for every .js supplied and yet intelli-sense doesn't work out of the box with the default project template?! - this is meant to be version 2 of a stable product!

With that out of the way it's time to check out what else is provided. Basically what you get is a simple application with a Home, About and Registration/Login screen managed by the **HomeController** and **AccountController**. Now the best way to find out how to use a framework is to see how existing pages are made and copy the approach. This is why it is of utmost importance that the sample included with the default template is a best-practices, high-quality offering.

[![](images/home-controller.png "home-controller")](http://ww2.servicestack.net/wp-uploads/2010/06/home-controller.png)The class you get in the **HomeController** is displayed on the left. As controllers go, the class itself is pretty straightforward with a fairly light-weight class with well chosen naming conventions and typical controller pattern. A couple of issues I have is that the base **Controller** class is not an interface (which would give your controller class more re-usability outside of an MVC framework) and the lone **\[HandleError\]** attribute, which I quite honestly have no idea of the purpose - even after reading the documentation:

> Represents an attribute that is used to handle an exception that is thrown by an action method.

Now the problem I have with returning a View() (as is the case with most Controller actions) is that if the return value of Index() Action was changed to **return About();** instead, the code would indicate that the **About** view would be used while the behaviour would remain unchanged - variations like this between the intent of code and behaviour is a likely source of bugs. A simple fix to avoid this issue is to rename the parameterless View() method to ActionView() or DefaultView(), so the behaviour becomes more apparent.
