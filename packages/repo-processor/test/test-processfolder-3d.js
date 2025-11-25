#!/usr/bin/env node

import RepoProcessor from '../dist/index.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function test() {
  console.log('Testing 3D models with processFolder...\n');
  
  try {
    const results = await RepoProcessor.processFolder(
      join(__dirname, 'portfolio'),
      {
        outputPath: join(__dirname, 'test-output'),
        // No custom iframeEmbedOptions - using defaults
      }
    );

    const iframePost = results.find(f => f.slug === 'iframe-embed');
    if (!iframePost) {
      console.log('❌ iframe-embed post not found');
      return;
    }

    const gltfUrl = 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/Duck/glTF/Duck.gltf';
    const hasGltfIframe = iframePost.html.includes('iframe.repo.md/model3d/url/gltf/');
    const hasGlbIframe = iframePost.html.includes('iframe.repo.md/model3d/url/glb/');

    console.log('GLTF iframe found:', hasGltfIframe);
    console.log('GLB iframe found:', hasGlbIframe);

    if (hasGltfIframe && hasGlbIframe) {
      console.log('\n✅ 3D models are working!');
    } else {
      console.log('\n❌ 3D models NOT working!');
      
      // Debug: Check if the URLs are in the HTML at all
      console.log('\nChecking raw URLs in HTML:');
      console.log('Contains GLTF URL:', iframePost.html.includes(gltfUrl));
      console.log('Contains "Duck.gltf":', iframePost.html.includes('Duck.gltf'));
      
      // Find the lines with the URLs
      const lines = iframePost.html.split('\n');
      console.log('\nLines containing 3D model URLs:');
      lines.forEach((line, i) => {
        if (line.includes('Duck.gltf') || line.includes('Box.glb')) {
          console.log(`Line ${i + 1}: ${line.trim()}`);
        }
      });
    }

  } catch (error) {
    console.error('Error:', error.message);
  }
}

test();