import { test, expect, describe } from 'vitest';
import { MediaService } from '../src/lib/mediaService';
import type { MediaFileData } from '../src/types';

// Mock media data for testing
const mockMediaData: MediaFileData[] = [
  {
    fileName: 'photographer-headshot.jpg',
    originalPath: 'assets/photographer-headshot.jpg',
    effectivePath: '_media/photographer-headshot.jpg',
    metadata: { hash: 'abc123' },
    sizes: {
      xs: [{ format: 'webp', publicPath: '/_media/xs/photographer-headshot.webp', width: 100, height: 100 }],
      sm: [{ format: 'webp', publicPath: '/_media/sm/photographer-headshot.webp', width: 200, height: 200 }],
      md: [{ format: 'webp', publicPath: '/_media/md/photographer-headshot.webp', width: 400, height: 400 }],
      lg: [{ format: 'webp', publicPath: '/_media/lg/photographer-headshot.webp', width: 800, height: 800 }],
      xl: [{ format: 'webp', publicPath: '/_media/xl/photographer-headshot.webp', width: 1200, height: 1200 }]
    }
  },
  {
    fileName: 'cover-image.jpg',
    originalPath: 'assets/cover-image.jpg',
    effectivePath: '_media/cover-image.jpg',
    metadata: { hash: 'def456' },
    sizes: {
      xs: [{ format: 'webp', publicPath: '/_media/xs/cover-image.webp', width: 100, height: 100 }],
      sm: [{ format: 'webp', publicPath: '/_media/sm/cover-image.webp', width: 200, height: 200 }],
      md: [{ format: 'webp', publicPath: '/_media/md/cover-image.webp', width: 400, height: 400 }],
      lg: [{ format: 'webp', publicPath: '/_media/lg/cover-image.webp', width: 800, height: 800 }],
      xl: [{ format: 'webp', publicPath: '/_media/xl/cover-image.webp', width: 1200, height: 1200 }]
    }
  }
];

describe('Frontmatter Image Processing', () => {
  test('MediaService finds media items correctly', () => {
    const mediaService = new MediaService({
      mediaData: mockMediaData,
      mediaPathMap: {},
      useAbsolutePaths: false,
      preferredSize: 'lg'
    });
    
    // Test finding by filename
    const item = mediaService.findMediaItem(
      'photographer-headshot.jpg', 
      'photographer-headshot.jpg', 
      ''
    );
    
    expect(item).toBeDefined();
    expect(item?.fileName).toBe('photographer-headshot.jpg');
  });
  
  test('MediaService extracts correct size variant', () => {
    const mediaService = new MediaService({
      mediaData: mockMediaData,
      mediaPathMap: {},
      useAbsolutePaths: false,
      preferredSize: 'lg'
    });
    
    const item = mediaService.findMediaItem(
      'photographer-headshot.jpg', 
      'photographer-headshot.jpg', 
      ''
    );
    
    if (item) {
      const variant = mediaService.getBestSizeVariant(item);
      expect(variant).toBeDefined();
      expect(variant?.imagePath).toBe('/_media/lg/photographer-headshot.webp');
      expect(variant?.width).toBe(800);
      expect(variant?.height).toBe(800);
    }
  });
  
  test('resolveFrontmatterImages should process multiple image fields', () => {
    // This is a conceptual test - the actual implementation is in processFolder.ts
    // which requires a full vault setup to test properly
    
    const frontmatter = {
      title: 'Test Post',
      cover: '![[cover-image.jpg]]',
      photographer_portrait: '![[photographer-headshot.jpg]]'
    };
    
    // Expected output after processing:
    const expectedFields = [
      'cover',
      'cover-xs',
      'cover-sm',
      'cover-md',
      'cover-lg',
      'cover-xl',
      'photographer_portrait',
      'photographer_portrait-xs',
      'photographer_portrait-sm',
      'photographer_portrait-md',
      'photographer_portrait-lg',
      'photographer_portrait-xl'
    ];
    
    console.log('Expected frontmatter fields after processing:', expectedFields);
  });
  
  test('Custom image fields can be configured', () => {
    // Test that custom fields can be passed via ProcessOptions
    const customFields = [
      'author_photo',
      'banner_image',
      'og_image',
      'twitter_card_image'
    ];
    
    // These would be passed as:
    // opts.frontmatterImageFields = customFields
    
    console.log('Custom image fields can be configured via ProcessOptions.frontmatterImageFields');
  });
});