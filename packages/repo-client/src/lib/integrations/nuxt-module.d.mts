/**
 * Nuxt module configuration type definitions
 */

export interface NuxtRepoMdModuleOptions {
  projectId?: string;
  [key: string]: unknown;
}

export interface NuxtRepoMdModuleConfig {
  meta: {
    name: string;
    configKey: string;
  };
  defaults: {
    projectId: undefined;
  };
}

export interface NuxtModuleContext {
  options: {
    runtimeConfig: {
      public: {
        repoMd: NuxtRepoMdModuleOptions;
      };
    };
  };
}

export type NuxtModuleSetupFunction = (
  options: NuxtRepoMdModuleOptions,
  nuxt: NuxtModuleContext
) => void;

export const nuxtRepoMdModuleConfig: NuxtRepoMdModuleConfig;
export function createNuxtModuleSetup(): NuxtModuleSetupFunction;
export const nuxtModuleExample: string;

declare const _default: {
  install(): void;
};
export default _default;
