# Enabling Slack LLM Integration

The Slack LLM integration is now set up with an intelligent factory pattern that automatically determines whether to use the LLM-powered handler or the basic handler based on your organization's configuration.

## How It Works

The `messageHandlerFactory` automatically checks:
1. If your Slack workspace is connected to an organization
2. If there's a valid Slack installation with bot token
3. If LLM is enabled for your organization (default: enabled)

## Default Behavior

- **Workspaces without org connection**: Use basic handler (ping/pong, deploy commands work)
- **Workspaces with org but no valid installation**: Use basic handler
- **Properly configured workspaces**: Use LLM-integrated handler

## Enabling LLM for Your Workspace

1. **Ensure your Slack workspace is properly connected** to your organization:
   ```javascript
   // The org must have slackIntegration.teamId set
   {
     slackIntegration: {
       teamId: "T093WGZV3FW",
       teamName: "Your Workspace",
       installedAt: Date,
       installedBy: "U12345"
     }
   }
   ```

2. **Ensure you have a valid Slack installation**:
   ```javascript
   // In slackInstallations collection
   {
     teamId: "T093WGZV3FW",
     botToken: "xoxb-your-bot-token",
     orgId: ObjectId("your-org-id")
   }
   ```

3. **Optionally disable LLM** (it's enabled by default):
   ```javascript
   // In org settings
   {
     settings: {
       slackLLMEnabled: false // Set to false to disable
     }
   }
   ```

## Testing

1. **Ping command** (works regardless of LLM status):
   - `@bot ping` → Returns "pong"

2. **Deploy command** (works regardless of LLM status):
   - `@bot deploy project-name` → Triggers deployment

3. **LLM queries** (only with proper setup):
   - `@bot what's the weather?` → Processes through LLM
   - `@bot help me with this code` → AI-powered response

## Monitoring

The factory logs which handler is being used:
- `Using default handler for team T123 (no org found)`
- `Using default handler for team T123 (no valid installation)`
- `Using default handler for team T123 (LLM disabled)`
- `Creating integrated LLM handler for team T123`

## Benefits

1. **Graceful fallback**: If LLM isn't configured, basic commands still work
2. **Per-workspace control**: Each Slack workspace can have different settings
3. **Cached handlers**: Handlers are cached for performance
4. **Easy debugging**: Clear logs show which handler is being used

## Troubleshooting

If LLM isn't working:
1. Check logs for which handler is being used
2. Verify org has `slackIntegration.teamId`
3. Verify `slackInstallations` has valid bot token
4. Check if `settings.slackLLMEnabled` is not false
5. Ensure users have matching emails in both systems