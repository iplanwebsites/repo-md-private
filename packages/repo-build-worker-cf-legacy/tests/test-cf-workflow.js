#!/usr/bin/env node
// Automated CF Containers Workflow Test
// Tests the complete deployment workflow without actually deploying
// Usage: node scripts/test-cf-workflow.js

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const COLORS = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
};

const log = (msg, color = 'reset') => {
  console.log(`${COLORS[color]}${msg}${COLORS.reset}`);
};

const exec = (cmd, options = {}) => {
  try {
    return execSync(cmd, {
      encoding: 'utf8',
      stdio: options.silent ? 'pipe' : 'inherit',
      ...options,
    });
  } catch (error) {
    if (!options.allowFailure) {
      throw error;
    }
    return null;
  }
};

class TestSuite {
  constructor() {
    this.passed = 0;
    this.failed = 0;
    this.warnings = 0;
  }

  test(name, fn) {
    process.stdout.write(`${COLORS.blue}▶${COLORS.reset} ${name}... `);
    try {
      fn();
      log('✅ PASSED', 'green');
      this.passed++;
      return true;
    } catch (error) {
      log(`❌ FAILED: ${error.message}`, 'red');
      this.failed++;
      return false;
    }
  }

  warn(name, fn) {
    process.stdout.write(`${COLORS.blue}▶${COLORS.reset} ${name}... `);
    try {
      fn();
      log('✅ OK', 'green');
      return true;
    } catch (error) {
      log(`⚠️  WARNING: ${error.message}`, 'yellow');
      this.warnings++;
      return false;
    }
  }

  summary() {
    log('\n=================================', 'blue');
    log('Test Summary', 'blue');
    log('=================================', 'blue');
    log(`Passed:   ${this.passed}`, 'green');
    log(`Failed:   ${this.failed}`, 'red');
    log(`Warnings: ${this.warnings}`, 'yellow');
    log(`Total:    ${this.passed + this.failed + this.warnings}`);

    if (this.failed === 0) {
      log('\n🎉 All tests passed!', 'green');
      return 0;
    } else {
      log('\n❌ Some tests failed', 'red');
      return 1;
    }
  }
}

async function main() {
  log('🧪 Cloudflare Containers Workflow Test', 'blue');
  log('=====================================\n', 'blue');

  const suite = new TestSuite();
  const projectRoot = path.resolve(process.cwd());

  // Test 1: Check required files
  log('[1/10] Checking required files...', 'blue');
  suite.test('wrangler.toml exists', () => {
    if (!fs.existsSync('wrangler.toml')) {
      throw new Error('wrangler.toml not found');
    }
  });

  suite.test('Dockerfile.cf exists', () => {
    if (!fs.existsSync('Dockerfile.cf')) {
      throw new Error('Dockerfile.cf not found');
    }
  });

  suite.test('src/cf-worker.js exists', () => {
    if (!fs.existsSync('src/cf-worker.js')) {
      throw new Error('src/cf-worker.js not found');
    }
  });

  suite.test('CF deployment scripts exist', () => {
    const scripts = [
      'scripts/cf-deploy.sh',
      'scripts/cf-test.sh',
      'scripts/cf-local-dev.sh',
      'scripts/cf-manage.js',
    ];
    for (const script of scripts) {
      if (!fs.existsSync(script)) {
        throw new Error(`${script} not found`);
      }
    }
  });

  // Test 2: Check npm scripts
  log('\n[2/10] Checking npm scripts...', 'blue');
  suite.test('CF scripts in package.json', () => {
    const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    const requiredScripts = [
      'cf:deploy',
      'cf:test',
      'cf:dev',
      'cf:manage',
      'cf:status',
    ];
    for (const script of requiredScripts) {
      if (!pkg.scripts[script]) {
        throw new Error(`Script ${script} not found in package.json`);
      }
    }
  });

  // Test 3: Validate wrangler.toml
  log('\n[3/10] Validating wrangler.toml...', 'blue');
  suite.test('wrangler.toml syntax', () => {
    const content = fs.readFileSync('wrangler.toml', 'utf8');
    if (!content.includes('name = "repo-build-worker"')) {
      throw new Error('Invalid worker name');
    }
    if (!content.includes('[[containers]]')) {
      throw new Error('No container configuration found');
    }
    if (!content.includes('SKIP_EMBEDDINGS')) {
      throw new Error('SKIP_EMBEDDINGS not configured');
    }
  });

  // Test 4: Check Docker availability
  log('\n[4/10] Checking Docker...', 'blue');
  suite.test('Docker daemon running', () => {
    const result = exec('docker info', { silent: true, allowFailure: true });
    if (!result) {
      throw new Error('Docker not running. Start Docker Desktop.');
    }
  });

  // Test 5: Validate Dockerfile.cf
  log('\n[5/10] Validating Dockerfile.cf...', 'blue');
  suite.test('Dockerfile.cf structure', () => {
    const content = fs.readFileSync('Dockerfile.cf', 'utf8');
    if (!content.includes('FROM node:20')) {
      throw new Error('Should use Node 20');
    }
    if (!content.includes('SKIP_EMBEDDINGS=true')) {
      throw new Error('SKIP_EMBEDDINGS not set in Dockerfile');
    }
    if (!content.includes('EXPOSE 8080')) {
      throw new Error('Should expose port 8080 for CF Containers');
    }
  });

  // Test 6: Check src/cf-worker.js
  log('\n[6/10] Validating CF Worker entry point...', 'blue');
  suite.test('cf-worker.js exports', () => {
    const content = fs.readFileSync('src/cf-worker.js', 'utf8');
    if (!content.includes('export class RepoBuildContainer')) {
      throw new Error('RepoBuildContainer class not exported');
    }
    if (!content.includes('extends Container')) {
      throw new Error('Should extend Container class');
    }
    if (!content.includes('export default')) {
      throw new Error('No default export found');
    }
  });

  // Test 7: Check SKIP_EMBEDDINGS implementation
  log('\n[7/10] Checking SKIP_EMBEDDINGS implementation...', 'blue');
  suite.test('buildAssets.js has SKIP_EMBEDDINGS', () => {
    const content = fs.readFileSync('src/process/buildAssets.js', 'utf8');
    if (!content.includes('SKIP_EMBEDDINGS')) {
      throw new Error('SKIP_EMBEDDINGS not implemented in buildAssets.js');
    }
    if (!content.includes('skipEmbeddings')) {
      throw new Error('skipEmbeddings variable not found');
    }
  });

  // Test 8: Check documentation
  log('\n[8/10] Checking documentation...', 'blue');
  suite.test('CF documentation exists', () => {
    const docs = [
      'DEV/CF_DEPLOYMENT_GUIDE.md',
      'DEV/PROCESSOR_LIB_REQUIREMENTS.md',
      'DEV/CLOUDFLARE_MIGRATION_INDEX.md',
      'DEV/CF_QUICK_START.md',
      'DEV/README.md',
    ];
    for (const doc of docs) {
      if (!fs.existsSync(doc)) {
        throw new Error(`${doc} not found`);
      }
    }
  });

  // Test 9: Optional checks (warnings)
  log('\n[9/10] Optional checks...', 'blue');
  suite.warn('Wrangler CLI installed', () => {
    const result = exec('npx wrangler --version', { silent: true, allowFailure: true });
    if (!result) {
      throw new Error('Wrangler not installed. Run: npm install');
    }
  });

  suite.warn('Wrangler authenticated', () => {
    const result = exec('npx wrangler whoami', { silent: true, allowFailure: true });
    if (!result || result.includes('not authenticated')) {
      throw new Error('Not logged in. Run: npm run cf:login');
    }
  });

  // Test 10: Build test (optional)
  log('\n[10/10] Build test (optional)...', 'blue');
  const shouldBuild = process.argv.includes('--build');

  if (shouldBuild) {
    suite.test('Docker build succeeds', () => {
      log('\nBuilding Docker image (this may take a few minutes)...', 'yellow');
      exec('docker build -f Dockerfile.cf -t repo-build-worker:test-workflow .', {
        stdio: 'inherit',
      });
    });
  } else {
    log('⏭️  Skipping Docker build (use --build to enable)', 'yellow');
  }

  // Summary
  const exitCode = suite.summary();

  if (exitCode === 0) {
    log('\n📋 Next Steps:', 'blue');
    log('1. Read documentation: DEV/CF_QUICK_START.md');
    log('2. Run full container test: npm run cf:test');
    log('3. Test locally: npm run cf:dev');
    log('4. Deploy to dev: npm run cf:deploy:dev');
    log('\n💡 Tips:', 'blue');
    log('- View status: npm run cf:status');
    log('- Stream logs: npm run cf:logs');
    log('- Manage deployment: npm run cf:manage help');
    log('- All docs in: DEV/ folder');
  }

  process.exit(exitCode);
}

main().catch((error) => {
  log(`\n❌ Fatal error: ${error.message}`, 'red');
  process.exit(1);
});
