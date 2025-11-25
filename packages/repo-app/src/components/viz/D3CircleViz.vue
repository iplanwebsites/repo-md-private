<script setup>
import { ref, onMounted, onUnmounted, watch, computed } from "vue";
import { D3CircleViz } from "./d3CircleViz";

// Props
const props = defineProps({
  data: {
    type: Object,
    required: true,
    validator: (value) => {
      if (!value) return false;
      if (!Array.isArray(value.nodes)) {
        console.warn('D3CircleViz: data.nodes must be an array');
        return false;
      }
      if (!Array.isArray(value.edges)) {
        console.warn('D3CircleViz: data.edges must be an array');
        return false;
      }
      return true;
    },
  },
  width: {
    type: Number,
    default: 954,
  },
  showImages: {
    type: Boolean,
    default: true,
  },
  colors: {
    type: Object,
    default: () => ({
      in: "#00f",
      out: "#f00",
      image: "#ff8800",
      none: "#ccc",
    }),
  },
  title: {
    type: String,
    default: "Blog Post Relationships",
  },
  showHeader: {
    type: Boolean,
    default: true,
  },
  showControls: {
    type: Boolean,
    default: true,
  },
});

// Reactive data
const vizContainer = ref(null);
const includeImages = ref(false); // Default to false to hide images initially
let vizInstance = null;

// Computed properties
const description = computed(() => {
  return `This chart shows relationships between blog posts. Hover a post to reveal its outgoing links (<b style="color: ${
    props.colors.out
  };">linking to</b>), incoming links (<b style="color: ${
    props.colors.in
  };">linked from</b>), mutual links (<b style="color: ${
    props.colors.mutual || '#9900cc'
  };">bidirectional</b>)${
    includeImages.value
      ? `, and images (<b style="color: ${props.colors.image};">images</b>)`
      : ""
  }.`;
});

// Methods
const createVisualization = () => {
  if (!vizContainer.value) return;

  // Validate data before creating visualization
  if (!props.data || !Array.isArray(props.data.nodes) || !Array.isArray(props.data.edges)) {
    console.warn('D3CircleViz: Invalid data provided, skipping visualization');
    return;
  }

  // Destroy existing instance
  if (vizInstance) {
    vizInstance.destroy();
  }

  // Create new instance
  vizInstance = new D3CircleViz(vizContainer.value, {
    width: props.width,
    includeImages: includeImages.value,
    colors: props.colors,
  });

  vizInstance.setData(props.data).render();
};

const updateVisualization = () => {
  // Recreate the visualization to ensure proper filtering
  createVisualization();
};

// Watchers
watch(
  () => props.data,
  (newData) => {
    if (vizInstance && newData) {
      vizInstance.setData(newData).render();
    }
  },
  { deep: true }
);

watch(
  () => props.width,
  (newWidth) => {
    if (vizInstance) {
      vizInstance.updateOptions({ width: newWidth });
    }
  }
);

watch(
  () => props.colors,
  (newColors) => {
    if (vizInstance) {
      vizInstance.updateOptions({ colors: newColors });
    }
  },
  { deep: true }
);

// Watch for changes in includeImages
watch(includeImages, (newValue) => {
  console.log('includeImages changed to:', newValue);
  updateVisualization();
});

// Lifecycle hooks
onMounted(() => {
  createVisualization();
});

onUnmounted(() => {
  if (vizInstance) {
    vizInstance.destroy();
  }
});
</script>

<template>
  <div class="d3-circle-viz-container">
    <div class="viz-header" v-if="showHeader">
      <h2>{{ title }}</h2>
      <p v-html="description"></p>
    </div>
    <div ref="vizContainer" class="viz-content"></div>
    <div class="viz-controls" v-if="showControls">
      <label>
        <input
          type="checkbox"
          v-model="includeImages"
          @change="updateVisualization"
        />
        Show Images
      </label>
    </div>
  </div>
</template>

<style scoped>
.d3-circle-viz-container {
  width: 100%;
  font-family: var(
    --sans-serif,
    -apple-system,
    BlinkMacSystemFont,
    "Segoe UI",
    Roboto,
    sans-serif
  );
}

.viz-header {
  margin-bottom: 20px;
  color: #666;
}

.viz-header h2 {
  margin: 0 0 10px 0;
  font-size: 24px;
  font-weight: normal;
}

.viz-header p {
  margin: 0;
  font-size: 14px;
  line-height: 1.5;
}

.viz-content {
  width: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
}

.viz-controls {
  margin-top: 20px;
  text-align: center;
}

.viz-controls label {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  font-size: 14px;
  color: #666;
}

.viz-controls input[type="checkbox"] {
  cursor: pointer;
}

/* Ensure the SVG text is visible */
:deep(.viz-content text) {
  cursor: pointer;
}

:deep(.viz-content text:hover) {
  fill: #000;
}
</style>
