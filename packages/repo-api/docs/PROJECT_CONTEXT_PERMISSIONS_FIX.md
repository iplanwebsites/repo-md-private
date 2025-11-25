# Project Context Permissions Fix

## Issue
The project-specific tools (search_project_posts, get_project_stats, etc.) were failing with "Missing required permissions: read" error even though the user had the appropriate permissions.

## Root Cause
The `baseTool.js` validation was looking for permissions in `context.user.permissions`, but the EditorChatHandler was passing the user object directly without the permissions property attached.

## Solution
Modified the tool execution context in `editorChat.js` to include permissions within the user object:

```javascript
context: {
  sessionBranch: this.chat?.metadata?.sessionBranch,
  user: {
    ...this.user,
    permissions: this.getUserPermissions(),
  },
  org: this.org,
  project: this.project,
  permissions: this.getUserPermissions(),
  auth: true,
}
```

## Files Modified
- `/lib/llm/editorChat.js` - Updated tool execution context to include permissions in user object

## Testing
After the fix:
- Project tools now execute successfully
- Permission validation passes correctly
- Tools can access project data as expected

## Related Files
- `/lib/llm/tools/baseTool.js` - Contains the permission validation logic
- `/lib/llm/tools/projectTools.js` - Project-specific tools that require read permission