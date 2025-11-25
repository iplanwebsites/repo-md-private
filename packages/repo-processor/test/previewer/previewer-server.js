import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = 3456; // Using an obscure port

// Get the dist folder path from command line argument
const distPath = process.argv[2];

if (!distPath) {
    console.error('Please provide the dist folder path as an argument');
    process.exit(1);
}

const resolvedDistPath = path.resolve(distPath);
console.log('Resolved dist path:', resolvedDistPath);

// Verify the posts.json file exists
const postsJsonPath = path.join(resolvedDistPath, 'posts.json');
if (!fs.existsSync(postsJsonPath)) {
    console.error('posts.json not found at:', postsJsonPath);
} else {
    console.log('Found posts.json at:', postsJsonPath);
}

// Add logging middleware
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    res.on('finish', () => {
        console.log(`[${new Date().toISOString()}] ${req.method} ${req.url} - ${res.statusCode}`);
    });
    next();
});

// Serve static files from the current directory
app.use(express.static(__dirname));

// Map the specified folder to /dist
app.use('/dist', express.static(resolvedDistPath));

// Add error handling for 404s
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] 404 Not Found: ${req.method} ${req.url}`);
    res.status(404).send('Not Found');
});

app.listen(port, () => {
    console.log(`Previewer server running at http://localhost:${port}`);
    console.log(`Serving dist folder from: ${distPath}`);
    console.log(`Full dist path: ${resolvedDistPath}`);
}); 