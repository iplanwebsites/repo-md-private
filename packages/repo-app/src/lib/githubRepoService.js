import JSZip from 'jszip'

export class GitHubRepoService {
  constructor() {
    this.apiBase = 'https://api.github.com'
    this.defaultHeaders = {
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'repo-md-app'
    }
  }

  setAuthToken(token) {
    this.authToken = token
    this.defaultHeaders['Authorization'] = `token ${token}`
  }

  async fetchRepoInfo(owner, repo) {
    const url = `${this.apiBase}/repos/${owner}/${repo}`
    console.log('🔍 Fetching repository info:', { owner, repo, url })
    console.log('📡 Request headers:', this.defaultHeaders)
    
    try {
      const response = await fetch(url, {
        headers: this.defaultHeaders
      })
      
      console.log('📥 Repository info response:', {
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries())
      })
      
      if (!response.ok) {
        const errorText = await response.text()
        console.error('❌ Repository info error response:', errorText)
        throw new Error(`Failed to fetch repository info: ${response.status} - ${response.statusText}`)
      }
      
      const data = await response.json()
      console.log('✅ Repository info fetched successfully:', { 
        name: data.name, 
        size: data.size, 
        default_branch: data.default_branch,
        private: data.private
      })
      
      return data
    } catch (error) {
      console.error('💥 Error fetching repository info:', error)
      throw new Error(`Error fetching repository info: ${error.message}`)
    }
  }

  async fetchRepoZipball(owner, repo, branch = 'main') {
    const url = `${this.apiBase}/repos/${owner}/${repo}/zipball/${branch}`
    console.log('📦 Fetching repository zipball:', { owner, repo, branch, url })
    console.log('📡 Request headers:', this.defaultHeaders)
    
    try {
      // First, try the direct approach
      const response = await fetch(url, {
        headers: this.defaultHeaders,
        mode: 'cors',
        redirect: 'follow'
      })
      
      console.log('📥 Zipball response:', {
        status: response.status,
        statusText: response.statusText,
        contentType: response.headers.get('content-type'),
        contentLength: response.headers.get('content-length'),
        finalUrl: response.url,
        redirected: response.redirected,
        headers: Object.fromEntries(response.headers.entries())
      })
      
      if (!response.ok) {
        const errorText = await response.text()
        console.error('❌ Zipball error response:', errorText)
        throw new Error(`Failed to fetch repository zipball: ${response.status} - ${response.statusText}`)
      }
      
      console.log('⏬ Starting zipball download...')
      const arrayBuffer = await response.arrayBuffer()
      console.log('✅ Zipball downloaded successfully:', { 
        size: arrayBuffer.byteLength,
        sizeKB: Math.round(arrayBuffer.byteLength / 1024),
        sizeMB: Math.round(arrayBuffer.byteLength / 1024 / 1024 * 100) / 100
      })
      
      return arrayBuffer
    } catch (error) {
      console.error('💥 Error fetching repository zipball:', error)
      if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
        console.error('🌐 Network error details:', {
          message: 'CORS issue detected with GitHub zipball endpoint',
          suggestions: [
            'The zipball endpoint redirects to a download URL that may not have CORS headers',
            'This is a common issue with GitHub\'s download endpoints in browsers',
            'We need to use an alternative approach like the Contents API'
          ]
        })
        // Try alternative approach using GitHub Contents API
        console.log('🔄 Attempting alternative approach using GitHub Contents API...')
        return await this.fetchRepoViaContentsAPI(owner, repo, branch)
      }
      throw new Error(`Error fetching repository zipball: ${error.message}`)
    }
  }

  async fetchRepoViaContentsAPI(owner, repo, branch = 'main') {
    console.log('📁 Using Contents API as fallback:', { owner, repo, branch })
    
    try {
      // Get repository tree recursively
      const treeUrl = `${this.apiBase}/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`
      console.log('🌳 Fetching repository tree:', treeUrl)
      
      const treeResponse = await fetch(treeUrl, {
        headers: this.defaultHeaders
      })
      
      if (!treeResponse.ok) {
        throw new Error(`Failed to fetch repository tree: ${treeResponse.status}`)
      }
      
      const treeData = await treeResponse.json()
      console.log('📊 Tree data received:', { 
        totalItems: treeData.tree?.length || 0,
        truncated: treeData.truncated 
      })
      
      // Filter for files only (not trees/subdirectories)
      const fileItems = treeData.tree.filter(item => item.type === 'blob')
      console.log('📄 File items to download:', fileItems.length)
      
      const files = {}
      let processed = 0
      
      // Download files in batches to avoid overwhelming the API
      const batchSize = 10
      for (let i = 0; i < fileItems.length; i += batchSize) {
        const batch = fileItems.slice(i, i + batchSize)
        
        await Promise.all(batch.map(async (item) => {
          if (this.shouldIncludeFile(item.path)) {
            try {
              const contentResponse = await fetch(`${this.apiBase}/repos/${owner}/${repo}/contents/${item.path}?ref=${branch}`, {
                headers: this.defaultHeaders
              })
              
              if (contentResponse.ok) {
                const contentData = await contentResponse.json()
                if (contentData.content) {
                  // GitHub returns base64 encoded content
                  const content = atob(contentData.content.replace(/\s/g, ''))
                  const uint8Array = new Uint8Array(content.length)
                  for (let j = 0; j < content.length; j++) {
                    uint8Array[j] = content.charCodeAt(j)
                  }
                  files[item.path] = uint8Array
                }
              }
            } catch (fileError) {
              console.warn(`⚠️ Failed to fetch file ${item.path}:`, fileError.message)
            }
          }
          
          processed++
          if (processed % 10 === 0) {
            console.log(`📈 Progress: ${processed}/${fileItems.length} files processed`)
          }
        }))
      }
      
      console.log('✅ Contents API download completed:', {
        totalFiles: Object.keys(files).length,
        totalSize: Object.values(files).reduce((sum, content) => sum + content.byteLength, 0)
      })
      
      // Convert to the expected format (simulate zipball structure)
      return this.simulateZipballFromFiles(files)
      
    } catch (error) {
      console.error('💥 Contents API fallback failed:', error)
      throw new Error(`Contents API fallback failed: ${error.message}`)
    }
  }

  simulateZipballFromFiles(files) {
    // Create a simple "zip-like" structure that our extraction can handle
    console.log('🔄 Converting Contents API files to zipball format...')
    
    // We'll return the files directly since our extractZipToFiles can be modified
    // to handle this case
    return { __isContentsAPI: true, files }
  }

  async extractZipToFiles(zipArrayBuffer, progressCallback) {
    try {
      // Check if this is a Contents API response instead of a real zipball
      if (zipArrayBuffer && zipArrayBuffer.__isContentsAPI) {
        console.log('📁 Processing Contents API files (no ZIP extraction needed)')
        const files = zipArrayBuffer.files
        const filePaths = Object.keys(files)
        
        // Simulate progress for consistency
        if (progressCallback) {
          filePaths.forEach((path, index) => {
            progressCallback({
              processed: index + 1,
              total: filePaths.length,
              currentFile: path
            })
          })
        }
        
        return files
      }
      
      // Normal ZIP processing
      console.log('📦 Extracting ZIP archive...')
      const zip = await JSZip.loadAsync(zipArrayBuffer)
      const files = {}
      const zipFiles = Object.keys(zip.files)
      let processed = 0

      for (const [path, file] of Object.entries(zip.files)) {
        if (!file.dir) {
          const cleanPath = this.cleanZipPath(path)
          
          if (this.shouldIncludeFile(cleanPath)) {
            const content = await file.async('uint8array')
            files[cleanPath] = content
          }
        }
        
        processed++
        if (progressCallback) {
          progressCallback({
            processed,
            total: zipFiles.length,
            currentFile: path
          })
        }
      }

      return files
    } catch (error) {
      throw new Error(`Error extracting ZIP archive: ${error.message}`)
    }
  }

  cleanZipPath(path) {
    const parts = path.split('/')
    return parts.slice(1).join('/')
  }

  shouldIncludeFile(path) {
    if (!path || path.startsWith('.git/')) return false
    
    const excludePatterns = [
      '.DS_Store',
      'Thumbs.db',
      '.gitignore',
      '.gitattributes',
      '.gitmodules',
      'node_modules/',
      '.next/',
      'dist/',
      'build/',
      '.vscode/',
      '.idea/',
      '*.log',
      '*.tmp',
      '*.swp',
      '*.swo'
    ]
    
    return !excludePatterns.some(pattern => {
      if (pattern.includes('*')) {
        const regex = new RegExp(pattern.replace('*', '.*'))
        return regex.test(path)
      }
      return path.includes(pattern)
    })
  }

  async writeFilesToWebContainer(webContainer, files, progressCallback) {
    try {
      const filePaths = Object.keys(files)
      let written = 0

      for (const [path, content] of Object.entries(files)) {
        if (path) {
          const directory = path.split('/').slice(0, -1).join('/')
          
          if (directory) {
            await this.ensureDirectoryExists(webContainer, directory)
          }
          
          await webContainer.fs.writeFile(path, content)
          written++
          
          if (progressCallback) {
            progressCallback({
              written,
              total: filePaths.length,
              currentFile: path
            })
          }
        }
      }

      return written
    } catch (error) {
      throw new Error(`Error writing files to WebContainer: ${error.message}`)
    }
  }

  convertFilesToFileSystemTree(files, projectName = 'myProject') {
    const projectTree = {}
    
    for (const [path, content] of Object.entries(files)) {
      if (!path) continue
      
      const parts = path.split('/')
      let current = projectTree
      
      for (let i = 0; i < parts.length; i++) {
        const part = parts[i]
        if (i === parts.length - 1) {
          let fileContents
          if (typeof content === 'string') {
            fileContents = content
          } else if (content instanceof Uint8Array) {
            // Try to decode as text, but fallback to base64 for binary files
            try {
              fileContents = new TextDecoder('utf-8', { fatal: true }).decode(content)
            } catch (error) {
              // If it fails, it's likely a binary file - convert to base64
              fileContents = btoa(String.fromCharCode.apply(null, content))
              console.warn(`⚠️ Binary file detected, converting to base64: ${path}`)
            }
          } else {
            fileContents = String(content)
          }
          
          current[part] = {
            file: {
              contents: fileContents
            }
          }
        } else {
          if (!current[part]) {
            current[part] = {
              directory: {}
            }
          }
          current = current[part].directory
        }
      }
    }
    
    // Wrap the entire project tree in a single project directory
    return {
      [projectName]: {
        directory: projectTree
      }
    }
  }

  async ensureDirectoryExists(webContainer, dirPath) {
    const parts = dirPath.split('/')
    let currentPath = ''
    
    for (const part of parts) {
      if (part) {
        currentPath += (currentPath ? '/' : '') + part
        try {
          await webContainer.fs.mkdir(currentPath, { recursive: true })
        } catch (error) {
          if (!error.message.includes('EEXIST')) {
            throw error
          }
        }
      }
    }
  }

  async cloneRepoToWebContainer(webContainer, owner, repo, branch = 'main', options = {}) {
    const { 
      onProgress, 
      onComplete, 
      onError,
      maxSize = 50 * 1024 * 1024, // 50MB default limit
      useMount = false // New option to use mount instead of fs operations
    } = options

    console.log('🚀 Starting repository clone to WebContainer:', { 
      owner, 
      repo, 
      branch, 
      maxSizeMB: maxSize / 1024 / 1024,
      useMount,
      hasAuthToken: !!this.authToken
    })

    try {
      if (onProgress) onProgress({ stage: 'fetching-info', message: 'Fetching repository information...' })
      
      const repoInfo = await this.fetchRepoInfo(owner, repo)
      
      if (repoInfo.size * 1024 > maxSize) {
        throw new Error(`Repository too large (${(repoInfo.size / 1024).toFixed(1)}MB). Maximum size: ${(maxSize / 1024 / 1024).toFixed(1)}MB`)
      }

      if (onProgress) onProgress({ stage: 'downloading', message: 'Downloading repository archive...' })
      
      const zipBuffer = await this.fetchRepoZipball(owner, repo, branch)

      if (onProgress) onProgress({ stage: 'extracting', message: 'Extracting files...' })
      
      const files = await this.extractZipToFiles(zipBuffer, (progress) => {
        if (onProgress) {
          onProgress({
            stage: 'extracting',
            message: `Extracting ${progress.currentFile}`,
            progress: progress.processed / progress.total
          })
        }
      })

      let filesWritten = 0
      let fileSystemTree = null

      if (useMount) {
        if (onProgress) onProgress({ stage: 'mounting', message: 'Converting to FileSystemTree...' })
        
        fileSystemTree = this.convertFilesToFileSystemTree(files, repo)
        
        console.log('🗂️ FileSystemTree structure for mounting:', {
          totalDirectories: Object.keys(fileSystemTree).length,
          structure: fileSystemTree
        })
        
        if (onProgress) onProgress({ stage: 'mounting', message: 'Mounting files to container...' })
        
        await webContainer.mount(fileSystemTree)
        filesWritten = Object.keys(files).length
        
        // Wait a moment for the mount to complete and verify files
        if (onProgress) onProgress({ stage: 'verifying', message: 'Verifying mounted files...' })
        await new Promise(resolve => setTimeout(resolve, 1000))
        
        // Verify that files are properly mounted
        try {
          const projectDir = `/${repo}`
          const dirContents = await webContainer.fs.readdir(projectDir)
          console.log('📁 Project directory contents:', dirContents)
          
          // Check if package.json exists in the project directory
          const packageJsonPath = `${projectDir}/package.json`
          try {
            await webContainer.fs.readFile(packageJsonPath, 'utf-8')
            console.log('✅ package.json found at:', packageJsonPath)
          } catch (err) {
            console.warn('⚠️ package.json not found at:', packageJsonPath)
          }
        } catch (error) {
          console.error('❌ Error verifying mounted files:', error)
        }
      } else {
        if (onProgress) onProgress({ stage: 'writing', message: 'Writing files to container...' })
        
        filesWritten = await this.writeFilesToWebContainer(webContainer, files, (progress) => {
          if (onProgress) {
            onProgress({
              stage: 'writing',
              message: `Writing ${progress.currentFile}`,
              progress: progress.written / progress.total
            })
          }
        })
      }

      const result = {
        owner,
        repo,
        branch,
        filesWritten,
        repoInfo,
        fileSystemTree,
        success: true
      }

      if (onComplete) onComplete(result)
      return result

    } catch (error) {
      const errorResult = {
        owner,
        repo,
        branch,
        error: error.message,
        success: false
      }
      
      if (onError) onError(errorResult)
      throw error
    }
  }

  async setupWebContainerWithRepo(owner, repo, branch = 'main', options = {}) {
    const { 
      onProgress, 
      onComplete, 
      onError,
      autoInstall = true,
      autoStart = false
    } = options

    try {
      if (onProgress) onProgress({ stage: 'booting', message: 'Booting WebContainer...' })
      
      const { WebContainer } = await import('@webcontainer/api')
      const webContainer = await WebContainer.boot()

      if (onProgress) onProgress({ stage: 'cloning', message: 'Cloning repository...' })
      
      const cloneResult = await this.cloneRepoToWebContainer(webContainer, owner, repo, branch, {
        ...options,
        useMount: true,
        onProgress: (progress) => {
          if (onProgress) onProgress(progress)
        }
      })

      if (autoInstall) {
        if (onProgress) onProgress({ stage: 'installing', message: 'Installing dependencies...' })
        
        // Change to the project directory before running npm install
        const projectDir = `/${repo}`
        console.log('📦 Starting npm install in directory:', projectDir)
        
        let installProcess = await webContainer.spawn('npm', ['install'], {
          cwd: projectDir
        })
        
        // Capture install output and relay to console
        if (installProcess.output) {
          const reader = installProcess.output.getReader()
          
          const readInstallOutput = async () => {
            try {
              while (true) {
                const { done, value } = await reader.read()
                if (done) break
                
                // Debug: log the type and value we're receiving (only log meaningful content)
                if (typeof value !== 'string' || (value && !value.includes('\x1B'))) {
                  console.log('📦 npm install raw value:', { 
                    type: typeof value, 
                    constructor: value?.constructor?.name,
                    isUint8Array: value instanceof Uint8Array,
                    value: value
                  })
                }
                
                let text
                if (value instanceof Uint8Array) {
                  text = new TextDecoder().decode(value)
                } else if (typeof value === 'string') {
                  text = value
                } else {
                  text = String(value)
                }
                
                // Clean up ANSI escape codes and empty lines
                const cleanText = text.replace(/\x1B\[[0-9;]*[mGKHf]/g, '').trim()
                if (cleanText && cleanText !== '\\' && cleanText !== '|' && cleanText !== '/' && cleanText !== '-') {
                  console.log('📦 npm install:', cleanText)
                } else if (cleanText) {
                  // This is just progress spinner characters, show them minimally
                  console.log('📦 npm install progress:', cleanText)
                }
                
                // Also relay to progress callback if available
                if (onProgress) {
                  onProgress({ 
                    stage: 'installing', 
                    message: `Installing: ${text.trim().substring(0, 100)}...`,
                    output: text
                  })
                }
              }
            } catch (error) {
              console.error('📦 npm install output error:', error)
            }
          }
          
          // Start reading output (don't await, let it run in parallel)
          readInstallOutput().catch(error => {
            console.error('📦 Install output reading error:', error)
            // Don't let output reading errors propagate
          })
        }
        
        let installExitCode = await installProcess.exit
        console.log('📦 npm install completed with exit code:', installExitCode)
        
        if (installExitCode !== 0) {
          console.warn('⚠️ npm install failed, trying with --legacy-peer-deps...')
          if (onProgress) onProgress({ stage: 'installing', message: 'Retrying with --legacy-peer-deps...' })
          
          // Try again with legacy peer deps
          installProcess = await webContainer.spawn('npm', ['install', '--legacy-peer-deps'], {
            cwd: projectDir
          })
          
          // Capture retry output
          if (installProcess.output) {
            const reader = installProcess.output.getReader()
            
            const readRetryOutput = async () => {
              try {
                while (true) {
                  const { done, value } = await reader.read()
                  if (done) break
                  
                  let text
                  if (value instanceof Uint8Array) {
                    text = new TextDecoder().decode(value)
                  } else if (typeof value === 'string') {
                    text = value
                  } else {
                    text = String(value)
                  }
                  
                  // Clean up ANSI escape codes
                  const cleanText = text.replace(/\x1B\[[0-9;]*[mGKHf]/g, '').trim()
                  if (cleanText && cleanText !== '\\' && cleanText !== '|' && cleanText !== '/' && cleanText !== '-') {
                    console.log('📦 npm install (legacy):', cleanText)
                  }
                  
                  // Relay to progress callback
                  if (onProgress) {
                    onProgress({ 
                      stage: 'installing', 
                      message: `Installing (legacy): ${text.trim().substring(0, 100)}...`,
                      output: text
                    })
                  }
                }
              } catch (error) {
                console.error('📦 npm install retry output error:', error)
              }
            }
            
            readRetryOutput().catch(error => {
              console.error('📦 Install retry output reading error:', error)
            })
          }
          
          installExitCode = await installProcess.exit
          console.log('📦 npm install (legacy) completed with exit code:', installExitCode)
          
          if (installExitCode !== 0) {
            const errorMsg = `npm install failed even with --legacy-peer-deps (exit code ${installExitCode})`
            console.error('❌', errorMsg)
            throw new Error(errorMsg)
          } else {
            console.log('✅ npm install completed successfully with --legacy-peer-deps')
          }
        } else {
          console.log('✅ npm install completed successfully')
        }
      }

      if (autoStart) {
        if (onProgress) onProgress({ stage: 'starting', message: 'Starting development server...' })
        
        console.log('🚀 Starting npm run dev...')
        
        // Set up server-ready listener before starting
        webContainer.on('server-ready', (port, url) => {
          console.log('✅ Server ready:', { port, url })
          if (onProgress) onProgress({ stage: 'ready', message: `Server ready at ${url}`, url, port })
        })
        
        const devProcess = await webContainer.spawn('npm', ['run', 'dev'], {
          cwd: projectDir
        })
        
        // Capture dev server output and relay to console
        if (devProcess.output) {
          const reader = devProcess.output.getReader()
          
          const readDevOutput = async () => {
            try {
              while (true) {
                const { done, value } = await reader.read()
                if (done) break
                
                let text
                if (value instanceof Uint8Array) {
                  text = new TextDecoder().decode(value)
                } else if (typeof value === 'string') {
                  text = value
                } else {
                  text = String(value)
                }
                
                console.log('🚀 npm run dev:', text.trim())
                
                // Also relay to progress callback if available
                if (onProgress) {
                  onProgress({ 
                    stage: 'starting', 
                    message: `Dev server: ${text.trim().substring(0, 100)}...`,
                    output: text
                  })
                }
              }
            } catch (error) {
              console.error('🚀 npm run dev output error:', error)
            }
          }
          
          // Start reading output (don't await, let it run in background)
          readDevOutput()
        }
        
        console.log('🚀 Dev server process started')
      }

      const result = {
        ...cloneResult,
        webContainer,
        success: true
      }

      if (onComplete) onComplete(result)
      return result

    } catch (error) {
      const errorResult = {
        owner,
        repo,
        branch,
        error: error.message,
        success: false
      }
      
      if (onError) onError(errorResult)
      throw error
    }
  }

  async getRepoBranches(owner, repo) {
    const url = `${this.apiBase}/repos/${owner}/${repo}/branches`
    console.log('🌿 Fetching repository branches:', { owner, repo, url })
    
    try {
      const response = await fetch(url, {
        headers: this.defaultHeaders
      })
      
      console.log('📥 Branches response:', {
        status: response.status,
        statusText: response.statusText
      })
      
      if (!response.ok) {
        const errorText = await response.text()
        console.error('❌ Branches error response:', errorText)
        throw new Error(`Failed to fetch branches: ${response.status} - ${response.statusText}`)
      }
      
      const branches = await response.json()
      const branchNames = branches.map(branch => branch.name)
      console.log('✅ Branches fetched successfully:', branchNames)
      
      return branchNames
    } catch (error) {
      console.error('💥 Error fetching branches:', error)
      throw new Error(`Error fetching branches: ${error.message}`)
    }
  }

  async searchRepos(query, options = {}) {
    const { 
      sort = 'stars', 
      order = 'desc', 
      per_page = 30,
      page = 1 
    } = options

    const searchParams = new URLSearchParams({
      q: query,
      sort,
      order,
      per_page,
      page
    })

    const url = `${this.apiBase}/search/repositories?${searchParams}`
    console.log('🔍 Searching repositories:', { query, options, url })

    try {
      const response = await fetch(url, {
        headers: this.defaultHeaders
      })
      
      console.log('📥 Search response:', {
        status: response.status,
        statusText: response.statusText,
        rateLimitRemaining: response.headers.get('x-ratelimit-remaining'),
        rateLimitReset: response.headers.get('x-ratelimit-reset')
      })
      
      if (!response.ok) {
        const errorText = await response.text()
        console.error('❌ Search error response:', errorText)
        throw new Error(`Failed to search repositories: ${response.status} - ${response.statusText}`)
      }
      
      const data = await response.json()
      console.log('✅ Search completed successfully:', { 
        totalCount: data.total_count,
        itemsReturned: data.items?.length || 0
      })
      
      return data
    } catch (error) {
      console.error('💥 Error searching repositories:', error)
      throw new Error(`Error searching repositories: ${error.message}`)
    }
  }
}

export const githubRepoService = new GitHubRepoService()