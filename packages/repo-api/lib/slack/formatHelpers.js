/**
 * Slack message formatting helpers
 */

/**
 * Format JSON as a code block for Slack
 */
export function jsonBlock(data, title = null) {
	const jsonString = JSON.stringify(data, null, 2);
	const block = {
		type: "section",
		text: {
			type: "mrkdwn",
			text: title ? `*${title}*\n\`\`\`json\n${jsonString}\n\`\`\`` : `\`\`\`json\n${jsonString}\n\`\`\``
		}
	};
	return block;
}

/**
 * Format code block with syntax highlighting
 */
export function codeBlock(code, language = 'javascript', title = null) {
	const block = {
		type: "section",
		text: {
			type: "mrkdwn",
			text: title ? `*${title}*\n\`\`\`${language}\n${code}\n\`\`\`` : `\`\`\`${language}\n${code}\n\`\`\``
		}
	};
	return block;
}

/**
 * Create a formatted list
 */
export function bulletList(items, title = null) {
	const listText = items.map(item => `• ${item}`).join('\n');
	return {
		type: "section",
		text: {
			type: "mrkdwn",
			text: title ? `*${title}*\n${listText}` : listText
		}
	};
}

/**
 * Create a key-value table
 */
export function keyValueTable(data, title = null) {
	const rows = Object.entries(data).map(([key, value]) => {
		const formattedKey = key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' ');
		return `*${formattedKey}:* ${value}`;
	});
	
	return {
		type: "section",
		text: {
			type: "mrkdwn",
			text: title ? `*${title}*\n${rows.join('\n')}` : rows.join('\n')
		}
	};
}

/**
 * Format conversation summary as blocks
 */
export function conversationSummaryBlock(summary) {
	const blocks = [];
	
	// Summary header
	blocks.push({
		type: "section",
		text: {
			type: "mrkdwn",
			text: "📊 *Conversation Summary*"
		}
	});
	
	// Topics
	if (summary.topics && summary.topics.length > 0) {
		blocks.push({
			type: "section",
			text: {
				type: "mrkdwn",
				text: `*Topics discussed:* ${summary.topics.map(t => `\`${t}\``).join(', ')}`
			}
		});
	}
	
	// Stats
	blocks.push({
		type: "section",
		fields: [
			{
				type: "mrkdwn",
				text: `*Messages:* ${summary.messageStats.total}`
			},
			{
				type: "mrkdwn",
				text: `*Duration:* ${summary.duration}`
			},
			{
				type: "mrkdwn",
				text: `*User messages:* ${summary.messageStats.userMessages}`
			},
			{
				type: "mrkdwn",
				text: `*Bot responses:* ${summary.messageStats.botMessages}`
			}
		]
	});
	
	// Last topic
	blocks.push({
		type: "context",
		elements: [
			{
				type: "mrkdwn",
				text: `Last topic: ${summary.lastTopic}`
			}
		]
	});
	
	return blocks;
}

/**
 * Format error message
 */
export function errorBlock(error, context = null) {
	const blocks = [
		{
			type: "section",
			text: {
				type: "mrkdwn",
				text: "❌ *An error occurred*"
			}
		},
		{
			type: "section",
			text: {
				type: "mrkdwn",
				text: `\`\`\`\n${error.message || error}\n\`\`\``
			}
		}
	];
	
	if (context) {
		blocks.push({
			type: "context",
			elements: [
				{
					type: "mrkdwn",
					text: context
				}
			]
		});
	}
	
	return blocks;
}

/**
 * Create a divider block
 */
export function divider() {
	return { type: "divider" };
}

/**
 * Format recent conversation history
 */
export function conversationHistoryBlock(history, limit = 5) {
	const recentMessages = history.slice(-limit);
	const blocks = [];
	
	blocks.push({
		type: "section",
		text: {
			type: "mrkdwn",
			text: `📜 *Recent conversation (last ${recentMessages.length} messages)*`
		}
	});
	
	recentMessages.forEach((msg, index) => {
		const icon = msg.isBot ? '🤖' : '👤';
		const time = new Date(msg.timestamp).toLocaleTimeString();
		const username = msg.username || msg.user || 'Unknown';
		
		// Format message text, handling code blocks and long messages
		let text = msg.text;
		if (text.length > 150) {
			text = text.substring(0, 150) + '...';
		}
		// Escape any markdown that might break formatting
		text = text.replace(/[*_~`]/g, '\\$&');
		
		blocks.push({
			type: "section",
			text: {
				type: "mrkdwn",
				text: `${icon} *${username}* [${time}]\n${text}`
			}
		});
	});
	
	return blocks;
}

/**
 * Create action buttons
 */
export function actionButtons(buttons) {
	return {
		type: "actions",
		elements: buttons.map(btn => ({
			type: "button",
			text: {
				type: "plain_text",
				text: btn.text
			},
			value: btn.value,
			action_id: btn.actionId,
			...(btn.style && { style: btn.style }), // primary, danger
			...(btn.url && { url: btn.url })
		}))
	};
}

/**
 * Format bytes to human readable format
 */
export function formatBytes(bytes, decimals = 2) {
	if (bytes === 0) return '0 Bytes';
	
	const k = 1024;
	const dm = decimals < 0 ? 0 : decimals;
	const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
	
	const i = Math.floor(Math.log(bytes) / Math.log(k));
	
	return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}