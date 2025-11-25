import { ObjectId } from "mongodb";
import { db } from "../../db.js";
import RepoMD from "repo-md";

/**
 * Read-only SDK for safe project data access
 * Used by PersonaAgents to provide public-facing functionality
 */
export class ProjectReadOnlySDK {
  constructor(projectId) {
    this.projectId = projectId;
    this.project = null;
    this.repoMD = null;
    this._initialized = false;
  }

  /**
   * Initialize the SDK with project data
   */
  async initialize() {
    if (this._initialized) {
      return;
    }

    try {
      // Load project from database
      this.project = await db.projects.findOne({ 
        _id: new ObjectId(this.projectId) 
      });

      if (!this.project) {
        throw new Error(`Project not found: ${this.projectId}`);
      }

      // Initialize RepoMD if project has repoMdProjectId
      if (this.project.repoMdProjectId) {
        this.repoMD = new RepoMD(this.project.repoMdProjectId);
        await this.repoMD.ready();
      }

      this._initialized = true;
    } catch (error) {
      console.error(`Failed to initialize ProjectReadOnlySDK for ${this.projectId}:`, error);
      throw error;
    }
  }

  /**
   * Ensure SDK is initialized before operations
   */
  async ensureInitialized() {
    if (!this._initialized) {
      await this.initialize();
    }
  }

  /**
   * Search for content within the project
   */
  async searchContent(query, options = {}) {
    await this.ensureInitialized();
    
    if (!this.repoMD) {
      return [];
    }

    try {
      const results = await this.repoMD.search(query, {
        limit: options.limit || 10,
        type: options.type || 'all',
        includePrivate: false, // Never include private content
      });

      // Filter and format results for public consumption
      return results.map(result => ({
        title: result.title || result.name,
        path: result.path,
        excerpt: this.truncateExcerpt(result.excerpt || result.content),
        type: result.type,
        score: result.score,
        lastModified: result.lastModified,
      }));
    } catch (error) {
      console.error("Search error:", error);
      return [];
    }
  }

  /**
   * Browse a specific file
   */
  async browseFile(path) {
    await this.ensureInitialized();
    
    if (!this.repoMD) {
      throw new Error("Repository content not available");
    }

    try {
      const file = await this.repoMD.getSourceFile(path);
      
      if (!file) {
        throw new Error(`File not found: ${path}`);
      }

      // Return sanitized file data
      return {
        path: file.path,
        name: file.name,
        content: file.content,
        language: file.language || this.detectLanguage(path),
        size: file.size || file.content?.length || 0,
        lastModified: file.lastModified,
        // Exclude sensitive metadata
      };
    } catch (error) {
      console.error(`Failed to browse file ${path}:`, error);
      throw new Error(`Cannot access file: ${path}`);
    }
  }

  /**
   * Get general project information
   */
  async getProjectInfo() {
    await this.ensureInitialized();

    // Return public project information only
    return {
      id: this.project._id.toString(),
      name: this.project.name,
      description: this.project.description,
      visibility: this.project.visibility || 'private',
      techStack: this.project.techStack || [],
      framework: this.project.framework,
      language: this.project.language,
      topics: this.project.topics || [],
      createdAt: this.project.createdAt,
      lastUpdated: this.project.updatedAt,
      // Exclude sensitive data like tokens, keys, deployment details
    };
  }

  /**
   * List project content by type
   */
  async listContent(type = 'all', options = {}) {
    await this.ensureInitialized();
    
    if (!this.repoMD) {
      return [];
    }

    try {
      const content = await this.repoMD.getContent({
        type,
        limit: options.limit || 20,
        includePrivate: false,
        sort: options.sort || 'name',
      });

      // Return formatted content list
      return content.map(item => ({
        path: item.path,
        name: item.name,
        type: item.type,
        size: item.size,
        lastModified: item.lastModified,
        description: item.description,
      }));
    } catch (error) {
      console.error("List content error:", error);
      return [];
    }
  }

  /**
   * Get project structure/tree
   */
  async getProjectStructure(maxDepth = 3) {
    await this.ensureInitialized();
    
    if (!this.repoMD) {
      return null;
    }

    try {
      const structure = await this.repoMD.getFileTree({
        maxDepth,
        includePrivate: false,
        includeHidden: false,
      });

      return this.sanitizeStructure(structure);
    } catch (error) {
      console.error("Get structure error:", error);
      return null;
    }
  }

  /**
   * Get documentation for the project
   */
  async getDocumentation(path = null) {
    await this.ensureInitialized();
    
    if (!this.repoMD) {
      return null;
    }

    try {
      if (path) {
        // Get specific documentation file
        return await this.browseFile(path);
      }

      // Get all documentation files
      const docs = await this.repoMD.getContent({
        type: 'docs',
        includePrivate: false,
      });

      return docs.map(doc => ({
        path: doc.path,
        title: doc.title || doc.name,
        summary: this.truncateExcerpt(doc.summary || doc.content),
      }));
    } catch (error) {
      console.error("Get documentation error:", error);
      return null;
    }
  }

  /**
   * Check if a path exists
   */
  async pathExists(path) {
    await this.ensureInitialized();
    
    if (!this.repoMD) {
      return false;
    }

    try {
      const file = await this.repoMD.getSourceFile(path);
      return !!file;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get project statistics
   */
  async getStatistics() {
    await this.ensureInitialized();

    const stats = {
      name: this.project.name,
      visibility: this.project.visibility || 'private',
      createdAt: this.project.createdAt,
      lastUpdated: this.project.updatedAt,
    };

    if (this.repoMD) {
      try {
        const repoStats = await this.repoMD.getStatistics();
        stats.files = repoStats.totalFiles || 0;
        stats.size = repoStats.totalSize || 0;
        stats.languages = repoStats.languages || [];
      } catch (error) {
        console.error("Failed to get repo statistics:", error);
      }
    }

    return stats;
  }

  // Helper methods

  /**
   * Truncate excerpt to reasonable length
   */
  truncateExcerpt(text, maxLength = 200) {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  }

  /**
   * Detect language from file path
   */
  detectLanguage(path) {
    const ext = path.split('.').pop().toLowerCase();
    const languageMap = {
      js: 'javascript',
      jsx: 'javascript',
      ts: 'typescript',
      tsx: 'typescript',
      py: 'python',
      rb: 'ruby',
      java: 'java',
      cpp: 'cpp',
      c: 'c',
      cs: 'csharp',
      go: 'go',
      rs: 'rust',
      php: 'php',
      swift: 'swift',
      kt: 'kotlin',
      md: 'markdown',
      json: 'json',
      xml: 'xml',
      html: 'html',
      css: 'css',
      scss: 'scss',
      sass: 'sass',
      less: 'less',
      sql: 'sql',
      sh: 'bash',
      bash: 'bash',
      yml: 'yaml',
      yaml: 'yaml',
    };
    return languageMap[ext] || 'text';
  }

  /**
   * Sanitize file structure for public consumption
   */
  sanitizeStructure(structure) {
    if (!structure) return null;

    const sanitize = (node) => {
      const sanitized = {
        name: node.name,
        path: node.path,
        type: node.type,
      };

      if (node.children && Array.isArray(node.children)) {
        // Filter out private/hidden directories
        sanitized.children = node.children
          .filter(child => !this.isPrivatePath(child.path))
          .map(child => sanitize(child));
      }

      return sanitized;
    };

    return sanitize(structure);
  }

  /**
   * Check if path should be private
   */
  isPrivatePath(path) {
    const privatePaths = [
      '.env',
      '.git',
      'node_modules',
      '.keys',
      '.secrets',
      'private',
      'internal',
    ];

    return privatePaths.some(privatePath => 
      path.includes(privatePath)
    );
  }
}