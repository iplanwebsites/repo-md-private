# Using Local Wrangler (No Global Install)

This project uses Wrangler as a **devDependency** instead of requiring a global installation.

## ✅ What This Means

You don't need to run:
```bash
npm install -g wrangler  # NOT NEEDED!
```

Wrangler is already installed in `node_modules/` via:
```bash
npm install  # This installs wrangler locally
```

## 🚀 Using Wrangler

### Via npm Scripts (Recommended)

All CF commands use `npx wrangler` automatically:

```bash
# Login to Cloudflare
npm run cf:login

# Check status
npm run cf:status

# View logs
npm run cf:logs

# Deploy
npm run cf:deploy:dev
```

### Direct npx Usage

You can also run wrangler directly with `npx`:

```bash
# Any wrangler command works with npx
npx wrangler whoami
npx wrangler --version
npx wrangler containers list
npx wrangler tail
```

### How npx Works

`npx` automatically finds and runs the locally installed version from `node_modules/.bin/`:

```bash
# These are equivalent:
npx wrangler whoami
./node_modules/.bin/wrangler whoami
```

## 📋 Available Commands

All these commands use local wrangler (no global install needed):

```bash
npm run cf:login              # Login to Cloudflare
npm run cf:status             # Check deployment status
npm run cf:logs               # Stream logs
npm run cf:deploy:dev         # Deploy to dev
npm run cf:deploy:staging     # Deploy to staging
npm run cf:deploy:production  # Deploy to production
npm run cf:manage             # Management CLI
npm run cf:workflow           # Validate setup
```

## 🔧 Why Local Installation?

**Benefits:**
- ✅ No global installs required
- ✅ Version locked in `package.json`
- ✅ Same version for all developers
- ✅ CI/CD friendly
- ✅ Multiple projects can use different versions

**Traditional Approach (not used here):**
```bash
npm install -g wrangler  # Global install
wrangler whoami          # Uses global version
```

**Our Approach (better):**
```bash
npm install              # Local install
npm run cf:login         # Uses local version via npx
```

## 🐛 Troubleshooting

### "wrangler: command not found"

**Problem:** You're trying to use `wrangler` directly without `npx`

**Solution:** Use `npx wrangler` or npm scripts:
```bash
# ❌ Won't work (no global install)
wrangler whoami

# ✅ Use npx
npx wrangler whoami

# ✅ Or use npm script
npm run cf:status
```

### "Cannot find module 'wrangler'"

**Problem:** Dependencies not installed

**Solution:** Run npm install
```bash
npm install
```

### Check if Wrangler is Available

```bash
# Check local installation
npx wrangler --version

# Should output something like:
# ⛅️ wrangler 4.45.3
```

## 📦 package.json Configuration

```json
{
  "devDependencies": {
    "wrangler": "^4.45.3"  // Local installation
  },
  "scripts": {
    "cf:login": "npx wrangler login",
    "cf:status": "node scripts/cf-manage.js status",
    "cf:logs": "node scripts/cf-manage.js logs"
  }
}
```

## 🎯 Quick Start

```bash
# 1. Install dependencies (includes wrangler)
npm install

# 2. Login to Cloudflare
npm run cf:login

# 3. Check authentication
npx wrangler whoami

# 4. You're ready!
npm run cf:workflow
```

## 🔍 Behind the Scenes

All our scripts use `npx wrangler` internally:

**scripts/cf-deploy.sh:**
```bash
npx wrangler deploy
npx wrangler containers list
```

**scripts/cf-manage.js:**
```javascript
exec('npx wrangler whoami');
exec('npx wrangler tail');
```

**tests/test-cf-workflow.js:**
```javascript
exec('npx wrangler --version');
exec('npx wrangler whoami');
```

## ✅ Summary

- **Don't install globally:** `npm install -g wrangler` ❌
- **Just use npm scripts:** `npm run cf:login` ✅
- **Or use npx:** `npx wrangler ...` ✅
- **Local version:** Managed in `package.json` ✅

---

**No global installations needed! 🎉**
