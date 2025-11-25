<script setup>
import { ref, onMounted, onUnmounted, watch, computed } from 'vue';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer';
import TSNE from 'tsne-js';
import { PCA } from 'ml-pca';

const props = defineProps({
  embeddings: {
    type: Object,
    required: true,
    validator: (value) => {
      return value && typeof value === 'object';
    }
  },
  graphData: {
    type: Object,
    default: null
  },
  width: {
    type: Number,
    default: 800
  },
  height: {
    type: Number,
    default: 600
  },
  is3D: {
    type: Boolean,
    default: true
  },
  reductionMethod: {
    type: String,
    default: 'pca',
    validator: (value) => ['pca', 'tsne', 'umap'].includes(value)
  }
});

const container = ref(null);
let scene, camera, perspectiveCamera, orthographicCamera, renderer, labelRenderer, controls;
let nodeObjects = new Map();
let edgeObjects = [];
const nodeEdgeMap = new Map(); // Map nodes to their connected edges
let raycaster, mouse;
const hoveredNode = ref(null);
const selectedNode = ref(null);
const isComputing = ref(false);

// Configuration flag for label visibility
const SHOW_LABELS_ONLY_ON_HOVER = true;

// Store original materials for restoration
const originalMaterials = new Map();

// Cache for computed reductions
const reductionCache = new Map();

const dimensionReducer = {
  pca2D: (embeddings) => {
    const cacheKey = 'pca2D';
    if (reductionCache.has(cacheKey)) {
      return reductionCache.get(cacheKey);
    }
    
    const vectors = Object.values(embeddings);
    const keys = Object.keys(embeddings);
    if (vectors.length === 0) return {};
    
    try {
      // Use ml-pca for proper PCA
      const pca = new PCA(vectors);
      const projected = pca.predict(vectors, { nComponents: 2 });
      
      const result = {};
      projected.forEach((coords, idx) => {
        result[keys[idx]] = [coords[0], coords[1]];
      });
      
      reductionCache.set(cacheKey, result);
      return result;
    } catch (error) {
      console.error('PCA failed:', error);
      // Fallback to simple projection
      const result = {};
      vectors.forEach((vec, idx) => {
        const x = vec.reduce((sum, v, i) => sum + v * Math.cos(i * 0.1), 0);
        const y = vec.reduce((sum, v, i) => sum + v * Math.sin(i * 0.1), 0);
        result[keys[idx]] = [x, y];
      });
      return result;
    }
  },
  
  pca3D: (embeddings) => {
    const cacheKey = 'pca3D';
    if (reductionCache.has(cacheKey)) {
      return reductionCache.get(cacheKey);
    }
    
    const vectors = Object.values(embeddings);
    const keys = Object.keys(embeddings);
    if (vectors.length === 0) return {};
    
    try {
      // Use ml-pca for proper PCA
      const pca = new PCA(vectors);
      const projected = pca.predict(vectors, { nComponents: 3 });
      
      const result = {};
      projected.forEach((coords, idx) => {
        result[keys[idx]] = [coords[0], coords[1], coords[2]];
      });
      
      reductionCache.set(cacheKey, result);
      return result;
    } catch (error) {
      console.error('PCA 3D failed:', error);
      // Fallback
      const result = {};
      vectors.forEach((vec, idx) => {
        const x = vec.reduce((sum, v, i) => sum + v * Math.cos(i * 0.1), 0);
        const y = vec.reduce((sum, v, i) => sum + v * Math.sin(i * 0.1), 0);
        const z = vec.reduce((sum, v, i) => sum + v * Math.cos(i * 0.2 + Math.PI/4), 0);
        result[keys[idx]] = [x, y, z];
      });
      return result;
    }
  },
  
  tsne2D: (embeddings) => {
    const cacheKey = 'tsne2D';
    if (reductionCache.has(cacheKey)) {
      return reductionCache.get(cacheKey);
    }
    
    const vectors = Object.values(embeddings);
    const keys = Object.keys(embeddings);
    if (vectors.length === 0) return {};
    
    try {
      // Initialize t-SNE
      const tsne = new TSNE({
        dim: 2,
        perplexity: Math.min(30, Math.floor(vectors.length / 4)),
        earlyExaggeration: 4.0,
        learningRate: 100.0,
        nIter: 500,
        metric: 'euclidean'
      });
      
      // Initialize with data
      tsne.init({
        data: vectors,
        type: 'dense'
      });
      
      // Run t-SNE
      tsne.run();
      
      // Get output
      const output = tsne.getOutput();
      
      const result = {};
      output.forEach((coords, idx) => {
        result[keys[idx]] = coords;
      });
      
      reductionCache.set(cacheKey, result);
      return result;
    } catch (error) {
      console.error('t-SNE failed:', error);
      // Fallback
      const result = {};
      for (const [key, vec] of Object.entries(embeddings)) {
        const angle = Math.random() * Math.PI * 2;
        const radius = Math.sqrt(Math.random()) * 10;
        result[key] = [
          Math.cos(angle) * radius,
          Math.sin(angle) * radius
        ];
      }
      return result;
    }
  },
  
  tsne3D: (embeddings) => {
    const cacheKey = 'tsne3D';
    if (reductionCache.has(cacheKey)) {
      return reductionCache.get(cacheKey);
    }
    
    const vectors = Object.values(embeddings);
    const keys = Object.keys(embeddings);
    if (vectors.length === 0) return {};
    
    try {
      // Initialize t-SNE for 3D
      const tsne = new TSNE({
        dim: 3,
        perplexity: Math.min(30, Math.floor(vectors.length / 4)),
        earlyExaggeration: 4.0,
        learningRate: 100.0,
        nIter: 500,
        metric: 'euclidean'
      });
      
      // Initialize with data
      tsne.init({
        data: vectors,
        type: 'dense'
      });
      
      // Run t-SNE
      tsne.run();
      
      // Get output
      const output = tsne.getOutput();
      
      const result = {};
      output.forEach((coords, idx) => {
        result[keys[idx]] = coords;
      });
      
      reductionCache.set(cacheKey, result);
      return result;
    } catch (error) {
      console.error('t-SNE 3D failed:', error);
      // Fallback
      const result = {};
      for (const [key, vec] of Object.entries(embeddings)) {
        result[key] = [
          (Math.random() - 0.5) * 20,
          (Math.random() - 0.5) * 20,
          (Math.random() - 0.5) * 20
        ];
      }
      return result;
    }
  },
  
  umap2D: (embeddings) => {
    // UMAP-like dimensionality reduction (simplified)
    // In production, you'd use a proper UMAP implementation
    const vectors = Object.values(embeddings);
    const keys = Object.keys(embeddings);
    if (vectors.length === 0) return {};
    
    const result = {};
    
    // Simple UMAP approximation using random neighbor graphs
    vectors.forEach((vec, idx) => {
      // Simulate UMAP's local/global structure preservation
      const angle = (idx / vectors.length) * Math.PI * 2;
      const radius = 5 + Math.random() * 10;
      
      // Add some clustering based on vector similarity
      const cluster = vec.reduce((sum, v) => sum + v, 0) > 0 ? 1 : -1;
      
      result[keys[idx]] = [
        Math.cos(angle) * radius + cluster * 5,
        Math.sin(angle) * radius + Math.random() * 2
      ];
    });
    
    return result;
  },
  
  umap3D: (embeddings) => {
    // UMAP-like 3D reduction
    const vectors = Object.values(embeddings);
    const keys = Object.keys(embeddings);
    if (vectors.length === 0) return {};
    
    const result = {};
    
    vectors.forEach((vec, idx) => {
      // Simulate UMAP's manifold learning
      const theta = (idx / vectors.length) * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const radius = 5 + Math.random() * 10;
      
      // Add clustering
      const cluster = vec.reduce((sum, v) => sum + v, 0) > 0 ? 1 : -1;
      
      result[keys[idx]] = [
        Math.sin(phi) * Math.cos(theta) * radius + cluster * 3,
        Math.sin(phi) * Math.sin(theta) * radius,
        Math.cos(phi) * radius + Math.random() * 2
      ];
    });
    
    return result;
  }
};

const reducedPositions = computed(() => {
  if (!props.embeddings) return {};
  
  const methodSuffix = props.is3D ? '3D' : '2D';
  const method = props.reductionMethod + methodSuffix;
  
  // Set computing state for async operations
  if (props.reductionMethod === 'tsne' && !reductionCache.has(method)) {
    isComputing.value = true;
    // Use setTimeout to allow UI to update
    setTimeout(() => {
      isComputing.value = false;
    }, 100);
  }
  
  // Fallback to PCA if method doesn't exist
  const reducer = dimensionReducer[method] || dimensionReducer[`pca${methodSuffix}`];
  const result = reducer(props.embeddings);
  
  return result;
});

const normalizePositions = (positions) => {
  const values = Object.values(positions);
  if (values.length === 0) return positions;
  
  // Find bounds
  const bounds = {
    min: [...values[0]],
    max: [...values[0]]
  };
  
  for (const pos of values) {
    for (let i = 0; i < pos.length; i++) {
      bounds.min[i] = Math.min(bounds.min[i], pos[i]);
      bounds.max[i] = Math.max(bounds.max[i], pos[i]);
    }
  }
  
  // Normalize to [-10, 10] range
  const normalized = {};
  const scale = 20;
  
  for (const [key, pos] of Object.entries(positions)) {
    normalized[key] = pos.map((v, i) => {
      const range = bounds.max[i] - bounds.min[i];
      return range > 0 ? ((v - bounds.min[i]) / range - 0.5) * scale : 0;
    });
  }
  
  return normalized;
};

const initThreeJS = () => {
  if (!container.value) return;
  
  // Scene setup
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0xffffff);
  
  // Camera setup - both perspective and orthographic
  const aspect = props.width / props.height;
  
  // Perspective camera for 3D view
  perspectiveCamera = new THREE.PerspectiveCamera(45, aspect, 0.1, 1000);
  perspectiveCamera.position.set(0, 0, 40);
  
  // Orthographic camera for 2D view
  const frustumSize = 30;
  orthographicCamera = new THREE.OrthographicCamera(
    frustumSize * aspect / -2,
    frustumSize * aspect / 2,
    frustumSize / 2,
    frustumSize / -2,
    0.1,
    1000
  );
  orthographicCamera.position.set(0, 0, 50);
  orthographicCamera.lookAt(0, 0, 0);
  
  // Set initial camera based on mode
  camera = props.is3D ? perspectiveCamera : orthographicCamera;
  
  // Renderer setup
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(props.width, props.height);
  container.value.appendChild(renderer.domElement);
  
  // Label renderer
  labelRenderer = new CSS2DRenderer();
  labelRenderer.setSize(props.width, props.height);
  labelRenderer.domElement.style.position = 'absolute';
  labelRenderer.domElement.style.top = '0px';
  labelRenderer.domElement.style.pointerEvents = 'none';
  container.value.appendChild(labelRenderer.domElement);
  
  // Controls
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  
  // For 2D view, disable rotation
  if (!props.is3D) {
    controls.enableRotate = false;
    controls.enablePan = true;
    controls.enableZoom = true;
  }
  
  // Lights
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
  scene.add(ambientLight);
  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.4);
  directionalLight.position.set(10, 10, 10);
  scene.add(directionalLight);
  
  // Raycaster for interaction
  raycaster = new THREE.Raycaster();
  mouse = new THREE.Vector2();
  
  // Grid and axes helpers based on view mode
  if (props.is3D) {
    const gridHelper = new THREE.GridHelper(30, 30, 0xcccccc, 0xeeeeee);
    scene.add(gridHelper);
    
    const axesHelper = new THREE.AxesHelper(15);
    scene.add(axesHelper);
  } else {
    // For 2D view, add a subtle grid in the XY plane
    const gridHelper = new THREE.GridHelper(30, 30, 0xeeeeee, 0xf5f5f5);
    gridHelper.rotation.x = Math.PI / 2;
    scene.add(gridHelper);
  }
};

// Helper function to generate color from string (for folder-based coloring)
const stringToColor = (str) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  const h = hash % 360;
  const s = 70 + (hash % 30); // 70-100% saturation
  const l = 45 + (hash % 20); // 45-65% lightness
  
  // Convert HSL to hex
  const hslToHex = (h, s, l) => {
    h = h / 360;
    s = s / 100;
    l = l / 100;
    
    let r, g, b;
    
    if (s === 0) {
      r = g = b = l;
    } else {
      const hue2rgb = (p, q, t) => {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1/6) return p + (q - p) * 6 * t;
        if (t < 1/2) return q;
        if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
        return p;
      };
      
      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      r = hue2rgb(p, q, h + 1/3);
      g = hue2rgb(p, q, h);
      b = hue2rgb(p, q, h - 1/3);
    }
    
    const toHex = x => {
      const hex = Math.round(x * 255).toString(16);
      return hex.length === 1 ? '0' + hex : hex;
    };
    
    return parseInt(`0x${toHex(r)}${toHex(g)}${toHex(b)}`, 16);
  };
  
  return hslToHex(h, s, l);
};

const createNodes = () => {
  if (!scene || !props.graphData || !props.graphData.nodes || !reducedPositions.value) return;
  
  // Clear existing nodes
  nodeObjects.forEach(obj => {
    if (scene && obj.mesh) scene.remove(obj.mesh);
    if (scene && obj.label) scene.remove(obj.label);
  });
  nodeObjects.clear();
  
  const positions = normalizePositions(reducedPositions.value);
  const nodeGeometry = new THREE.SphereGeometry(0.3, 16, 16);
  
  // Extract unique folders for color mapping
  const folders = new Set();
  
  // Debug: log first post node to see its structure
  const firstPostNode = props.graphData.nodes.find(n => n.type === 'post');
  if (firstPostNode) {
    console.log('Post node structure:', firstPostNode);
  }
  
  props.graphData.nodes.forEach(node => {
    if (node.type === 'post') {
      // For posts, the id is typically the full path (e.g., "content/blog/post.md")
      // The label is typically just the filename
      const filePath = node.id || node.path || node.label || '';
      const folder = filePath.includes('/') 
        ? filePath.substring(0, filePath.lastIndexOf('/'))
        : 'root';
      folders.add(folder);
    }
  });
  
  // Create nodes
  props.graphData.nodes.forEach(node => {
    const position = positions[node.id];
    if (!position) return;
    
    // Determine color based on type and folder
    let color;
    if (node.type === 'media') {
      color = 0xf59e0b; // Orange for media
    } else if (node.type === 'post') {
      // Color by folder - the id is typically the full path
      const filePath = node.id || node.path || node.label || '';
      const folder = filePath.includes('/') 
        ? filePath.substring(0, filePath.lastIndexOf('/'))
        : 'root';
      color = stringToColor(folder);
    } else {
      color = 0x10b981; // Default green
    }
    
    const material = new THREE.MeshPhongMaterial({ 
      color,
      emissive: color,
      emissiveIntensity: 0.2
    });
    
    // Store original material for restoration
    originalMaterials.set(node.id, material);
    
    const mesh = new THREE.Mesh(nodeGeometry, material);
    
    // Position nodes appropriately for 2D vs 3D
    if (props.is3D) {
      mesh.position.set(
        position[0],
        position[1],
        position[2] || 0
      );
    } else {
      // For 2D, use X and Y, set Z to 0
      mesh.position.set(
        position[0],
        position[1],
        0
      );
    }
    
    mesh.userData = { node };
    scene.add(mesh);
    
    // Create label
    const labelDiv = document.createElement('div');
    labelDiv.className = 'node-label';
    
    // Get filename and folder info
    const filename = node.label.split('/').pop();
    const filePath = node.id || node.path || node.label || '';
    const folder = filePath.includes('/') 
      ? filePath.substring(0, filePath.lastIndexOf('/'))
      : 'root';
    
    // Show folder info in label on hover
    labelDiv.innerHTML = `
      <div style="font-weight: 600;">${filename}</div>
      ${folder !== 'root' ? `<div style="font-size: 10px; color: #666; margin-top: 2px;">${folder}</div>` : ''}
    `;
    
    labelDiv.style.fontSize = '12px';
    labelDiv.style.color = '#333';
    labelDiv.style.backgroundColor = 'rgba(255, 255, 255, 0.95)';
    labelDiv.style.padding = '4px 8px';
    labelDiv.style.borderRadius = '4px';
    labelDiv.style.border = '1px solid #ddd';
    labelDiv.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
    labelDiv.style.display = SHOW_LABELS_ONLY_ON_HOVER ? 'none' : 'block';
    labelDiv.style.visibility = SHOW_LABELS_ONLY_ON_HOVER ? 'hidden' : 'visible'; // Also set visibility
    labelDiv.style.opacity = SHOW_LABELS_ONLY_ON_HOVER ? '0' : '1'; // And opacity for good measure
    labelDiv.style.transition = 'opacity 0.2s ease-in-out'; // Smooth transition
    
    const label = new CSS2DObject(labelDiv);
    label.position.copy(mesh.position);
    scene.add(label);
    
    nodeObjects.set(node.id, { mesh, label, labelDiv });
  });
};

const createEdges = () => {
  if (!scene || !props.graphData || !props.graphData.edges) return;
  
  // Clear existing edges and mappings
  edgeObjects.forEach(obj => {
    if (scene) scene.remove(obj.line);
  });
  edgeObjects = [];
  nodeEdgeMap.clear();
  
  const edgeMaterial = new THREE.LineBasicMaterial({ 
    color: 0xcccccc,
    opacity: 0.3,
    transparent: true
  });
  
  props.graphData.edges.forEach(edge => {
    const sourceObj = nodeObjects.get(edge.source);
    const targetObj = nodeObjects.get(edge.target);
    
    if (!sourceObj || !targetObj) return;
    
    const points = [
      sourceObj.mesh.position,
      targetObj.mesh.position
    ];
    
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const line = new THREE.Line(geometry, edgeMaterial.clone()); // Clone material for individual control
    scene.add(line);
    
    const edgeObj = {
      line,
      source: edge.source,
      target: edge.target,
      material: line.material
    };
    
    edgeObjects.push(edgeObj);
    
    // Map nodes to their edges
    if (!nodeEdgeMap.has(edge.source)) {
      nodeEdgeMap.set(edge.source, []);
    }
    if (!nodeEdgeMap.has(edge.target)) {
      nodeEdgeMap.set(edge.target, []);
    }
    nodeEdgeMap.get(edge.source).push(edgeObj);
    nodeEdgeMap.get(edge.target).push(edgeObj);
  });
};

const animate = () => {
  requestAnimationFrame(animate);
  
  if (controls) {
    controls.update();
  }
  
  if (renderer && camera && scene) {
    renderer.render(scene, camera);
  }
  
  if (labelRenderer && camera && scene) {
    labelRenderer.render(scene, camera);
  }
};

const onMouseMove = (event) => {
  const rect = container.value.getBoundingClientRect();
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  
  raycaster.setFromCamera(mouse, camera);
  
  const intersects = raycaster.intersectObjects(
    Array.from(nodeObjects.values()).map(obj => obj.mesh)
  );
  
  // Reset previous hover
  if (hoveredNode.value) {
    const prevObj = nodeObjects.get(hoveredNode.value);
    
    // Hide label
    if (prevObj && prevObj.labelDiv && SHOW_LABELS_ONLY_ON_HOVER) {
      prevObj.labelDiv.style.display = 'none';
      prevObj.labelDiv.style.visibility = 'hidden';
      prevObj.labelDiv.style.opacity = '0';
    }
    
    // Restore original node material
    if (prevObj && prevObj.mesh) {
      const originalMaterial = originalMaterials.get(hoveredNode.value);
      if (originalMaterial) {
        prevObj.mesh.material = originalMaterial;
      }
    }
    
    // Reset edge highlights
    const connectedEdges = nodeEdgeMap.get(hoveredNode.value) || [];
    connectedEdges.forEach(edgeObj => {
      edgeObj.material.color.setHex(0xcccccc);
      edgeObj.material.opacity = 0.3;
      edgeObj.material.needsUpdate = true;
    });
  }
  
  if (intersects.length > 0) {
    const node = intersects[0].object.userData.node;
    hoveredNode.value = node.id;
    
    const nodeObj = nodeObjects.get(node.id);
    
    // Show label
    if (nodeObj && nodeObj.labelDiv && SHOW_LABELS_ONLY_ON_HOVER) {
      nodeObj.labelDiv.style.display = 'block';
      nodeObj.labelDiv.style.visibility = 'visible';
      nodeObj.labelDiv.style.opacity = '1';
    }
    
    // Highlight node in red
    if (nodeObj && nodeObj.mesh) {
      const highlightMaterial = new THREE.MeshPhongMaterial({
        color: 0xff0000,
        emissive: 0xff0000,
        emissiveIntensity: 0.3
      });
      nodeObj.mesh.material = highlightMaterial;
    }
    
    // Highlight connected edges
    const connectedEdges = nodeEdgeMap.get(node.id) || [];
    connectedEdges.forEach(edgeObj => {
      edgeObj.material.color.setHex(0xff0000);
      edgeObj.material.opacity = 0.8;
      edgeObj.material.needsUpdate = true;
    });
    
    container.value.style.cursor = 'pointer';
  } else {
    hoveredNode.value = null;
    container.value.style.cursor = 'default';
  }
};

const onClick = (event) => {
  const rect = container.value.getBoundingClientRect();
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  
  raycaster.setFromCamera(mouse, camera);
  
  const intersects = raycaster.intersectObjects(
    Array.from(nodeObjects.values()).map(obj => obj.mesh)
  );
  
  if (intersects.length > 0) {
    const node = intersects[0].object.userData.node;
    selectedNode.value = node;
  }
};

const onResize = () => {
  if (!camera || !renderer || !labelRenderer) return;
  
  const width = container.value.clientWidth;
  const height = container.value.clientHeight;
  
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  
  renderer.setSize(width, height);
  labelRenderer.setSize(width, height);
};

onMounted(() => {
  initThreeJS();
  createNodes();
  createEdges();
  animate();
  
  container.value.addEventListener('mousemove', onMouseMove);
  container.value.addEventListener('click', onClick);
  window.addEventListener('resize', onResize);
});

onUnmounted(() => {
  if (container.value) {
    container.value.removeEventListener('mousemove', onMouseMove);
    container.value.removeEventListener('click', onClick);
  }
  window.removeEventListener('resize', onResize);
  
  if (renderer) {
    renderer.dispose();
  }
});

watch(() => props.is3D, (is3D) => {
  if (!perspectiveCamera || !orthographicCamera || !controls) return;
  
  // Switch camera
  camera = is3D ? perspectiveCamera : orthographicCamera;
  
  // Update controls
  controls.dispose();
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  
  if (!is3D) {
    // 2D view settings
    controls.enableRotate = false;
    controls.enablePan = true;
    controls.enableZoom = true;
    
    // Reset camera position for top-down view
    camera.position.set(0, 0, 50);
    camera.lookAt(0, 0, 0);
  } else {
    // 3D view settings
    controls.enableRotate = true;
    controls.enablePan = true;
    controls.enableZoom = true;
  }
  
  // Recreate nodes with appropriate positioning
  createNodes();
  createEdges();
});

watch(() => props.embeddings, () => {
  createNodes();
  createEdges();
});

watch(() => props.reductionMethod, () => {
  // Clear cache when method changes
  reductionCache.clear();
  createNodes();
  createEdges();
});
</script>

<template>
  <div class="threejs-graph-container">
    <div ref="container" class="threejs-canvas" :style="{ width: width + 'px', height: height + 'px', position: 'relative' }">
      <!-- Computing indicator -->
      <div v-if="isComputing" class="computing-overlay">
        <div class="computing-message">
          <div class="spinner"></div>
          <span>Computing {{ reductionMethod.toUpperCase() }}...</span>
        </div>
      </div>
    </div>
    
    <div v-if="selectedNode" class="node-details">
      <h3>{{ selectedNode.label }}</h3>
      <p>Type: {{ selectedNode.type }}</p>
      <button @click="selectedNode = null" class="close-btn">×</button>
    </div>
  </div>
</template>

<style scoped>
.threejs-graph-container {
  position: relative;
}

.threejs-canvas {
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  overflow: hidden;
}

.computing-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(255, 255, 255, 0.9);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10;
}

.computing-message {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 14px;
  color: #4b5563;
}

.spinner {
  width: 20px;
  height: 20px;
  border: 2px solid #e5e7eb;
  border-top-color: #3b82f6;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.node-details {
  position: absolute;
  top: 10px;
  right: 10px;
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  padding: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  min-width: 200px;
}

.node-details h3 {
  margin: 0 0 8px 0;
  font-size: 14px;
  font-weight: 600;
}

.node-details p {
  margin: 0;
  font-size: 12px;
  color: #6b7280;
}

.close-btn {
  position: absolute;
  top: 8px;
  right: 8px;
  background: none;
  border: none;
  font-size: 20px;
  cursor: pointer;
  color: #6b7280;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
}

.close-btn:hover {
  background: #f3f4f6;
}

:global(.node-label) {
  pointer-events: none !important;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}
</style>