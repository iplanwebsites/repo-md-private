/**
 * Graph clustering algorithms for optimizing node ordering in circular layouts
 */

/**
 * Extract folder path from node label or path
 */
function getNodeFolder(node) {
  // Assuming nodes have a path property or we can extract from label
  // For nodes without explicit path, try to extract from label
  let path = node.path || node.label || '';
  
  // If the label looks like a path (contains /), use it
  if (!node.path && node.label && node.label.includes('/')) {
    path = node.label;
  }
  
  const parts = path.split('/');
  // Return folder path (everything except filename)
  return parts.length > 1 ? parts.slice(0, -1).join('/') : '/';
}

/**
 * Sort nodes by degree (total connections)
 */
export function sortByDegree(nodes, edges, options = {}) {
  const { groupByFolder = false } = options;
  
  // Calculate degree for each node
  const nodeDegrees = new Map();
  
  nodes.forEach(node => {
    nodeDegrees.set(node.id, { node, degree: 0 });
  });
  
  edges.forEach(edge => {
    if (nodeDegrees.has(edge.source)) {
      nodeDegrees.get(edge.source).degree++;
    }
    if (nodeDegrees.has(edge.target)) {
      nodeDegrees.get(edge.target).degree++;
    }
  });
  
  let sortedNodes = Array.from(nodeDegrees.values())
    .sort((a, b) => b.degree - a.degree || a.node.label.localeCompare(b.node.label))
    .map(item => item.node);
  
  if (groupByFolder) {
    sortedNodes = groupNodesByFolder(sortedNodes);
  }
  
  return sortedNodes;
}

/**
 * Community detection using simplified Louvain algorithm
 */
export function detectCommunities(nodes, edges, options = {}) {
  const { groupByFolder = false } = options;
  
  // Create adjacency list
  const adjacency = new Map();
  nodes.forEach(node => adjacency.set(node.id, new Set()));
  
  edges.forEach(edge => {
    adjacency.get(edge.source)?.add(edge.target);
    adjacency.get(edge.target)?.add(edge.source);
  });
  
  // Simple community detection: nodes that share many connections
  const communities = new Map();
  let communityId = 0;
  
  nodes.forEach(node => {
    if (!communities.has(node.id)) {
      // Start new community
      const community = new Set([node.id]);
      const queue = [node.id];
      
      while (queue.length > 0) {
        const current = queue.shift();
        const neighbors = adjacency.get(current) || new Set();
        
        neighbors.forEach(neighbor => {
          if (!communities.has(neighbor)) {
            // Check if neighbor shares enough connections
            const sharedConnections = countSharedConnections(current, neighbor, adjacency);
            if (sharedConnections >= 2) {
              community.add(neighbor);
              communities.set(neighbor, communityId);
              queue.push(neighbor);
            }
          }
        });
      }
      
      // Assign community to all members
      community.forEach(memberId => communities.set(memberId, communityId));
      communityId++;
    }
  });
  
  // Sort nodes by community, then by degree within community
  const nodesByCommunity = new Map();
  nodes.forEach(node => {
    const comm = communities.get(node.id) || -1;
    if (!nodesByCommunity.has(comm)) {
      nodesByCommunity.set(comm, []);
    }
    nodesByCommunity.get(comm).push(node);
  });
  
  let sortedNodes = [];
  Array.from(nodesByCommunity.entries())
    .sort((a, b) => a[0] - b[0])
    .forEach(([_, communityNodes]) => {
      sortedNodes.push(...sortByDegree(communityNodes, edges));
    });
  
  if (groupByFolder) {
    sortedNodes = groupNodesByFolder(sortedNodes);
  }
  
  return sortedNodes;
}

/**
 * Spectral ordering using simplified Fiedler vector approach
 */
export function spectralOrdering(nodes, edges, options = {}) {
  const { groupByFolder = false } = options;
  
  // Create adjacency matrix
  const nodeIndex = new Map();
  nodes.forEach((node, i) => nodeIndex.set(node.id, i));
  
  const n = nodes.length;
  const adjacency = Array(n).fill(null).map(() => Array(n).fill(0));
  const degree = Array(n).fill(0);
  
  edges.forEach(edge => {
    const i = nodeIndex.get(edge.source);
    const j = nodeIndex.get(edge.target);
    if (i !== undefined && j !== undefined) {
      adjacency[i][j] = 1;
      adjacency[j][i] = 1;
      degree[i]++;
      degree[j]++;
    }
  });
  
  // Compute Laplacian (simplified)
  const laplacian = Array(n).fill(null).map(() => Array(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i === j) {
        laplacian[i][j] = degree[i];
      } else {
        laplacian[i][j] = -adjacency[i][j];
      }
    }
  }
  
  // Simplified spectral ordering: use node connectivity patterns
  // (Full eigenvalue computation would require a linear algebra library)
  const scores = nodes.map((node, i) => {
    let score = 0;
    for (let j = 0; j < n; j++) {
      if (adjacency[i][j]) {
        score += j; // Position-weighted connections
      }
    }
    return { node, score: score / Math.max(degree[i], 1) };
  });
  
  let sortedNodes = scores
    .sort((a, b) => a.score - b.score)
    .map(item => item.node);
  
  if (groupByFolder) {
    sortedNodes = groupNodesByFolder(sortedNodes);
  }
  
  return sortedNodes;
}

/**
 * Force-directed circular layout
 */
export function forceDirectedCircular(nodes, edges, options = {}) {
  const { groupByFolder = false, iterations = 50 } = options;
  
  // Initialize positions on circle
  const positions = new Map();
  const n = nodes.length;
  nodes.forEach((node, i) => {
    const angle = (2 * Math.PI * i) / n;
    positions.set(node.id, { angle, index: i });
  });
  
  // Simulate forces
  for (let iter = 0; iter < iterations; iter++) {
    const forces = new Map();
    nodes.forEach(node => forces.set(node.id, 0));
    
    // Attraction between connected nodes
    edges.forEach(edge => {
      const pos1 = positions.get(edge.source);
      const pos2 = positions.get(edge.target);
      if (pos1 && pos2) {
        const diff = pos2.angle - pos1.angle;
        const force = diff * 0.1; // Attraction coefficient
        forces.set(edge.source, forces.get(edge.source) + force);
        forces.set(edge.target, forces.get(edge.target) - force);
      }
    });
    
    // Apply forces
    nodes.forEach(node => {
      const pos = positions.get(node.id);
      pos.angle += forces.get(node.id) * 0.1; // Damping
      // Normalize angle to [0, 2π]
      pos.angle = ((pos.angle % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
    });
  }
  
  // Sort nodes by final angle
  let sortedNodes = nodes.slice().sort((a, b) => {
    return positions.get(a.id).angle - positions.get(b.id).angle;
  });
  
  if (groupByFolder) {
    sortedNodes = groupNodesByFolder(sortedNodes);
  }
  
  return sortedNodes;
}

/**
 * Bidirectional edge bundling
 */
export function bidirectionalGrouping(nodes, edges, options = {}) {
  const { groupByFolder = false } = options;
  
  // Calculate in/out degree for each node
  const nodeStats = new Map();
  nodes.forEach(node => {
    nodeStats.set(node.id, { node, inDegree: 0, outDegree: 0 });
  });
  
  edges.forEach(edge => {
    if (edge.type !== 'POST_USE_IMAGE') {
      const sourceStats = nodeStats.get(edge.source);
      const targetStats = nodeStats.get(edge.target);
      if (sourceStats) sourceStats.outDegree++;
      if (targetStats) targetStats.inDegree++;
    }
  });
  
  // Categorize nodes
  const sources = []; // Mostly outgoing
  const sinks = [];   // Mostly incoming
  const balanced = []; // Balanced in/out
  
  nodeStats.forEach(stats => {
    const ratio = stats.outDegree / Math.max(stats.inDegree, 1);
    if (ratio > 2) {
      sources.push(stats.node);
    } else if (ratio < 0.5) {
      sinks.push(stats.node);
    } else {
      balanced.push(stats.node);
    }
  });
  
  // Sort within groups by degree
  sources.sort((a, b) => {
    const aStats = nodeStats.get(a.id);
    const bStats = nodeStats.get(b.id);
    return (bStats.outDegree - aStats.outDegree) || a.label.localeCompare(b.label);
  });
  
  sinks.sort((a, b) => {
    const aStats = nodeStats.get(a.id);
    const bStats = nodeStats.get(b.id);
    return (bStats.inDegree - aStats.inDegree) || a.label.localeCompare(b.label);
  });
  
  balanced.sort((a, b) => a.label.localeCompare(b.label));
  
  let sortedNodes = [...sources, ...balanced, ...sinks];
  
  if (groupByFolder) {
    sortedNodes = groupNodesByFolder(sortedNodes);
  }
  
  return sortedNodes;
}

/**
 * Best clustering - combines multiple approaches
 */
export function bestClustering(nodes, edges, options = {}) {
  const { groupByFolder = false } = options;
  
  // First, detect communities
  const communities = detectCommunitiesDetailed(nodes, edges);
  
  // Within each community, apply spectral ordering
  const sortedCommunities = [];
  communities.forEach(community => {
    const communityEdges = edges.filter(edge => 
      community.some(n => n.id === edge.source) && 
      community.some(n => n.id === edge.target)
    );
    
    // Apply spectral ordering within community
    const orderedCommunity = spectralOrdering(community, communityEdges, { groupByFolder: false });
    sortedCommunities.push(orderedCommunity);
  });
  
  // Order communities by inter-community connections
  const communityConnections = calculateInterCommunityConnections(sortedCommunities, edges);
  const orderedCommunities = orderCommunitiesByConnections(sortedCommunities, communityConnections);
  
  // Flatten
  let sortedNodes = orderedCommunities.flat();
  
  if (groupByFolder) {
    sortedNodes = groupNodesByFolder(sortedNodes);
  }
  
  return sortedNodes;
}

// Helper functions

function countSharedConnections(node1Id, node2Id, adjacency) {
  const neighbors1 = adjacency.get(node1Id) || new Set();
  const neighbors2 = adjacency.get(node2Id) || new Set();
  
  let shared = 0;
  neighbors1.forEach(neighbor => {
    if (neighbors2.has(neighbor)) shared++;
  });
  
  return shared;
}

function groupNodesByFolder(nodes) {
  // Group nodes by folder
  const folderGroups = new Map();
  
  nodes.forEach(node => {
    const folder = getNodeFolder(node);
    if (!folderGroups.has(folder)) {
      folderGroups.set(folder, []);
    }
    folderGroups.get(folder).push(node);
  });
  
  // Sort folders and flatten
  const sortedFolders = Array.from(folderGroups.keys()).sort();
  const result = [];
  
  console.log('Grouping by folders:', sortedFolders);
  
  sortedFolders.forEach(folder => {
    const folderNodes = folderGroups.get(folder);
    console.log(`Folder "${folder}": ${folderNodes.length} nodes`);
    result.push(...folderNodes);
  });
  
  return result;
}

function detectCommunitiesDetailed(nodes, edges) {
  // More detailed community detection for best clustering
  const adjacency = new Map();
  nodes.forEach(node => adjacency.set(node.id, new Set()));
  
  edges.forEach(edge => {
    adjacency.get(edge.source)?.add(edge.target);
    adjacency.get(edge.target)?.add(edge.source);
  });
  
  const visited = new Set();
  const communities = [];
  
  nodes.forEach(node => {
    if (!visited.has(node.id)) {
      const community = [];
      const queue = [node.id];
      visited.add(node.id);
      
      while (queue.length > 0) {
        const current = queue.shift();
        const currentNode = nodes.find(n => n.id === current);
        community.push(currentNode);
        
        const neighbors = adjacency.get(current) || new Set();
        neighbors.forEach(neighbor => {
          if (!visited.has(neighbor)) {
            visited.add(neighbor);
            queue.push(neighbor);
          }
        });
      }
      
      if (community.length > 0) {
        communities.push(community);
      }
    }
  });
  
  return communities;
}

function calculateInterCommunityConnections(communities, edges) {
  const connections = [];
  
  for (let i = 0; i < communities.length; i++) {
    for (let j = i + 1; j < communities.length; j++) {
      const comm1Ids = new Set(communities[i].map(n => n.id));
      const comm2Ids = new Set(communities[j].map(n => n.id));
      
      let connectionCount = 0;
      edges.forEach(edge => {
        if ((comm1Ids.has(edge.source) && comm2Ids.has(edge.target)) ||
            (comm2Ids.has(edge.source) && comm1Ids.has(edge.target))) {
          connectionCount++;
        }
      });
      
      if (connectionCount > 0) {
        connections.push({ i, j, count: connectionCount });
      }
    }
  }
  
  return connections;
}

function orderCommunitiesByConnections(communities, connections) {
  // Simple ordering: start with most connected community
  const communityOrder = [];
  const remaining = new Set(communities.map((_, i) => i));
  
  // Find community with most connections
  const connectionCounts = new Map();
  connections.forEach(({ i, j, count }) => {
    connectionCounts.set(i, (connectionCounts.get(i) || 0) + count);
    connectionCounts.set(j, (connectionCounts.get(j) || 0) + count);
  });
  
  let current = Array.from(connectionCounts.entries())
    .sort((a, b) => b[1] - a[1])[0]?.[0] || 0;
  
  communityOrder.push(current);
  remaining.delete(current);
  
  // Greedily add communities with most connections to already placed ones
  while (remaining.size > 0) {
    let bestNext = null;
    let bestCount = -1;
    
    remaining.forEach(candidate => {
      let count = 0;
      connections.forEach(({ i, j, count: c }) => {
        if ((communityOrder.includes(i) && j === candidate) ||
            (communityOrder.includes(j) && i === candidate)) {
          count += c;
        }
      });
      
      if (count > bestCount) {
        bestCount = count;
        bestNext = candidate;
      }
    });
    
    if (bestNext !== null) {
      communityOrder.push(bestNext);
      remaining.delete(bestNext);
    } else {
      // No connections, just add remaining
      remaining.forEach(r => communityOrder.push(r));
      break;
    }
  }
  
  return communityOrder.map(i => communities[i]);
}