/**
 * Parse Slack commands for Background Agents
 */

/**
 * Parse command and options from a Slack message
 * @param {string} text - The message text
 * @param {string} botUserId - The bot's user ID to remove from mentions
 * @returns {Object} Parsed command object
 */
export function parseCommand(text, botUserId) {
	// Remove bot mention
	const cleanText = text.replace(new RegExp(`<@${botUserId}>`, 'g'), '').trim();
	
	// Check for special commands first
	const lowerText = cleanText.toLowerCase();
	
	// Special commands that don't create agents
	if (lowerText === 'help') {
		return { type: 'help', prompt: null, options: {} };
	}
	
	if (lowerText === 'settings') {
		return { type: 'settings', prompt: null, options: {} };
	}
	
	if (lowerText === 'list my agents' || lowerText === 'list agents') {
		return { type: 'listAgents', prompt: null, options: {} };
	}
	
	if (lowerText === 'projects' || lowerText === 'list projects') {
		return { type: 'projects', prompt: null, options: {} };
	}
	
	// Check for deploy command
	const deployMatch = cleanText.match(/^deploy\s+(\S+)(\s+(.+))?/i);
	if (deployMatch) {
		return {
			type: 'deploy',
			projectSlug: deployMatch[1],
			branch: deployMatch[3] || 'main',
			prompt: null,
			options: {}
		};
	}
	
	// Check for task command
	const taskMatch = cleanText.match(/^task\s+(\S+)(\s+(.+))?/i);
	if (taskMatch) {
		return {
			type: 'task',
			taskType: taskMatch[1],
			taskParams: taskMatch[3] || '',
			prompt: null,
			options: {}
		};
	}
	
	// Check if forcing new agent
	const forceNewAgent = cleanText.match(/^agent\s+(.+)/i);
	if (forceNewAgent) {
		const remainingText = forceNewAgent[1];
		const parsed = parseOptionsAndPrompt(remainingText);
		return {
			type: 'newAgent',
			forceNew: true,
			...parsed
		};
	}
	
	// Regular command with options
	const parsed = parseOptionsAndPrompt(cleanText);
	return {
		type: 'agent',
		forceNew: false,
		...parsed
	};
}

/**
 * Parse options and prompt from text
 * @param {string} text - The text to parse
 * @returns {Object} Object with options and prompt
 */
function parseOptionsAndPrompt(text) {
	let options = {};
	let prompt = text;
	
	// Parse bracket format [key=value, key2=value2]
	const bracketMatch = text.match(/\[([^\]]+)\]/);
	if (bracketMatch) {
		const optionsStr = bracketMatch[1];
		options = parseBracketOptions(optionsStr);
		// Remove the bracket portion from prompt
		prompt = text.replace(bracketMatch[0], '').trim();
	}
	
	// Parse inline format key=value
	const inlineOptions = parseInlineOptions(prompt);
	if (Object.keys(inlineOptions).length > 0) {
		options = { ...options, ...inlineOptions };
		// Remove inline options from prompt
		prompt = removeInlineOptions(prompt);
	}
	
	// Validate and normalize options
	options = normalizeOptions(options);
	
	return { options, prompt: prompt.trim() };
}

/**
 * Parse options from bracket format
 * @param {string} optionsStr - Options string like "key=value, key2=value2"
 * @returns {Object} Parsed options
 */
function parseBracketOptions(optionsStr) {
	const options = {};
	const pairs = optionsStr.split(',');
	
	for (const pair of pairs) {
		const [key, value] = pair.split('=').map(s => s.trim());
		if (key && value) {
			options[key.toLowerCase()] = value;
		}
	}
	
	return options;
}

/**
 * Parse inline options from text
 * @param {string} text - Text containing inline options
 * @returns {Object} Parsed options
 */
function parseInlineOptions(text) {
	const options = {};
	const validKeys = ['branch', 'model', 'repo', 'autopr'];
	
	// Match pattern like branch=value or model=value
	const pattern = new RegExp(`\\b(${validKeys.join('|')})=(\\S+)`, 'gi');
	let match;
	
	while ((match = pattern.exec(text)) !== null) {
		const [, key, value] = match;
		options[key.toLowerCase()] = value;
	}
	
	return options;
}

/**
 * Remove inline options from prompt text
 * @param {string} text - Text containing inline options
 * @returns {string} Text with options removed
 */
function removeInlineOptions(text) {
	const validKeys = ['branch', 'model', 'repo', 'autopr'];
	const pattern = new RegExp(`\\b(${validKeys.join('|')})=\\S+`, 'gi');
	return text.replace(pattern, '').replace(/\s+/g, ' ').trim();
}

/**
 * Normalize and validate options
 * @param {Object} options - Raw options
 * @returns {Object} Normalized options
 */
function normalizeOptions(options) {
	const normalized = {};
	
	// Handle branch
	if (options.branch) {
		normalized.branch = options.branch;
	}
	
	// Handle model
	if (options.model) {
		normalized.model = options.model;
	}
	
	// Handle repo - normalize format
	if (options.repo) {
		normalized.repo = normalizeRepoFormat(options.repo);
	}
	
	// Handle autopr - convert to boolean
	if (options.autopr !== undefined) {
		normalized.autopr = options.autopr === 'true' || options.autopr === true;
	}
	
	return normalized;
}

/**
 * Normalize repository format
 * @param {string} repo - Repository in various formats
 * @returns {string} Normalized repo format (owner/repo)
 */
function normalizeRepoFormat(repo) {
	// Handle full GitHub URL
	const githubMatch = repo.match(/github\.com[/:]([^/]+)\/([^/\s]+)/);
	if (githubMatch) {
		return `${githubMatch[1]}/${githubMatch[2].replace(/\.git$/, '')}`;
	}
	
	// Already in owner/repo format
	if (repo.match(/^[^/]+\/[^/]+$/)) {
		return repo;
	}
	
	// Invalid format, return as-is
	return repo;
}

/**
 * Extract repository references from message text
 * @param {string} text - Message text
 * @returns {Array} Array of repository references found
 */
export function extractRepoReferences(text) {
	const repos = [];
	
	// Match GitHub URLs
	const githubPattern = /https?:\/\/github\.com\/([^/\s]+)\/([^/\s]+)/g;
	let match;
	while ((match = githubPattern.exec(text)) !== null) {
		repos.push(`${match[1]}/${match[2].replace(/\.git$/, '')}`);
	}
	
	// Match owner/repo format
	const repoPattern = /\b([a-zA-Z0-9-]+)\/([a-zA-Z0-9-_.]+)\b/g;
	while ((match = repoPattern.exec(text)) !== null) {
		// Avoid matching things like "and/or"
		if (!match[1].match(/^(and|or|if|then)$/i)) {
			repos.push(`${match[1]}/${match[2]}`);
		}
	}
	
	return [...new Set(repos)]; // Remove duplicates
}

/**
 * Determine if message is requesting a follow-up to existing agent
 * @param {string} text - Message text
 * @param {boolean} hasExistingAgent - Whether thread has existing agent
 * @returns {boolean} True if this is a follow-up request
 */
export function isFollowUpRequest(text, hasExistingAgent) {
	if (!hasExistingAgent) return false;
	
	// If explicitly using "agent" command, it's a new agent
	if (text.match(/^agent\s+/i)) return false;
	
	// Otherwise, additional instructions are follow-ups
	return true;
}