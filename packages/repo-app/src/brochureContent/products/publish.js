import { BLOCK_TYPES, HERO_BTN_CTA, getBannerImageByPath } from "@/components/pushmd/blockTypes";
import {
	FastForward,
	GitBranch,
	Globe,
	Zap,
	Eye,
	Shield,
	RefreshCw,
	Rocket,
	Archive,
} from "lucide-vue-next";

export const blocks = [
	// Hero Block
	{
		type: BLOCK_TYPES.HERO,
		title: "Publish",
		subtitle: "Deploy via Git. Host on the edge. Simplify content backups and previews",
		btnLabel: "Get started",
		btnTo: HERO_BTN_CTA,
		btnSecondaryLabel: "Documentation",
		btnSecondaryTo: "/docs",

		bgImage: getBannerImageByPath("/img/bg/bg12.png"),
		noBgFilter: true,
	},

	// Features Block
	{
		type: BLOCK_TYPES.FEATURES,
		title: "Git → Edge → Live",
		features: [
			{
				title: "Deploy via Git",
				description:
					"Push to any branch, get instant deployments - that's it",
				icon: GitBranch,
			},
			{
				title: "Host on the Edge",
				description:
					"Global CDN delivers your content from 200+ locations worldwide",
				icon: Globe,
			},
			{
				title: "Content Backups",
				description: "Every version preserved forever - rollback to any point in time",
				icon: Archive,
			},
			{
				title: "Simplified Previews",
				description: "Every branch gets a preview URL - test before going live",
				icon: Eye,
			},
		],
	},

	// Cards Block
	{
		type: BLOCK_TYPES.CARDS,
		title: "Publishing Without the Pain",
		cards: [
			{
				title: "No Deploy Scripts",
				description:
					"Skip the build pipelines and CI/CD complexity - just push",
				icon: GitBranch,
			},
			{
				title: "Instant Rollbacks",
				description:
					"One-click rollback to any previous version, no data loss",
				icon: RefreshCw,
			},
			{
				title: "Preview Everything",
				description: "Test changes on real URLs before merging to production",
				icon: Eye,
			},
			{
				title: "Edge Performance",
				description:
					"Sub-second loading times from any location on Earth",
				icon: Rocket,
			},
		],
	},

	// Text Block
	{
		type: BLOCK_TYPES.TEXT,
		title: "The Deployment You've Been Waiting For",
		content: `
      <p class="mb-4">Forget complex deployment pipelines. Just connect your Git repo and push. We handle the edge hosting, automatic backups, and preview generation. It's that simple.</p>
      <p class="mb-4">What you get out of the box:</p>
      <ul class="list-disc pl-6 mb-4">
        <li>Automatic deployments from any Git provider</li>
        <li>Global edge network with 200+ locations</li>
        <li>Complete version history and instant rollbacks</li>
        <li>Preview URLs for every branch and pull request</li>
        <li>Zero configuration, maximum performance</li>
      </ul>
    `,
	},

	// CTA Block
	{
		type: BLOCK_TYPES.CTA,
		title: "Deploy Your Content Today",
		subtitle: "Free tier includes unlimited Git deployments and edge hosting",
		btnLabel: "Connect Git Repo",
		btnTo: HERO_BTN_CTA,
	},
];

export default blocks;