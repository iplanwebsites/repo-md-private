<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import trpc from '@/trpc'
import { getSupaUser } from '@/lib/supabaseClient'
import { ChevronDown, X, ExternalLink, MoreHorizontal } from 'lucide-vue-next'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'

const route = useRoute()
const router = useRouter()

const selectedTemplate = ref(route.params.templateId || 'clean')
const selectedProject = ref(route.query.projectId || '')
const selectedRevision = ref(route.query.rev || 'latest')
const userProjects = ref([])
const deployments = ref([])
const isLoading = ref(true)
const isAuthenticated = ref(false)

// Static template collection with their demo URLs
const templateDemos = [
    { id: 'noto', name: 'Noto', url: 'https://noto-demo.repo.md' },
  { id: 'clean', name: 'Clean', url: 'https://clean-demo.repo.md' },
  { id: 'blog-starter', name: 'Blog Starter', url: 'https://blog-starter-demo.repo.md' },
  { id: 'docs-template', name: 'Documentation', url: 'https://docs-template-demo.repo.md' },
  { id: 'portfolio', name: 'Portfolio', url: 'https://portfolio-demo.repo.md' },
  { id: 'landing-page', name: 'Landing Page', url: 'https://landing-demo.repo.md' },
  { id: 'company-blog', name: 'Company Blog', url: 'https://company-blog-demo.repo.md' },
  { id: 'knowledge-base', name: 'Knowledge Base', url: 'https://kb-demo.repo.md' },
  { id: 'personal-site', name: 'Personal Site', url: 'https://personal-demo.repo.md' },
  { id: 'startup-landing', name: 'Startup Landing', url: 'https://startup-demo.repo.md' },
  { id: 'markdown-notes', name: 'Markdown Notes', url: 'https://notes-demo.repo.md' }
]

const demoProjects = [
  { id: 'rac', name: 'cooking blog', id: '6848af1cacdf98346841d302'},
  { id: 'weird', name: 'weird', id: '6851d519ac5bcd832fb4c887' },
  { id: 'demo-portfolio', name: 'Portfolio Demo', id: 'TBD' }
]

const allProjects = computed(() => {
  // Always show demo projects first, then user projects if authenticated
  return isAuthenticated.value ? [...demoProjects, ...userProjects.value] : demoProjects
})

const iframeUrl = computed(() => {
  // If showing template demo with no project selected
  if (selectedTemplate.value && !selectedProject.value) {
    const templateDemo = templateDemos.find(t => t.id === selectedTemplate.value)
    return templateDemo?.url || ''
  }
  
  // If template and project are both selected
  if (selectedTemplate.value && selectedProject.value) {
    const templateDemo = templateDemos.find(t => t.id === selectedTemplate.value)
    if (templateDemo) {
      return `${templateDemo.url}/?repo=${selectedProject.value}`
    }
  }
  
  // If only project is selected (no template)
  if (!selectedProject.value) return ''
  
  const demoProject = demoProjects.find(p => p.id === selectedProject.value)
  if (demoProject) {
    return `https://${demoProject.id}.repo.md`
  }
  
  const project = userProjects.value.find(p => p.id === selectedProject.value)
  if (!project) return ''
  
  if (selectedRevision.value === 'latest') {
    return project.deployedUrl || ''
  }
  
  const deployment = deployments.value.find(d => d.id === selectedRevision.value)
  return deployment?.url || ''
})

const currentProjectName = computed(() => {
  const project = allProjects.value.find(p => p.id === selectedProject.value)
  return project?.name || 'Select Project'
})

const currentTemplateName = computed(() => {
  const template = templateDemos.find(t => t.id === selectedTemplate.value)
  return template?.name || 'Select Template'
})

const loadUserProjects = async () => {
  const user = await getSupaUser()
  isAuthenticated.value = !!user
  
  if (!user) return
  
  try {
    // First, get all user's organizations
    const orgs = await trpc.orgs.list.query()
    
    // Then fetch projects for each organization
    const projectPromises = orgs.map(org => 
      trpc.projects.list.query({ 
        orgId: org.id,
        includeCollaborations: true 
      })
    )
    
    const projectResults = await Promise.all(projectPromises)
    
    // Flatten and map the projects
    userProjects.value = projectResults.flat().map(project => ({
      id: project.id,
      name: project.name,
      orgId: project.orgId,
      deployedUrl: project.url || `https://${project.slug}.repo.md`
    }))
  } catch (error) {
    console.error('Failed to load user projects:', error)
  }
}

const loadDeployments = async () => {
  if (!selectedProject.value || demoProjects.find(p => p.id === selectedProject.value)) {
    deployments.value = []
    return
  }
  
  const project = userProjects.value.find(p => p.id === selectedProject.value)
  if (!project) return
  
  try {
    const result = await trpc.deployments.list.query({
      orgId: project.orgId,
      projectId: project.id
    })
    deployments.value = result || []
  } catch (error) {
    console.error('Failed to load deployments:', error)
    deployments.value = []
  }
}

const updateUrl = () => {
  const query = {}
  if (selectedProject.value) query.projectId = selectedProject.value
  if (selectedRevision.value && selectedRevision.value !== 'latest') query.rev = selectedRevision.value
  
  router.replace({
    params: { templateId: selectedTemplate.value },
    query
  })
}

watch(selectedTemplate, () => {
  updateUrl()
})

watch(selectedProject, async () => {
  selectedRevision.value = 'latest'
  await loadDeployments()
  updateUrl()
})

watch(selectedRevision, () => {
  updateUrl()
})

onMounted(async () => {
  isLoading.value = true
  
  // Load user projects (this will also check authentication)
  await loadUserProjects()
  
  if (selectedProject.value) {
    await loadDeployments()
  }
  
  // Set default template if none selected
  if (!selectedTemplate.value && templateDemos.length > 0) {
    selectedTemplate.value = templateDemos[0].id
  }
  
  // Set default project if none selected and user has projects
  if (!selectedProject.value && allProjects.value.length > 0) {
    selectedProject.value = allProjects.value[0].id
  }
  
  isLoading.value = false
})

const closeDemo = () => {
  window.close()
}

const copyUrl = () => {
  if (iframeUrl.value) {
    navigator.clipboard.writeText(iframeUrl.value)
  }
}

const openInNewTab = () => {
  if (iframeUrl.value) {
    window.open(iframeUrl.value, '_blank')
  }
}
</script>

<template>
  <div class="h-screen bg-gray-50">
    <!-- Main content area with iframe (accounting for fixed bottom bar) -->
    <div class="h-full pb-14 relative">
      <iframe
        v-if="iframeUrl"
        :src="iframeUrl"
        class="w-full h-full border-0"
        title="Site Demo"
      />
      <div v-else class="flex items-center justify-center h-full text-gray-500">
        <div class="text-center">
          <p class="text-lg mb-2">No preview available</p>
          <p class="text-sm">Select a project to preview</p>
        </div>
      </div>
    </div>

    <!-- Bottom navbar - fixed to bottom -->
    <div class="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-2 z-50">
      <div class="flex items-center gap-3">
        <!-- Template selector -->
        <div class="relative">
          <select
            v-model="selectedTemplate"
            class="appearance-none bg-gray-50 border border-gray-300 rounded-md px-3 py-1.5 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            @change="selectedProject = ''"
          >
            <option value="" disabled>Select Template</option>
            <option v-for="template in templateDemos" :key="template.id" :value="template.id">
              {{ template.name }}
            </option>
          </select>
          <ChevronDown class="absolute right-2 top-2 h-4 w-4 text-gray-400 pointer-events-none" />
        </div>

        <!-- Project selector -->
        <div class="relative">
          <select
            v-model="selectedProject"
            class="appearance-none bg-gray-50 border border-gray-300 rounded-md px-3 py-1.5 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">{{ isAuthenticated ? 'Select Your Project' : 'Select Demo Project' }}</option>
            <option v-for="project in allProjects" :key="project.id" :value="project.id">
              {{ project.name }}
            </option>
          </select>
          <ChevronDown class="absolute right-2 top-2 h-4 w-4 text-gray-400 pointer-events-none" />
        </div>

        <!-- Revision selector (only for user projects) -->
        <div v-if="selectedProject && !demoProjects.find(p => p.id === selectedProject)" class="relative">
          <select
            v-model="selectedRevision"
            class="appearance-none bg-gray-50 border border-gray-300 rounded-md px-3 py-1.5 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="latest">Latest</option>
            <option v-for="deployment in deployments" :key="deployment.id" :value="deployment.id">
              {{ deployment.id.slice(0, 8) }} - {{ new Date(deployment.createdAt).toLocaleDateString() }}
            </option>
          </select>
          <ChevronDown class="absolute right-2 top-2 h-4 w-4 text-gray-400 pointer-events-none" />
        </div>

        <!-- Current URL display -->
        <div v-if="iframeUrl" class="flex items-center gap-1 text-xs text-gray-500">
          <span class="max-w-xs truncate">{{ iframeUrl }}</span>
          <a :href="iframeUrl" target="_blank" class="text-gray-500 hover:text-gray-700 ml-1">
            <ExternalLink class="h-3 w-3" />
          </a>
        </div>

        <!-- Actions group on the right -->
        <div class="flex items-center gap-1 ml-auto">
          <!-- More options button -->
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                class="p-1.5 text-gray-500 hover:text-gray-700 rounded hover:bg-gray-100"
                title="More options"
              >
                <MoreHorizontal class="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem @click="copyUrl">
                Copy URL
              </DropdownMenuItem>
              <DropdownMenuItem @click="openInNewTab">
                Open in New Tab
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <!-- Close button -->
          <button
            @click="closeDemo"
            class="p-1.5 text-gray-500 hover:text-gray-700 rounded hover:bg-gray-100"
            title="Close demo"
          >
            <X class="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  </div>
</template>