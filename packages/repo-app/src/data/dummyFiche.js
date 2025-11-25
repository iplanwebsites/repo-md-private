// Dummy data for testing
export const dummyData = {
	profileMetadata: {
		name: "John Doe",
		gender: "man",
		pronouns: "he/him",
		userId: "USR123456789",
		createdAt: "2025-02-06T14:30:00Z",
		lastUpdated: "2025-02-06T14:30:00Z",
		assessmentVersion: "1.0.0",
		completionStatus: {
			portraitAuthentique: "COMPLETED",
			miroirEmotions: "COMPLETED",
			architecteVision: "COMPLETED",
		},
	},
	portraitAuthentique: {
		rawScores: {
			openness: 4.2,
			conscientiousness: 3.8,
			extraversion: 3.5,
			agreeableness: 4.0,
			neuroticism: 2.7,
		},
		percentiles: {
			openness: 85,
			conscientiousness: 65,
			extraversion: 55,
			agreeableness: 75,
			neuroticism: 35,
		},
		// New field for personality summary
		personalitySummary:
			"A highly adaptable individual with strong creative tendencies and emotional intelligence. Shows particular strength in building relationships while maintaining analytical rigor in decision-making.",
		extendedAnalysis: {
			identityStructure: {
				description:
					"Complex identity structure characterized by strong professional drive balanced with personal growth aspirations",
				strengths: [
					"Emotional intelligence",
					"Strategic thinking",
					"Adaptability",
				],
				values: ["Growth", "Authenticity", "Impact"],
				blockages: ["Perfectionism", "Decision paralysis under pressure"],
			},

			cognitivePatterns: {
				thinkingStyle: "Analytical with strong creative tendencies",
				decisionMaking: {
					primary: "Data-driven with intuitive validation",
					patterns: ["Seeks multiple perspectives", "Values long-term impact"],
					challenges: ["Analysis paralysis when stakes are high"],
				},
			},

			emotionalDynamics: {
				emotionalManagement: {
					strengths: ["High self-awareness", "Strong emotional regulation"],
					areas_for_growth: [
						"Stress management during high-pressure situations",
					],
				},
				resilience: {
					level: "High",
					factors: ["Strong support network", "Adaptive coping mechanisms"],
					development_areas: ["Building stress tolerance"],
				},
			},

			philosophicalDimension: {
				existentialAspirations: [
					"Creating lasting positive impact",
					"Personal mastery",
				],
				lifePhilosophy:
					"Believes in continuous growth and contribution to society",
				purposeAlignment: 0.85,
			},

			behavioralPatterns: {
				habits: {
					productive: ["Morning routine", "Regular reflection practices"],
					limiting: ["Overcommitment", "Perfectionist tendencies"],
				},
				stressResponse: {
					primary: "Analytical problem-solving",
					secondary: "Seeking social support",
					improvement_areas: [
						"Early stress recognition",
						"Preventive measures",
					],
				},
				interactionStyle: {
					primary: "Collaborative",
					strengths: ["Active listening", "Empathetic communication"],
					challenges: ["Setting boundaries", "Direct confrontation"],
				},
			},
		},
		analysis: {
			dominantTraits: ["openness", "agreeableness"],
			strengths: [
				{
					trait: "openness",
					description: "Strong curiosity and creative thinking",
					manifestations: [
						"Seeks novel experiences",
						"Enjoys abstract concepts",
						"Appreciates artistic expression",
					],
				},
			],
			developmentAreas: [
				{
					trait: "neuroticism",
					challenge: "Stress management",
					recommendations: [
						"Daily mindfulness practice",
						"Stress tracking journal",
						"Regular exercise routine",
					],
				},
			],
		},
	},
	miroirEmotions: {
		responses: [
			{
				stepId: 1,
				imageSymbol: "mountain_path",
				narrative:
					"I see myself at a crossroads, with the mountain representing my ultimate goal...",
				dominantEmotions: ["determination", "anticipation"],
				symbols: ["path", "mountain", "horizon"],
				intensity: 4,
			},
		],
		analysis: {
			recurringThemes: [
				{
					theme: "transformation",
					frequency: 3,
					associatedSymbols: ["butterfly", "bridge", "sunrise"],
					emotionalResponse: "positive",
				},
			],
			emotionalPatterns: {
				primaryEmotions: ["hope", "determination"],
				challengingEmotions: ["uncertainty"],
				emotionalResources: ["resilience", "adaptability"],
			},
			symbolMapping: {
				personal: ["light", "water", "bridge"],
				professional: ["mountain", "path", "star"],
				relational: ["tree", "circle", "hands"],
			},
		},
	},
	architecteVision: {
		foundationalStory: {
			keyMoments: [
				{
					age: 12,
					event: "First public speaking experience",
					impact: "Discovery of leadership abilities",
					emotions: ["pride", "accomplishment"],
				},
				{
					age: 17,
					event: "became pizza delivery boy",
					impact: "got autonomy and overcame shyness",
					emotions: ["autonomy", "accomplishment"],
				},
			],
			coreValues: ["authenticity", "growth", "connection"],
			lifeThemes: ["education", "personal development", "community"],
		},
		longTermVision: {
			threeDimensions: {
				personal:
					"Developing emotional mastery and maintaining work-life harmony",
				professional: "Creating innovative educational programs",
				social: "Building supportive communities",
			},
			legacy: {
				desired: "Empowering others through education and personal growth",
				impact: "Global",
				timeframe: "25+ years",
			},
		},
		perfectDay: {
			activities: [
				{
					timeBlock: "morning",
					activity: "Meditation and exercise",
					significance: "Energy and clarity",
				},
			],
			flowStates: [
				{
					activity: "Creative writing",
					duration: "2 hours",
					frequency: "daily",
				},
			],
		},
		fearsResilience: {
			coreFears: [
				{
					fear: "Not reaching full potential",
					root: "perfectionism",
					copingStrategy: "Setting realistic milestones",
				},
			],
			resilienceFactors: [
				"adaptability",
				"support network",
				"learning mindset",
			],
		},
		personalSuperpower: {
			primary: "Empathetic leadership",
			manifestations: ["Team building", "Conflict resolution", "Mentoring"],
			developmentAreas: ["Setting boundaries", "Self-advocacy"],
		},
		timeRelationship: {
			orientation: "future-focused",
			challenges: ["present-moment awareness"],
			strengths: ["long-term planning", "goal setting"],
		},
		lifeMission: {
			statement:
				"To inspire and empower others through education and personal development",
			keyElements: ["education", "empowerment", "community"],
			alignment: {
				withValues: 0.9,
				withStrengths: 0.85,
				withAspirations: 0.95,
			},
		},
	},
	integratedAnalysis: {
		coreDynamics: {
			primaryStrengths: [
				{
					area: "emotional intelligence",
					evidence: [
						"high agreeableness",
						"empathetic responses",
						"community focus",
					],
					applications: ["leadership", "mentoring", "relationship building"],
				},
			],
			growthOpportunities: [
				{
					area: "stress management",
					evidence: ["neuroticism scores", "perfectionism indicators"],
					recommendations: ["mindfulness practice", "boundary setting"],
				},
			],
		},
		coherenceIndicators: {
			valueAlignment: 0.88,
			behaviorConsistency: 0.85,
			narrativeIntegration: 0.92,
		},
		recommendedInterventions: [
			{
				focus: "Stress Management",
				type: "Skill Development",
				activities: ["Mindfulness training", "Time management workshop"],
				priority: "High",
				expectedOutcomes: ["Reduced anxiety", "Improved work-life balance"],
			},
		],
	},
};
