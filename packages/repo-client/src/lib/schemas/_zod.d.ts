// Module augmentation to add .meta() to Zod types
// This matches the runtime implementation in schemas.ts that adds these methods to ZodType.prototype

import "zod";

declare module "zod" {
  interface ZodType<Output = unknown, Def extends ZodTypeDef = ZodTypeDef, Input = Output> {
    meta<T extends Record<string, unknown>>(metadata: T): this;
    getMeta<T extends Record<string, unknown>>(): T | undefined;
  }
}
