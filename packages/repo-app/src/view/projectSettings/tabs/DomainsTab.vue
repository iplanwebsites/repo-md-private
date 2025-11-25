<script setup>
import { ref, computed, watch } from "vue";
import { Link, Shield, ClipboardCopy, PlusCircle } from "lucide-vue-next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import SettingsCard from "@/components/SettingsCard.vue";
import SettingsHeading from "@/components/SettingsHeading.vue";
import { copyToClipboard } from "../utils";

const props = defineProps({
	project: {
		type: Object,
		default: null,
	},
});

// Form data
const customDomain = ref("");

// Computed properties
const projectHandle = computed(() => props.project?.slug || '[project-handle]');
const defaultDomainUrl = computed(() => `https://${projectHandle.value}.repo.md`);

// Initialize form data from props
const initializeFormData = () => {
	if (props.project) {
		// Initialize domains settings from project data if needed
	}
};

// Watch for project changes
watch(() => props.project, () => {
	initializeFormData();
}, { immediate: true });

// Copy default domain
const copyDefaultDomain = () => {
	copyToClipboard(defaultDomainUrl.value, "Default domain");
};

// Add custom domain
const addCustomDomain = () => {
	// TODO: Implement add custom domain functionality
	console.log("Adding custom domain:", customDomain.value);
	customDomain.value = "";
};
</script>

<template>
	<div>
		<SettingsHeading
			title="Domain Management"
			subtitle="Configure and manage your project's domains."
		>
			<Button size="sm" class="flex items-center">
				<PlusCircle class="h-4 w-4 mr-2" />
				Add Domain
			</Button>
		</SettingsHeading>

		<!-- Default Domain Card -->
		<SettingsCard
			title="Site Domains"
			description="Manage default and custom domains for your site."
			:save="false"
		>
			<ul class="space-y-4">
				<!-- Default Domain -->
				<li class="p-4 border rounded-md bg-muted/20">
					<div class="flex justify-between items-center">
						<div>
							<p class="font-medium text-sm mb-1">Default Domain</p>
							<p class="text-primary text-sm font-medium">
								{{ defaultDomainUrl }}
							</p>
							<p class="text-xs text-muted-foreground mt-1">
								Available immediately
							</p>
						</div>
						<Button variant="outline" size="sm" class="h-8" @click="copyDefaultDomain">
							<ClipboardCopy class="h-4 w-4 mr-2" />
							Copy
						</Button>
					</div>
				</li>

				<!-- Add Custom Domain Form -->
				<li class="p-4 border rounded-md bg-muted/20">
					<p class="font-medium text-sm mb-3">Add Custom Domain</p>
					<div class="space-y-4">
						<div>
							<Input 
								v-model="customDomain"
								placeholder="example.com" 
								class="w-full" 
								@keyup.enter="addCustomDomain"
							/>
							<p class="text-xs text-muted-foreground mt-1">
								Enter your custom domain without http:// or https://
							</p>
						</div>
						<div class="flex justify-end">
							<Button size="sm" class="h-8" @click="addCustomDomain">Add Domain</Button>
						</div>
					</div>
				</li>

				<!-- Domain Settings Note -->
				<li class="p-4 border rounded-md bg-muted/10 flex items-start gap-3">
					<Link class="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
					<div>
						<p class="text-sm font-medium mb-1">DNS Configuration</p>
						<p class="text-xs text-muted-foreground">
							To connect your custom domain, you'll need to configure your DNS settings. Point your domain to our servers using a CNAME record. <a href="/docs/domains" class="text-primary hover:underline">Learn more</a>
						</p>
					</div>
				</li>
			</ul>
		</SettingsCard>

		<!-- Domain Verification Card -->
		<SettingsCard
			title="SSL & Verification"
			description="Manage SSL certificates and domain verification."
			:save="false"
		>
			<div class="p-4 bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 rounded-md border border-blue-200 dark:border-blue-800 text-sm flex items-center gap-3">
				<Shield class="h-5 w-5" />
				<span>SSL certificates are provisioned automatically for all domains. Verification status will appear here after you add a custom domain.</span>
			</div>
		</SettingsCard>
	</div>
</template>