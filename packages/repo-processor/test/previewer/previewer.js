// Post Tester Utility
class PostTester {
    constructor() {
        this.posts = [];
        this.selectedPost = null;
        this.currentView = 'preview';
        
        // Add styles for frontmatter section
        this.addStyles();
        
        // Initialize
        this.init();
    }

    addStyles() {
        const style = document.createElement('style');
        style.textContent = `
            .frontmatter-section {
                margin-bottom: 2rem;
                padding: 1rem;
                background-color: #f8f9fa;
                border-radius: 4px;
                border: 1px solid #dee2e6;
            }
            
            .frontmatter-section h3 {
                margin-top: 0;
                margin-bottom: 1rem;
                color: #495057;
            }
            
            .frontmatter-table {
                width: 100%;
                border-collapse: collapse;
            }
            
            .frontmatter-table th,
            .frontmatter-table td {
                padding: 0.5rem;
                border: 1px solid #dee2e6;
                text-align: left;
            }
            
            .frontmatter-table th {
                background-color: #e9ecef;
                font-weight: 600;
            }
            
            .frontmatter-table tr:nth-child(even) {
                background-color: #f8f9fa;
            }
        `;
        document.head.appendChild(style);
    }

    async init() {
        // Parse URL parameters for view
        this.parseUrlParams();
        
        // Load posts data
        await this.loadPosts();
        
        // Parse URL parameters for post selection (after posts are loaded)
        this.parsePostFromUrl();
        
        // Setup event listeners
        this.setupEventListeners();
        
        // If a post was selected via URL, display it
        if (this.selectedPost) {
            this.displayPost(this.selectedPost);
        }
    }

    parseUrlParams() {
        // First check query parameters
        const searchParams = new URLSearchParams(window.location.search);
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        
        // Get view from either source, preferring hash fragment
        const view = hashParams.get('view') || searchParams.get('view');
        
        if (view && ['preview', 'code', 'json'].includes(view)) {
            this.currentView = view;
            // Update active tab
            document.querySelectorAll('.tab').forEach(tab => {
                tab.classList.toggle('active', tab.dataset.view === view);
            });
        }
    }

    parsePostFromUrl() {
        // First check query parameters
        const searchParams = new URLSearchParams(window.location.search);
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        
        // Get hash from either source, preferring hash fragment
        const hash = hashParams.get('hash') || searchParams.get('hash');
        
        if (hash) {
            const post = this.posts.find(p => this.generateHash(p.fileName) === hash);
            if (post) {
                this.selectedPost = post.fileName;
            }
        }
    }


    async loadPosts() {
        try {
            const response = await fetch('/dist/posts.json');
            if (!response.ok) {
                throw new Error('Failed to load posts.json');
            }
            this.posts = await response.json();
            this.renderPostsTable();
        } catch (error) {
            console.error('Error loading posts:', error);
            this.showError('Failed to load posts. Make sure posts.json exists in the dist folder.');
        }
    }

    renderPostsTable() {
        const tbody = document.getElementById('postsBody');
        tbody.innerHTML = '';
        
        this.posts.forEach(post => {
            const row = document.createElement('tr');
            row.dataset.filename = post.fileName;
            
            // Highlight selected row
            if (post.fileName === this.selectedPost) {
                row.classList.add('selected');
            }
            
            row.innerHTML = `
                <td><a href="#" class="clickable" data-filename="${post.fileName}">${post.fileName}</a></td>
                <td>${post.slug || '-'}</td>
                <td>${post.wordCount || '-'}</td>
            `;
            
            tbody.appendChild(row);
        });
    }

    setupEventListeners() {
        // Table row clicks
        document.getElementById('postsTable').addEventListener('click', (e) => {
            e.preventDefault();
            
            const clickable = e.target.closest('.clickable');
            if (clickable) {
                const filename = clickable.dataset.filename;
                this.selectPost(filename);
            }
        });
        
        // Tab clicks
        document.querySelectorAll('.tab').forEach(tab => {
            tab.addEventListener('click', () => {
                this.switchView(tab.dataset.view);
            });
        });
        
        // Browser back/forward buttons
        window.addEventListener('popstate', () => {
            this.parseUrlParams();
            this.parsePostFromUrl();
            if (this.selectedPost) {
                this.displayPost(this.selectedPost);
            } else {
                // Clear content if no post is selected
                document.getElementById('content').innerHTML = '<div class="no-selection">Select a post to view its content</div>';
            }
        });
    }

    selectPost(filename) {
        this.selectedPost = filename;
        this.updateUrl();
        this.displayPost(filename);
        
        // Update selected row
        document.querySelectorAll('#postsTable tr').forEach(row => {
            row.classList.toggle('selected', row.dataset.filename === filename);
        });
    }

    displayPost(filename) {
        const post = this.posts.find(p => p.fileName === filename);
        if (!post) {
            this.showError(`Post "${filename}" not found`);
            return;
        }
        
        // Create frontmatter section
        let frontmatterHtml = '<div class="frontmatter-section">';
        frontmatterHtml += '<h3>Frontmatter Variables</h3>';
        if (Object.keys(post.frontmatter).length === 0) {
            frontmatterHtml += '<p>No frontmatter variables found</p>';
        } else {
            frontmatterHtml += '<table class="frontmatter-table">';
            frontmatterHtml += '<tr><th>Variable</th><th>Value</th></tr>';
            for (const [key, value] of Object.entries(post.frontmatter)) {
                frontmatterHtml += `<tr><td>${key}</td><td>${JSON.stringify(value)}</td></tr>`;
            }
            frontmatterHtml += '</table>';
        }
        frontmatterHtml += '</div>';
        
        // Update all views
        const previewContent = document.getElementById('preview');
        const codeContent = document.getElementById('code');
        const jsonContent = document.getElementById('json');
        
        // Preview view
        previewContent.innerHTML = `
            ${frontmatterHtml}
            <div class="preview-content">
                ${post.html || '<p>No HTML content available</p>'}
            </div>
        `;
        
        // Code view
        const formattedHtml = this.formatHtml(post.html || '');
        codeContent.innerHTML = `
            ${frontmatterHtml}
            <div class="code-content">
                <pre><code class="language-html">${this.escapeHtml(formattedHtml)}</code></pre>
            </div>
        `;
        
        // JSON view
        const formattedJson = JSON.stringify(post, null, 2);
        jsonContent.innerHTML = `
            <div class="json-content">
                <pre><code class="language-json">${this.escapeHtml(formattedJson)}</code></pre>
            </div>
        `;
        
        // Show the appropriate view
        this.showCurrentView();
        
        // Apply syntax highlighting
        hljs.highlightAll();
    }

    showCurrentView() {
        const views = ['preview', 'code', 'json'];
        views.forEach(view => {
            const element = document.getElementById(view);
            if (element) {
                element.style.display = view === this.currentView ? 'block' : 'none';
            }
        });
    }

    switchView(view) {
        if (!['preview', 'code', 'json'].includes(view)) {
            return;
        }
        
        this.currentView = view;
        
        // Update active tab
        document.querySelectorAll('.tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.view === view);
        });
        
        // Update URL
        this.updateUrl();
        
        // Show the appropriate view
        this.showCurrentView();
        
        // Apply syntax highlighting when switching to preview
        if (view === 'preview') {
            hljs.highlightAll();
        }
    }

    updateUrl() {
        const params = new URLSearchParams();
        if (this.selectedPost) {
            params.set('hash', this.generateHash(this.selectedPost));
        }
        if (this.currentView !== 'preview') {
            params.set('view', this.currentView);
        }
        
        // Remove any existing query parameters and update hash
        const newUrl = window.location.pathname;
        window.history.replaceState({}, '', newUrl);
        window.location.hash = params.toString();
    }

    formatHtml(html) {
        // Basic HTML formatting for better readability
        let formatted = html;
        
        // Add newlines after opening tags
        formatted = formatted.replace(/(<[^>]+>)(?=<)/g, '$1\n');
        
        // Add indentation
        const lines = formatted.split('\n');
        let indentLevel = 0;
        const formattedLines = [];
        
        for (let line of lines) {
            line = line.trim();
            if (!line) continue;
            
            // Decrease indent for closing tags
            if (line.match(/^<\/(div|p|h[1-6]|ul|ol|li|blockquote|section|article|header|footer|main|nav|aside)>/)) {
                indentLevel = Math.max(0, indentLevel - 1);
            }
            
            // Add current line with indentation
            formattedLines.push('  '.repeat(indentLevel) + line);
            
            // Increase indent for opening tags (not self-closing)
            if (line.match(/^<(div|p|h[1-6]|ul|ol|li|blockquote|section|article|header|footer|main|nav|aside)[^>]*>/) && 
                !line.match(/\/>\s*$/)) {
                indentLevel++;
            }
        }
        
        return formattedLines.join('\n');
    }

    escapeHtml(text) {
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return text.replace(/[&<>"']/g, m => map[m]);
    }

    showError(message) {
        const content = document.getElementById('content');
        content.innerHTML = `<div class="error">${message}</div>`;
    }

    generateHash(filename) {
        // Simple hash function - you might want to use a more robust one in production
        let hash = 0;
        for (let i = 0; i < filename.length; i++) {
            const char = filename.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32bit integer
        }
        return Math.abs(hash).toString(16);
    }
}

// Initialize the post tester when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    new PostTester();
});