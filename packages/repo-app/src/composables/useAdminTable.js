import { ref, computed } from 'vue';
import { toast } from '@/components/ui/toast/use-toast.ts';
import trpc from '@/trpc.js';

export function useAdminTable(options = {}) {
  const {
    fetchFn,
    itemName = 'item',
    itemsName = 'items',
    searchFields = [],
    defaultLimit = 25
  } = options;

  // State
  const items = ref([]);
  const loading = ref(false);
  const searchQuery = ref('');
  const page = ref(1);
  const limit = ref(defaultLimit);
  const totalItems = ref(0);
  const stats = ref({});
  const selectedItem = ref(null);
  const showModal = ref(false);

  // Computed
  const totalPages = computed(() => Math.ceil(totalItems.value / limit.value));

  // Methods
  async function fetchItems(params = {}) {
    loading.value = true;
    
    try {
      const data = await fetchFn({
        page: page.value,
        limit: limit.value,
        search: searchQuery.value,
        ...params
      });
      
      items.value = data.items || [];
      totalItems.value = data.total || 0;
      
      if (data.stats) {
        stats.value = data.stats;
      }
    } catch (error) {
      console.error(`Error fetching ${itemsName}:`, error);
      toast({
        title: 'Error',
        description: `Failed to load ${itemsName}`,
        variant: 'destructive'
      });
    } finally {
      loading.value = false;
    }
  }

  function viewItem(item) {
    selectedItem.value = item;
    showModal.value = true;
  }

  function searchItems(items) {
    if (!searchQuery.value || searchFields.length === 0) {
      return items;
    }
    
    const query = searchQuery.value.toLowerCase();
    return items.filter(item => 
      searchFields.some(field => {
        const value = getNestedProperty(item, field);
        return value && String(value).toLowerCase().includes(query);
      })
    );
  }

  function getNestedProperty(obj, path) {
    return path.split('.').reduce((curr, prop) => curr?.[prop], obj);
  }

  async function deleteItem(item, deleteFn, confirmMessage) {
    if (!confirm(confirmMessage || `Are you sure you want to delete this ${itemName}?`)) {
      return;
    }
    
    try {
      await deleteFn(item);
      
      // Remove from local state
      items.value = items.value.filter(i => i.id !== item.id);
      totalItems.value--;
      
      toast({
        title: 'Success',
        description: `${itemName} deleted successfully`,
      });
    } catch (error) {
      console.error(`Error deleting ${itemName}:`, error);
      toast({
        title: 'Error',
        description: `Failed to delete ${itemName}`,
        variant: 'destructive'
      });
    }
  }

  async function exportItems(exportFn, filename) {
    try {
      const data = await exportFn({ format: 'csv' });
      
      // Create blob and download
      const blob = new Blob([data], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename || `${itemsName}-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
      
      toast({
        title: 'Success',
        description: `${itemsName} exported successfully`,
      });
    } catch (error) {
      console.error(`Error exporting ${itemsName}:`, error);
      toast({
        title: 'Error',
        description: `Failed to export ${itemsName}`,
        variant: 'destructive'
      });
    }
  }

  // Pagination helpers
  function goToPage(newPage) {
    page.value = newPage;
    fetchItems();
  }

  function nextPage() {
    if (page.value < totalPages.value) {
      page.value++;
      fetchItems();
    }
  }

  function prevPage() {
    if (page.value > 1) {
      page.value--;
      fetchItems();
    }
  }

  return {
    // State
    items,
    loading,
    searchQuery,
    page,
    limit,
    totalItems,
    totalPages,
    stats,
    selectedItem,
    showModal,
    
    // Methods
    fetchItems,
    viewItem,
    searchItems,
    deleteItem,
    exportItems,
    goToPage,
    nextPage,
    prevPage
  };
}

// Common formatting functions
export function formatDate(dateString) {
  if (!dateString) return '—';
  return new Date(dateString).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

export function formatSize(bytes) {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export function formatDuration(seconds) {
  if (!seconds) return '—';
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds}s`;
}

export function formatCurrency(amount) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(amount || 0);
}