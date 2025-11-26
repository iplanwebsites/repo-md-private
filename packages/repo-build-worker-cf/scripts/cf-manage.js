#!/usr/bin/env node
// Cloudflare Containers Management CLI
// Useful commands to manage CF deployments, containers, and images
// Usage: node scripts/cf-manage.js <command>

import { execSync } from 'child_process';
import { readFileSync } from 'fs';
import { join } from 'path';

const commands = {
  // Status commands
  'status': {
    desc: 'Show overall status of CF deployment',
    run: () => {
      console.log('📊 Cloudflare Deployment Status\n');

      console.log('Worker Info:');
      exec('npx wrangler whoami');

      console.log('\nContainers:');
      exec('npx wrangler containers list');

      console.log('\nImages:');
      exec('npx wrangler containers images list');
    }
  },

  'logs': {
    desc: 'Stream live logs from deployed worker',
    run: () => {
      console.log('📜 Streaming logs (Ctrl+C to stop)...\n');
      exec('npx wrangler tail', { stdio: 'inherit' });
    }
  },

  'list-containers': {
    desc: 'List all deployed containers',
    run: () => {
      exec('npx wrangler containers list');
    }
  },

  'list-images': {
    desc: 'List all container images',
    run: () => {
      exec('npx wrangler containers images list');
    }
  },

  // Deployment commands
  'deploy': {
    desc: 'Deploy to Cloudflare (interactive)',
    run: () => {
      const env = process.argv[3] || 'dev';
      console.log(`🚀 Deploying to environment: ${env}\n`);
      exec(`bash scripts/cf-deploy.sh ${env}`, { stdio: 'inherit' });
    }
  },

  'delete': {
    desc: 'Delete deployment from Cloudflare',
    run: () => {
      console.log('⚠️  This will delete the deployment. Proceed? (Ctrl+C to cancel)');
      setTimeout(() => {
        exec('npx wrangler delete', { stdio: 'inherit' });
      }, 2000);
    }
  },

  // Development commands
  'dev': {
    desc: 'Start local development server',
    run: () => {
      console.log('🔧 Starting local development...\n');
      exec('bash scripts/cf-local-dev.sh', { stdio: 'inherit' });
    }
  },

  'dev-docker': {
    desc: 'Start local dev server in Docker',
    run: () => {
      console.log('🐳 Starting local development in Docker...\n');
      exec('USE_DOCKER=true bash scripts/cf-local-dev.sh', { stdio: 'inherit' });
    }
  },

  'test': {
    desc: 'Run CF container tests',
    run: () => {
      console.log('🧪 Running tests...\n');
      exec('bash scripts/cf-test.sh', { stdio: 'inherit' });
    }
  },

  // Configuration commands
  'secrets': {
    desc: 'Manage secrets (interactive)',
    run: () => {
      const action = process.argv[3]; // put, delete, list

      if (action === 'list') {
        console.log('📝 Secrets in wrangler.toml:');
        console.log('  - GITHUB_TOKEN');
        console.log('  - OPENAI_API_KEY');
        console.log('  - R2_ACCESS_KEY_ID');
        console.log('  - R2_SECRET_ACCESS_KEY');
        console.log('  - R2_ACCOUNT_ID');
        console.log('  - R2_BUCKET_NAME');
        console.log('\nTo set a secret: node scripts/cf-manage.js secrets put <NAME>');
      } else if (action === 'put') {
        const name = process.argv[4];
        if (!name) {
          console.error('Usage: node scripts/cf-manage.js secrets put <SECRET_NAME>');
          process.exit(1);
        }
        exec(`npx wrangler secret put ${name}`, { stdio: 'inherit' });
      } else if (action === 'delete') {
        const name = process.argv[4];
        if (!name) {
          console.error('Usage: node scripts/cf-manage.js secrets delete <SECRET_NAME>');
          process.exit(1);
        }
        exec(`npx wrangler secret delete ${name}`, { stdio: 'inherit' });
      } else {
        console.log('Usage:');
        console.log('  node scripts/cf-manage.js secrets list');
        console.log('  node scripts/cf-manage.js secrets put <NAME>');
        console.log('  node scripts/cf-manage.js secrets delete <NAME>');
      }
    }
  },

  'config': {
    desc: 'Show current configuration',
    run: () => {
      console.log('⚙️  Configuration\n');

      try {
        const wranglerPath = join(process.cwd(), 'wrangler.toml');
        const config = readFileSync(wranglerPath, 'utf-8');
        console.log('wrangler.toml:');
        console.log(config);
      } catch (error) {
        console.error('Could not read wrangler.toml');
      }
    }
  },

  // Build commands
  'build': {
    desc: 'Build container image locally',
    run: () => {
      console.log('🔨 Building container image...\n');
      exec('docker build -f Dockerfile.cf -t repo-build-worker:local .', { stdio: 'inherit' });
    }
  },

  'build-test': {
    desc: 'Build and test container locally',
    run: () => {
      console.log('🔨 Building container...\n');
      exec('docker build -f Dockerfile.cf -t repo-build-worker:test .', { stdio: 'inherit' });

      console.log('\n🧪 Testing container...\n');
      exec('bash scripts/cf-test.sh', { stdio: 'inherit' });
    }
  },

  // Cleanup commands
  'cleanup': {
    desc: 'Clean up local Docker images and containers',
    run: () => {
      console.log('🧹 Cleaning up...\n');

      exec('docker stop cf-test-container 2>/dev/null || true');
      exec('docker rm cf-test-container 2>/dev/null || true');
      exec('docker stop cf-dev 2>/dev/null || true');
      exec('docker rm cf-dev 2>/dev/null || true');

      console.log('\nClean up Docker images? (y/n)');
      // In a real implementation, you'd use readline for input
      console.log('Run manually: docker rmi repo-build-worker:test repo-build-worker:dev');
    }
  },

  // Help command
  'help': {
    desc: 'Show this help message',
    run: () => showHelp()
  }
};

function exec(command, options = {}) {
  try {
    const result = execSync(command, {
      stdio: options.stdio || 'pipe',
      encoding: 'utf-8',
      ...options
    });
    if (result && !options.stdio) {
      console.log(result);
    }
    return result;
  } catch (error) {
    if (error.stdout) console.log(error.stdout);
    if (error.stderr) console.error(error.stderr);
    process.exit(error.status || 1);
  }
}

function showHelp() {
  console.log('🔧 Cloudflare Containers Management CLI\n');
  console.log('Usage: node scripts/cf-manage.js <command>\n');
  console.log('Available commands:\n');

  Object.entries(commands).forEach(([name, { desc }]) => {
    console.log(`  ${name.padEnd(20)} ${desc}`);
  });

  console.log('\nExamples:');
  console.log('  node scripts/cf-manage.js status');
  console.log('  node scripts/cf-manage.js deploy dev');
  console.log('  node scripts/cf-manage.js logs');
  console.log('  node scripts/cf-manage.js secrets put GITHUB_TOKEN');
}

// Main execution
const command = process.argv[2];

if (!command || command === 'help' || !commands[command]) {
  showHelp();
  process.exit(command && command !== 'help' ? 1 : 0);
}

commands[command].run();
