import { BLOCK_TYPES, HERO_BTN_CTA, getBannerImageByPath } from "@/components/pushmd/blockTypes";
import {
	Edit,
	GitBranch,
	FileText,
	Code,
	Coffee,
	Zap,
	Download,
	RefreshCw,
} from "lucide-vue-next";

export const blocks = [
	// Hero Block
	{
		type: BLOCK_TYPES.HERO,
		title: "The Indie Blogger's Dream",
		subtitle: "Write in Obsidian, Deploy with Git",
		btnLabel: "Start Blogging Free",
		btnTo: HERO_BTN_CTA,
		btnSecondaryLabel: "See How It Works",
		btnSecondaryTo: "#workflow",
		bgImage: getBannerImageByPath("/img/bg/bg12.png"),
		noBgFilter: true,
	},

	// Text Block - Introduction
	{
		type: BLOCK_TYPES.TEXT,
		title: "For Indie Bloggers Who Code (or Want to Learn)",
		content: `
			<p class="mb-4 text-lg">Remember when blogging was simple? You'd write your thoughts, hit publish, and your words were out there. Then came the complexity: WordPress plugins, database backups, security updates, and that constant fear of losing everything to a hack or a hosting mishap.</p>
			<p class="mb-4 text-lg font-semibold">What if you could write in your favorite markdown editor, push to Git, and have your blog instantly live worldwide? No databases, no admin panels, no plugin conflicts. Just you, your words, and the tools you already love.</p>
		`,
	},

	// Features Block - Writing Tools
	{
		type: BLOCK_TYPES.FEATURES,
		title: "Write Where You Think Best",
		features: [
			{
				title: "Obsidian Integration",
				description: "Your blog becomes part of your knowledge graph. Internal links, backlinks, and embeds work seamlessly.",
				icon: Edit,
			},
			{
				title: "Any Editor Works",
				description: "VS Code, Typora, iA Writer, Vim - use whatever makes you productive. It's just markdown files.",
				icon: FileText,
			},
			{
				title: "Offline First",
				description: "Write at coffee shops without WiFi. Your content lives on your computer, sync when ready.",
				icon: Coffee,
			},
			{
				title: "Version Control Built In",
				description: "Every edit tracked, every change reversible. Your blog history preserved forever in Git.",
				icon: GitBranch,
			},
		],
	},

	// Text Block - Deploy Example
	{
		type: BLOCK_TYPES.TEXT,
		title: "Deploy Like a Developer",
		content: `
			<pre class="bg-gray-900 text-gray-100 p-6 rounded-lg overflow-x-auto">
<code class="language-bash"># Write your post
echo "# Today's Thoughts" > content/today.md

# Preview locally
npm run dev
# Opens: http://localhost:3000

# Ship it
git add .
git commit -m "New post: Today's Thoughts"
git push

# Live in 5 seconds at:
# https://yourblog.com/today</code>
			</pre>
		`,
	},

	// Cards Block - Import Options
	{
		type: BLOCK_TYPES.CARDS,
		title: "Import From Anywhere",
		cards: [
			{
				title: "WordPress Migration",
				description: "Export your WordPress content and import as clean markdown files. URLs and SEO preserved.",
				icon: Download,
				code: 'npm run import:wordpress --url=yourblog.com',
			},
			{
				title: "Notion Import",
				description: "Bring your Notion pages and databases. They become markdown with frontmatter.",
				icon: RefreshCw,
				code: 'npm run import:notion --token=your-token',
			},
			{
				title: "Medium & Ghost",
				description: "We handle all major platforms. Your content belongs to you, not locked in their system.",
				icon: FileText,
				code: 'npm run import:medium --username=you',
			},
		],
	},

	// Text Block - Code Highlighting
	{
		type: BLOCK_TYPES.TEXT,
		title: "Code Blocks That Shine",
		content: `
			<p class="mb-4">Write about code? Your snippets will look gorgeous with automatic syntax highlighting</p>
			<pre class="bg-gray-900 text-gray-100 p-6 rounded-lg overflow-x-auto">
<code class="language-javascript">// Syntax highlighting included
const publishPost = async (content) => {
  await git.add('content/*')
  await git.commit(\`New post: \${content.title}\`)
  await git.push()
  
  // Live worldwide in seconds
  return \`https://yourblog.com/\${content.slug}\`
}

// Line numbers, copy buttons, language labels - all automatic</code>
			</pre>
		`,
	},

	// Text Block - Obsidian Features
	{
		type: BLOCK_TYPES.TEXT,
		title: "Obsidian Power Features",
		content: `
			<h3 class="text-xl font-bold mb-3">Internal Links Work</h3>
			<pre class="bg-gray-100 p-4 rounded mb-4"><code>Check out my [[Previous Post About This]]
Related: [[projects/my-app|My App Project]]</code></pre>
			<p class="mb-4">These convert to proper blog links automatically.</p>

			<h3 class="text-xl font-bold mb-3">Embedded Content</h3>
			<pre class="bg-gray-100 p-4 rounded mb-4"><code>![[snippet-of-code.md]]
![[images/my-diagram.png]]</code></pre>
			<p class="mb-4">Embeds work seamlessly. Your knowledge graph becomes your blog.</p>

			<h3 class="text-xl font-bold mb-3">Tags & Backlinks</h3>
			<pre class="bg-gray-100 p-4 rounded mb-4"><code>#blogging #indieweb #markdown</code></pre>
			<p class="mb-4">Related posts appear automatically based on your Obsidian graph.</p>
		`,
	},

	// Features Block - Developer Features
	{
		type: BLOCK_TYPES.FEATURES,
		title: "The Developer's Advantage",
		features: [
			{
				title: "Branch Previews",
				description: "Test big changes on branches. Every branch gets its own preview URL instantly.",
				icon: GitBranch,
			},
			{
				title: "Custom Shortcodes",
				description: "Embed tweets, YouTube videos, CodePens with simple shortcodes in your markdown.",
				icon: Code,
			},
			{
				title: "API Integration",
				description: "Pull in your GitHub repos, show live data, create interactive demos.",
				icon: Zap,
			},
			{
				title: "SEO Without Plugins",
				description: "Automatic sitemap, perfect meta tags, schema markup, image optimization built-in.",
				icon: FileText,
			},
		],
	},

	// Testimonials as Cards
	{
		type: BLOCK_TYPES.CARDS,
		title: "Why Indie Bloggers Love This",
		cards: [
			{
				title: "Sarah Chen - Tech Blogger",
				description: "I write in Obsidian all day for work notes. Now my blog is part of the same workflow. Push to Git, and I'm published. It's magical.",
				icon: Edit,
			},
			{
				title: "Mike Rodriguez - Developer Advocate",
				description: "I embed code samples, create interactive demos, and my blog still loads in under a second. WordPress could never.",
				icon: Code,
			},
			{
				title: "Emma Thompson - Digital Nomad",
				description: "I write offline in cafes, sync when I have WiFi. My blog is always with me, always under my control.",
				icon: Coffee,
			},
		],
	},

	// Getting Started Text
	{
		type: BLOCK_TYPES.TEXT,
		title: "Start Blogging Like It's 2024",
		content: `
			<pre class="bg-gray-900 text-gray-100 p-6 rounded-lg overflow-x-auto">
<code class="language-bash"># Clone the indie blogger starter
git clone https://github.com/pushmd/indie-blog-starter
cd indie-blog-starter

# Install
npm install

# Import your existing content (optional)
npm run import:wordpress --url=your-old-blog.com

# Start writing
obsidian .  # Opens in Obsidian
# or
code .      # Opens in VS Code

# Preview
npm run dev

# Publish
git push</code>
			</pre>
		`,
	},

	// CTA Block
	{
		type: BLOCK_TYPES.CTA,
		title: "Your Blog, Your Rules",
		subtitle: "Own your content. Use your tools. Blog like a developer.",
		btnLabel: "Start Free Today",
		btnTo: HERO_BTN_CTA,
		features: [
			"Markdown files on your computer",
			"Any editor (Obsidian, VS Code, etc)",
			"Git tracks all changes",
			"Push to publish instantly",
			"Scale infinitely on edge network",
			"Customize freely - it's just code",
		],
	},
];

export default blocks;