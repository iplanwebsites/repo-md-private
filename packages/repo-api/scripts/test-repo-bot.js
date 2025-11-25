/**
 * Test script for @repo bot commands
 */

import { parseCommand } from '../lib/slack/commandParser.js';

// Assuming bot user ID is something like U123REPO
const BOT_USER_ID = 'U123REPO';

console.log('🤖 Testing @repo bot commands\n');
console.log('='*50 + '\n');

// Test commands that users would actually type
const testCommands = [
	// Basic commands
	'<@U123REPO> help',
	'<@U123REPO> ping',
	'<@U123REPO> fix the login bug',
	'<@U123REPO> implement dark mode',
	
	// With options
	'<@U123REPO> [repo=torvalds/linux] fix bug',
	'<@U123REPO> [branch=dev, model=o3] add user authentication',
	'<@U123REPO> branch=main repo=myorg/api fix the auth token validation',
	
	// Special commands
	'<@U123REPO> settings',
	'<@U123REPO> list my agents',
	'<@U123REPO> agent implement new feature',
	
	// Real-world examples
	'<@U123REPO> fix this',
	'<@U123REPO> [repo=myorg/frontend, branch=fix/login] update the regex to handle both old and new token formats',
	'<@U123REPO> also add backwards compatibility'
];

console.log('Command Parsing Results:');
console.log('-'*50);

testCommands.forEach((cmd, index) => {
	const parsed = parseCommand(cmd, BOT_USER_ID);
	
	// Simulate how it would appear in Slack
	const displayCmd = cmd.replace(`<@${BOT_USER_ID}>`, '@repo');
	
	console.log(`\n${index + 1}. User types: "${displayCmd}"`);
	console.log('   Parsed result:');
	console.log(`   - Type: ${parsed.type}`);
	console.log(`   - Prompt: ${parsed.prompt || '(none)'}`);
	if (Object.keys(parsed.options).length > 0) {
		console.log(`   - Options: ${JSON.stringify(parsed.options)}`);
	}
	if (parsed.forceNew !== undefined) {
		console.log(`   - Force new: ${parsed.forceNew}`);
	}
});

console.log('\n' + '='*50);
console.log('\n✅ Quick test in Slack:');
console.log('1. Go to any channel where @repo is installed');
console.log('2. Type: @repo help');
console.log('3. Type: @repo ping');
console.log('4. Type: @repo fix the login bug');
console.log('5. Wait 5 seconds for the mock completion');
console.log('\nThe bot should respond to each command!');