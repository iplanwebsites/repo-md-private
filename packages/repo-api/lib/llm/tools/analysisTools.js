import { db } from '../../../db.js';
import GitFileService from '../../gitFileService.js';
import path from 'path';

export const analyzeCodeStructure = {
	name: 'analyze_code_structure',
	description: 'Analyze the structure and organization of the project codebase',
	parameters: {
		type: 'object',
		properties: {
			focus: {
				type: 'string',
				enum: ['all', 'frontend', 'backend', 'styles', 'config'],
				default: 'all',
				description: 'Area of codebase to focus analysis on'
			}
		}
	},
	async execute({ focus = 'all' }, context) {
		const { project, user } = context;
		
		if (!project) {
			throw new Error('No project context available');
		}
		
		const githubUser = await db.users.findOne({ _id: user._id });
		const githubToken = githubUser?.githubSupaToken;
		
		if (!githubToken) {
			throw new Error('GitHub authentication required');
		}
		
		const gitService = new GitFileService('github', githubToken);
		
		// Get repository tree
		const tree = await gitService.getRepositoryTree(
			project.githubRepo.owner,
			project.githubRepo.repoName,
			'main'
		);
		
		// Analyze structure
		const analysis = {
			totalFiles: 0,
			totalDirectories: 0,
			fileTypes: {},
			directories: {},
			largestFiles: [],
			possibleEntryPoints: [],
			configFiles: [],
			documentationFiles: []
		};
		
		// Process tree
		for (const item of tree) {
			if (item.type === 'blob') {
				analysis.totalFiles++;
				
				const ext = path.extname(item.path).toLowerCase();
				analysis.fileTypes[ext] = (analysis.fileTypes[ext] || 0) + 1;
				
				// Track large files
				if (item.size > 50000) {
					analysis.largestFiles.push({
						path: item.path,
						size: item.size,
						sizeKB: Math.round(item.size / 1024)
					});
				}
				
				// Identify entry points
				const basename = path.basename(item.path);
				if (['index.js', 'index.html', 'main.js', 'app.js', 'server.js'].includes(basename)) {
					analysis.possibleEntryPoints.push(item.path);
				}
				
				// Identify config files
				if (basename.match(/^(\.|)(config|settings|env)/i) || 
					['package.json', 'tsconfig.json', 'webpack.config.js'].includes(basename)) {
					analysis.configFiles.push(item.path);
				}
				
				// Identify documentation
				if (ext === '.md' || basename.match(/readme/i)) {
					analysis.documentationFiles.push(item.path);
				}
			} else if (item.type === 'tree') {
				analysis.totalDirectories++;
				const dirName = item.path.split('/')[0];
				analysis.directories[dirName] = (analysis.directories[dirName] || 0) + 1;
			}
		}
		
		// Sort results
		analysis.largestFiles.sort((a, b) => b.size - a.size);
		analysis.largestFiles = analysis.largestFiles.slice(0, 10);
		
		// Apply focus filter
		if (focus !== 'all') {
			const focusPatterns = {
				frontend: ['.js', '.jsx', '.ts', '.tsx', '.vue', '.html', '.css', '.scss'],
				backend: ['.js', '.ts', '.py', '.rb', '.go', '.java', '.php'],
				styles: ['.css', '.scss', '.sass', '.less', '.styl'],
				config: analysis.configFiles
			};
			
			if (focusPatterns[focus]) {
				if (focus === 'config') {
					return {
						focus,
						configFiles: analysis.configFiles,
						totalFiles: analysis.configFiles.length
					};
				} else {
					const relevantTypes = {};
					for (const ext of focusPatterns[focus]) {
						if (analysis.fileTypes[ext]) {
							relevantTypes[ext] = analysis.fileTypes[ext];
						}
					}
					analysis.fileTypes = relevantTypes;
				}
			}
		}
		
		return analysis;
	}
};

export const analyzeDependencies = {
	name: 'analyze_dependencies',
	description: 'Analyze project dependencies and package configuration',
	parameters: {
		type: 'object',
		properties: {
			checkOutdated: {
				type: 'boolean',
				default: false,
				description: 'Check for outdated dependencies'
			}
		}
	},
	async execute({ checkOutdated = false }, context) {
		const { project, user } = context;
		
		if (!project) {
			throw new Error('No project context available');
		}
		
		const githubUser = await db.users.findOne({ _id: user._id });
		const githubToken = githubUser?.githubSupaToken;
		
		if (!githubToken) {
			throw new Error('GitHub authentication required');
		}
		
		const gitService = new GitFileService('github', githubToken);
		
		try {
			// Get package.json
			const packageFile = await gitService.getFileContent(
				project.githubRepo.owner,
				project.githubRepo.repoName,
				'package.json',
				'main'
			);
			
			const packageData = JSON.parse(packageFile.content);
			
			const analysis = {
				name: packageData.name,
				version: packageData.version,
				description: packageData.description,
				scripts: Object.keys(packageData.scripts || {}),
				dependencies: {
					production: Object.keys(packageData.dependencies || {}).length,
					development: Object.keys(packageData.devDependencies || {}).length,
					total: 0
				},
				topDependencies: [],
				frameworks: [],
				buildTools: []
			};
			
			analysis.dependencies.total = analysis.dependencies.production + analysis.dependencies.development;
			
			// Identify key dependencies
			const allDeps = {
				...packageData.dependencies,
				...packageData.devDependencies
			};
			
			// Detect frameworks
			const frameworkPatterns = {
				'react': 'React',
				'vue': 'Vue.js',
				'angular': 'Angular',
				'express': 'Express.js',
				'next': 'Next.js',
				'nuxt': 'Nuxt.js',
				'gatsby': 'Gatsby',
				'svelte': 'Svelte'
			};
			
			for (const [pattern, name] of Object.entries(frameworkPatterns)) {
				if (Object.keys(allDeps).some(dep => dep.includes(pattern))) {
					analysis.frameworks.push(name);
				}
			}
			
			// Detect build tools
			const buildToolPatterns = {
				'webpack': 'Webpack',
				'vite': 'Vite',
				'rollup': 'Rollup',
				'parcel': 'Parcel',
				'esbuild': 'ESBuild',
				'typescript': 'TypeScript'
			};
			
			for (const [pattern, name] of Object.entries(buildToolPatterns)) {
				if (Object.keys(allDeps).some(dep => dep.includes(pattern))) {
					analysis.buildTools.push(name);
				}
			}
			
			// Get top 10 dependencies
			analysis.topDependencies = Object.entries(allDeps)
				.slice(0, 10)
				.map(([name, version]) => ({ name, version }));
			
			return analysis;
			
		} catch (error) {
			// Try other package managers
			const packageManagers = [
				{ file: 'composer.json', type: 'PHP/Composer' },
				{ file: 'requirements.txt', type: 'Python/pip' },
				{ file: 'Gemfile', type: 'Ruby/Bundler' },
				{ file: 'go.mod', type: 'Go Modules' },
				{ file: 'pom.xml', type: 'Java/Maven' }
			];
			
			for (const pm of packageManagers) {
				try {
					await gitService.getFileContent(
						project.githubRepo.owner,
						project.githubRepo.repoName,
						pm.file,
						'main'
					);
					
					return {
						packageManager: pm.type,
						configFile: pm.file,
						message: `Project uses ${pm.type}. Detailed analysis for this package manager is not yet implemented.`
					};
				} catch (e) {
					// Continue checking
				}
			}
			
			return {
				error: 'No package configuration file found',
				suggestion: 'This project might not use a standard package manager'
			};
		}
	}
};

export const generateSummary = {
	name: 'generate_project_summary',
	description: 'Generate a comprehensive summary of the project',
	parameters: {
		type: 'object',
		properties: {
			includeStats: {
				type: 'boolean',
				default: true,
				description: 'Include statistics in summary'
			}
		}
	},
	async execute({ includeStats = true }, context) {
		const { project } = context;
		
		if (!project) {
			throw new Error('No project context available');
		}
		
		const summary = {
			project: {
				name: project.name,
				description: project.description,
				repository: `${project.githubRepo.owner}/${project.githubRepo.repoName}`,
				visibility: project.githubRepo.visibility || 'public',
				lastUpdated: project.updatedAt
			}
		};
		
		// Add deployment info if available
		if (project.deploymentEnabled) {
			summary.deployment = {
				enabled: true,
				url: project.deploymentUrl,
				provider: project.deploymentProvider || 'GitHub Pages'
			};
		}
		
		// Add processed content info
		if (project.processedContent) {
			summary.content = {
				pages: project.processedContent.pages?.length || 0,
				lastProcessed: project.processedContent.lastProcessed,
				hasIndex: !!project.processedContent.indexPage
			};
		}
		
		// Add statistics if requested
		if (includeStats) {
			const recentDeploys = await db.deploys.find({
				projectId: project._id.toString()
			}).sort({ createdAt: -1 }).limit(5).toArray();
			
			summary.statistics = {
				totalDeploys: await db.deploys.countDocuments({
					projectId: project._id.toString()
				}),
				recentDeploys: recentDeploys.map(d => ({
					date: d.createdAt,
					status: d.status,
					trigger: d.metadata?.trigger
				}))
			};
		}
		
		return summary;
	}
};

export const allAnalysisTools = [analyzeCodeStructure, analyzeDependencies, generateSummary];

// Aliases for catalogue.js
export const findDependencies = analyzeDependencies;
export const detectPatterns = analyzeCodeStructure; // closest match
export const suggestImprovements = generateSummary; // closest match

export default allAnalysisTools;