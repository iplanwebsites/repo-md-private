#!/usr/bin/env node

import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkStringify from 'remark-stringify';

async function test() {
  console.log('Testing if remarkGfm converts URLs to links...\n');
  
  const processor = unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkStringify);

  const input = `
Testing URLs:

https://example.com/model.glb

https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/Duck/glTF/Duck.gltf
`;

  const ast = processor.parse(input);
  const result = processor.stringify(ast);
  
  console.log('Input:', input);
  console.log('\nOutput:', result);
  
  // Check AST
  console.log('\nAST nodes:');
  const walkAst = (node, depth = 0) => {
    const indent = '  '.repeat(depth);
    console.log(`${indent}${node.type}${node.url ? ` (url: ${node.url})` : ''}${node.value ? ` (value: ${node.value})` : ''}`);
    if (node.children) {
      node.children.forEach(child => walkAst(child, depth + 1));
    }
  };
  walkAst(ast);
}

test().catch(console.error);