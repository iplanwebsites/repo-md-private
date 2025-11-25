import { db } from '../../../db.js';
import GitFileService from '../../gitFileService.js';

export const searchProjectFiles = {
	name: 'search_project_files',
	description: 'Search for files and content within the current project repository',
	parameters: {
		type: 'object',
		properties: {
			query: {
				type: 'string',
				description: 'Search query to find in file names or content'
			},
			fileTypes: {
				type: 'array',
				items: { type: 'string' },
				description: 'File extensions to filter by (e.g., ["js", "md"])'
			},
			maxResults: {
				type: 'integer',
				default: 20,
				description: 'Maximum number of results to return'
			}
		},
		required: ['query']
	},
	async execute({ query, fileTypes = [], maxResults = 20 }, context) {
		const { project, user } = context;
		
		if (!project) {
			throw new Error('No project context available');
		}
		
		// Get GitHub token
		const githubUser = await db.users.findOne({ _id: user._id });
		const githubToken = githubUser?.githubSupaToken;
		
		if (!githubToken) {
			throw new Error('GitHub authentication required');
		}
		
		const gitService = new GitFileService('github', githubToken);
		
		// Search in repository
		const searchResults = await gitService.searchRepository(
			project.githubRepo.owner,
			project.githubRepo.repoName,
			query,
			{
				extensions: fileTypes,
				limit: maxResults
			}
		);
		
		return {
			results: searchResults,
			total: searchResults.length,
			query,
			project: project.name
		};
	}
};

export const searchDocumentation = {
	name: 'search_documentation',
	description: 'Search through project documentation and README files',
	parameters: {
		type: 'object',
		properties: {
			query: {
				type: 'string',
				description: 'Search query'
			}
		},
		required: ['query']
	},
	async execute({ query }, context) {
		const { project } = context;
		
		if (!project) {
			return { results: [], message: 'No project context' };
		}
		
		// Search in processed content if available
		if (project.processedContent?.pages) {
			const results = [];
			
			for (const page of project.processedContent.pages) {
				if (page.content?.toLowerCase().includes(query.toLowerCase()) ||
					page.title?.toLowerCase().includes(query.toLowerCase())) {
					results.push({
						title: page.title,
						path: page.path,
						excerpt: page.content.substring(0, 200) + '...',
						score: page.title?.toLowerCase().includes(query.toLowerCase()) ? 2 : 1
					});
				}
			}
			
			// Sort by relevance
			results.sort((a, b) => b.score - a.score);
			
			return {
				results: results.slice(0, 10),
				total: results.length,
				query
			};
		}
		
		return { results: [], message: 'No processed content available' };
	}
};

// Placeholder for semantic search (not yet implemented)
export const semanticSearch = null;

export const allSearchTools = [searchProjectFiles, searchDocumentation];
export default allSearchTools;