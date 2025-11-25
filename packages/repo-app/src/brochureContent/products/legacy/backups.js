import { BLOCK_TYPES, HERO_BTN_CTA, getBannerImageByPath } from "@/components/pushmd/blockTypes";
import {
	History,
	RotateCcw,
	RefreshCw,
	Archive,
	Clock,
	DiffIcon,
	Cloud,
	Download,
} from "lucide-vue-next";

export const blocks = [
	// Hero Block
	{
		type: BLOCK_TYPES.HERO,
		title: "Automatic Backups",
		subtitle: "Never lose your content with Git-powered version control",
		btnLabel: "Get started",
		btnTo: HERO_BTN_CTA,
		// btnSecondaryLabel: "Learn more",
		// btnSecondaryTo: "/features/backups",
		bgImage: getBannerImageByPath("/img/bg/bg7.png"),
		noBgFilter: true,
	},

	// Features Block
	{
		type: BLOCK_TYPES.FEATURES,
		title: "Backup Features",
		features: [
			{
				title: "Git Version Control",
				description: "Every change is tracked with complete Git history",
				icon: RefreshCw,
			},
			{
				title: "Point-in-time Recovery",
				description: "Restore content to any previous state with a few clicks",
				icon: RotateCcw,
			},
			{
				title: "Complete History",
				description: "See who changed what and when for all your content",
				icon: History,
			},
			{
				title: "Local + Cloud",
				description: "Backups stored both locally and in secure cloud storage",
				icon: Cloud,
			},
		],
	},

	// Text Block
	{
		type: BLOCK_TYPES.TEXT,
		title: "Content Safety is Our Priority",
		content: `
      <p class="mb-4">In traditional CMS systems, content is often stored only in a database, making it vulnerable to loss. Our Git-based approach ensures that your content is backed up at every step.</p>
      <p class="mb-4">Key benefits of our backup system:</p>
      <ul class="list-disc pl-6 mb-4">
        <li>Automatic versioning of every content change</li>
        <li>Complete audit trail for all edits</li>
        <li>Ability to compare any two versions side by side</li>
        <li>One-click restore to any previous version</li>
        <li>Distributed backups across multiple systems</li>
      </ul>
    `,
	},

	// Cards Block
	{
		type: BLOCK_TYPES.CARDS,
		title: "Backup Capabilities",
		cards: [
			{
				title: "Automated Backups",
				description: "Every change is automatically backed up",
				icon: Clock,
			},
			{
				title: "Version Comparison",
				description: "Compare any versions to see exactly what changed",
				icon: DiffIcon,
			},
			{
				title: "Export & Archive",
				description: "Export your entire content history as needed",
				icon: Archive,
			},
			{
				title: "Local Clones",
				description: "Keep full backups on your local machine",
				icon: Download,
			},
		],
	},

	// CTA Block
	{
		type: BLOCK_TYPES.CTA,
		title: "Never Worry About Content Loss Again",
		subtitle: "Join thousands of users who trust us with their content backups",
		btnLabel: "Get Started Free",
		btnTo: HERO_BTN_CTA,
	},
];

export default blocks;
