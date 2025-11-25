import { useToast } from "@/components/ui/toast/use-toast";
import trpc from "@/trpc";

export const setActiveDeployment = async (projectId, revisionId, options = {}) => {
	const { toast } = useToast();
	const { 
		onSuccess,
		onError,
		successMessage,
		successDescription,
		errorMessage = "Failed to activate deployment"
	} = options;
	
	try {
		const response = await trpc.projects.setActiveRevision.mutate({
			projectId,
			revisionId
		});
		
		// Use the message from the API response if available
		const title = successMessage || response.message || "Deployment activated";
		const description = successDescription || `Revision ${response.revision.shortId} is now active`;
		
		toast({
			title,
			description,
		});
		
		if (onSuccess) {
			onSuccess(response);
		}
		
		return response;
	} catch (error) {
		console.error("Error setting active deployment:", error);
		
		// Use specific error message from the API if available
		const errorDesc = error.message || "Failed to activate deployment. Please try again.";
		
		toast({
			title: errorMessage,
			description: errorDesc,
			variant: "destructive",
		});
		
		if (onError) {
			onError(error);
		}
		
		throw error;
	}
};