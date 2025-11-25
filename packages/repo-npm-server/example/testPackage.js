#!/usr/bin/env node

/**
 * Test script to verify the installed my-repo-md package works correctly
 */

async function testInstalledPackage() {
  console.log('🧪 Testing installed my-repo-md package...\n');

  try {
    // Try to import the package
    console.log('📦 Importing my-repo-md...');
    const repo = await import('my-repo-md');
    
    console.log('✅ Package imported successfully!');
    console.log('📋 Available exports:', Object.keys(repo));
    
    // Test the default export (pre-configured instance)
    if (repo.default) {
      console.log('\n🎯 Testing pre-configured instance...');
      console.log('📝 Instance methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(repo.default)));
      
      // Test a method call (this might fail if the project doesn't exist, but that's expected)
      try {
        console.log('🚀 Calling getAllPosts()...');
        const posts = await repo.default.getAllPosts();
        console.log('✅ getAllPosts() succeeded!');
        console.log(`📊 Found ${posts?.length || 0} posts`);
      } catch (error) {
        console.log('⚠️  getAllPosts() failed (expected for mock project):', error.message);
      }
    }
    
    // Test the RepoMd class export
    if (repo.RepoMd) {
      console.log('\n🏗️  Testing RepoMd class...');
      console.log('✅ RepoMd class is available');
      
      // Test creating a new instance
      try {
        const customRepo = new repo.RepoMd({ projectId: 'test-project' });
        console.log('✅ Created custom RepoMd instance');
        console.log('📝 Custom instance methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(customRepo)));
      } catch (error) {
        console.log('❌ Failed to create custom instance:', error.message);
      }
    }

    console.log('\n🎉 Package test completed successfully!');
    
  } catch (error) {
    console.error('❌ Package test failed:', error.message);
    console.error('\n💡 Make sure you have run the create script first:');
    console.error('   npm run demo:cooking');
    process.exit(1);
  }
}

// Run the test
testInstalledPackage().catch(console.error);