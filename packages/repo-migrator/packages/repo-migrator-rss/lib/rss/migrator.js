import TurndownService from 'turndown';
import got from 'got';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import parseFeed from './feed.js';
import { join } from 'path';

export default async function migrateRss(source, outputDir = './posts', options = {}) {
  const { limit } = options;
  const tomd = new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced' });
  let untitledPostCounter = 0;
  let input, feed;
  const postExcerpt = '\n<!-- more -->\n';
  const rEntity = /&#?\w{2,4};/;
  const posts = [];

  const md = str => tomd.turndown(str);

  const unescapeHTML = str => {
    return str.replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, '\'');
  };

  const slugize = str => {
    return str.toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  };

  try {
    if (!source) {
      throw new Error('RSS source URL or file path is required');
    }

    if (/^http(s)?:\/\//i.test(source)) {
      console.log(`Fetching RSS from ${source}...`);
      input = await got(source, { resolveBodyOnly: true, retry: 0 });
    } else {
      console.log(`Reading RSS from file ${source}...`);
      input = await readFile(source, 'utf8');
    }

    console.log('Parsing RSS feed...');
    feed = await parseFeed(input);
  } catch (err) {
    throw new Error(`Failed to fetch/parse RSS: ${err.message}`);
  }

  if (feed && feed.items) {
    const itemCount = typeof limit === 'number' && limit > 0 && limit < feed.items.length
      ? limit
      : feed.items.length;

    console.log(`Processing ${itemCount} items...`);

    for (let i = 0; i < itemCount; i++) {
      const item = feed.items[i];
      const { date, tags, link } = item;
      let { content, excerpt, title } = item;

      if (excerpt) {
        if (rEntity.test(excerpt)) excerpt = unescapeHTML(excerpt);
        if (content && content.includes(excerpt)) {
          content = content.replace(excerpt, '');
        }
        content = md(excerpt) + postExcerpt + md(content || '');
      } else {
        content = md(content || '');
      }

      if (!title) {
        untitledPostCounter += 1;
        title = `Untitled Post ${untitledPostCounter}`;
        console.warn(`Post found without title. Using: ${title}`);
      }

      if (rEntity.test(title)) title = unescapeHTML(title);

      const newPost = {
        title,
        date: date || new Date().toISOString(),
        tags: tags || [],
        content,
        link
      };

      posts.push(newPost);
    }
  }

  // Create output directory
  if (!existsSync(outputDir)) {
    await mkdir(outputDir, { recursive: true });
  }

  // Write posts to files
  let successCount = 0;
  for (const post of posts) {
    try {
      const filename = `${slugize(post.title)}.md`;
      const filepath = join(outputDir, filename);

      const frontMatter = [
        '---',
        `title: "${post.title.replace(/"/g, '\\"')}"`,
        `date: ${post.date}`,
        ...post.tags.length ? [`tags: [${post.tags.map(tag => `"${tag}"`).join(', ')}]`] : [],
        ...post.link ? [`source: ${post.link}`] : [],
        '---',
        '',
        post.content
      ].join('\n');

      await writeFile(filepath, frontMatter, 'utf8');
      console.log(`✓ Created: ${filename}`);
      successCount++;
    } catch (err) {
      console.error(`✗ Failed to create file for: ${post.title} - ${err.message}`);
    }
  }

  console.log(`\nMigration complete: ${successCount}/${posts.length} posts created`);
  if (untitledPostCounter) {
    console.warn(`${untitledPostCounter} posts had no titles`);
  }

  return { totalPosts: posts.length, successCount, posts };
}
