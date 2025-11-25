export class FileChangeTracker {
  constructor() {
    this.originalFiles = new Map()
    this.currentFiles = new Map()
    this.changedFiles = new Set()
    this.listeners = new Set()
  }

  // Initialize with original file contents
  initializeFile(filePath, content) {
    this.originalFiles.set(filePath, content)
    this.currentFiles.set(filePath, content)
    this.changedFiles.delete(filePath)
    this.notifyListeners()
  }

  // Update current file content
  updateFile(filePath, content) {
    const originalContent = this.originalFiles.get(filePath) || ''
    this.currentFiles.set(filePath, content)
    
    if (content !== originalContent) {
      this.changedFiles.add(filePath)
    } else {
      this.changedFiles.delete(filePath)
    }
    
    this.notifyListeners()
  }

  // Save file (update original content)
  saveFile(filePath, content) {
    this.originalFiles.set(filePath, content)
    this.currentFiles.set(filePath, content)
    this.changedFiles.delete(filePath)
    this.notifyListeners()
  }

  // Revert file to original content
  revertFile(filePath) {
    const originalContent = this.originalFiles.get(filePath) || ''
    this.currentFiles.set(filePath, originalContent)
    this.changedFiles.delete(filePath)
    this.notifyListeners()
    return originalContent
  }

  // Get file content
  getOriginalContent(filePath) {
    return this.originalFiles.get(filePath) || ''
  }

  getCurrentContent(filePath) {
    return this.currentFiles.get(filePath) || ''
  }

  // Check if file has changes
  hasChanges(filePath) {
    return this.changedFiles.has(filePath)
  }

  // Get all changed files
  getChangedFiles() {
    return Array.from(this.changedFiles)
  }

  // Get diff for a file
  getFileDiff(filePath) {
    const original = this.getOriginalContent(filePath)
    const current = this.getCurrentContent(filePath)
    
    return {
      original,
      current,
      hasChanges: original !== current
    }
  }

  // Get statistics
  getStats() {
    return {
      totalFiles: this.originalFiles.size,
      changedFiles: this.changedFiles.size,
      unchangedFiles: this.originalFiles.size - this.changedFiles.size
    }
  }

  // Add change listener
  addListener(callback) {
    this.listeners.add(callback)
    return () => this.listeners.delete(callback)
  }

  // Notify all listeners
  notifyListeners() {
    this.listeners.forEach(callback => {
      try {
        callback({
          changedFiles: this.getChangedFiles(),
          stats: this.getStats()
        })
      } catch (error) {
        console.error('Error in file change listener:', error)
      }
    })
  }

  // Export all changes as patches
  exportAllDiffs() {
    const diffs = []
    
    for (const filePath of this.changedFiles) {
      const diff = this.getFileDiff(filePath)
      if (diff.hasChanges) {
        diffs.push({
          filePath,
          ...diff,
          patch: this.generatePatch(filePath, diff.original, diff.current)
        })
      }
    }
    
    return diffs
  }

  // Generate unified diff patch
  generatePatch(filePath, original, current) {
    const originalLines = original.split('\n')
    const currentLines = current.split('\n')
    
    // Simple unified diff generation
    const header = `--- a/${filePath}
+++ b/${filePath}
@@ -1,${originalLines.length} +1,${currentLines.length} @@
`
    
    const diffLines = []
    const maxLines = Math.max(originalLines.length, currentLines.length)
    
    for (let i = 0; i < maxLines; i++) {
      const originalLine = originalLines[i]
      const currentLine = currentLines[i]
      
      if (originalLine === currentLine) {
        diffLines.push(` ${originalLine || ''}`)
      } else {
        if (originalLine !== undefined) {
          diffLines.push(`-${originalLine}`)
        }
        if (currentLine !== undefined) {
          diffLines.push(`+${currentLine}`)
        }
      }
    }
    
    return header + diffLines.join('\n')
  }

  // Clear all tracking data
  clear() {
    this.originalFiles.clear()
    this.currentFiles.clear()
    this.changedFiles.clear()
    this.notifyListeners()
  }

  // Remove file from tracking
  removeFile(filePath) {
    this.originalFiles.delete(filePath)
    this.currentFiles.delete(filePath)
    this.changedFiles.delete(filePath)
    this.notifyListeners()
  }

  // Bulk initialize files
  initializeFiles(files) {
    for (const [filePath, content] of Object.entries(files)) {
      this.initializeFile(filePath, content)
    }
  }

  // Get unsaved changes summary
  getUnsavedChangesSummary() {
    const changedFiles = this.getChangedFiles()
    const summary = {
      hasChanges: changedFiles.length > 0,
      count: changedFiles.length,
      files: changedFiles.map(filePath => ({
        path: filePath,
        name: filePath.split('/').pop(),
        diff: this.getFileDiff(filePath)
      }))
    }
    
    return summary
  }
}

// Create a global instance
export const fileChangeTracker = new FileChangeTracker()