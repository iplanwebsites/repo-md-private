/**
 * Slack response templates for different scenarios
 */

import {
  jsonBlock,
  codeBlock,
  conversationSummaryBlock,
  bulletList,
  keyValueTable,
  divider,
  conversationHistoryBlock,
  actionButtons,
  formatBytes,
} from "./formatHelpers.js";

export const templates = {
  // Simple ping response
  ping: (context) => ({
    text: `Pong! 🏓\n_This is message #${context.messageNumber} in this thread_`,
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: "Pong! 🏓",
        },
      },
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: `Message #${context.messageNumber} in thread • ${context.threadContext.messageCount} previous messages`,
          },
        ],
      },
    ],
  }),

  // Help response
  help: (context) => ({
    text: `Here's what I can help you with:\n• Project information\n• Deployment status\n• Recent activities\n• Team collaboration\n_This is message #${context.messageNumber} in this thread_`,
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: "Here's what I can help you with:",
        },
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: "• 📁 Project information\n• 🚀 Deployment status\n• 📊 Recent activities\n• 👥 Team collaboration",
        },
      },
      {
        type: "actions",
        elements: [
          {
            type: "button",
            text: {
              type: "plain_text",
              text: "List Projects",
            },
            value: "list_projects",
            action_id: "list_projects",
          },
          {
            type: "button",
            text: {
              type: "plain_text",
              text: "Recent Deployments",
            },
            value: "recent_deployments",
            action_id: "recent_deployments",
          },
        ],
      },
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: `Message #${context.messageNumber} in thread`,
          },
        ],
      },
    ],
  }),

  // Projects list with selection
  projectsList: (context) => {
    const blocks = [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*${context.org.name} Projects*`
        }
      }
    ];

    if (!context.projects || context.projects.length === 0) {
      blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: "_No projects found in this organization._"
        }
      });
    } else {
      // Add current default if set
      const currentDefault = context.channelSettings?.repository;
      if (currentDefault) {
        blocks.push({
          type: "section",
          text: {
            type: "mrkdwn",
            text: `Current default: *${currentDefault}*`
          }
        });
      }
      
      blocks.push(divider());
      
      // List projects with selection buttons
      context.projects.forEach((project, index) => {
        const repoName = project.githubRepo || `${context.org.handle}/${project.name}`;
        const isDefault = currentDefault === repoName;
        
        blocks.push({
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*${project.name}* ${isDefault ? '(current default)' : ''}\n${project.description || '_No description_'}\n🔗 \`${repoName}\``
          },
          accessory: {
            type: "button",
            text: {
              type: "plain_text",
              text: isDefault ? "Current Default" : "Set as Default"
            },
            value: JSON.stringify({ 
              projectId: project._id.toString(), 
              repoName,
              channelId: context.channelId 
            }),
            action_id: `set_default_project_${index}`,
            style: isDefault ? "primary" : undefined,
            confirm: !isDefault ? {
              title: {
                type: "plain_text",
                text: "Set Default Project"
              },
              text: {
                type: "mrkdwn",
                text: `Set *${project.name}* as the default project for this channel?`
              },
              confirm: {
                type: "plain_text",
                text: "Set Default"
              },
              deny: {
                type: "plain_text",
                text: "Cancel"
              }
            } : undefined
          }
        });
        
        if (index < context.projects.length - 1) {
          blocks.push({ type: "divider" });
        }
      });
      
      blocks.push(divider());
      blocks.push({
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: "💡 _Set a default project to use it automatically when creating agents_"
          }
        ]
      });
    }

    return {
      text: `${context.org.name} has ${context.projects?.length || 0} projects`,
      blocks
    };
  },

  // Projects info - list actual projects
  projects: (context) => {
    const blocks = [{
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*${context.org.name} Projects*`
      }
    }];
    
    if (!context.projects || context.projects.length === 0) {
      blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: "_No projects found in this organization._"
        }
      });
    } else {
      blocks.push(divider());
      
      // List up to 10 most recent projects
      const projectsToShow = context.projects.slice(0, 10);
      projectsToShow.forEach((project, index) => {
        const updatedDate = new Date(project.updatedAt).toLocaleDateString();
        blocks.push({
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*${project.name}*${project.description ? `\n${project.description}` : ''}\n_Last updated: ${updatedDate}_`
          },
          accessory: {
            type: "button",
            text: {
              type: "plain_text",
              text: "View Project"
            },
            url: `https://repo.md/${context.org.handle}/${project.name}`,
            action_id: `view_project_${index}`
          }
        });
      });
      
      if (context.projects.length > 10) {
        blocks.push({
          type: "context",
          elements: [{
            type: "mrkdwn",
            text: `_Showing 10 of ${context.projects.length} projects_`
          }]
        });
      }
    }
    
    // Add link to view all projects
    blocks.push(divider());
    blocks.push({
      type: "actions",
      elements: [{
        type: "button",
        text: {
          type: "plain_text",
          text: "View All Projects"
        },
        url: `https://repo.md/${context.org.handle}`,
        action_id: "view_all_projects"
      }]
    });
    
    return {
      text: `${context.org.name} has ${context.projects?.length || 0} projects`,
      blocks
    };
  },

  // Old projects template kept for backward compatibility
  projectsOld: (context) => ({
    text: `To see your projects, use the \`/projects\` command, or ask me about a specific project!\n_This is message #${context.messageNumber} in this thread_`,
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: "To see your projects, use the `/projects` command, or ask me about a specific project!",
        },
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: "💡 *Pro tip:* You can also mention a project name and I'll give you its details.",
        },
      },
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: `Message #${context.messageNumber} in thread`,
          },
        ],
      },
    ],
  }),

  // Welcome/default response
  welcome: (context) => ({
    text: `Hi ${context.userName}! I'm here to help with your Repo.md projects. You can:\n• Use \`/projects\` to list all projects\n• Ask me about deployments and project status\n• Get help with any issues\n_This is message #${context.messageNumber} in this thread_`,
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `Hi ${context.userName}! I'm here to help with your Repo.md projects.`,
        },
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: "You can:\n• Use `/projects` to list all projects\n• Ask me about deployments and project status\n• Get help with any issues",
        },
      },
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: `Message #${context.messageNumber} in thread • ${context.threadContext.messageCount} previous messages`,
          },
        ],
      },
    ],
  }),

  // Ongoing conversation response
  continuation: (context) => {
    const blocks = [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: "I received your message! How can I help you further?",
        },
      },
      divider(),
    ];

    // Add conversation summary
    blocks.push(...conversationSummaryBlock(context.threadContext.summary));

    // Add recent history if conversation is long
    if (context.threadContext.messageCount > 5) {
      blocks.push(divider());
      blocks.push(
        ...conversationHistoryBlock(context.threadContext.history, 3)
      );
    }

    blocks.push({
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: `Message #${context.messageNumber} in thread`,
        },
      ],
    });

    return {
      text: `I received your message! How can I help you further?\n_This is message #${context.messageNumber} in this thread_`,
      blocks,
    };
  },

  // Deployment status response
  deploymentStatus: (context) => ({
    text: `Here's the latest deployment information:\n_This is message #${context.messageNumber} in this thread_`,
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: "🚀 *Recent Deployments:*",
        },
      },
      // This would be populated with actual deployment data
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: context.deployments || "_No recent deployments found_",
        },
      },
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: `Message #${context.messageNumber} in thread`,
          },
        ],
      },
    ],
  }),

  // Error response
  error: (context) => ({
    text: `Sorry, I encountered an error: ${context.error}\n_This is message #${context.messageNumber} in this thread_`,
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: "❌ Sorry, I encountered an error while processing your request.",
        },
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `Error details: \`${context.error}\``,
        },
      },
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: `Message #${context.messageNumber} in thread • Please try again or contact support`,
          },
        ],
      },
    ],
  }),

  // Implementation task response
  implementationTask: (context) => {
    // Analyze the conversation for technical details
    const messages = context.threadContext.history;
    const technicalDetails = [];

    // Extract technical information from the conversation
    messages.forEach((msg) => {
      if (msg.text.match(/line \d+/i)) {
        technicalDetails.push(
          `Line reference: ${msg.text.match(/line \d+/i)[0]}`
        );
      }
      if (msg.text.match(/\w+\.(js|ts|jsx|tsx|py|java|rb)/i)) {
        technicalDetails.push(
          `File mentioned: ${
            msg.text.match(/\w+\.(js|ts|jsx|tsx|py|java|rb)/i)[0]
          }`
        );
      }
      if (msg.text.match(/(error|bug|issue|problem)\s*[:.-]?\s*(.+)/i)) {
        const match = msg.text.match(
          /(error|bug|issue|problem)\s*[:.-]?\s*(.+)/i
        );
        technicalDetails.push(`${match[1]}: ${match[2].substring(0, 50)}...`);
      }
    });

    const blocks = [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: "🔧 *I understand the context and can help implement a solution*",
        },
      },
    ];

    if (technicalDetails.length > 0) {
      blocks.push(bulletList(technicalDetails, "Technical details identified"));
    }

    blocks.push(divider());
    blocks.push(...conversationSummaryBlock(context.threadContext.summary));

    if (context.threadContext.messageCount > 3) {
      blocks.push(divider());
      blocks.push(
        ...conversationHistoryBlock(context.threadContext.history, 5)
      );
    }

    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: "*Next steps:* Please provide access to the repository or share the relevant code files so I can implement the fix based on the discussion above.",
      },
    });

    blocks.push({
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: `Message #${context.messageNumber} • Analyzed ${context.threadContext.messageCount} messages for context`,
        },
      ],
    });

    return {
      text: `I understand the context from the ${context.threadContext.messageCount} messages above. I can help implement a solution. Please provide repository access or code files.\n_This is message #${context.messageNumber} in this thread_`,
      blocks,
    };
  },

  // Agent started response
  agentStarted: (context) => {
    const blocks = [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: "⏳ *Creating Background Agent...*"
        }
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `📡 Request ID: \`${context.agent.requestId}\`\n🔧 Command: \`${context.agent.command}\``
        }
      }
    ];

    if (Object.keys(context.agent.options).length > 0) {
      blocks.push(keyValueTable(context.agent.options, "Options"));
    }

    blocks.push(divider());
    blocks.push({
      type: "actions",
      elements: [
        {
          type: "button",
          text: {
            type: "plain_text",
            text: "Open in Repo.md"
          },
          url: `https://repo.md/${context.org.handle}/agent/${context.agent.requestId}`,
          action_id: "open_agent"
        }
      ]
    });

    blocks.push({
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: `Agent created by ${context.userName} • ${context.threadContext.fetchedFromSlack ? 'Using full thread context' : 'Using available context'}`
        }
      ]
    });

    return {
      text: `⏳ Creating Background Agent...\nRequest ID: ${context.agent.requestId}`,
      blocks
    };
  },

  // Agent completed response
  agentCompleted: (context) => {
    const blocks = [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: "✅ *Background Agent completed successfully!*"
        }
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: context.agent.completionMessage || "The requested changes have been implemented."
        }
      },
      divider(),
      {
        type: "actions",
        elements: [
          {
            type: "button",
            text: {
              type: "plain_text",
              text: "View PR"
            },
            style: "primary",
            url: context.agent.prUrl,
            action_id: "view_pr"
          },
          {
            type: "button",
            text: {
              type: "plain_text",
              text: "View in Repo.md"
            },
            url: `https://repo.md/${context.org.handle}/agent/${context.agent.requestId}`,
            action_id: "view_agent"
          }
        ]
      },
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: `Request ID: \`${context.agent.requestId}\` • Completed in ${context.duration}`
          }
        ]
      }
    ];

    return {
      text: `✅ Background Agent completed! PR: ${context.agent.prUrl}`,
      blocks
    };
  },

  // Agent failed response
  agentFailed: (context) => ({
    text: `❌ Background Agent failed: ${context.agent.error}\nRequest ID: ${context.agent.requestId}`,
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: "❌ *Background Agent failed*"
        }
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `Error: \`${context.agent.error || 'Unknown error'}\``
        }
      },
      divider(),
      {
        type: "actions",
        elements: [
          {
            type: "button",
            text: {
              type: "plain_text",
              text: "View Details"
            },
            url: `https://repo.md/${context.org.handle}/agent/${context.agent.requestId}`,
            action_id: "view_failed_agent"
          },
          {
            type: "button",
            text: {
              type: "plain_text",
              text: "Retry"
            },
            value: context.agent.requestId,
            action_id: "retry_agent"
          }
        ]
      },
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: `Request ID: \`${context.agent.requestId}\``
          }
        ]
      }
    ]
  }),

  // List agents response
  listAgents: (context) => {
    const blocks = [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Your active Background Agents* (${context.agents.length})`
        }
      }
    ];

    if (context.agents.length === 0) {
      blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: "_You don't have any active agents running._"
        }
      });
    } else {
      blocks.push(divider());
      
      for (const agent of context.agents) {
        const statusEmoji = {
          pending: '⏳',
          running: '🚀',
          completed: '✅',
          failed: '❌'
        }[agent.status] || '❓';

        blocks.push({
          type: "section",
          text: {
            type: "mrkdwn",
            text: `${statusEmoji} *${agent.command}*\n📍 Channel: <#${agent.channelId}>\n🕑 Started: ${new Date(agent.createdAt).toLocaleString()}`
          },
          accessory: {
            type: "button",
            text: {
              type: "plain_text",
              text: "View"
            },
            url: `https://repo.md/${context.org.handle}/agent/${agent.requestId}`,
            action_id: `view_agent_${agent._id}`
          }
        });
      }
    }

    return {
      text: `You have ${context.agents.length} active agents`,
      blocks
    };
  },

  // Settings response
  settingsCommand: (context) => ({
    text: "Opening channel settings...",
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: "⚙️ *Channel Settings*"
        }
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: "Configure default settings for Background Agents in this channel."
        }
      },
      keyValueTable(context.currentSettings, "Current Settings"),
      divider(),
      {
        type: "actions",
        elements: [
          {
            type: "button",
            text: {
              type: "plain_text",
              text: "Open Settings"
            },
            value: JSON.stringify({ channelId: context.channelId }),
            action_id: "open_settings_modal"
          }
        ]
      }
    ]
  }),

  // Help command for agents
  agentHelp: (context) => ({
    text: "Here's how to use Background Agents:",
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: "*🤖 Background Agents Help*"
        }
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: "*Basic Commands:*\n• `@bot [prompt]` - Start a Background Agent\n• `@bot deploy [projectslug]` - Deploy a project (e.g. `@bot deploy au5`)\n• `@bot task demo` - Run a demo task to test notifications\n• `@bot projects` - List available projects\n• `@bot settings` - Configure channel defaults\n• `@bot list my agents` - Show your running agents\n• `@bot agent [prompt]` - Force create a new agent in thread\n• `@bot help` - Show this help message"
        }
      },
      divider(),
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: "*Options:*\n• `branch` - Specify the base branch\n• `model` - Choose the AI model\n• `repo` - Target a specific repository\n• `autopr` - Enable/disable automatic PR creation"
        }
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: "*Examples:*\n• `@bot fix the login bug`\n• `@bot deploy myproject` - Deploy project 'myproject' to production\n• `@bot deploy myproject staging` - Deploy to staging branch\n• `@bot [repo=owner/repo] implement dark mode`\n• `@bot branch=dev model=o3 add user authentication`"
        }
      },
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: "Background Agents use thread context to understand your discussion"
          }
        ]
      }
    ]
  }),

  // Follow-up added response
  followUpAdded: (context) => ({
    text: "Follow-up instructions added to agent",
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: "📝 *Follow-up instructions added*"
        }
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `Your additional instructions have been sent to the running agent.\n\n📡 Request ID: \`${context.agent.requestId}\``
        }
      },
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: `Agent owned by ${context.agent.userName} • Status: ${context.agent.status}`
          }
        ]
      }
    ]
  }),

  // Deployment notification
  deploymentNotification: (context) => {
    const { deployment, project, org, duration, stats } = context;
    const status = deployment.status || 'completed';
    const statusEmoji = status === 'completed' ? '✅' : status === 'failed' ? '❌' : status === 'started' ? '🚀' : '⏳';
    const statusText = status === 'completed' ? 'Deployment Successful' : 
                       status === 'failed' ? 'Deployment Failed' : 
                       status === 'started' ? 'Deployment Started' : 
                       'Deployment In Progress';
    
    const blocks = [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `${statusEmoji} *${statusText}*`
        }
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Project:* ${project.name}\n*Repository:* \`${project.repoUrl || project.githubRepo || 'N/A'}\`\n*Branch:* \`${deployment.branch || 'main'}\`${deployment.commitMessage ? `\n*Commit:* ${deployment.commitMessage.substring(0, 50)}${deployment.commitMessage.length > 50 ? '...' : ''}` : ''}`
        },
        accessory: {
          type: "button",
          text: {
            type: "plain_text",
            text: "View Project"
          },
          url: `https://repo.md/${org.handle}/${project.name}`,
          action_id: "view_project"
        }
      }
    ];
    
    // Show progress indicator only for started status
    if (status === 'started') {
      blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: "🔄 _Deployment in progress... This message will update when complete._"
        }
      });
    }
    
    // Add deployment stats
    if (stats) {
      blocks.push(divider());
      blocks.push({
        type: "section",
        fields: [
          {
            type: "mrkdwn",
            text: `*Duration:* ${duration || 'N/A'}`
          },
          {
            type: "mrkdwn",
            text: `*Pages:* ${stats.pageCount || 0}`
          },
          {
            type: "mrkdwn",
            text: `*Total Size:* ${stats.totalSize ? formatBytes(stats.totalSize) : 'N/A'}`
          },
          {
            type: "mrkdwn",
            text: `*Files:* ${stats.fileCount || 0}`
          }
        ]
      });
    }
    
    // Add links
    blocks.push(divider());
    blocks.push({
      type: "actions",
      elements: [
        {
          type: "button",
          text: {
            type: "plain_text",
            text: "View Live Site"
          },
          style: "primary",
          url: `https://repo.md/${org.handle}/${project.name}`,
          action_id: "view_live_site"
        },
        {
          type: "button",
          text: {
            type: "plain_text",
            text: "View in Repo.md"
          },
          url: `https://repo.md/${org.handle}/${project.name}`,
          action_id: "view_in_repomd"
        }
      ]
    });
    
    // Add context
    blocks.push({
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: `Deployment ID: \`${deployment._id}\` • ${new Date(deployment.createdAt).toLocaleString()}`
        }
      ]
    });
    
    // Add error details if failed
    if (status === 'failed' && deployment.error) {
      blocks.push(divider());
      blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Error Details:*\n\`\`\`\n${deployment.error}\n\`\`\``
        }
      });
    }
    
    return {
      text: `${statusEmoji} ${statusText} for ${project.name}`,
      blocks
    };
  },

  // Debug/status response with JSON
  debug: (context) => {
    const blocks = [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: "🔍 *Debug Information*",
        },
      },
      divider(),
      jsonBlock(
        {
          threadId: context.threadContext.firstMessage?.threadTs,
          messageCount: context.threadContext.messageCount,
          topics: context.threadContext.summary.topics,
          duration: context.threadContext.summary.duration,
          lastTopic: context.threadContext.summary.lastTopic,
        },
        "Conversation Context"
      ),
      divider(),
      keyValueTable(
        {
          organization: context.org?.name || "Unknown",
          user: context.userName,
          messageNumber: context.messageNumber,
          timestamp: new Date().toISOString(),
        },
        "Current State"
      ),
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: `Message #${context.messageNumber} in thread`,
          },
        ],
      },
    ];

    return {
      text: `Debug information\n_This is message #${context.messageNumber} in this thread_`,
      blocks,
    };
  },

  // Task notification
  taskNotification: (context) => {
    const { task, project, org, duration, result } = context;
    const status = task.status || 'completed';
    const statusEmoji = status === 'completed' ? '✅' : status === 'failed' ? '❌' : status === 'started' ? '🚀' : '⏳';
    const statusText = status === 'completed' ? 'Task Completed' : 
                       status === 'failed' ? 'Task Failed' : 
                       status === 'started' ? 'Task Started' : 
                       'Task In Progress';
    
    const blocks = [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `${statusEmoji} *${statusText}*`
        }
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Task:* ${task.description || task.taskType}\n*Type:* \`${task.taskType}\`${project ? `\n*Project:* ${project.name}` : ''}${task.jobId ? `\n*Job ID:* \`${task.jobId}\`` : ''}`
        }
      }
    ];
    
    // Show progress indicator only for started status
    if (status === 'started') {
      blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: "🔄 _Task in progress... This message will update when complete._"
        }
      });
    }
    
    // Add task result or error
    if (status === 'completed' && result) {
      blocks.push(divider());
      blocks.push({
        type: "section",
        fields: [
          {
            type: "mrkdwn",
            text: `*Duration:* ${duration || 'N/A'}`
          },
          {
            type: "mrkdwn",
            text: `*Status:* Success`
          }
        ]
      });
      
      if (result.message) {
        blocks.push({
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*Result:* ${result.message}`
          }
        });
      }
    } else if (status === 'failed' && result?.error) {
      blocks.push(divider());
      blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Error:* ${result.error}`
        }
      });
    }
    
    // Add context
    blocks.push({
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: `Task ID: \`${task._id}\` • ${new Date(task.createdAt).toLocaleString()}`
        }
      ]
    });
    
    return { text: statusText, blocks };
  },
};

/**
 * Get response template by key
 */
export function getTemplate(templateKey, context) {
  const template = templates[templateKey];
  if (!template) {
    console.warn(`Template '${templateKey}' not found, using default`);
    return templates.welcome(context);
  }
  return template(context);
}

/**
 * Determine which template to use based on message content
 */
export function selectTemplate(messageText, threadContext) {
  const lowerText = messageText.toLowerCase();

  // Check for specific keywords
  if (lowerText.includes("ping")) return "ping";
  if (lowerText === "help") return "agentHelp"; // Agent-specific help
  if (lowerText.includes("help") && !lowerText.includes("@")) return "help"; // General help
  if (lowerText === "projects" || lowerText === "list projects") return "projectsList"; // Show projects list
  if (lowerText.includes("project") && !lowerText.includes("list")) return "projects"; // General project info
  if (lowerText.includes("deploy")) return "deploymentStatus";
  if (lowerText.includes("debug") || lowerText.includes("status"))
    return "debug";

  // Check for action words that suggest implementation tasks
  if (
    lowerText.match(
      /\b(fix|implement|update|change|modify|create|add|remove)\b/
    )
  ) {
    // If we have substantial context, use implementation template
    if (threadContext.messageCount > 2) {
      return "implementationTask";
    }
    return "continuation";
  }

  // For ongoing conversations
  if (threadContext.messageCount > 0) return "continuation";

  // Default welcome message
  return "welcome";
}
