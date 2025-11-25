export const TEMPLATES = [
    {
        id: 1,
        slug: "portfolio",
        name: "Simple Portfolio",
        icon: "/api/placeholder/24/24",
        image: "/api/placeholder/400/220",
        description: "Get started with a simple folder-based Portfolio template.",
        githubRepo: "repo-md/portfolio",
        categories: ["Starter", "Portfolio"],
        author: "Repo.md",
        framework: "repo",
        stars: 45,
        features: [
            "Project showcase structure",
            "Contact information template",
            "Skills & expertise organization",
            "Auto-generated project gallery",
        ],
        demoUrl: "https://portfolio.repo.md",
    },

    // Cookbook Template
    {
        id: 2,
        slug: "cookbook",
        name: "Recipe Collection",
        icon: "/api/placeholder/24/24",
        image: "/api/placeholder/400/220",
        description:
            "Save your tasty recipes just for you or publish them to the world with a click. No more hunting through bookmarks!",
        githubRepo: "repo-md/cookbook",
        categories: ["Personal", "Food", "Publishing"],
        author: "Repo.md",
        framework: "repo",
        stars: 78,
        features: [
            "Recipe card templates",
            "Ingredient database",
            "Meal planning system",
            "One-click web publishing",
            "Automatic nutrition calculation",
            "Shopping list generator",
        ],
        demoUrl: "https://cookbook.repo.md",
    },

    // Knowledge Base Template
    {
        id: 3,
        slug: "knowledge-base",
        name: "Support Desk Knowledge Base",
        icon: "/api/placeholder/24/24",
        image: "/api/placeholder/400/220",
        description:
            "Centralized knowledge repository with advanced search for support teams (and AI agents).",
        githubRepo: "repo-md/knowledge-base",
        categories: ["Business", "Support", "Documentation"],
        author: "Repo.md",
        framework: "repo",
        stars: 124,
        features: [
            "Article templates with metadata",
            "Automatic table of contents",
            "FAQ generator",
            "Version history tracking",
            "Tag-based organization",
            "AI-powered search integration",
            "User feedback collection",
        ],
        demoUrl: "https://kb.repo.md",
    },

    // Blog Template
    {
        id: 4,
        slug: "simple-blog",
        name: "Markdown Blog Engine",
        icon: "/api/placeholder/24/24",
        image: "/api/placeholder/400/220",
        description:
            "Write in Markdown, publish automatically. No more copy-pasting into CMSes.",
        githubRepo: "repo-md/simple-blog",
        categories: ["Publishing", "Blog", "Content"],
        author: "Repo.md",
        framework: "repo",
        stars: 156,
        features: [
            "Post templates with front matter",
            "Category & tag management",
            "SEO optimization helpers",
            "Automatic RSS feed generation",
            "Scheduled publishing",
            "Analytics integration",
            "Newsletter subscription",
        ],
        demoUrl: "https://blog.repo.md",
    },

    // School Notes Template
    {
        id: 5,
        slug: "school-notes",
        name: "Academic Study",
        icon: "/api/placeholder/24/24",
        image: "/api/placeholder/400/220",
        description:
            "Organize notes by classes, generate summaries, and collaborate with classmates.",
        githubRepo: "repo-md/school-notes",
        categories: ["Education", "Notes", "Collaboration"],
        author: "Repo.md",
        framework: "repo",
        stars: 92,
        features: [
            "Course folder structure",
            "Lecture note templates",
            "Assignment tracker",
            "Study group collaboration",
            "Exam review generator",
            "Bibliography management",
            "AI summarization integration",
        ],
        demoUrl: "https://studies.repo.md",
    },

    // Brain Dump Template
    {
        id: 6,
        slug: "brain-dump",
        name: "Connected Notes",
        icon: "/api/placeholder/24/24",
        image: "/api/placeholder/400/220",
        description:
            "Capture thoughts and see how they connect through a interactive graphs and searches.",
        githubRepo: "repo-md/brain-dump",
        categories: ["Productivity", "Knowledge", "Personal"],
        author: "Repo.md",
        framework: "repo",
        stars: 187,
        features: [
            "Daily note templates",
            "Automatic backlinking",
            "Graph visualization",
            "Tag management system",
            "Quick capture interface",
            "Zettelkasten methodology",
            "MOC (Map of Content) generator",
        ],
        demoUrl: "https://thoughts.repo.md",
    },

    // Journal Template
    {
        id: 7,
        slug: "daily-journal",
        name: "Personal Journal",
        icon: "/api/placeholder/24/24",
        image: "/api/placeholder/400/220",
        description:
            "Write every day. Track your moods, habits, and growth. Rediscover yourself through your own words.",
        githubRepo: "repo-md/daily-journal",
        categories: ["Personal", "Productivity", "Wellness"],
        author: "Repo.md",
        framework: "repo",
        stars: 103,
        features: [
            "Daily entry templates",
            "Mood tracking",
            "Habit monitoring",
            "Gratitude practice",
            "Year-in-review generator",
            "Privacy options",
            "Writing prompts",
        ],
        demoUrl: "https://journal.repo.md",
    },

    // Book/Thesis Template
    {
        id: 8,
        slug: "book-writing",
        name: "Book & Thesis",
        icon: "/api/placeholder/24/24",
        image: "/api/placeholder/400/220",
        description:
            "Leverage plain text to focus better on writing. Save your work at every step. Never lose a thought or version again.",
        githubRepo: "repo-md/book-writing",
        categories: ["Writing", "Academic", "Publishing"],
        author: "Repo.md",
        framework: "repo",
        stars: 142,
        features: [
            "Chapter organization",
            "Research note linking",
            "Word count tracking",
            "Version history",
            "Citation management",
            "Export to multiple formats",
            "Distraction-free writing mode",
            "Outline generator",
        ],
        demoUrl: "https://write.repo.md",
    },

    // Project Management Template
    {
        id: 9,
        slug: "project-management",
        name: "Project Tracker",
        icon: "/api/placeholder/24/24",
        image: "/api/placeholder/400/220",
        description:
            "Track projects, tasks, and milestones with a simple Markdown-based system.",
        githubRepo: "repo-md/project-management",
        categories: ["Productivity", "Business", "Organization"],
        author: "Repo.md",
        framework: "repo",
        stars: 119,
        features: [
            "Project dashboard",
            "Task templates",
            "Kanban board generation",
            "Progress tracking",
            "Time estimation",
            "Deadline management",
            "Meeting notes integration",
            "Automated reports",
        ],
        demoUrl: "https://projects.repo.md",
    },

    // Documentation Site Template
    {
        id: 10,
        slug: "documentation-site",
        name: "Documentation Hub",
        icon: "/api/placeholder/24/24",
        image: "/api/placeholder/400/220",
        description:
            "Create comprehensive, navigable documentation from Markdown files.",
        githubRepo: "repo-md/documentation-site",
        categories: ["Development", "Documentation", "Technical"],
        author: "Repo.md",
        framework: "repo",
        stars: 168,
        features: [
            "Structured documentation templates",
            "Automatic sidebar generation",
            "Code snippet formatting",
            "Version switching",
            "Search functionality",
            "API reference builder",
            "Interactive examples",
        ],
        demoUrl: "https://docs.repo.md",
    },
];

/**
 * Get template metadata by GitHub repo
 * @param {string} githubRepo - GitHub repository in format "owner/repo"
 * @returns {Object|null} Template metadata or null if not found
 */
export function getTemplateMetadata(githubRepo) {
    return TEMPLATES.find(template => template.githubRepo === githubRepo) || null;
}

/**
 * Get all templates for a specific owner
 * @param {string} owner - GitHub owner/organization name
 * @returns {Array} Array of templates for the owner
 */
export function getTemplatesByOwner(owner) {
    return TEMPLATES.filter(template => {
        const [templateOwner] = template.githubRepo.split('/');
        return templateOwner === owner;
    });
}