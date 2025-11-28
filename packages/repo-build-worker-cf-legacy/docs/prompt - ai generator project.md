I want to write a nodejs
module that takes a project
brief as input, and an
open ai call to get a JSON
array of files to be
created. Start with a
readme that documents the
needs, summarize the brief,
explain that this is a
starter repo.md (platform)
project, and frontmatter
params used in the files
(in the prompt to LLM,
we'll need to ask to come
up with relevant
frontmatter field to
properly fill the need
requested by brief. The MD
data might be used in an
app a website like a blog,
etc, and frontmatter usage
will vary depending on
case. It's possible to have
links between files, using
the wiki syntax [[filename
   without extension]], and
it's therefore possible to
have links between pages,
desirable even. We'll make
a lib in a file mdAgent.js
and export a fn "createStar
terProjectFromBrief(brief,
options). We'll also add a
script in the scripts
folder to test it, with
different output folders.
We'll trigger this script
from package json npm run t
estProjectStarterGenerator.
openAiKey will be an env
variable
