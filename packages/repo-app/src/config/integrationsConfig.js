import { 
  Mail, 
  MessageSquare, 
  Bot, 
  LineChart,
  Hash,
  MessageCircle,
  Brain,
  BarChart3,
  Send,
  Users,
  Sparkles,
  TrendingUp
} from "lucide-vue-next";

export const integrationsConfig = {
  // Newsletter & Email Services
  mailchimp: {
    name: "Mailchimp",
    brandName: "Mailchimp",
    description: "Email marketing platform - Send newsletters and automate campaigns",
    icon: Mail,
    color: "bg-yellow-500",
    category: "newsletter",
    website: "https://mailchimp.com",
    documentation: "https://mailchimp.com/developer/",
    features: ["Email campaigns", "Automation", "Analytics", "Segmentation"],
    pricing: "Free tier available",
    fields: {
      apiKey: {
        label: "API Key",
        type: "password",
        placeholder: "Your Mailchimp API key",
        help: "Found in Account → Extras → API keys"
      },
      listId: {
        label: "Audience ID",
        type: "text",
        placeholder: "e.g., a1b2c3d4e5",
        help: "Found in Audience → Settings → Audience name and defaults"
      },
      sendNewPosts: {
        label: "Auto-send new posts",
        type: "checkbox",
        default: true,
        help: "Automatically create campaigns for new blog posts"
      }
    }
  },

  convertkit: {
    name: "ConvertKit",
    brandName: "ConvertKit",
    description: "Creator-focused email marketing - Build your audience and sell products",
    icon: Send,
    color: "bg-red-500",
    category: "newsletter",
    website: "https://convertkit.com",
    documentation: "https://developers.convertkit.com/",
    features: ["Visual automations", "Landing pages", "Commerce", "Segmentation"],
    pricing: "Free up to 1,000 subscribers",
    fields: {
      apiKey: {
        label: "API Key",
        type: "password",
        placeholder: "Your ConvertKit API key",
        help: "Found in Settings → Advanced → API"
      },
      formId: {
        label: "Form ID",
        type: "text",
        placeholder: "e.g., 1234567",
        help: "ID of the form to subscribe users to"
      },
      sendNewPosts: {
        label: "Auto-send new posts",
        type: "checkbox",
        default: true,
        help: "Automatically broadcast new posts to subscribers"
      }
    }
  },

  substack: {
    name: "Substack",
    brandName: "Substack",
    description: "Newsletter platform - Cross-post your content to Substack readers",
    icon: Mail,
    color: "bg-orange-500",
    category: "newsletter",
    website: "https://substack.com",
    documentation: "https://api.substack.com/",
    features: ["Newsletter publishing", "Paid subscriptions", "Reader community", "Mobile apps"],
    pricing: "Free, 10% of paid subscriptions",
    fields: {
      publicationUrl: {
        label: "Publication URL",
        type: "url",
        placeholder: "https://yourpublication.substack.com",
        help: "Your Substack publication URL"
      },
      apiKey: {
        label: "API Key",
        type: "password",
        placeholder: "Your Substack API key",
        help: "Contact Substack support for API access"
      },
      sendNewPosts: {
        label: "Cross-post new content",
        type: "checkbox",
        default: true,
        help: "Automatically publish new posts to Substack"
      }
    }
  },

  // Notification Services
  // Slack integration is now handled at the organization level via OAuth

  discord: {
    name: "Discord",
    brandName: "Discord",
    description: "Community platform - Post updates to your Discord server",
    icon: MessageCircle,
    color: "bg-indigo-600",
    category: "notifications",
    website: "https://discord.com",
    documentation: "https://discord.com/developers/docs/resources/webhook",
    features: ["Webhook notifications", "Embeds", "File attachments", "Mentions"],
    pricing: "Free",
    fields: {
      webhookUrl: {
        label: "Webhook URL",
        type: "url",
        placeholder: "https://discord.com/api/webhooks/...",
        help: "Server Settings → Integrations → Webhooks → New Webhook"
      },
      notifyNewPosts: {
        label: "Post updates",
        type: "checkbox",
        default: true,
        help: "Send notifications when content is published"
      }
    }
  },

  // Comment Systems
  disqus: {
    name: "Disqus",
    brandName: "Disqus",
    description: "Comment system - Add discussion threads to your posts",
    icon: MessageSquare,
    color: "bg-blue-600",
    category: "comments",
    website: "https://disqus.com",
    documentation: "https://help.disqus.com/",
    features: ["Threaded discussions", "Moderation tools", "Social login", "Email notifications"],
    pricing: "Free with ads, paid plans available",
    fields: {
      shortname: {
        label: "Forum Shortname",
        type: "text",
        placeholder: "your-site-shortname",
        help: "Your unique Disqus forum shortname"
      }
    }
  },

  giscus: {
    name: "Giscus",
    brandName: "Giscus",
    description: "GitHub Discussions - Use GitHub discussions as comments",
    icon: MessageSquare,
    color: "bg-gray-800",
    category: "comments",
    website: "https://giscus.app",
    documentation: "https://github.com/giscus/giscus",
    features: ["GitHub integration", "Markdown support", "Reactions", "No tracking"],
    pricing: "Free (uses GitHub)",
    fields: {
      repo: {
        label: "Repository",
        type: "text",
        placeholder: "owner/repo",
        help: "GitHub repository (must be public)"
      },
      repoId: {
        label: "Repository ID",
        type: "text",
        placeholder: "R_kgDOH...",
        help: "Get from giscus.app configuration"
      },
      category: {
        label: "Discussion Category",
        type: "text",
        placeholder: "Announcements",
        help: "GitHub Discussions category"
      },
      categoryId: {
        label: "Category ID",
        type: "text",
        placeholder: "DIC_kwDOH...",
        help: "Get from giscus.app configuration"
      },
      theme: {
        label: "Theme",
        type: "select",
        options: ["light", "dark", "preferred_color_scheme"],
        default: "preferred_color_scheme",
        help: "Comment widget theme"
      }
    }
  },

  // AI Services
  claude: {
    name: "Claude",
    brandName: "Claude (Anthropic)",
    description: "AI assistant - Content suggestions, editing, and analysis",
    icon: Bot,
    color: "bg-amber-600",
    category: "ai",
    website: "https://www.anthropic.com",
    documentation: "https://docs.anthropic.com/",
    features: ["Content analysis", "Writing assistance", "Code understanding", "Long context"],
    pricing: "API usage-based pricing",
    fields: {
      apiKey: {
        label: "API Key",
        type: "password",
        placeholder: "sk-ant-api03-...",
        help: "Get your API key from console.anthropic.com"
      },
      model: {
        label: "Model",
        type: "select",
        options: [
          { value: "claude-3-opus-20240229", label: "Claude 3 Opus (Most capable)" },
          { value: "claude-3-sonnet-20240229", label: "Claude 3 Sonnet (Balanced)" },
          { value: "claude-3-haiku-20240307", label: "Claude 3 Haiku (Fastest)" }
        ],
        default: "claude-3-sonnet-20240229",
        help: "Choose model based on your needs"
      },
      enableContentSuggestions: {
        label: "Content suggestions",
        type: "checkbox",
        default: true,
        help: "Get AI-powered content improvement suggestions"
      }
    }
  },

  openai: {
    name: "OpenAI",
    brandName: "OpenAI (ChatGPT)",
    description: "AI platform - Content generation, editing, and automation",
    icon: Brain,
    color: "bg-green-600",
    category: "ai",
    website: "https://openai.com",
    documentation: "https://platform.openai.com/docs",
    features: ["GPT models", "DALL-E integration", "Embeddings", "Fine-tuning"],
    pricing: "Pay-as-you-go API pricing",
    fields: {
      apiKey: {
        label: "API Key",
        type: "password",
        placeholder: "sk-...",
        help: "Get your API key from platform.openai.com"
      },
      model: {
        label: "Model",
        type: "select",
        options: [
          { value: "gpt-4-turbo-preview", label: "GPT-4 Turbo (Latest)" },
          { value: "gpt-4", label: "GPT-4 (Most capable)" },
          { value: "gpt-3.5-turbo", label: "GPT-3.5 Turbo (Fast & affordable)" }
        ],
        default: "gpt-4-turbo-preview",
        help: "Choose based on capability vs cost"
      },
      enableContentGeneration: {
        label: "Content generation",
        type: "checkbox",
        default: true,
        help: "Enable AI-powered content creation"
      }
    }
  },

  // Analytics Services
  googleAnalytics: {
    name: "Google Analytics",
    brandName: "Google Analytics 4",
    description: "Web analytics - Track visitor behavior and content performance",
    icon: BarChart3,
    color: "bg-blue-600",
    category: "analytics",
    website: "https://analytics.google.com",
    documentation: "https://developers.google.com/analytics",
    features: ["Real-time data", "Audience insights", "Conversion tracking", "Custom events"],
    pricing: "Free",
    fields: {
      measurementId: {
        label: "Measurement ID",
        type: "text",
        placeholder: "G-XXXXXXXXXX",
        help: "Found in Admin → Data Streams → Web stream details"
      }
    }
  },

  plausible: {
    name: "Plausible",
    brandName: "Plausible Analytics",
    description: "Privacy-first analytics - Simple, lightweight, no cookies",
    icon: TrendingUp,
    color: "bg-indigo-600",
    category: "analytics",
    website: "https://plausible.io",
    documentation: "https://plausible.io/docs",
    features: ["Privacy-friendly", "No cookies", "Lightweight script", "Real-time stats"],
    pricing: "Starts at $9/month",
    fields: {
      domain: {
        label: "Domain",
        type: "text",
        placeholder: "yourdomain.com",
        help: "Your site domain as configured in Plausible"
      },
      apiKey: {
        label: "API Key (optional)",
        type: "password",
        placeholder: "For stats API access",
        help: "Only needed for accessing stats via API"
      }
    }
  }
};

// Helper functions
export const getIntegrationsByCategory = (category) => {
  return Object.entries(integrationsConfig)
    .filter(([key, config]) => config.category === category)
    .reduce((acc, [key, config]) => ({ ...acc, [key]: config }), {});
};

export const getIntegrationCategories = () => {
  const categories = new Set();
  Object.values(integrationsConfig).forEach(config => {
    categories.add(config.category);
  });
  return Array.from(categories);
};

// Category metadata
export const categoryInfo = {
  newsletter: {
    name: "Newsletter & Email",
    description: "Email marketing and newsletter services",
    icon: Mail
  },
  notifications: {
    name: "Notifications",
    description: "Real-time alerts and updates",
    icon: MessageSquare
  },
  comments: {
    name: "Comments",
    description: "Discussion and feedback systems",
    icon: MessageSquare
  },
  ai: {
    name: "AI Tools",
    description: "Artificial intelligence services",
    icon: Bot
  },
  analytics: {
    name: "Analytics",
    description: "Traffic and performance tracking",
    icon: LineChart
  }
};