#!/usr/bin/env node

import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import rehypeStringify from 'rehype-stringify';
import { remarkIframeEmbed } from '../dist/index.js';

async function test3DModels() {
  const processor = unified()
    .use(remarkParse)
    .use(remarkIframeEmbed) // Using defaults
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeStringify, { allowDangerousHtml: true });

  const input = `
Testing 3D model URLs:

https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/Duck/glTF/Duck.gltf

https://example.com/model.glb
`;

  const result = await processor.process(input);
  const html = result.toString();

  console.log('Generated HTML:');
  console.log(html);
  console.log('\n---\n');

  // Check if transformation happened
  const hasGltfIframe = html.includes('iframe.repo.md/model3d/url/gltf/');
  const hasGlbIframe = html.includes('iframe.repo.md/model3d/url/glb/');

  console.log('GLTF iframe found:', hasGltfIframe);
  console.log('GLB iframe found:', hasGlbIframe);

  if (!hasGltfIframe || !hasGlbIframe) {
    console.log('\n❌ 3D model URLs are NOT being transformed!');
    
    // Let's check the default config
    const testProcessor = unified()
      .use(remarkParse)
      .use(remarkIframeEmbed, {
        debug: true
      });
    
    console.log('\nChecking plugin configuration...');
  } else {
    console.log('\n✅ 3D model URLs are being transformed correctly!');
  }
}

test3DModels().catch(console.error);