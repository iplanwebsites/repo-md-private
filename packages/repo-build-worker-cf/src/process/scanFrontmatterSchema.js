import fs from 'fs/promises';
import path from 'path';

// Reserved SQLite keywords that cannot be used as column names without quoting
// We'll allow these but will need to quote them in queries
const SQLITE_RESERVED_WORDS = new Set([
  'order', 'group', 'index', 'key', 'table', 'column',
  'update', 'delete', 'insert', 'select', 'where', 'from', 'to',
  'limit', 'offset', 'join', 'union', 'having', 'exists'
]);

function detectType(value) {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (typeof value === 'boolean') return 'boolean';
  if (typeof value === 'number') return 'number';
  if (typeof value === 'string') {
    // Detect date formats
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return 'date:YYYY-MM-DD';
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value)) return 'date:ISO8601';
    return 'string';
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return 'array:empty';
    const elementTypes = new Set(value.map(item => detectType(item)));
    if (elementTypes.size === 1) {
      return `array<${Array.from(elementTypes)[0]}>`;
    }
    return `array<mixed>`;
  }
  if (typeof value === 'object') {
    return 'object';
  }
  return 'unknown';
}

function analyzeObjectShape(obj) {
  const shape = {};
  for (const [key, value] of Object.entries(obj)) {
    shape[key] = detectType(value);
  }
  return shape;
}

function mergeTypeInfo(existing, newType, value) {
  if (!existing) {
    existing = {
      types: new Set(),
      occurrences: 0,
      nullable: false,
      samples: [],
      conflicts: {}
    };
  }

  existing.types.add(newType);
  existing.occurrences++;
  
  if (value === null || value === undefined) {
    existing.nullable = true;
  }

  // Store samples for later analysis (limit to 3)
  if (existing.samples.length < 3 && value !== null && value !== undefined) {
    existing.samples.push(value);
  }

  // Track conflicts
  if (!existing.conflicts[newType]) {
    existing.conflicts[newType] = 0;
  }
  existing.conflicts[newType]++;

  // Handle object shapes
  if (newType === 'object' && value && typeof value === 'object') {
    if (!existing.objectShape) {
      existing.objectShape = {};
    }
    const shape = analyzeObjectShape(value);
    for (const [key, type] of Object.entries(shape)) {
      if (!existing.objectShape[key]) {
        existing.objectShape[key] = new Set();
      }
      existing.objectShape[key].add(type);
    }
  }

  return existing;
}

function determineRecommendedType(typeInfo) {
  const types = Array.from(typeInfo.types);
  
  // If only one type, recommend it
  if (types.length === 1) {
    return types[0];
  }

  // Handle date format conflicts
  const dateTypes = types.filter(t => t.startsWith('date:'));
  if (dateTypes.length > 0) {
    // Prefer ISO8601 over other date formats
    if (dateTypes.includes('date:ISO8601')) {
      return 'date:ISO8601';
    }
    return dateTypes[0];
  }

  // Handle string vs array conflicts (common in tags)
  if (types.includes('string') && types.some(t => t.startsWith('array<'))) {
    return types.find(t => t.startsWith('array<'));
  }

  // Return the most common type
  let maxCount = 0;
  let recommendedType = types[0];
  for (const [type, count] of Object.entries(typeInfo.conflicts)) {
    if (count > maxCount) {
      maxCount = count;
      recommendedType = type;
    }
  }

  return recommendedType;
}

function typeToSQLType(detectedType) {
  // Map detected types to SQLite types
  if (detectedType === 'boolean') return 'INTEGER'; // SQLite uses 0/1 for boolean
  if (detectedType === 'number') return 'REAL';
  if (detectedType === 'string') return 'TEXT';
  if (detectedType.startsWith('date:')) return 'TEXT'; // Store dates as TEXT
  if (detectedType.startsWith('array<')) return 'TEXT'; // Store arrays as JSON
  if (detectedType === 'object') return 'TEXT'; // Store objects as JSON
  return 'TEXT'; // Default to TEXT for unknown types
}

function sanitizeColumnName(name) {
  // Convert property name to valid SQLite column name
  // Replace non-alphanumeric characters with underscores
  return name.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase();
}

function generateSchemaReport(schema, statistics) {
  const report = {
    summary: {
      totalPosts: statistics.totalPosts,
      postsWithFrontmatter: statistics.postsWithFrontmatter,
      uniqueProperties: statistics.uniqueProperties,
      propertiesWithConflicts: 0,
      sqliteReservedWords: 0,
      warnings: [],
      errors: []
    },
    conflicts: [],
    sqliteReservedWords: [],
    recommendations: []
  };

  for (const [property, info] of Object.entries(schema)) {
    const types = Array.from(info.types);
    
    // Check for SQLite reserved words
    if (SQLITE_RESERVED_WORDS.has(property.toLowerCase())) {
      report.summary.sqliteReservedWords++;
      report.sqliteReservedWords.push(property);
      
      report.summary.warnings.push({
        type: 'sqlite_reserved_word',
        property,
        message: `Property '${property}' is a SQLite reserved word. It will be quoted in queries.`
      });
    }
    
    if (types.length > 1) {
      report.summary.propertiesWithConflicts++;
      
      const conflict = {
        property,
        types: types,
        occurrences: info.occurrences,
        distribution: info.conflicts,
        recommendation: determineRecommendedType(info),
        samples: info.samples
      };
      
      report.conflicts.push(conflict);

      // Add warning
      report.summary.warnings.push({
        type: 'type_conflict',
        property,
        message: `Property '${property}' has conflicting types: ${types.join(', ')}`
      });
    }

    // Check for potential issues
    if (info.occurrences < statistics.postsWithFrontmatter * 0.1) {
      report.summary.warnings.push({
        type: 'rare_property',
        property,
        message: `Property '${property}' appears in less than 10% of posts`
      });
    }
  }

  // Add recommendations
  if (report.conflicts.length > 0) {
    report.recommendations.push({
      type: 'normalize_types',
      message: 'Consider normalizing frontmatter types for consistency',
      details: report.conflicts.map(c => ({
        property: c.property,
        suggestedType: c.recommendation
      }))
    });
  }

  return report;
}

export default async function scanFrontmatterSchema(data) {
  const tempDir = data.tempDir;
  const logger = data.logger || console;
  const issueReporter = data.issueReporter;

  console.log('🔍 scanFrontmatterSchema called with:', {
    hasTempDir: !!tempDir,
    tempDir: tempDir,
    hasAssets: !!data.assets,
    distFolder: data.assets?.distFolder
  });

  try {
    if (logger.info) {
      logger.info('Starting frontmatter schema scan');
    } else {
      logger.log('Starting frontmatter schema scan');
    }

    // Determine the dist directory
    let distDir;
    if (data.assets && data.assets.distFolder) {
      distDir = data.assets.distFolder;
    } else if (tempDir) {
      distDir = path.join(tempDir, 'dist');
    } else {
      throw new Error('Cannot determine dist directory - neither tempDir nor assets.distFolder provided');
    }

    console.log('📁 Using dist directory:', distDir);

    // Read posts.json (primary) or content.json (fallback)
    let contentPath = path.join(distDir, 'posts.json');
    let contentData;
    
    try {
      // Try posts.json first
      contentData = JSON.parse(await fs.readFile(contentPath, 'utf8'));
    } catch (error) {
      // Fallback to content.json
      contentPath = path.join(distDir, 'content.json');
      contentData = JSON.parse(await fs.readFile(contentPath, 'utf8'));
    }
    
    const posts = Array.isArray(contentData) ? contentData : (contentData.posts || []);
    const schemaRegistry = {};
    const statistics = {
      totalPosts: posts.length,
      postsWithFrontmatter: 0,
      uniqueProperties: 0
    };

    // Analyze each post's frontmatter
    for (const post of posts) {
      if (post.frontmatter && typeof post.frontmatter === 'object') {
        statistics.postsWithFrontmatter++;
        
        for (const [key, value] of Object.entries(post.frontmatter)) {
          const type = detectType(value);
          schemaRegistry[key] = mergeTypeInfo(schemaRegistry[key], type, value);
        }
      }
    }

    statistics.uniqueProperties = Object.keys(schemaRegistry).length;

    // Convert sets to arrays for JSON serialization
    const schema = {};
    for (const [key, info] of Object.entries(schemaRegistry)) {
      const recommendedType = determineRecommendedType(info);
      const sqlType = typeToSQLType(recommendedType);
      const sanitizedName = sanitizeColumnName(key);
      const needsQuoting = SQLITE_RESERVED_WORDS.has(key.toLowerCase());

      schema[key] = {
        types: Array.from(info.types),
        occurrences: info.occurrences,
        nullable: info.nullable,
        recommendedType: recommendedType,
        sqlType: sqlType,
        columnName: sanitizedName,
        needsQuoting: needsQuoting
      };

      if (info.objectShape) {
        schema[key].objectShape = {};
        for (const [objKey, types] of Object.entries(info.objectShape)) {
          schema[key].objectShape[objKey] = Array.from(types).join('|');
        }
      }

      if (Object.keys(info.conflicts).length > 1) {
        schema[key].conflicts = info.conflicts;
      }
    }

    // Generate report
    const report = generateSchemaReport(schemaRegistry, statistics);

    // Save schema and report to the dist directory
    const schemaPath = path.join(distDir, 'posts-schema.json');
    const reportPath = path.join(distDir, 'schema-report.json');

    await fs.writeFile(schemaPath, JSON.stringify({
      schema,
      statistics,
      generatedAt: new Date().toISOString()
    }, null, 2));

    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));

    // Report issues to centralized reporter
    if (issueReporter) {
      for (const warning of report.summary.warnings) {
        issueReporter.addIssue({
          type: 'warning',
          category: 'frontmatter_schema',
          message: warning.message,
          details: warning
        });
      }

      for (const error of report.summary.errors) {
        issueReporter.addIssue({
          type: 'error',
          category: 'frontmatter_schema',
          message: error.message,
          details: error
        });
      }
    }

    if (logger.info) {
      logger.info(`Frontmatter schema scan complete: ${statistics.uniqueProperties} properties found, ${report.summary.propertiesWithConflicts} with conflicts`);
    } else {
      logger.log(`Frontmatter schema scan complete: ${statistics.uniqueProperties} properties found, ${report.summary.propertiesWithConflicts} with conflicts`);
    }

    return {
      ...data,
      schema: {
        schemaPath,
        reportPath,
        hasConflicts: report.summary.propertiesWithConflicts > 0,
        conflictCount: report.summary.propertiesWithConflicts,
        statistics
      }
    };
  } catch (error) {
    if (logger.error) {
      logger.error('Error scanning frontmatter schema:', error);
    } else {
      console.error('Error scanning frontmatter schema:', error);
    }
    
    if (issueReporter) {
      issueReporter.addIssue({
        type: 'error',
        category: 'frontmatter_schema',
        message: 'Failed to scan frontmatter schema',
        details: { error: error.message }
      });
    }

    // Don't fail the pipeline, just pass through
    return {
      ...data,
      schema: {
        error: error.message,
        hasConflicts: false,
        conflictCount: 0
      }
    };
  }
}