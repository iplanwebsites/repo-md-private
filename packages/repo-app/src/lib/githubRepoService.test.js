import { githubRepoService } from './githubRepoService.js'

// Mock WebContainer for testing
class MockWebContainer {
  constructor() {
    this.fs = {
      files: {},
      mkdir: async (path, options) => {
        console.log(`Creating directory: ${path}`)
        return Promise.resolve()
      },
      writeFile: async (path, content) => {
        console.log(`Writing file: ${path} (${content.length} bytes)`)
        this.files[path] = content
        return Promise.resolve()
      }
    }
  }
}

// Test the service
export async function testGitHubRepoService() {
  console.log('Testing GitHub Repo Service...')
  
  const mockContainer = new MockWebContainer()
  
  // Test with a small public repository
  const owner = 'octocat'
  const repo = 'Hello-World'
  
  try {
    console.log(`\nFetching repository info for ${owner}/${repo}...`)
    const repoInfo = await githubRepoService.fetchRepoInfo(owner, repo)
    console.log(`Repository size: ${repoInfo.size}KB`)
    console.log(`Default branch: ${repoInfo.default_branch}`)
    
    console.log('\nCloning repository to WebContainer...')
    const result = await githubRepoService.cloneRepoToWebContainer(
      mockContainer,
      owner,
      repo,
      repoInfo.default_branch,
      {
        onProgress: (progress) => {
          console.log(`[${progress.stage}] ${progress.message}`)
          if (progress.progress) {
            console.log(`Progress: ${(progress.progress * 100).toFixed(1)}%`)
          }
        },
        onComplete: (result) => {
          console.log('\nCloning completed!')
          console.log(`Files written: ${result.filesWritten}`)
        },
        onError: (error) => {
          console.error('Cloning failed:', error)
        }
      }
    )
    
    console.log('\nFiles in container:')
    Object.keys(mockContainer.fs.files).forEach(path => {
      console.log(`  ${path}`)
    })
    
    return result
    
  } catch (error) {
    console.error('Test failed:', error.message)
    throw error
  }
}

// Test searching repositories
export async function testRepoSearch() {
  console.log('\nTesting repository search...')
  
  try {
    const results = await githubRepoService.searchRepos('react', {
      per_page: 5
    })
    
    console.log(`Found ${results.total_count} repositories`)
    console.log('Top 5 results:')
    results.items.forEach((repo, index) => {
      console.log(`  ${index + 1}. ${repo.full_name} - ${repo.stargazers_count} stars`)
    })
    
    return results
    
  } catch (error) {
    console.error('Search test failed:', error.message)
    throw error
  }
}

// Usage example
console.log('GitHub Repo Service Test Suite')
console.log('To run tests, call:')
console.log('- testGitHubRepoService() for basic cloning test')
console.log('- testRepoSearch() for search functionality test')