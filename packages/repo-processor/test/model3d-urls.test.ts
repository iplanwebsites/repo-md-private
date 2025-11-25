import { describe, it, expect } from 'vitest';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import rehypeStringify from 'rehype-stringify';
import { remarkIframeEmbed } from '../src/remark/remarkIframeEmbed';

describe('remarkIframeEmbed - 3D Model URLs', () => {
  it('should transform naked glTF URLs into iframes', async () => {
    const processor = unified()
      .use(remarkParse)
      .use(remarkIframeEmbed, {
        features: {
          model3d: true
        },
        processNakedUrls: true
      })
      .use(remarkRehype, { allowDangerousHtml: true })
      .use(rehypeStringify, { allowDangerousHtml: true });

    const input = `
Here is a 3D model:

https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/Duck/glTF/Duck.gltf

And here is another one:

https://example.com/model.glb
`;

    const result = await processor.process(input);
    const html = result.toString();

    // Check that the URLs were transformed to iframes
    expect(html).toContain('<iframe');
    expect(html).toContain('iframe.repo.md/model3d/url/gltf/');
    expect(html).toContain('iframe.repo.md/model3d/url/glb/');
  });

  it('should not transform 3D model URLs when model3d feature is disabled', async () => {
    const processor = unified()
      .use(remarkParse)
      .use(remarkIframeEmbed, {
        features: {
          model3d: false
        },
        processNakedUrls: true
      })
      .use(remarkRehype, { allowDangerousHtml: true })
      .use(rehypeStringify, { allowDangerousHtml: true });

    const input = `
Here is a 3D model:

https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/Duck/glTF/Duck.gltf
`;

    const result = await processor.process(input);
    const html = result.toString();

    // Check that the URL was NOT transformed
    expect(html).not.toContain('<iframe');
    expect(html).toContain('https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/Duck/glTF/Duck.gltf');
  });

  it('should detect various 3D model formats', async () => {
    const processor = unified()
      .use(remarkParse)
      .use(remarkIframeEmbed, {
        features: {
          model3d: true
        },
        processNakedUrls: true
      })
      .use(remarkRehype, { allowDangerousHtml: true })
      .use(rehypeStringify, { allowDangerousHtml: true });

    const input = `
glTF: https://example.com/model.gltf
GLB: https://example.com/model.glb
OBJ: https://example.com/model.obj
STL: https://example.com/model.stl
FBX: https://example.com/model.fbx
DAE: https://example.com/model.dae
3DS: https://example.com/model.3ds
PLY: https://example.com/model.ply
`;

    const result = await processor.process(input);
    const html = result.toString();

    // Check that all formats were detected
    expect(html).toContain('iframe.repo.md/model3d/url/gltf/');
    expect(html).toContain('iframe.repo.md/model3d/url/glb/');
    expect(html).toContain('iframe.repo.md/model3d/url/obj/');
    expect(html).toContain('iframe.repo.md/model3d/url/stl/');
    expect(html).toContain('iframe.repo.md/model3d/url/fbx/');
    expect(html).toContain('iframe.repo.md/model3d/url/dae/');
    expect(html).toContain('iframe.repo.md/model3d/url/3ds/');
    expect(html).toContain('iframe.repo.md/model3d/url/ply/');
  });
});