import fs from 'fs/promises';
import path from 'path';

/**
 * Convert a detected type to TypeScript type
 */
function toTypeScriptType(detectedType) {
  if (detectedType === 'null' || detectedType === 'undefined') return 'undefined';
  if (detectedType === 'boolean') return 'boolean';
  if (detectedType === 'number') return 'number';
  if (detectedType === 'string') return 'string';
  if (detectedType.startsWith('date:')) return 'string';
  if (detectedType === 'array:empty') return 'any[]';
  if (detectedType.startsWith('array<')) {
    const innerType = detectedType.match(/array<(.+)>/)?.[1];
    return innerType ? `${toTypeScriptType(innerType)}[]` : 'any[]';
  }
  if (detectedType === 'object') return 'Record<string, any>';
  return 'any';
}

/**
 * Convert a detected type to Zod schema
 */
function toZodType(detectedType) {
  if (detectedType === 'null') return 'z.null()';
  if (detectedType === 'undefined') return 'z.undefined()';
  if (detectedType === 'boolean') return 'z.boolean()';
  if (detectedType === 'number') return 'z.number()';
  if (detectedType === 'string') return 'z.string()';
  if (detectedType === 'date:YYYY-MM-DD') return 'z.string().regex(/^\\d{4}-\\d{2}-\\d{2}$/)';
  if (detectedType === 'date:ISO8601') return 'z.string().datetime()';
  if (detectedType === 'array:empty') return 'z.array(z.any())';
  if (detectedType.startsWith('array<')) {
    const innerType = detectedType.match(/array<(.+)>/)?.[1];
    return innerType ? `z.array(${toZodType(innerType)})` : 'z.array(z.any())';
  }
  if (detectedType === 'object') return 'z.record(z.any())';
  return 'z.any()';
}

/**
 * Generate TypeScript interface from schema
 */
function generateTypeScriptInterface(schema, interfaceName = 'PostFrontmatter') {
  const lines = [`export interface ${interfaceName} {`];

  for (const [property, info] of Object.entries(schema)) {
    const types = info.types || [];
    const isOptional = info.nullable || info.occurrences < 100; // Consider rare properties as optional
    
    // Generate union type if multiple types
    let tsType;
    if (types.length === 0) {
      tsType = 'any';
    } else if (types.length === 1) {
      tsType = toTypeScriptType(types[0]);
    } else {
      // Union type
      const uniqueTypes = [...new Set(types.map(toTypeScriptType))];
      tsType = uniqueTypes.join(' | ');
    }

    // Handle object shapes
    if (info.objectShape) {
      const shapeLines = ['    {'];
      for (const [key, type] of Object.entries(info.objectShape)) {
        const isShapeOptional = type.includes('?');
        const cleanType = type.replace('?', '');
        shapeLines.push(`      ${key}${isShapeOptional ? '?' : ''}: ${cleanType};`);
      }
      shapeLines.push('    }');
      tsType = types.includes('string') 
        ? `string | ${shapeLines.join('\n')}`
        : shapeLines.join('\n');
    }

    lines.push(`  ${property}${isOptional ? '?' : ''}: ${tsType};`);
  }

  lines.push('}');
  return lines.join('\n');
}

/**
 * Generate Zod schema from schema
 */
function generateZodSchema(schema, schemaName = 'PostFrontmatterSchema') {
  const lines = [`import { z } from 'zod';`, '', `export const ${schemaName} = z.object({`];

  for (const [property, info] of Object.entries(schema)) {
    const types = info.types || [];
    const isOptional = info.nullable || info.occurrences < 100;
    
    // Generate union type if multiple types
    let zodType;
    if (types.length === 0) {
      zodType = 'z.any()';
    } else if (types.length === 1) {
      zodType = toZodType(types[0]);
    } else {
      // Union type
      const zodTypes = types.map(toZodType);
      zodType = `z.union([${zodTypes.join(', ')}])`;
    }

    // Handle object shapes
    if (info.objectShape && types.includes('object')) {
      const shapeFields = [];
      for (const [key, type] of Object.entries(info.objectShape)) {
        const isShapeOptional = type.includes('?');
        const cleanType = type.replace('?', '').split('|')[0].trim();
        const zodFieldType = toZodType(cleanType);
        shapeFields.push(`    ${key}: ${zodFieldType}${isShapeOptional ? '.optional()' : ''}`);
      }
      const objectSchema = `z.object({\n${shapeFields.join(',\n')}\n  })`;
      
      zodType = types.includes('string')
        ? `z.union([z.string(), ${objectSchema}])`
        : objectSchema;
    }

    lines.push(`  ${property}: ${zodType}${isOptional ? '.optional()' : ''},`);
  }

  lines.push('});');
  return lines.join('\n');
}

/**
 * Generate TypeScript and Zod types from frontmatter schema
 */
export default async function generateFrontmatterTypes(data) {
  const tempDir = data.tempDir;
  const logger = data.logger;

  try {
    // Check if schema exists
    if (!data.schema || !data.schema.schemaPath) {
      logger.info('No frontmatter schema found, skipping type generation');
      return data;
    }

    logger.info('🏗️ Generating TypeScript and Zod types from frontmatter schema');

    // Read schema
    const schemaData = JSON.parse(await fs.readFile(data.schema.schemaPath, 'utf8'));
    const schema = schemaData.schema;

    // Generate TypeScript interface
    const tsInterface = generateTypeScriptInterface(schema);
    const tsPath = path.join(tempDir, 'dist', 'posts.types.ts');
    await fs.writeFile(tsPath, tsInterface);

    // Generate Zod schema
    const zodSchema = generateZodSchema(schema);
    const zodPath = path.join(tempDir, 'dist', 'posts.schema.zod.ts');
    await fs.writeFile(zodPath, zodSchema);

    logger.info('✅ Type generation complete', {
      typescript: tsPath,
      zod: zodPath
    });

    return {
      ...data,
      types: {
        typescriptPath: tsPath,
        zodPath: zodPath
      }
    };
  } catch (error) {
    logger.error('Error generating types:', error);
    // Don't fail the pipeline
    return data;
  }
}