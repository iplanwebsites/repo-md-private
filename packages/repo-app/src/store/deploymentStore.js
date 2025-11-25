import { ref, computed } from 'vue';

// Reactive deployment status store
const currentDeploymentStatus = ref(null);

export function useDeploymentStatus() {
  // Set the deployment status
  const setDeploymentStatus = (status) => {
    currentDeploymentStatus.value = status;
  };

  // Get the deployment status color for breadcrumb
  const deploymentStatusColor = computed(() => {
    const status = currentDeploymentStatus.value?.toLowerCase();
    switch (status) {
      case "completed":
      case "success":
        return "green";
      case "failed":
      case "error":
        return "red";
      case "running":
      case "in_progress":
      case "processing":
        return "yellow";
      case "pending":
      case "queued":
        return "yellow";
      default:
        return "gray";
    }
  });

  // Clear deployment status (when leaving deployment pages)
  const clearDeploymentStatus = () => {
    currentDeploymentStatus.value = null;
  };

  return {
    currentDeploymentStatus,
    deploymentStatusColor,
    setDeploymentStatus,
    clearDeploymentStatus
  };
}