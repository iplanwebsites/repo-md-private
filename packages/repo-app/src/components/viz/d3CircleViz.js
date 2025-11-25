import * as d3 from "d3";

export class D3CircleViz {
  constructor(container, options = {}) {
    this.container = container;
    this.options = {
      width: 954,
      includeImages: true,
      colors: {
        in: "#00f",
        out: "#f00",
        image: "#ff8800",
        none: "#ccc",
      },
      ...options,
    };
    this.svg = null;
    this.data = null;
  }

  setData(data) {
    this.data = data;
    return this;
  }

  render() {
    if (!this.data) {
      console.error("No data provided");
      return;
    }

    // Validate data structure
    if (!this.data.nodes || !Array.isArray(this.data.nodes)) {
      console.error("Invalid data: nodes must be an array");
      return;
    }

    if (!this.data.edges || !Array.isArray(this.data.edges)) {
      console.error("Invalid data: edges must be an array");
      return;
    }

    // Clear previous content
    d3.select(this.container).selectAll("*").remove();

    const { width, includeImages, colors } = this.options;
    const radius = width / 2;

    // Extract nodes and edges
    const nodes = this.data.nodes;
    const edges = this.data.edges;

    // Filter out invalid nodes (must have id and label)
    const validNodes = nodes.filter(n => n && n.id && n.label);
    
    console.log('D3CircleViz render - total nodes:', nodes.length);
    console.log('D3CircleViz render - valid nodes:', validNodes.length);
    console.log('D3CircleViz render - edges count:', edges.length);

    // If no valid nodes, show empty state
    if (validNodes.length === 0) {
      d3.select(this.container)
        .append("div")
        .style("text-align", "center")
        .style("padding", "40px")
        .style("color", "#666")
        .html("<p>No valid nodes to display</p><p>Nodes must have both 'id' and 'label' properties</p>");
      return;
    }

    // Create a map of node id to node data
    const nodeMap = new Map(validNodes.map((n) => [n.id, n]));

    // Prepare data for circular layout
    const circleNodes = validNodes.map((node, i) => ({
      id: node.id,
      name: node.label,
      type: node.type,
      x: (2 * Math.PI * i) / validNodes.length,
      y: radius - 100,
      incoming: [],
      outgoing: [],
      images: [],
    }));

    // Create a map for quick lookup
    const circleNodeMap = new Map(circleNodes.map((n) => [n.id, n]));

    // Filter valid edges (must have source and target that exist in validNodes)
    const validEdges = edges.filter(edge => 
      edge && 
      edge.source && 
      edge.target && 
      circleNodeMap.has(edge.source) && 
      circleNodeMap.has(edge.target)
    );

    console.log('D3CircleViz render - total edges:', edges.length);
    console.log('D3CircleViz render - valid edges:', validEdges.length);

    // First pass: collect all edges to detect mutual links
    const edgeMap = new Map();
    validEdges.forEach((edge) => {
      if (edge.type === "POST_LINKS_TO_POST") {
        const key = `${edge.source}-${edge.target}`;
        const reverseKey = `${edge.target}-${edge.source}`;
        edgeMap.set(key, edge);
        
        // Check if reverse edge exists
        if (edgeMap.has(reverseKey)) {
          edge.isMutual = true;
          edgeMap.get(reverseKey).isMutual = true;
        }
      }
    });

    // Process edges
    validEdges.forEach((edge) => {
      const source = circleNodeMap.get(edge.source);
      const target = circleNodeMap.get(edge.target);

      if (source && target) {
        if (edge.type === "POST_LINKS_TO_POST") {
          const linkType = edge.isMutual ? "mutual" : "link";
          source.outgoing.push({ path: null, node: target, type: linkType });
          target.incoming.push({ path: null, node: source, type: linkType });
        } else if ((edge.type === "POST_INCLUDES_IMAGE" || edge.type === "POST_USE_IMAGE") && includeImages) {
          source.images.push({ path: null, node: target, type: "image" });
        }
      }
    });

    // Create SVG
    this.svg = d3
      .select(this.container)
      .append("svg")
      .attr("width", width)
      .attr("height", width)
      .attr("viewBox", [-width / 2, -width / 2, width, width])
      .attr("style", "max-width: 100%; height: auto; font: 10px sans-serif;");

    // Draw nodes
    const node = this.svg
      .append("g")
      .selectAll("g")
      .data(circleNodes)
      .join("g")
      .attr(
        "transform",
        (d) => `rotate(${(d.x * 180) / Math.PI - 90}) translate(${d.y},0)`
      );

    node
      .append("text")
      .attr("dy", "0.31em")
      .attr("x", (d) => (d.x < Math.PI ? 6 : -6))
      .attr("text-anchor", (d) => (d.x < Math.PI ? "start" : "end"))
      .attr("transform", (d) => (d.x >= Math.PI ? "rotate(180)" : null))
      .text((d) => d.name)
      .attr("fill", (d) => (d.type === "image" || d.type === "media" ? colors.image : null))
      .each(function (d) {
        d.text = this;
      })
      .on("mouseover", (event, d) => this.handleMouseOver(event, d))
      .on("mouseout", (event, d) => this.handleMouseOut(event, d))
      .call((text) =>
        text.append("title").text((d) => {
          let tooltip = `${d.name}\n`;
          
          // Count different types of links
          const outgoingLinks = d.outgoing.filter((o) => o.type === "link").length;
          const outgoingMutual = d.outgoing.filter((o) => o.type === "mutual").length;
          const incomingLinks = d.incoming.filter((i) => i.type === "link").length;
          const incomingMutual = d.incoming.filter((i) => i.type === "mutual").length;
          
          // Display counts
          tooltip += `${outgoingLinks + outgoingMutual} outgoing (${outgoingMutual} mutual)\n`;
          tooltip += `${incomingLinks + incomingMutual} incoming (${incomingMutual} mutual)`;
          
          if (includeImages) {
            tooltip += `\n${d.images.length} images`;
          }
          return tooltip;
        })
      );

    // Line generator for curved paths
    const line = d3
      .lineRadial()
      .curve(d3.curveBundle.beta(0.85))
      .radius((d) => d.y)
      .angle((d) => d.x);

    // Prepare link data
    const linkData = [];
    const processedPairs = new Set(); // To avoid duplicate mutual links
    
    circleNodes.forEach((source) => {
      source.outgoing.forEach((edge) => {
        if (edge.type === "link" || edge.type === "mutual") {
          // For mutual links, only add once
          if (edge.type === "mutual") {
            const pairKey = [source.id, edge.node.id].sort().join('-');
            if (!processedPairs.has(pairKey)) {
              processedPairs.add(pairKey);
              linkData.push({ source, target: edge.node, type: edge.type });
            }
          } else {
            linkData.push({ source, target: edge.node, type: edge.type });
          }
        }
      });
      if (includeImages) {
        source.images.forEach((edge) => {
          linkData.push({ source, target: edge.node, type: "image" });
        });
      }
    });

    // Draw edges
    const link = this.svg
      .append("g")
      .attr("stroke", colors.none)
      .attr("fill", "none")
      .selectAll("path")
      .data(linkData)
      .join("path")
      .style("mix-blend-mode", "multiply")
      .attr("class", (d) => d.type)
      .attr("stroke", (d) => {
        if (d.type === "image") return colors.image;
        // In default state, both mutual and one-way links use subtle grays
        if (d.type === "mutual") return colors.none; // Normal gray for mutual
        return colors.oneWay || "#e6e6e6"; // Lighter gray for one-way
      })
      .attr("stroke-opacity", (d) => (d.type === "image" ? 0.5 : 1))
      .attr("d", (d) => {
        const path = [];
        path.push({ x: d.source.x, y: d.source.y });

        // Add intermediate points for bundling effect
        const bundle = 0.85;
        const midRadius = d.source.y * bundle;
        path.push({ x: d.source.x, y: midRadius });
        path.push({ x: d.target.x, y: midRadius });
        path.push({ x: d.target.x, y: d.target.y });

        return line(path);
      })
      .each(function (d) {
        d.path = this;
      });

    // Store paths in node references
    circleNodes.forEach((node) => {
      node.outgoing.forEach((edge) => {
        const pathEl = linkData.find(
          (l) => l.source === node && l.target === edge.node
        );
        if (pathEl) edge.path = pathEl.path;
      });
      node.incoming.forEach((edge) => {
        const pathEl = linkData.find(
          (l) => l.source === edge.node && l.target === node
        );
        if (pathEl) edge.path = pathEl.path;
      });
      node.images.forEach((edge) => {
        const pathEl = linkData.find(
          (l) =>
            l.source === node && l.target === edge.node && l.type === "image"
        );
        if (pathEl) edge.path = pathEl.path;
      });
    });

    // Store references for interaction
    this.link = link;
    this.node = node;
    this.circleNodes = circleNodes;

    return this;
  }

  handleMouseOver(event, d) {
    const { colors, includeImages } = this.options;

    this.link.style("mix-blend-mode", null);
    d3.select(event.target).attr("font-weight", "bold");

    // Highlight incoming links
    d.incoming.forEach((edge) => {
      if (edge.path) {
        const strokeColor = edge.type === "mutual" ? (colors.mutual || "#9900cc") : colors.in;
        d3.select(edge.path).attr("stroke", strokeColor).raise();
      }
      if (edge.node.text) {
        const fillColor = edge.type === "mutual" ? (colors.mutual || "#9900cc") : colors.in;
        d3.select(edge.node.text)
          .attr("fill", fillColor)
          .attr("font-weight", "bold");
      }
    });

    // Highlight outgoing links
    d.outgoing.forEach((edge) => {
      if (edge.path) {
        const strokeColor = edge.type === "mutual" ? (colors.mutual || "#9900cc") : colors.out;
        d3.select(edge.path).attr("stroke", strokeColor).raise();
      }
      if (edge.node.text) {
        const fillColor = edge.type === "mutual" ? (colors.mutual || "#9900cc") : colors.out;
        d3.select(edge.node.text)
          .attr("fill", fillColor)
          .attr("font-weight", "bold");
      }
    });

    // Highlight images if enabled
    if (includeImages) {
      d.images.forEach((edge) => {
        if (edge.path) {
          d3.select(edge.path)
            .attr("stroke", colors.image)
            .attr("stroke-opacity", 1)
            .raise();
        }
        if (edge.node.text) {
          d3.select(edge.node.text)
            .attr("fill", colors.image)
            .attr("font-weight", "bold");
        }
      });
    }
  }

  handleMouseOut(event, d) {
    const { colors, includeImages } = this.options;

    this.link.style("mix-blend-mode", "multiply");
    d3.select(event.target).attr("font-weight", null);

    // Reset all edges and texts
    d.incoming.forEach((edge) => {
      if (edge.path) {
        // Restore default colors based on type
        const defaultColor = edge.type === "mutual" ? colors.none : (colors.oneWay || "#e6e6e6");
        d3.select(edge.path).attr("stroke", defaultColor);
      }
      if (edge.node.text) {
        d3.select(edge.node.text)
          .attr("fill", (edge.node.type === "image" || edge.node.type === "media") ? colors.image : null)
          .attr("font-weight", null);
      }
    });

    d.outgoing.forEach((edge) => {
      if (edge.path) {
        // Restore default colors based on type
        const defaultColor = edge.type === "mutual" ? colors.none : (colors.oneWay || "#e6e6e6");
        d3.select(edge.path).attr("stroke", defaultColor);
      }
      if (edge.node.text) {
        d3.select(edge.node.text)
          .attr("fill", (edge.node.type === "image" || edge.node.type === "media") ? colors.image : null)
          .attr("font-weight", null);
      }
    });

    if (includeImages) {
      d.images.forEach((edge) => {
        if (edge.path) {
          d3.select(edge.path)
            .attr("stroke", colors.image)
            .attr("stroke-opacity", 0.5);
        }
        if (edge.node.text) {
          d3.select(edge.node.text)
            .attr("fill", edge.node.type === "image" ? colors.image : null)
            .attr("font-weight", null);
        }
      });
    }
  }

  updateOptions(options) {
    console.log('D3CircleViz updateOptions called with:', options);
    this.options = { ...this.options, ...options };
    if (this.data) {
      this.render();
    }
    return this;
  }

  destroy() {
    if (this.svg) {
      this.svg.remove();
    }
  }
}

// Factory function for easier instantiation
export function createD3CircleViz(container, data, options) {
  const viz = new D3CircleViz(container, options);
  if (data) {
    viz.setData(data).render();
  }
  return viz;
}
