DEV.md

PAge to add:

Gemini Code Assist and the Gemini CLI are now authorized to access your account

bookmark_border

The authentication with Gemini Code Assist, Cloud Code with Gemini Code Assist, or the Gemini CLI was successful.

To learn more about Gemini Code Assist capabilities, see the Gemini Code Assist documentation.

To learn more about Gemini CLI, see the Gemini CLI documentation.

You can close this window and return to your IDE or terminal.

# Start prompt.

we need to produce a enhancement roadmap. We need to transform this library into a
dedicated agent, specialized into managing and working not on any codebase, but
specefically content repos made of markdown files in specefic format (obsidian vaults).
Specs of the agents are located in REPO.md file (in users folders), no gemini.md, We'll
also need to extract understood guidelines to json in a .repo folder for debugging.
We'll also have a new set of tools, like image creation apis (external) that we need to
enable. The new structure need to make it easy to add new tools functionality. we'll
also have migration helpers (importing a rss or wordpress, we have the module but will
need to call it via npx in a function call), same for a deploy command. we'll have to
run a deploy command that will effectively send data to server (mock that fn). We'll
also need to move away from the google auth an use a different auth flow provider to
authenticate the cli with our new server. Save the report to DEV/roadmap1.md
