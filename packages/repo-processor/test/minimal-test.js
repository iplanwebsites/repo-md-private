import { unified } from 'unified';
import remarkParse from 'remark-parse';
import { remarkObsidianLink } from 'remark-obsidian-link';
import { visit } from 'unist-util-visit';

const markdown = `
Here are some wikilinks:
[[code]]
[[portraits]]

And a regular link: [test](test.md)
`;

// Test 1: Parse with remarkObsidianLink
console.log('🧪 Test 1: Parse with remarkObsidianLink\n');
const processor1 = unified()
  .use(remarkParse)
  .use(remarkObsidianLink);

const ast1 = processor1.parse(markdown);

// Count wikilink nodes
let wikiLinkCount = 0;
visit(ast1, 'wikiLink', (node) => {
  wikiLinkCount++;
  console.log('Found wikiLink node:', node);
});

console.log(`\nTotal wikiLinks found: ${wikiLinkCount}`);

// Test 2: Process without toLink
console.log('\n🧪 Test 2: Process without toLink\n');
const result2 = processor1.processSync(markdown);
console.log('Result:', result2.toString());