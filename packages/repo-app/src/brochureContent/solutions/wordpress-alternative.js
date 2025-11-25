import { BLOCK_TYPES, HERO_BTN_CTA, getBannerImageByPath } from "@/components/pushmd/blockTypes";
import {
	Database,
	Shield,
	Zap,
	GitBranch,
	Download,
	CheckCircle,
	XCircle,
	FileText,
	Code,
	TrendingUp,
	Users,
	RefreshCw,
} from "lucide-vue-next";

export const blocks = [
	// Hero Block
	{
		type: BLOCK_TYPES.HERO,
		title: "The Modern WordPress Alternative",
		subtitle: "Why Markdown is the Future of Content Management",
		btnLabel: "Start Migration Free",
		btnTo: HERO_BTN_CTA,
		btnSecondaryLabel: "See Migration Process",
		btnSecondaryTo: "#migration",
		bgImage: getBannerImageByPath("/img/bg/bg14.png"),
		noBgFilter: true,
	},

	// Text Block - Introduction
	{
		type: BLOCK_TYPES.TEXT,
		title: "Escape the WordPress Complexity Trap",
		content: `
			<p class="mb-4 text-lg">After 20 years, WordPress powers 40% of the web. But at what cost? Plugin conflicts, security vulnerabilities, database corruptions, and that dreaded white screen of death. What started as a simple blogging platform has become a complex beast requiring constant maintenance.</p>
			<p class="mb-4 text-lg font-semibold">There's a better way. A way that's faster, more secure, and actually enjoyable to use. Welcome to the world of markdown-based content management.</p>
		`,
	},

	// Comparison Features
	{
		type: BLOCK_TYPES.FEATURES,
		title: "WordPress Way vs. Our Way",
		features: [
			{
				title: "Content Storage",
				description: "Plain text files vs database - your content stays portable and accessible",
				icon: Database,
			},
			{
				title: "No Server Required",
				description: "Deploy static files anywhere vs PHP/MySQL server requirements",
				icon: Shield,
			},
			{
				title: "Zero Plugin Conflicts",
				description: "Everything built-in vs constant plugin compatibility issues",
				icon: CheckCircle,
			},
			{
				title: "Lightning Fast",
				description: "Pre-built pages vs slow database queries on every request",
				icon: Zap,
			},
		],
	},

	// Text Block - Migration
	{
		type: BLOCK_TYPES.TEXT,
		title: "Automated WordPress Migration",
		subtitle: "We make switching painless with our automated migration tool",
		content: `
			<pre class="bg-gray-900 text-gray-100 p-6 rounded-lg overflow-x-auto">
<code class="language-bash"># One command migrates everything
npx migrate-from-wordpress https://your-site.com

✅ Exporting posts... 847 found
✅ Exporting pages... 23 found  
✅ Exporting media... 1,263 files
✅ Converting to markdown...
✅ Preserving URLs and SEO...
✅ Migration complete!</code>
			</pre>
		`,
	},

	// Features Block - What Gets Migrated
	{
		type: BLOCK_TYPES.FEATURES,
		title: "What Gets Migrated",
		features: [
			{
				title: "Posts & Pages → Markdown",
				description: "All your content converted to clean markdown files with frontmatter metadata",
				icon: FileText,
			},
			{
				title: "Custom Post Types → Content Types",
				description: "WordPress custom types become structured frontmatter with all fields preserved",
				icon: Database,
			},
			{
				title: "Media Library → Local Files",
				description: "Images downloaded, optimized, and organized with automatic WebP conversion",
				icon: Download,
			},
			{
				title: "SEO & URLs → Preserved",
				description: "All permalinks, meta descriptions, and SEO settings maintained perfectly",
				icon: TrendingUp,
			},
		],
	},

	// Text Block - Frontmatter
	{
		type: BLOCK_TYPES.TEXT,
		title: "Content Types That Make Sense",
		subtitle: "From WordPress custom fields chaos to clean frontmatter structure",
		content: `
			<pre class="bg-gray-900 text-gray-100 p-6 rounded-lg overflow-x-auto">
<code class="language-yaml">---
# WordPress Custom Post Type → Clean Frontmatter
type: "product"
title: "Amazing Product"
price: 99.99
sku: "PROD-001"
gallery:
  - "/images/product-1.jpg"
  - "/images/product-2.jpg"
features:
  - "Feature One"
  - "Feature Two"
categories: ["Technology", "Reviews"]
tags: ["smartphone", "android", "2024"]
seo:
  description: "Original meta description preserved"
  canonical: "https://your-site.com/products/amazing-product/"
---

Your content here, perfectly converted to markdown.</code>
			</pre>
		`,
	},

	// Success Stories as Cards
	{
		type: BLOCK_TYPES.CARDS,
		title: "Real Migration Success Stories",
		cards: [
			{
				title: "Sarah Mitchell - Food Blogger",
				description: "I was terrified of losing my 5 years of content. The migration was flawless - even my custom recipe cards converted perfectly! From 47 plugins and 3-second loads to zero maintenance and 0.3-second loads. 1,200 posts migrated.",
				icon: CheckCircle,
			},
			{
				title: "David Chen - Tech Documentation Lead",
				description: "Our team can now work on docs simultaneously without database locks. 10,000 pages migrated from WordPress Multisite with all URLs preserved. Game changer.",
				icon: Users,
			},
			{
				title: "Lisa Anderson - Marketing Director",
				description: "WordPress maintenance was eating 20 hours a month. Now it's zero. The migration took 30 minutes for our entire corporate site.",
				icon: TrendingUp,
			},
		],
	},

	// Security Comparison
	{
		type: BLOCK_TYPES.CARDS,
		title: "Security: Night and Day Difference",
		cards: [
			{
				title: "WordPress Attack Vectors",
				description: "SQL injection, PHP exploits, plugin backdoors, file upload attacks, XML-RPC attacks, admin panel brute force",
				icon: XCircle,
			},
			{
				title: "Markdown Security",
				description: "No database, no server-side code, no plugin vulnerabilities, static files only, Git-based authentication",
				icon: CheckCircle,
			},
		],
	},

	// Text Block - Workflow
	{
		type: BLOCK_TYPES.TEXT,
		title: "Publishing Workflow Transformation",
		content: `
			<pre class="bg-gray-900 text-gray-100 p-6 rounded-lg overflow-x-auto">
<code class="language-bash"># Old WordPress Way:
# 1. Login to admin panel
# 2. Navigate through menus
# 3. Use block editor
# 4. Preview (hope it works)
# 5. Publish and pray
# 6. Check if caching cleared
# 7. Fix what broke

# New Markdown Way:
echo "# New Post" > content/new-post.md  # Write
npm run dev                              # Preview instantly
git add . && git commit && git push      # Publish
# Live in 5 seconds worldwide ✨</code>
			</pre>
		`,
	},

	// Features - Advanced
	{
		type: BLOCK_TYPES.FEATURES,
		title: "Advanced Features WordPress Can't Match",
		features: [
			{
				title: "Branch-Based A/B Testing",
				description: "Test complete redesigns or content variations with preview URLs for every Git branch",
				icon: GitBranch,
			},
			{
				title: "AI-Powered Automation",
				description: "Schedule AI to generate posts, optimize content, and handle SEO automatically",
				icon: Zap,
			},
			{
				title: "Edge Computing",
				description: "Runs at 200+ locations worldwide. <50ms latency anywhere vs WordPress origin server",
				icon: Shield,
			},
			{
				title: "True Version Control",
				description: "Every change in Git history. Instant rollbacks. No bloated revision tables",
				icon: Code,
			},
		],
	},

	// Stats as Cards
	{
		type: BLOCK_TYPES.CARDS,
		title: "The Numbers Don't Lie",
		cards: [
			{
				title: "90%",
				description: "Faster page loads",
				icon: Zap,
			},
			{
				title: "100%",
				description: "Uptime (no database)",
				icon: Shield,
			},
			{
				title: "0",
				description: "Maintenance hours",
				icon: CheckCircle,
			},
			{
				title: "∞",
				description: "Scalability",
				icon: TrendingUp,
			},
		],
	},

	// Migration Checklist as Text
	{
		type: BLOCK_TYPES.TEXT,
		title: "Migration Checklist",
		content: `
			<p class="mb-4 text-lg">Everything covered in our automated migration:</p>
			<ul class="space-y-2">
				<li class="flex items-center"><span class="text-green-500 mr-2">✓</span> Automated content migration</li>
				<li class="flex items-center"><span class="text-green-500 mr-2">✓</span> URL structure preserved</li>
				<li class="flex items-center"><span class="text-green-500 mr-2">✓</span> SEO rankings maintained</li>
				<li class="flex items-center"><span class="text-green-500 mr-2">✓</span> Media files optimized</li>
				<li class="flex items-center"><span class="text-green-500 mr-2">✓</span> Custom types converted</li>
				<li class="flex items-center"><span class="text-green-500 mr-2">✓</span> Redirects configured</li>
				<li class="flex items-center"><span class="text-green-500 mr-2">✓</span> Analytics continued</li>
			</ul>
		`,
	},

	// Text Block - What You Lose
	{
		type: BLOCK_TYPES.TEXT,
		title: "What You'll Lose (Good Riddance)",
		content: `
			<ul class="list-disc pl-6 space-y-2 text-lg">
				<li class="line-through text-gray-500">Plugin conflicts</li>
				<li class="line-through text-gray-500">Security vulnerabilities</li>
				<li class="line-through text-gray-500">Database errors</li>
				<li class="line-through text-gray-500">Slow page loads</li>
				<li class="line-through text-gray-500">Update anxiety</li>
				<li class="line-through text-gray-500">Hosting headaches</li>
				<li class="line-through text-gray-500">Maintenance costs</li>
			</ul>
		`,
	},

	// Getting Started
	{
		type: BLOCK_TYPES.TEXT,
		title: "Start Your Migration",
		content: `
			<pre class="bg-gray-900 text-gray-100 p-6 rounded-lg overflow-x-auto">
<code class="language-bash"># Install migration tool
npm install -g wordpress-to-markdown

# Run migration
wordpress-to-markdown \\
  --source https://your-wordpress-site.com \\
  --output ./content \\
  --preserve-urls \\
  --download-media \\
  --optimize-images

# Deploy your new site
git init
git add .
git commit -m "Fresh start with markdown"
git push

# Your new site is live! 🚀</code>
			</pre>
		`,
	},

	// CTA Block
	{
		type: BLOCK_TYPES.CTA,
		title: "The Future is File-Based",
		subtitle: "Join thousands who've already made the switch. Your content deserves better than a database.",
		btnLabel: "Start Free Migration",
		btnTo: HERO_BTN_CTA,
		btnSecondaryLabel: "Talk to Migration Expert",
		btnSecondaryTo: "/contact",
		features: [
			"Simple: Files, not databases",
			"Fast: Edge-delivered, not server-processed",
			"Secure: Static, not dynamic",
			"Flexible: Your tools, your workflow",
			"Portable: Your content, your control",
		],
	},
];

export default blocks;