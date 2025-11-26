import { schemas, getMethodsByMode, type SchemaWithMeta, type MethodMode } from "../schemas/schemas.js";
import { type ZodTypeAny } from "zod";

/** OpenAI parameter property type */
export interface OpenAiProperty {
  type: string;
  description?: string;
  default?: unknown;
  enum?: string[];
  items?: OpenAiProperty;
}

/** OpenAI function parameters type */
export interface OpenAiFunctionParameters {
  type: "object";
  properties: Record<string, OpenAiProperty>;
  required: string[];
}

/** OpenAI function specification */
export interface OpenAiFunction {
  name: string;
  description: string;
  parameters: OpenAiFunctionParameters;
}

/** OpenAI tool specification */
export interface OpenAiSpecs {
  type: "function";
  functions: OpenAiFunction[];
}

/** Options for creating OpenAI specs */
export interface CreateOpenAiSpecsOptions {
  methods?: string;
}

/** Schema definition type */
interface SchemaDef {
  typeName?: string;
  shape?: Record<string, ZodTypeAny> | (() => Record<string, ZodTypeAny>);
  innerType?: ZodTypeAny;
  schema?: ZodTypeAny;
  description?: string;
  checks?: Array<{ kind: string }>;
  type?: ZodTypeAny;
  values?: string[];
  defaultValue?: () => unknown;
}

/**
 * Check if a Zod schema is optional (has a default value or is explicitly optional)
 */
function isOptionalSchema(schema: ZodTypeAny): boolean {
  if (!schema) return false;

  const def = (schema as unknown as { _def: SchemaDef })._def;
  if (!def) return false;

  // Check if it's explicitly optional
  if (def.typeName === "ZodOptional") return true;

  // Check if it has a default value
  if (def.typeName === "ZodDefault") return true;

  // Check for wrapped optional schemas
  let current: ZodTypeAny | undefined = schema;
  while (current) {
    const currentDef: SchemaDef | undefined = (current as unknown as { _def: SchemaDef })._def;
    if (!currentDef) break;

    if (
      currentDef.typeName === "ZodOptional" ||
      currentDef.typeName === "ZodDefault"
    ) {
      return true;
    }
    // Handle nested schemas
    if (currentDef.innerType) {
      current = currentDef.innerType;
    } else if (currentDef.schema) {
      current = currentDef.schema;
    } else {
      break;
    }
  }

  return false;
}

/**
 * Convert a Zod schema to OpenAI function parameter specification
 */
function zodToOpenAiSpec(zodSchema: SchemaWithMeta, functionName: string): OpenAiFunction {
  try {
    const def = (zodSchema as unknown as { _def: SchemaDef })._def;
    const shapeRaw = def.shape;
    const shape = typeof shapeRaw === "function" ? shapeRaw() : shapeRaw;
    const description =
      (zodSchema as unknown as { description?: string }).description || `Execute ${functionName} operation`;

    const properties: Record<string, OpenAiProperty> = {};
    const required: string[] = [];

    if (shape && typeof shape === "object") {
      for (const [key, schema] of Object.entries(shape)) {
        const property = convertZodProperty(schema);
        properties[key] = property;

        if (!isOptionalSchema(schema)) {
          required.push(key);
        }
      }
    }

    return {
      name: functionName,
      description,
      parameters: {
        type: "object",
        properties,
        required,
      },
    };
  } catch (error) {
    console.warn(`Failed to convert schema for ${functionName}:`, error);
    return {
      name: functionName,
      description: `Execute ${functionName} operation`,
      parameters: {
        type: "object",
        properties: {},
        required: [],
      },
    };
  }
}

/**
 * Convert individual Zod property to OpenAI parameter format
 */
function convertZodProperty(schema: ZodTypeAny): OpenAiProperty {
  const property: OpenAiProperty = { type: "string" };
  const def = (schema as unknown as { _def: SchemaDef })._def;

  // Extract description from various schema wrapper types
  let description: string | undefined = (schema as unknown as { description?: string }).description || def?.description;

  // For wrapped schemas, check inner types for description
  let current: ZodTypeAny | undefined = schema;
  while (current && !description) {
    const currentDef: SchemaDef | undefined = (current as unknown as { _def: SchemaDef })._def;
    if (currentDef?.description) {
      description = currentDef.description;
      break;
    }
    if (currentDef?.innerType) {
      current = currentDef.innerType;
    } else if (currentDef?.schema) {
      current = currentDef.schema;
    } else {
      break;
    }
  }

  if (description) {
    property.description = description;
  }

  const typeName = def?.typeName;

  switch (typeName) {
    case "ZodString":
      property.type = "string";
      break;
    case "ZodNumber":
      property.type = "number";
      if (def?.checks?.some((check) => check.kind === "int")) {
        property.type = "integer";
      }
      break;
    case "ZodBoolean":
      property.type = "boolean";
      break;
    case "ZodArray":
      property.type = "array";
      if (def?.type) {
        property.items = convertZodProperty(def.type);
      }
      break;
    case "ZodRecord":
    case "ZodObject":
      property.type = "object";
      break;
    case "ZodEnum":
      property.type = "string";
      property.enum = def?.values;
      break;
    case "ZodOptional": {
      if (def?.innerType) {
        const innerProperty = convertZodProperty(def.innerType);
        // Preserve the description from the ZodOptional if the inner type doesn't have one
        if (description && !innerProperty.description) {
          innerProperty.description = description;
        }
        return innerProperty;
      }
      break;
    }
    case "ZodDefault": {
      if (def?.innerType) {
        const innerProperty = convertZodProperty(def.innerType);
        if (def.defaultValue) {
          innerProperty.default = def.defaultValue();
        }
        // Preserve the description from the ZodDefault if the inner type doesn't have one
        if (description && !innerProperty.description) {
          innerProperty.description = description;
        }
        return innerProperty;
      }
      break;
    }
    case "ZodEffects": {
      if (def?.schema) {
        const innerProperty = convertZodProperty(def.schema);
        // Preserve the description from the ZodEffects if the inner type doesn't have one
        if (description && !innerProperty.description) {
          innerProperty.description = description;
        }
        return innerProperty;
      }
      break;
    }
    default:
      property.type = "string";
  }

  return property;
}

/**
 * Generate OpenAI Tool Specifications from Zod schemas
 * @param options - Configuration options
 * @param options.methods - Method filter mode (default: "publicChatMethods")
 *   - "all": Include all methods
 *   - "publicChatMethods": Exclude internal and framework methods (default)
 *   - "popular": Only popular methods
 *   - "inference": Only AI/ML-powered methods
 *   - "framework": Only framework integration methods
 *   - "public": Only public methods (excludes internal)
 *   - "lightweight": Exclude memory-heavy methods
 *   - "cacheable": Only cacheable methods
 *   - "readonly": Only read-only methods
 * @returns OpenAI tool specification
 */
export function createOpenAiSpecs(options: CreateOpenAiSpecsOptions = {}): OpenAiSpecs {
  const { methods = "publicChatMethods" } = options;

  const functions: OpenAiFunction[] = [];
  const selectedSchemas = getMethodsByMode(methods as MethodMode);

  for (const [functionName, schema] of Object.entries(selectedSchemas)) {
    const spec = zodToOpenAiSpec(schema, functionName);
    functions.push(spec);
  }

  return {
    type: "function",
    functions,
  };
}

// Backward compatibility - export the default spec creation without parameters
// export const openAiSpecs = createOpenAiSpecs();
