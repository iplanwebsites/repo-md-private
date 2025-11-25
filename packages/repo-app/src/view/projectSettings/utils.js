import { useToast } from "@/components/ui/toast/use-toast";
import trpc from "@/trpc";

export const saveProjectSettings = async (projectId, settings) => {
	const { toast } = useToast();
	
	try {
		const response = await trpc.projects.updateSettings.mutate({
			projectId,
			settings
		});
		
		toast({
			title: "Settings saved",
			description: "Your project settings have been updated successfully.",
		});
		
		return response;
	} catch (error) {
		console.error("Error saving settings:", error);
		toast({
			title: "Error saving settings",
			description: error.message || "Failed to save project settings. Please try again.",
			variant: "destructive",
		});
		throw error;
	}
};

export const copyToClipboard = async (text, label = "Text") => {
	const { toast } = useToast();
	
	try {
		await navigator.clipboard.writeText(text);
		toast({
			title: `${label} copied`,
			description: `${label} has been copied to clipboard.`,
		});
	} catch (error) {
		console.error("Error copying to clipboard:", error);
		toast({
			title: "Copy failed",
			description: "Failed to copy to clipboard. Please try again.",
			variant: "destructive",
		});
	}
};