import { BLOCK_TYPES, HERO_BTN_CTA, getBannerImageByPath } from "@/components/pushmd/blockTypes";
import {
	MapPin,
	Mail,
	Phone,
	MessageSquare,
	Clock,
	Globe,
	Instagram,
	Twitter,
	Linkedin,
	Github,
	 
} from "lucide-vue-next";
import { XIcon } from '@/lib/MyIcons.js'
// Define all blocks for the contact page
export const contactBlocks = [
	// Hero Block
	{
		type: BLOCK_TYPES.HERO,
		title: "Contact Us",
		subtitle:
			"We'd love to hear from you. Get in touch with our team for support, feedback, or partnership opportunities.",
		bgImage: getBannerImageByPath("/img/bg/bg9.png"),
		noBgFilter: false,
	},

	// Contact Info Section
	/*
  {
    type: BLOCK_TYPES.CARDS,
    title: "Get in Touch",
    cards: [
      {
        title: "Email Us",
        description: "hi@repo.md",
        icon: Mail,
      },
      {
        title: "Call Us",
        description: "+1 (555) 123-4567",
        icon: Phone,
      },
      {
        title: "Visit Us",
        description: "123 Innovation Street, Toronto, Canada",
        icon: MapPin,
      },
      {
        title: "Office Hours",
        description: "Monday - Friday, 9AM - 5PM EST",
        icon: Clock,
      },
    ],
  },*/

	// Contact Form Section
	{
		type: BLOCK_TYPES.CONTACT_FORM,
		title: "Send Us a Message",
		subtitle:
			"We'd love to hear from you. Fill out the form below and we'll get back to you as soon as possible.",
		buttonText: "Send Message",
		nameLabel: "Your Name",
		emailLabel: "Your Email",
		subjectLabel: "Subject",
		messageLabel: "Message",
		namePlaceholder: "John Doe",
		emailPlaceholder: "your@email.com",
		subjectPlaceholder: "How can we help you?",
		messagePlaceholder: "Your message here...",
		successMessage: "Thank you for your message! We'll get back to you soon.",
		endpoint: "/api/contact",
	},

	// Social Media Section
	{
		type: BLOCK_TYPES.FEATURES,
		title: "Connect With Us",
		features: [
			{
				title: "Follow Us on Social Media",
				description: "Stay updated with our latest news and announcements",
				icon: Globe,
			},
			{
				title: "Join Our Developer Community",
				description: "Collaborate with other developers using Repo.md",
				icon: MessageSquare,
			},
		],
	},

	// Social Media Links Section
	{
		type: BLOCK_TYPES.CARDS,
		cards: [
			{
				title: "X",
				description: "@repomd",
				icon: XIcon ,// Twitter,
				btnLabel: "Follow Us",
				btnHref: "https://x.com/repomd",
			},
			{
				title: "LinkedIn",
				description: "Repo.md",
				icon: Linkedin,
				btnLabel: "Connect",
				btnHref: "https://linkedin.com/company/repomd",
			},
			{
				title: "Instagram",
				description: "@repomd.official",
				icon: Instagram,
				btnLabel: "Follow",
				btnHref: "https://instagram.com/repomd.official",
			},
			{
				title: "GitHub",
				description: "repo-md",
				icon: Github,
				btnLabel: "Star Us",
				btnHref: "https://github.com/repo-md",
			},
		],
	},

	// Support CTA
	{
		type: BLOCK_TYPES.CTA,
		title: "Need Help?",
		subtitle:
			"Our support team is ready to assist you with any questions or issues.",
		btnLabel: "Visit Help Center",
		btnTo: "/help",
	},
];

export default contactBlocks;
