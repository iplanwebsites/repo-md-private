import { sentryVitePlugin } from "@sentry/vite-plugin";
import { URL, fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import Components from "unplugin-vue-components/vite";
import AutoImport from "unplugin-auto-import/vite";




const AUTO_IMPORT_OPTIONS = {
	// targets to transform
	include: [
		/\.[tj]sx?$/, // .ts, .tsx, .js, .jsx
		/\.vue$/,
		/\.vue\?vue/, // .vue
		/\.md$/, // .md
	],

	// global imports to register
	imports: [
		// presets
		"vue",
		"vue-router",
		// custom
		{
			"@vueuse/core": [
				// named imports
				"useMouse", // import { useMouse } from '@vueuse/core',
				// alias
				["useFetch", "useMyFetch"], // import { useFetch as useMyFetch } from '@vueuse/core',
			],
			axios: [
				// default imports
				["default", "axios"], // import { default as axios } from 'axios',
			],
			"[package-name]": [
				"[import-names]",
				// alias
				["[from]", "[alias]"],
			],
		},
		// example type import
		{
			from: "vue-router",
			imports: ["RouteLocationRaw"],
			type: true,
		},
	],

	// Array of strings of regexes that contains imports meant to be filtered out.
	ignore: ["useMouse", "useFetch"],

	// Enable auto import by filename for default module exports under directories
	defaultExportByFilename: false,

	// Options for scanning directories for auto import
	dirsScanOptions: {
		types: true, // Enable auto import the types under the directories
	},

	// Auto import for module exports under directories
	// by default it only scan one level of modules under the directory
	dirs: [
		"./hooks",
		"./composables", // only root modules
		"./composables/**", // all nested modules
		// ...

		{
			glob: "./hooks",
			types: true, // enable import the types
		},
		{
			glob: "./composables",
			types: false, // If top level dirsScanOptions.types importing enabled, just only disable this directory
		},
		// ...
	],

	// Filepath to generate corresponding .d.ts file.
	// Defaults to './auto-imports.d.ts' when `typescript` is installed locally.
	// Set `false` to disable.
	dts: "./auto-imports.d.ts",

	// Array of strings of regexes that contains imports meant to be ignored during
	// the declaration file generation. You may find this useful when you need to provide
	// a custom signature for a function.
	ignoreDts: ["ignoredFunction", /^ignore_/],

	// Auto import inside Vue template
	// see https://github.com/unjs/unimport/pull/15 and https://github.com/unjs/unimport/pull/72
	vueTemplate: false,

	// Auto import directives inside Vue template
	// see https://github.com/unjs/unimport/pull/374
	vueDirectives: undefined,

	// Custom resolvers, compatible with `unplugin-vue-components`
	// see https://github.com/antfu/unplugin-auto-import/pull/23/
	resolvers: [
		/* ... */
	],

	// Include auto-imported packages in Vite's `optimizeDeps` options
	// Recommend to enable
	viteOptimizeDeps: true,

	// Inject the imports at the end of other imports
	injectAtEnd: true,

	// Generate corresponding .eslintrc-auto-import.json file.
	// eslint globals Docs - https://eslint.org/docs/user-guide/configuring/language-options#specifying-globals
	eslintrc: {
		enabled: false, // Default `false`
		// provide path ending with `.mjs` or `.cjs` to generate the file with the respective format
		filepath: "./.eslintrc-auto-import.json", // Default `./.eslintrc-auto-import.json`
		globalsPropValue: true, // Default `true`, (true | false | 'readonly' | 'readable' | 'writable' | 'writeable')
	},

	// Generate corresponding .biomelintrc-auto-import.json file.
	// biomejs extends Docs - https://biomejs.dev/guides/how-biome-works/#the-extends-option
	biomelintrc: {
		enabled: false, // Default `false`
		filepath: "./.biomelintrc-auto-import.json", // Default `./.biomelintrc-auto-import.json`
	},

	// Save unimport items into a JSON file for other tools to consume
	dumpUnimportItems: "./auto-imports.json", // Default `false`
};

function getCurrentDir() {
	const url = new URL(".", import.meta.url);
	return fileURLToPath(url);
}

import packageJson from "./package.json";

export default defineConfig(async ({ command, mode }) => {
	// Only load proxy config in dev mode - not needed for production build
	let proxyConfig = {};
	if (command === 'serve') {
		try {
			const { viteRepoMdProxy } = await import("@repo-md/client");
			proxyConfig = {
				...viteRepoMdProxy({ projectId: '680e97604a0559a192640d2c', route: '_repo' }),
				...viteRepoMdProxy({ projectId: '680e97604a0559a192640d2c', route: '_repo_docs' }),
				...viteRepoMdProxy({ projectId: '680e97604a0559a192640d2c', route: '_repo_blog' }),
			};
		} catch (e) {
			console.warn('Could not load @repo-md/client proxy config:', e);
		}
	}

	return {
	define: {
		"import.meta.env.VITE_APP_VERSION": JSON.stringify(packageJson.version),
		"import.meta.env.VITE_APP_BUILD_DATE": JSON.stringify(
			new Date().toISOString(),
		),
	},

	esbuild: {
		//drop: ['console', 'debugger'], //working! drop ALL!
		pure: ["console.log", "console.debug", "console.trace"], // 'console.info',
		drop: ["debugger"],
		minifyWhitespace: true,
		minifySyntax: true,
		minifyIdentifiers: true,
		//	legalComments: "none", // Remove all comments including license comments
	},

	server: {
		headers: {
			'Cross-Origin-Embedder-Policy': 'require-corp',
			'Cross-Origin-Opener-Policy': 'same-origin',
		},
		proxy: {
			...proxyConfig,
/*
			
			"/_repo/medias": {
				target: "https://static.repo.md",
				changeOrigin: true,
				rewrite: (path) => {
					// Transform /_repo/medias/file.jpeg to /iplanwebsites/680e97604a0559a192640d2c/_shared/medias/file.jpeg
					return path.replace(
						"/_repo/medias",
						"/iplanwebsites/680e97604a0559a192640d2c/_shared/medias",
					);
				},
				configure: (proxy, options) => {
					// Keep the logging for debugging
					proxy.on("error", (err, req, res) => {
						console.log("Proxy error:", err);
					});
					proxy.on("proxyReq", (proxyReq, req, res) => {
						console.log("Proxy request:", req.url, "→", proxyReq.path);
					});
					proxy.on("proxyRes", (proxyRes, req, res) => {
						console.log("Proxy response:", proxyRes.statusCode, req.url);
					});
				},
			},
 


			"/_repo_blog/medias": {
				target: "https://static.repo.md",
				changeOrigin: true,
				rewrite: (path) => {
					// Transform /_repo/medias/file.jpeg to /iplanwebsites/680e97604a0559a192640d2c/_shared/medias/file.jpeg
					return path.replace(
						"/_repo/medias",
						"/iplanwebsites/680e97604a0559a192640d2c/_shared/medias",
					);
				},
				configure: (proxy, options) => {
					// Keep the logging for debugging
					proxy.on("error", (err, req, res) => {
						console.log("Proxy error:", err);
					});
					proxy.on("proxyReq", (proxyReq, req, res) => {
						console.log("Proxy request:", req.url, "→", proxyReq.path);
					});
					proxy.on("proxyRes", (proxyRes, req, res) => {
						console.log("Proxy response:", proxyRes.statusCode, req.url);
					});
				},
			},
			"/_repo_docs/medias": {
				target: "https://static.repo.md",
				changeOrigin: true,
				rewrite: (path) => {
					// Transform /_repo/medias/file.jpeg to /iplanwebsites/680e97604a0559a192640d2c/_shared/medias/file.jpeg
					return path.replace(
						"/_repo_docs/medias",
						"/iplanwebsites/680e97604a0559a192640d2c/_shared/medias",
					);
				},
				configure: (proxy, options) => {
					// Keep the logging for debugging
					proxy.on("error", (err, req, res) => {
						console.log("Proxy error:", err);
					});
					proxy.on("proxyReq", (proxyReq, req, res) => {
						console.log("Proxy request:", req.url, "→", proxyReq.path);
					});
					proxy.on("proxyRes", (proxyRes, req, res) => {
						console.log("Proxy response:", proxyRes.statusCode, req.url);
					});
				},
			},


			*/
		},
		logLevel: "info",
	},

	plugins: [
		//https://github.com/unplugin/unplugin-auto-import
		AutoImport(AUTO_IMPORT_OPTIONS),
		vue({
			template: {
				compilerOptions: {
					isCustomElement: (tag) => tag === "midi-player",
				},
			},
		}),
		Components({
			// Specify the components directory
			dirs: ["src/components"],
			// Allow deep search for components in subdirectories
			deep: true,
			// Use directory as namespace prefix for components
			directoryAsNamespace: false,
			// Specify the file extensions for components
			extensions: ["vue"],
			// Include these file types for auto-importing components
			include: [/\.vue$/, /\.vue\?vue/],
			// Generate a TypeScript declaration file
			dts: "src/components.d.ts",
		}),
		// Conditionally add Sentry plugin based on ENABLE_SENTRY env var
		...(process.env.ENABLE_SENTRY !== 'false' ? [sentryVitePlugin({
			org: "repomd",
			project: "repomd-app",
		})] : []),
	],

	resolve: {
		alias: {
			"@": resolve(getCurrentDir(), "./src"),
			// Resolve workspace package for Vercel builds where symlinks don't work
			"@repo-md/client": resolve(getCurrentDir(), "../repo-client/src/lib/index.js"),
		},
	},

	build: {
		sourcemap: true,
		minify: "esbuild",
	},
};
});
