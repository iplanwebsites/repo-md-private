import { githubRepoService } from './githubRepoService.js'

/**
 * Example usage of GitHubRepoService in a Vue component
 */
export const GitHubRepoServiceExample = {
  setup() {
    const { ref, reactive } = require('vue')
    
    const state = reactive({
      loading: false,
      error: null,
      progress: null,
      result: null,
      serverUrl: null
    })
    
    const repoUrl = ref('')
    const selectedBranch = ref('main')
    const branches = ref([])
    const webContainer = ref(null)
    const useWebContainer = ref(true)
    const autoInstall = ref(true)
    const autoStart = ref(false)
    
    // Parse GitHub URL
    const parseGitHubUrl = (url) => {
      const match = url.match(/github\.com\/([^\/]+)\/([^\/]+)/)
      if (match) {
        return {
          owner: match[1],
          repo: match[2].replace(/\.git$/, '')
        }
      }
      return null
    }
    
    // Fetch repository branches
    const fetchBranches = async (owner, repo) => {
      try {
        const branchList = await githubRepoService.getRepoBranches(owner, repo)
        branches.value = branchList
        selectedBranch.value = branchList.includes('main') ? 'main' : branchList[0] || 'main'
      } catch (error) {
        console.error('Error fetching branches:', error)
      }
    }
    
    // Clone repository to WebContainer with full setup
    const setupWebContainerWithRepo = async () => {
      const parsed = parseGitHubUrl(repoUrl.value)
      if (!parsed) {
        state.error = 'Invalid GitHub URL'
        return
      }
      
      state.loading = true
      state.error = null
      state.progress = null
      state.result = null
      state.serverUrl = null
      
      try {
        const result = await githubRepoService.setupWebContainerWithRepo(
          parsed.owner,
          parsed.repo,
          selectedBranch.value,
          {
            autoInstall: autoInstall.value,
            autoStart: autoStart.value,
            onProgress: (progress) => {
              state.progress = progress
              if (progress.stage === 'ready' && progress.url) {
                state.serverUrl = progress.url
              }
            },
            onComplete: (result) => {
              state.result = result
              state.loading = false
              webContainer.value = result.webContainer
            },
            onError: (error) => {
              state.error = error.error
              state.loading = false
            }
          }
        )
        
        console.log('WebContainer setup completed:', result)
        
      } catch (error) {
        state.error = error.message
        state.loading = false
      }
    }
    
    // Clone repository to existing WebContainer
    const cloneRepository = async () => {
      const parsed = parseGitHubUrl(repoUrl.value)
      if (!parsed) {
        state.error = 'Invalid GitHub URL'
        return
      }
      
      if (!webContainer.value) {
        state.error = 'WebContainer not initialized'
        return
      }
      
      state.loading = true
      state.error = null
      state.progress = null
      state.result = null
      
      try {
        const result = await githubRepoService.cloneRepoToWebContainer(
          webContainer.value,
          parsed.owner,
          parsed.repo,
          selectedBranch.value,
          {
            useMount: useWebContainer.value,
            onProgress: (progress) => {
              state.progress = progress
            },
            onComplete: (result) => {
              state.result = result
              state.loading = false
            },
            onError: (error) => {
              state.error = error.error
              state.loading = false
            }
          }
        )
        
        console.log('Repository cloned successfully:', result)
        
      } catch (error) {
        state.error = error.message
        state.loading = false
      }
    }
    
    // Search repositories
    const searchRepos = async (query) => {
      try {
        const results = await githubRepoService.searchRepos(query, {
          per_page: 10
        })
        return results.items.map(repo => ({
          name: repo.full_name,
          url: repo.html_url,
          description: repo.description,
          stars: repo.stargazers_count,
          language: repo.language
        }))
      } catch (error) {
        console.error('Error searching repositories:', error)
        return []
      }
    }
    
    // Initialize with authentication token if available
    const initializeService = (token) => {
      if (token) {
        githubRepoService.setAuthToken(token)
      }
    }
    
    // Manual npm install
    const installDependencies = async () => {
      if (!webContainer.value) {
        state.error = 'WebContainer not initialized'
        return
      }
      
      try {
        state.loading = true
        state.progress = { stage: 'installing', message: 'Installing dependencies...' }
        
        const installProcess = await webContainer.value.spawn('npm', ['install'])
        const exitCode = await installProcess.exit
        
        if (exitCode === 0) {
          state.progress = { stage: 'complete', message: 'Dependencies installed successfully' }
        } else {
          state.error = 'Failed to install dependencies'
        }
        
        state.loading = false
        
      } catch (error) {
        state.error = error.message
        state.loading = false
      }
    }
    
    // Start development server
    const startDevServer = async () => {
      if (!webContainer.value) {
        state.error = 'WebContainer not initialized'
        return
      }
      
      try {
        state.loading = true
        state.progress = { stage: 'starting', message: 'Starting development server...' }
        
        const devProcess = await webContainer.value.spawn('npm', ['run', 'dev'])
        
        webContainer.value.on('server-ready', (port, url) => {
          state.serverUrl = url
          state.progress = { stage: 'ready', message: `Server ready at ${url}` }
          state.loading = false
        })
        
      } catch (error) {
        state.error = error.message
        state.loading = false
      }
    }
    
    return {
      state,
      repoUrl,
      selectedBranch,
      branches,
      webContainer,
      useWebContainer,
      autoInstall,
      autoStart,
      parseGitHubUrl,
      fetchBranches,
      cloneRepository,
      setupWebContainerWithRepo,
      searchRepos,
      initializeService,
      installDependencies,
      startDevServer
    }
  }
}

/**
 * Example Vue template for using the service
 */
export const ExampleTemplate = `
<template>
  <div class="github-repo-service">
    <div class="form-group">
      <label>GitHub Repository URL:</label>
      <input 
        v-model="repoUrl" 
        type="text" 
        placeholder="https://github.com/owner/repo"
        @change="onRepoUrlChange"
      />
    </div>
    
    <div class="form-group" v-if="branches.length > 0">
      <label>Branch:</label>
      <select v-model="selectedBranch">
        <option v-for="branch in branches" :key="branch" :value="branch">
          {{ branch }}
        </option>
      </select>
    </div>
    
    <button 
      @click="cloneRepository" 
      :disabled="state.loading || !repoUrl"
      class="clone-button"
    >
      {{ state.loading ? 'Cloning...' : 'Clone Repository' }}
    </button>
    
    <div v-if="state.progress" class="progress">
      <div class="progress-bar">
        <div 
          class="progress-fill" 
          :style="{ width: (state.progress.progress * 100) + '%' }"
        ></div>
      </div>
      <div class="progress-text">
        {{ state.progress.message }}
      </div>
    </div>
    
    <div v-if="state.error" class="error">
      Error: {{ state.error }}
    </div>
    
    <div v-if="state.result" class="result">
      <h3>Repository Cloned Successfully!</h3>
      <p>Files written: {{ state.result.filesWritten }}</p>
      <p>Repository: {{ state.result.owner }}/{{ state.result.repo }}</p>
      <p>Branch: {{ state.result.branch }}</p>
    </div>
  </div>
</template>

<script>
import { GitHubRepoServiceExample } from './githubRepoService.example.js'

export default {
  name: 'GitHubRepoLoader',
  ...GitHubRepoServiceExample,
  methods: {
    async onRepoUrlChange() {
      const parsed = this.parseGitHubUrl(this.repoUrl)
      if (parsed) {
        await this.fetchBranches(parsed.owner, parsed.repo)
      }
    }
  }
}
</script>

<style scoped>
.github-repo-service {
  max-width: 600px;
  margin: 0 auto;
  padding: 20px;
}

.form-group {
  margin-bottom: 15px;
}

.form-group label {
  display: block;
  margin-bottom: 5px;
  font-weight: bold;
}

.form-group input,
.form-group select {
  width: 100%;
  padding: 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
}

.clone-button {
  background-color: #007bff;
  color: white;
  padding: 10px 20px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.clone-button:disabled {
  background-color: #6c757d;
  cursor: not-allowed;
}

.progress {
  margin-top: 15px;
}

.progress-bar {
  width: 100%;
  height: 20px;
  background-color: #e9ecef;
  border-radius: 10px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background-color: #28a745;
  transition: width 0.3s ease;
}

.progress-text {
  margin-top: 5px;
  font-size: 14px;
  color: #666;
}

.error {
  margin-top: 15px;
  padding: 10px;
  background-color: #f8d7da;
  color: #721c24;
  border-radius: 4px;
}

.result {
  margin-top: 15px;
  padding: 10px;
  background-color: #d4edda;
  color: #155724;
  border-radius: 4px;
}
</style>
`