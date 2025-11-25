TODOS

# quality

1. Restructure the API to be more object-oriented

The current API is very functional, which isn't bad, but for
a processing library like this, an object-oriented approach
might be clearer:

// Example of a cleaner, more object-oriented approach
import { RepoProcessor } from 'repo-processor';

const processor = new RepoProcessor({
buildDir: './dist',
inputPath: './content',
// other config options
});

const results = await processor.process();

This would give you more flexibility for adding methods and
maintaining state throughout the processing lifecycle.

2. Configuration management

The configuration handling is currently done with a large
options object with many optional properties. Consider:

- Using a config builder pattern
- Adding validation for required fields and compatible
  options
- Setting sensible defaults in a centralized place
- Implementing nested config objects for related settings

3. Better separation of concerns

The current structure has some functions doing too much. For
example, the main RepoProcessor function handles both
high-level orchestration and some implementation details.
Consider:

- Creating more specialized classes/modules
- Separating configuration, processing, and output logic
- Making the media handling more modular and pluggable

4. Standardized error handling

Implement a consistent error handling strategy:

- Custom error classes for different failure modes
- Proper error messages that help with debugging
- Option to collect warnings without failing
- Structured logging system

5. Improved plugin system

The remark/rehype plugin system could be more extensible:

- Allow for easier plugging in of custom processors
- Create a more standardized way to pass options to plugins
- Use dependency injection for better testability (1)

6. Modern packaging approach

Consider modernizing the package structure:

- ESM-first approach with CJS compatibility layer
- Tree-shakable exports
- Better documentation through JSDoc
- Separate types into a well-organized hierarchy

7. Better testing patterns

Implement more comprehensive testing:

- Unit tests for core functionality
- Integration tests for common workflows
- Snapshot testing for output formats
- Performance benchmarks

8. Documentation improvements

- Add comprehensive API documentation
- Include usage examples for common scenarios
- Document configuration options more thoroughly
- Create a changelog to track version changes

Tehere's an issue with location of \_posts folder, it's created within the "source" folder, but it really need to be located in the dist folder, just like the \_media folder

.
.
.

In processFolder. We import lib as \* lib
Instead, we'll load the selected libs as top level, instead of using the dot syntax, easier tracability...

.
.

Write documentation into Readme on how to use the new PROCESS.js entry point.
The CLI will be updated to use that process function instead of calling all the stuff separately...

,,
,

1. Create a shared media service module to eliminate
   duplication between remarkMdImages and remarkObsidianMedia
   plugins. The Task analysis provides a detailed plan for this
   refactoring.
2. Update import patterns to directly import specific
   functions from modules rather than using namespace imports
   with dot notation. This improves code traceability and makes
   dependencies clearer.
3. Replace the "useless..." comment in
   remarkObsidianMedia.ts with proper documentation or remove
   redundant code.
4. Consider performance optimizations in the media lookup
   process. Currently, many string variations are created for
   each path with multiple lookups performed.
5. The wip-legacy folder in the remark directory suggests
   there may be some code that could be removed if it's truly
   no longer needed.
   .
   .
   .

In the WORKER-builder
