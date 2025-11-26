import { validateFunctionParams, extractParamMetadata, type ParamMetadata } from './types.js';
import { schemas, type SchemaWithMeta } from './schemas.js';

// Cache for parameter metadata to avoid repeated schema introspection
const parameterMetadataCache = new Map<string, ParamMetadata[]>();

/**
 * Extract parameter metadata from schema using schema introspection
 * @param functionName - The name of the function
 * @returns Array of parameter metadata objects
 */
function getParameterMetadata(functionName: string): ParamMetadata[] {
  if (parameterMetadataCache.has(functionName)) {
    return parameterMetadataCache.get(functionName)!;
  }

  const schema = schemas[functionName];
  if (!schema) {
    return [];
  }

  const metadata = extractParamMetadata(schema);
  parameterMetadataCache.set(functionName, metadata);
  return metadata;
}

/**
 * Convert positional arguments to parameter object using schema-driven approach
 * @param functionName - The name of the function
 * @param args - The positional arguments
 * @returns Parameter object
 */
function convertArgsToParamsObject(functionName: string, args: unknown[]): Record<string, unknown> {
  const paramMetadata = getParameterMetadata(functionName);

  if (paramMetadata.length === 0) {
    // No schema metadata available, return first arg if it's an object, otherwise empty
    return (args.length === 1 && args[0] !== null && typeof args[0] === 'object')
      ? args[0] as Record<string, unknown>
      : {};
  }

  // If we have only one argument and it's an object, assume it's already a params object
  if (args.length === 1 && args[0] !== null && typeof args[0] === 'object') {
    return args[0] as Record<string, unknown>;
  }

  // Convert positional arguments to parameter object based on schema order
  const paramsObj: Record<string, unknown> = {};

  paramMetadata.forEach((param, index) => {
    if (index < args.length && args[index] !== undefined) {
      paramsObj[param.name] = args[index];
    } else if (param.default !== undefined) {
      paramsObj[param.name] = param.default;
    }
  });

  return paramsObj;
}

/**
 * Convert validated parameter object back to positional arguments
 * @param functionName - The name of the function
 * @param validatedData - The validated parameter object
 * @returns Array of positional arguments
 */
function convertParamsObjectToArgs(functionName: string, validatedData: Record<string, unknown>): unknown[] {
  const paramMetadata = getParameterMetadata(functionName);

  if (paramMetadata.length === 0) {
    // No schema metadata available, return the object as single argument
    return [validatedData];
  }

  // Convert parameter object to positional arguments based on schema order
  const args: unknown[] = [];

  paramMetadata.forEach((param) => {
    if (Object.prototype.hasOwnProperty.call(validatedData, param.name)) {
      args.push(validatedData[param.name]);
    } else if (param.default !== undefined) {
      args.push(param.default);
    }
  });

  return args;
}

/** Generic function type */
type AnyFunction = (...args: unknown[]) => unknown;

/**
 * Creates a validation wrapper for a RepoMD method
 * @param functionName - The name of the function to validate
 * @param originalMethod - The original method to wrap
 * @returns A wrapped function that validates parameters before calling the original method
 */
export function createValidatedFunction<T extends AnyFunction>(
  functionName: string,
  originalMethod: T
): T {
  // Check if we have a schema for this function
  const hasSchema = !!schemas[functionName];

  // If no schema exists, just return the original method without validation
  if (!hasSchema) {
    return originalMethod;
  }

  const wrappedFunction = function (this: unknown, ...args: unknown[]): unknown {
    // Convert positional arguments to parameter object using schema introspection
    const paramsObj = convertArgsToParamsObject(functionName, args);

    // Validate parameters using Zod schema
    const validation = validateFunctionParams(functionName, paramsObj);

    if (!validation.success) {
      throw new Error(`Parameter validation failed for ${String(functionName)}: ${validation.error}`);
    }

    // Convert validated parameter object back to positional arguments using schema introspection
    const validatedArgs = convertParamsObjectToArgs(functionName, validation.data);

    // Call the original method with validated arguments
    return originalMethod.apply(this, validatedArgs);
  };

  return wrappedFunction as T;
}

/** Instance with methods that can be validated */
interface ValidatableInstance {
  [key: string]: unknown;
}

/**
 * Applies validation wrappers to RepoMD methods
 * @param instance - The RepoMD instance to apply validation to
 * @param methodNames - Optional list of method names to validate
 */
export function applyValidation(instance: ValidatableInstance, methodNames?: string[]): void {
  const methods = methodNames || Object.keys(instance);

  for (const methodName of methods) {
    // Skip non-function properties and private methods
    if (typeof instance[methodName] !== 'function' || methodName.startsWith('_')) {
      continue;
    }

    // Skip constructor and known internal methods
    if (methodName === 'constructor' || methodName === 'destroy') {
      continue;
    }

    // Create a validated wrapper
    const originalMethod = instance[methodName] as AnyFunction;
    instance[methodName] = createValidatedFunction(methodName, originalMethod);
  }
}
