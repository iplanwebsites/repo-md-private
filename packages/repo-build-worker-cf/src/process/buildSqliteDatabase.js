// src/process/buildSqliteDatabase.js
// SKIP_SQLITE=true disables this module (for CF Containers where better-sqlite3 doesn't work)
import fs from 'fs/promises';
import path from 'path';

// Lazy-load better-sqlite3 only when needed (avoid crash on import in CF Containers)
let Database = null;
async function getDatabase() {
  if (!Database) {
    Database = (await import('better-sqlite3')).default;
  }
  return Database;
}

/**
 * Normalize frontmatter based on schema recommendations
 * @param {Object} frontmatter - Original frontmatter
 * @param {Object} schema - Schema information from scanFrontmatterSchema
 * @param {string} mode - Normalization mode: 'strict', 'permissive', or 'original'
 * @returns {Object} - Normalized frontmatter
 */
function normalizeFrontmatter(frontmatter, schema, mode = 'permissive') {
  if (!frontmatter || !schema || mode === 'original') {
    return frontmatter || {};
  }

  const normalized = {};

  for (const [key, value] of Object.entries(frontmatter)) {
    const schemaInfo = schema[key];
    
    if (!schemaInfo) {
      // Property not in schema
      if (mode === 'permissive') {
        normalized[key] = value;
      }
      continue;
    }

    const recommendedType = schemaInfo.recommendedType;

    // Type coercion based on recommended type
    if (recommendedType === 'boolean' && typeof value !== 'boolean') {
      normalized[key] = value === 'true' || value === true || value === 1 || value === '1';
    } else if (recommendedType.startsWith('array<') && !Array.isArray(value)) {
      // Convert single values to arrays
      normalized[key] = [value];
    } else if (recommendedType === 'string' && Array.isArray(value) && value.length === 1) {
      // Convert single-item arrays to strings
      normalized[key] = value[0];
    } else if (recommendedType.startsWith('date:') && typeof value === 'string') {
      // Normalize date formats (keep as string for SQLite)
      normalized[key] = value;
    } else {
      // Keep original value
      normalized[key] = value;
    }
  }

  return normalized;
}

/**
 * Convert a value to SQLite-compatible format based on its type
 */
function valueToSQL(value, sqlType) {
  if (value === null || value === undefined) return null;
  
  if (sqlType === 'INTEGER') {
    // Handle boolean -> INTEGER conversion
    if (typeof value === 'boolean') return value ? 1 : 0;
    if (typeof value === 'number') return Math.floor(value);
    if (typeof value === 'string') {
      const num = parseInt(value, 10);
      return isNaN(num) ? null : num;
    }
    return null;
  }
  
  if (sqlType === 'REAL') {
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
      const num = parseFloat(value);
      return isNaN(num) ? null : num;
    }
    return null;
  }
  
  if (sqlType === 'TEXT') {
    if (typeof value === 'object') return JSON.stringify(value);
    if (Array.isArray(value)) return JSON.stringify(value);
    return String(value);
  }
  
  return value;
}

/**
 * Build SQLite database from content.json in the dist folder
 * @param {Object} data - Job data containing asset information
 * @returns {Promise<Object>} - Result with database information
 */
async function buildSqliteDatabase(data) {
  console.log('🗃️ Building SQLite database...', { jobId: data.jobId });

  // Skip if SKIP_SQLITE is set (for CF Containers)
  if (process.env.SKIP_SQLITE === 'true') {
    console.log('⚠️ SKIP_SQLITE=true - Skipping SQLite database creation');
    return { skipped: true, reason: 'SKIP_SQLITE=true' };
  }

  // Validate required data
  if (!data.assets || !data.assets.distFolder) {
    throw new Error('Asset information is required (distFolder)');
  }
  
  const distFolder = data.assets.distFolder;
  // Use contentPath if provided, otherwise default to posts.json
  const contentPath = data.assets.contentPath || path.join(distFolder, 'posts.json');
  const dbPath = path.join(distFolder, 'content.sqlite');
  
  // Load schema if available
  let schema = null;
  let frontmatterMode = 'permissive'; // Can be configured: 'strict', 'permissive', 'original'
  
  console.log('🔍 Checking for schema data:', {
    hasSchema: !!data.schema,
    schemaPath: data.schema?.schemaPath,
    schemaKeys: data.schema ? Object.keys(data.schema) : []
  });
  
  if (data.schema && data.schema.schemaPath) {
    try {
      const schemaData = await fs.readFile(data.schema.schemaPath, 'utf8');
      const schemaJson = JSON.parse(schemaData);
      schema = schemaJson.schema;
      console.log('📊 Using frontmatter schema for normalization');
      console.log(`📊 Schema contains ${Object.keys(schema).length} properties`);
    } catch (error) {
      console.warn('⚠️ Could not load frontmatter schema:', error.message);
    }
  }
  
  try {
    // Make sure content.json exists
    await fs.access(contentPath);
    
    // Read the content.json file
    const contentDataRaw = await fs.readFile(contentPath, 'utf8');
    const contentJson = JSON.parse(contentDataRaw);
    
    // Handle both array format and object format with posts property
    const contentData = Array.isArray(contentJson) ? contentJson : (contentJson.posts || []);
    
    console.log(`📊 Creating SQLite database from ${contentData.length} content items...`);

    // Create or connect to SQLite database (lazy-load to avoid crash on import)
    const DatabaseClass = await getDatabase();
    const db = new DatabaseClass(dbPath);
    
    // Begin transaction for better performance
    db.exec('BEGIN TRANSACTION;');
    
    // Create base posts table with reserved columns prefixed with underscore
    db.exec(`
      CREATE TABLE IF NOT EXISTS posts (
        _id TEXT PRIMARY KEY,
        _slug TEXT NOT NULL,
        _title TEXT,
        _content TEXT,
        _backlinks TEXT,
        _wordCount INTEGER,
        _created TEXT,
        _modified TEXT,
        _path TEXT,
        _type TEXT,
        _frontmatter TEXT,
        _frontmatter_normalized TEXT
      );

      CREATE TABLE IF NOT EXISTS medias (
        id TEXT PRIMARY KEY,
        hash TEXT,
        filename TEXT,
        path TEXT,
        url TEXT,
        width INTEGER,
        height INTEGER,
        filesize INTEGER,
        mime_type TEXT,
        created TEXT,
        modified TEXT,
        embedding TEXT
      );

      CREATE TABLE IF NOT EXISTS tags (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tag TEXT NOT NULL UNIQUE
      );

      CREATE TABLE IF NOT EXISTS post_tags (
        post_id TEXT,
        tag_id INTEGER,
        PRIMARY KEY (post_id, tag_id),
        FOREIGN KEY (post_id) REFERENCES posts(_id),
        FOREIGN KEY (tag_id) REFERENCES tags(id)
      );

      CREATE TABLE IF NOT EXISTS links (
        source_id TEXT,
        target_id TEXT,
        PRIMARY KEY (source_id, target_id),
        FOREIGN KEY (source_id) REFERENCES posts(_id),
        FOREIGN KEY (target_id) REFERENCES posts(_id)
      );

      CREATE TABLE IF NOT EXISTS post_media (
        post_id TEXT,
        media_id TEXT,
        PRIMARY KEY (post_id, media_id),
        FOREIGN KEY (post_id) REFERENCES posts(_id),
        FOREIGN KEY (media_id) REFERENCES medias(id)
      );
    `);
    
    // Add dynamic columns based on schema
    if (schema) {
      console.log('📊 Adding dynamic columns for frontmatter properties...');
      console.log(`📊 Processing ${Object.keys(schema).length} schema properties`);
      
      for (const [property, info] of Object.entries(schema)) {
        const { columnName, sqlType, needsQuoting } = info;
        
        try {
          // Check if column already exists
          const columnExists = db.prepare(`
            SELECT COUNT(*) as count FROM pragma_table_info('posts') 
            WHERE name = ?
          `).get(columnName);
          
          if (!columnExists || columnExists.count === 0) {
            // Add the column - quote if it's a reserved word
            const quotedColumn = needsQuoting ? `"${columnName}"` : columnName;
            const alterSQL = `ALTER TABLE posts ADD COLUMN ${quotedColumn} ${sqlType}`;
            console.log(`  Adding column: ${columnName} (${sqlType})${needsQuoting ? ' [quoted]' : ''}`);
            db.exec(alterSQL);
          }
        } catch (error) {
          console.warn(`  Warning: Could not add column ${columnName}:`, error.message);
        }
      }
    }
    
    // Create indexes for faster querying
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_posts_slug ON posts(_slug);
      CREATE INDEX IF NOT EXISTS idx_medias_hash ON medias(hash);
      CREATE INDEX IF NOT EXISTS idx_tags_tag ON tags(tag);
      CREATE INDEX IF NOT EXISTS idx_posts_frontmatter ON posts(_frontmatter);
    `);
    
    // Create indexes for common frontmatter properties
    if (schema) {
      const indexableProperties = ['draft', 'published', 'date', 'author', 'category', 'status'];
      
      for (const prop of indexableProperties) {
        if (schema[prop]) {
          const { columnName, needsQuoting } = schema[prop];
          try {
            const quotedColumn = needsQuoting ? `"${columnName}"` : columnName;
            const indexSQL = `CREATE INDEX IF NOT EXISTS idx_posts_${columnName} ON posts(${quotedColumn})`;
            console.log(`  Creating index on ${columnName}`);
            db.exec(indexSQL);
          } catch (error) {
            console.warn(`  Warning: Could not create index on ${columnName}:`, error.message);
          }
        }
      }
    }
    
    // Build dynamic insert statement based on schema
    let postColumns = ['_id', '_slug', '_title', '_content', '_backlinks', '_wordCount', 
                      '_created', '_modified', '_path', '_type', '_frontmatter', '_frontmatter_normalized'];
    let postPlaceholders = ['?', '?', '?', '?', '?', '?', '?', '?', '?', '?', '?', '?'];
    
    if (schema) {
      for (const [property, info] of Object.entries(schema)) {
        const quotedColumn = info.needsQuoting ? `"${info.columnName}"` : info.columnName;
        postColumns.push(quotedColumn);
        postPlaceholders.push('?');
      }
    }
    
    const insertPostSQL = `
      INSERT OR REPLACE INTO posts (${postColumns.join(', ')})
      VALUES (${postPlaceholders.join(', ')})
    `;
    
    const insertPost = db.prepare(insertPostSQL);

    const insertMedia = db.prepare(`
      INSERT OR REPLACE INTO medias (
        id, hash, filename, path, url, width, height, filesize, mime_type, created, modified, embedding
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertPostMedia = db.prepare(`
      INSERT OR IGNORE INTO post_media (post_id, media_id) VALUES (?, ?)
    `);

    const insertTag = db.prepare(`
      INSERT OR IGNORE INTO tags (tag) VALUES (?)
    `);

    const insertPostTag = db.prepare(`
      INSERT OR IGNORE INTO post_tags (post_id, tag_id) VALUES (?, ?)
    `);

    const insertLink = db.prepare(`
      INSERT OR IGNORE INTO links (source_id, target_id) VALUES (?, ?)
    `);

    const getTagId = db.prepare(`
      SELECT id FROM tags WHERE tag = ?
    `);
    
    // Separate content items by type
    const posts = [];
    const medias = [];

    for (const item of contentData) {
      if (item.type === 'media' || item.type === 'image') {
        medias.push(item);
      } else {
        posts.push(item);
      }
    }

    console.log(`📊 Processing ${posts.length} posts and ${medias.length} media items...`);

    // Process media items first
    for (const media of medias) {
      // Insert the media
      insertMedia.run(
        media.id,
        media.hash || null,
        media.filename || path.basename(media.path || ''),
        media.path || null,
        media.url || null,
        media.width || null,
        media.height || null,
        media.filesize || null,
        media.mime_type || null,
        media.created || null,
        media.modified || null,
        media.embedding ? JSON.stringify(media.embedding) : null
      );
    }

    // Process post items
    for (const post of posts) {
      // Normalize frontmatter if schema is available
      const normalizedFrontmatter = schema 
        ? normalizeFrontmatter(post.frontmatter, schema, frontmatterMode)
        : post.frontmatter || {};

      // Build values array for insert
      const values = [
        post.id,
        post.slug,
        post.title,
        post.html || post.markdown,
        JSON.stringify(post.backlinks || []),
        post.wordCount || 0,
        post.created,
        post.modified,
        post.path,
        post.type,
        JSON.stringify(post.frontmatter || {}),
        JSON.stringify(normalizedFrontmatter)
      ];
      
      // Add values for dynamic columns
      if (schema) {
        for (const [property, info] of Object.entries(schema)) {
          const value = normalizedFrontmatter[property];
          const sqlValue = valueToSQL(value, info.sqlType);
          values.push(sqlValue);
        }
      }

      // Insert the post
      insertPost.run(...values);

      // Process tags
      if (post.tags && Array.isArray(post.tags)) {
        for (const tag of post.tags) {
          // Insert tag if it doesn't exist
          insertTag.run(tag);

          // Get tag ID
          const tagRow = getTagId.get(tag);
          if (tagRow) {
            // Create relationship
            insertPostTag.run(post.id, tagRow.id);
          }
        }
      }

      // Process links
      if (post.links && Array.isArray(post.links)) {
        for (const link of post.links) {
          if (link.target) {
            insertLink.run(post.id, link.target);
          }
        }
      }

      // Process media references
      if (post.media && Array.isArray(post.media)) {
        for (const mediaRef of post.media) {
          if (mediaRef.id) {
            insertPostMedia.run(post.id, mediaRef.id);
          }
        }
      }
    }
    
    // Commit transaction
    db.exec('COMMIT;');
    
    // Optimize the database
    db.exec('VACUUM;');
    
    // Close the database connection
    db.close();
    
    const dbStats = await fs.stat(dbPath);
    console.log('✅ SQLite database built successfully!', {
      dbPath,
      sizeBytes: dbStats.size,
      sizeHuman: `${(dbStats.size / (1024 * 1024)).toFixed(2)} MB`,
      postsCount: posts.length,
      mediaCount: medias.length
    });

    return {
      ...data,
      database: {
        processed: true,
        dbPath: dbPath,
        sizeBytes: dbStats.size,
        postsCount: posts.length,
        mediaCount: medias.length,
        totalItemCount: contentData.length,
        timestamp: new Date().toISOString()
      }
    };
  } catch (error) {
    console.error('❌ Failed to build database', {
      jobId: data.jobId,
      error: error.message,
      stack: error.stack
    });
    throw error;
  }
}

export default buildSqliteDatabase;