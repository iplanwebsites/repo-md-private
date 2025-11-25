<script setup>
import { ref } from "vue";
import { 
  Info, 
  Code, 
  Lock, 
  Zap,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Terminal,
  FileJson
} from "lucide-vue-next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import CodeBlock from "@/components/CodeBlock.vue";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";

// Example webhook payloads
const webhookExamples = ref({
  curlCommand: `curl -X POST https://api.repo.md/webhooks/{projectId}/command \\
  -H 'Authorization: Bearer YOUR_API_KEY' \\
  -H 'Content-Type: application/json' \\
  -d '{"command": "Your command here"}'`,

  jsSignature: `const crypto = require('crypto');

function verifyWebhookSignature(payload, signature, secret) {
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(JSON.stringify(payload));
  const expectedSignature = 'sha256=' + hmac.digest('hex');
  
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}`,

  apiKeyPayload: `{
  "api_key": "YOUR_API_KEY",
  "command": "Create a new blog post",
  "context": {
    "source": "external-service"
  }
}`,

  successResponse: `{
  "success": true,
  "command_id": "cmd_1234567890",
  "status": "completed",
  "result": {
    "action": "content_created",
    "details": {
      "file": "blog/2024-01-15-new-post.md",
      "url": "https://example.repo.md/blog/new-post"
    }
  },
  "execution_time": 1234
}`,

  errorResponse: `{
  "success": false,
  "error": {
    "code": "PERMISSION_DENIED",
    "message": "Insufficient permissions to delete content",
    "details": {
      "required_permission": "content_management.delete_content",
      "current_permissions": ["content_management.create_content"]
    }
  }
}`,
  createContent: `{
  "command": "Create a blog post about the benefits of static site generators",
  "context": {
    "source": "api",
    "user": "automation@company.com",
    "priority": "normal"
  },
  "options": {
    "publish": true,
    "tags": ["technology", "web development"],
    "author": "Tech Team"
  }
}`,

  updateContent: `{
  "command": "Update the documentation page for API endpoints",
  "context": {
    "source": "github-action",
    "ref": "docs/api-endpoints.md"
  },
  "options": {
    "section": "Authentication",
    "content": "Add OAuth 2.0 flow documentation"
  }
}`,

  mediaOperations: `{
  "command": "Generate a hero image for the latest blog post",
  "context": {
    "source": "cms",
    "postId": "2024-01-best-practices"
  },
  "options": {
    "style": "modern, minimalist",
    "dimensions": "1200x630",
    "format": "webp"
  }
}`,

  buildTrigger: `{
  "command": "Deploy preview for pull request #123",
  "context": {
    "source": "github",
    "pr": 123,
    "branch": "feature/new-design"
  },
  "options": {
    "environment": "preview",
    "notify": ["dev-team@company.com"]
  }
}`,

  analytics: `{
  "command": "Generate monthly analytics report",
  "context": {
    "source": "scheduler",
    "month": "2024-01"
  },
  "options": {
    "format": "markdown",
    "metrics": ["pageviews", "unique_visitors", "top_pages"],
    "save_to": "reports/2024-01-analytics.md"
  }
}`,

  aiAgent: `{
  "command": "Analyze user feedback and create improvement suggestions",
  "context": {
    "source": "feedback-system",
    "period": "last-7-days"
  },
  "options": {
    "categories": ["ui", "performance", "features"],
    "output": "issues",
    "assignee": "@product-team"
  }
}`
});

// Security best practices
const securityPractices = ref([
  {
    title: "Use webhook secrets",
    description: "Always configure a secret key to verify webhook authenticity",
    example: "HMAC-SHA256 signature validation"
  },
  {
    title: "Validate payloads",
    description: "Check payload structure and content before processing",
    example: "Schema validation with Zod or JSON Schema"
  },
  {
    title: "Rate limiting",
    description: "Implement rate limits to prevent abuse",
    example: "100 requests per minute per IP"
  },
  {
    title: "Audit logging",
    description: "Log all webhook activities for security monitoring",
    example: "Track who triggered what action and when"
  },
  {
    title: "IP whitelisting",
    description: "Restrict webhook access to known IP addresses when possible",
    example: "GitHub Actions IPs, company VPN ranges"
  },
  {
    title: "Timeout handling",
    description: "Set reasonable timeouts to prevent long-running operations",
    example: "30-second timeout for command processing"
  }
]);

// Response codes
const responseCodes = ref([
  { code: "200", status: "Success", description: "Command executed successfully" },
  { code: "202", status: "Accepted", description: "Command queued for processing" },
  { code: "400", status: "Bad Request", description: "Invalid payload or missing required fields" },
  { code: "401", status: "Unauthorized", description: "Invalid or missing authentication" },
  { code: "403", status: "Forbidden", description: "Insufficient permissions for requested action" },
  { code: "429", status: "Rate Limited", description: "Too many requests" },
  { code: "500", status: "Server Error", description: "Internal error processing webhook" }
]);
</script>

<template>
  <div class="space-y-6">
    <!-- Overview -->
    <Alert>
      <Info class="h-4 w-4" />
      <AlertTitle>Webhook Command API</AlertTitle>
      <AlertDescription>
        The webhook command API allows external services to trigger actions in your project using natural language commands.
        Commands are processed by AI agents that respect your configured permissions.
      </AlertDescription>
    </Alert>

    <!-- API Documentation Tabs -->
    <Tabs defaultValue="examples" class="w-full">
      <TabsList class="grid w-full grid-cols-4">
        <TabsTrigger value="examples">Examples</TabsTrigger>
        <TabsTrigger value="authentication">Authentication</TabsTrigger>
        <TabsTrigger value="responses">Responses</TabsTrigger>
        <TabsTrigger value="security">Security</TabsTrigger>
      </TabsList>

      <!-- Examples Tab -->
      <TabsContent value="examples" class="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Command Examples</CardTitle>
            <CardDescription>
              Common webhook commands organized by capability
            </CardDescription>
          </CardHeader>
          <CardContent class="space-y-4">
            <!-- Create Content -->
            <div class="space-y-2">
              <div class="flex items-center gap-2">
                <Badge variant="default">Content Management</Badge>
                <span class="text-sm font-medium">Create Content</span>
              </div>
              <CodeBlock 
                :code="webhookExamples.createContent"
                language="json"
              />
            </div>

            <!-- Update Content -->
            <div class="space-y-2">
              <div class="flex items-center gap-2">
                <Badge variant="default">Content Management</Badge>
                <span class="text-sm font-medium">Update Content</span>
              </div>
              <CodeBlock 
                :code="webhookExamples.updateContent"
                language="json"
              />
            </div>

            <!-- Media Operations -->
            <div class="space-y-2">
              <div class="flex items-center gap-2">
                <Badge variant="secondary">Media Management</Badge>
                <span class="text-sm font-medium">Generate Image</span>
              </div>
              <CodeBlock 
                :code="webhookExamples.mediaOperations"
                language="json"
              />
            </div>

            <!-- Build Trigger -->
            <div class="space-y-2">
              <div class="flex items-center gap-2">
                <Badge variant="outline">Deployment</Badge>
                <span class="text-sm font-medium">Trigger Build</span>
              </div>
              <CodeBlock 
                :code="webhookExamples.buildTrigger"
                language="json"
              />
            </div>

            <!-- Analytics -->
            <div class="space-y-2">
              <div class="flex items-center gap-2">
                <Badge>Data Access</Badge>
                <span class="text-sm font-medium">Generate Report</span>
              </div>
              <CodeBlock 
                :code="webhookExamples.analytics"
                language="json"
              />
            </div>

            <!-- AI Agent -->
            <div class="space-y-2">
              <div class="flex items-center gap-2">
                <Badge variant="secondary">AI Agents</Badge>
                <span class="text-sm font-medium">AI Analysis</span>
              </div>
              <CodeBlock 
                :code="webhookExamples.aiAgent"
                language="json"
              />
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      <!-- Authentication Tab -->
      <TabsContent value="authentication" class="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Authentication Methods</CardTitle>
            <CardDescription>
              Secure your webhooks with proper authentication
            </CardDescription>
          </CardHeader>
          <CardContent class="space-y-4">
            <!-- Bearer Token -->
            <div class="space-y-2">
              <h4 class="font-medium flex items-center gap-2">
                <Lock class="w-4 h-4" />
                Bearer Token
              </h4>
              <p class="text-sm text-muted-foreground">
                Include your project API key in the Authorization header
              </p>
              <CodeBlock 
                :code="webhookExamples.curlCommand"
                language="bash"
              />
            </div>

            <!-- Webhook Secret -->
            <div class="space-y-2">
              <h4 class="font-medium flex items-center gap-2">
                <Lock class="w-4 h-4" />
                Webhook Secret (HMAC)
              </h4>
              <p class="text-sm text-muted-foreground">
                Verify webhook authenticity using HMAC-SHA256 signatures
              </p>
              <CodeBlock 
                :code="webhookExamples.jsSignature"
                language="javascript"
              />
            </div>

            <!-- API Key -->
            <div class="space-y-2">
              <h4 class="font-medium flex items-center gap-2">
                <Lock class="w-4 h-4" />
                API Key in Payload
              </h4>
              <p class="text-sm text-muted-foreground">
                Include API key directly in the webhook payload (less secure)
              </p>
              <CodeBlock 
                :code="webhookExamples.apiKeyPayload"
                language="json"
              />
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      <!-- Responses Tab -->
      <TabsContent value="responses" class="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Response Formats</CardTitle>
            <CardDescription>
              Understanding webhook response codes and formats
            </CardDescription>
          </CardHeader>
          <CardContent class="space-y-4">
            <!-- Success Response -->
            <div class="space-y-2">
              <h4 class="font-medium flex items-center gap-2">
                <CheckCircle class="w-4 h-4 text-green-600" />
                Success Response
              </h4>
              <CodeBlock 
                :code="webhookExamples.successResponse"
                language="json"
              />
            </div>

            <!-- Error Response -->
            <div class="space-y-2">
              <h4 class="font-medium flex items-center gap-2">
                <XCircle class="w-4 h-4 text-red-600" />
                Error Response
              </h4>
              <CodeBlock 
                :code="webhookExamples.errorResponse"
                language="json"
              />
            </div>

            <!-- Response Codes Table -->
            <div class="space-y-2">
              <h4 class="font-medium">HTTP Response Codes</h4>
              <div class="overflow-x-auto">
                <table class="w-full text-sm">
                  <thead>
                    <tr class="border-b">
                      <th class="text-left p-2 font-medium">Code</th>
                      <th class="text-left p-2 font-medium">Status</th>
                      <th class="text-left p-2 font-medium">Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="response in responseCodes" :key="response.code" class="border-b">
                      <td class="p-2">
                        <Badge :variant="response.code.startsWith('2') ? 'default' : response.code.startsWith('4') ? 'secondary' : 'destructive'">
                          {{ response.code }}
                        </Badge>
                      </td>
                      <td class="p-2 font-medium">{{ response.status }}</td>
                      <td class="p-2 text-muted-foreground">{{ response.description }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      <!-- Security Tab -->
      <TabsContent value="security" class="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Security Best Practices</CardTitle>
            <CardDescription>
              Keep your webhooks secure and reliable
            </CardDescription>
          </CardHeader>
          <CardContent class="space-y-4">
            <div v-for="practice in securityPractices" :key="practice.title" class="space-y-2 p-3 border rounded-lg">
              <h4 class="font-medium flex items-center gap-2">
                <Shield class="w-4 h-4 text-blue-600" />
                {{ practice.title }}
              </h4>
              <p class="text-sm text-muted-foreground">{{ practice.description }}</p>
              <p class="text-xs text-muted-foreground">
                <span class="font-medium">Example:</span> {{ practice.example }}
              </p>
            </div>

            <!-- Rate Limiting Alert -->
            <Alert>
              <AlertTriangle class="h-4 w-4" />
              <AlertTitle>Rate Limiting</AlertTitle>
              <AlertDescription>
                Webhooks are rate-limited to prevent abuse. Default limits:
                <ul class="list-disc list-inside mt-2 text-sm">
                  <li>100 requests per minute per API key</li>
                  <li>1000 requests per hour per project</li>
                  <li>10 concurrent command executions</li>
                </ul>
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  </div>
</template>