import { diffLines, createPatch } from 'diff';

/**
 * File modification tracker
 * Tracks file changes with sources and diffs
 */
export class FileTracker {
  constructor() {
    this.modifications = new Map();
  }

  /**
   * Track a file creation
   */
  trackCreation(path, content, metadata = {}) {
    this.modifications.set(path, {
      type: 'created',
      path,
      content,
      originalContent: null,
      diff: null,
      timestamp: new Date().toISOString(),
      ...metadata
    });
  }

  /**
   * Track a file modification
   */
  trackModification(path, originalContent, newContent, metadata = {}) {
    const diff = createPatch(
      path,
      originalContent || '',
      newContent || '',
      'original',
      'modified'
    );

    const changes = diffLines(originalContent || '', newContent || '');
    const stats = {
      additions: changes.filter(c => c.added).reduce((sum, c) => sum + c.count, 0),
      deletions: changes.filter(c => c.removed).reduce((sum, c) => sum + c.count, 0),
      totalChanges: changes.filter(c => c.added || c.removed).length
    };

    this.modifications.set(path, {
      type: 'modified',
      path,
      content: newContent,
      originalContent,
      diff,
      stats,
      timestamp: new Date().toISOString(),
      ...metadata
    });
  }

  /**
   * Track a file deletion
   */
  trackDeletion(path, originalContent, metadata = {}) {
    this.modifications.set(path, {
      type: 'deleted',
      path,
      content: null,
      originalContent,
      diff: null,
      timestamp: new Date().toISOString(),
      ...metadata
    });
  }

  /**
   * Get all modifications
   */
  getModifications() {
    return Array.from(this.modifications.values());
  }

  /**
   * Get modification for specific path
   */
  getModification(path) {
    return this.modifications.get(path);
  }

  /**
   * Get summary of modifications
   */
  getSummary() {
    const mods = this.getModifications();
    return {
      total: mods.length,
      created: mods.filter(m => m.type === 'created').length,
      modified: mods.filter(m => m.type === 'modified').length,
      deleted: mods.filter(m => m.type === 'deleted').length,
      files: mods.map(m => ({
        path: m.path,
        type: m.type,
        stats: m.stats
      }))
    };
  }

  /**
   * Clear all tracked modifications
   */
  clear() {
    this.modifications.clear();
  }
}

/**
 * Create a file tracker instance for a chat session
 */
export function createFileTracker() {
  return new FileTracker();
}

/**
 * Enhance tool result with file tracking
 */
export function enhanceToolResult(result, tracker, operation) {
  if (!result.success) return result;

  const enhanced = { ...result };

  // Add file tracking info based on operation type
  switch (operation) {
    case 'create':
      if (result.path && result.content) {
        tracker.trackCreation(result.path, result.content, {
          branch: result.branch,
          commitSha: result.commitSha
        });
        enhanced.fileTracking = {
          type: 'created',
          path: result.path,
          size: result.content.length
        };
      }
      break;

    case 'modify':
      if (result.path && result.originalContent !== undefined) {
        tracker.trackModification(
          result.path,
          result.originalContent,
          result.content,
          {
            branch: result.branch,
            commitSha: result.commitSha,
            operations: result.operations
          }
        );
        const mod = tracker.getModification(result.path);
        enhanced.fileTracking = {
          type: 'modified',
          path: result.path,
          stats: mod.stats,
          diff: mod.diff
        };
      }
      break;

    case 'delete':
      if (result.path) {
        tracker.trackDeletion(result.path, result.originalContent, {
          branch: result.branch,
          commitSha: result.commitSha
        });
        enhanced.fileTracking = {
          type: 'deleted',
          path: result.path
        };
      }
      break;
  }

  // Add summary of all modifications so far
  enhanced.allModifications = tracker.getSummary();

  return enhanced;
}