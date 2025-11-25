import dotenv from 'dotenv';
dotenv.config();

import { connectDb, db } from '../db.js';

async function checkChannels() {
  await connectDb();
  
  console.log('=== Checking Slack Channel Configuration ===\n');
  
  // Get the organization
  const org = await db.orgs.findOne({
    "slackIntegration.teamId": "T093WGZV3FW"
  });
  
  if (!org) {
    console.log('❌ No organization found with Slack integration');
    process.exit(1);
  }
  
  console.log(`Organization: ${org.name}`);
  console.log(`Slack Team ID: ${org.slackIntegration?.teamId}`);
  console.log('\nConfigured channels:');
  
  const channels = org.slackIntegration?.channels || [];
  
  if (channels.length === 0) {
    console.log('❌ No channels configured');
    console.log('\n💡 To configure channels, use the tRPC procedure:');
    console.log('   trpc.slack.configureChannels({ channels: [...] })');
  } else {
    channels.forEach(channel => {
      console.log(`\n📢 ${channel.name} (${channel.id})`);
      console.log(`   Types: ${(channel.types || []).join(', ')}`);
    });
  }
  
  // Check recent deployments
  console.log('\n\n=== Recent Deployments ===');
  const recentDeploys = await db.deploys.find({})
    .sort({ createdAt: -1 })
    .limit(5)
    .toArray();
    
  for (const deploy of recentDeploys) {
    console.log(`\nDeploy ${deploy._id}`);
    console.log(`  Status: ${deploy.status}`);
    console.log(`  Started: ${deploy.startedAt}`);
    console.log(`  Slack Messages: ${deploy.slackMessages?.length || 0}`);
    if (deploy.slackMessages?.length > 0) {
      deploy.slackMessages.forEach(msg => {
        console.log(`    - ${msg.channelName} (${msg.channelId})`);
      });
    }
  }
  
  process.exit(0);
}

checkChannels().catch(console.error);