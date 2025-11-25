import dotenv from 'dotenv';
dotenv.config();

import { connectDb, db } from '../db.js';
import { ObjectId } from 'mongodb';

async function configureChannels() {
  await connectDb();
  
  console.log('🔧 Configuring Slack Channels...\n');
  
  const orgId = '6806c04d80750e59ba5797d6';
  
  // Define the channels to configure
  // You'll need to update these with your actual channel IDs
  const channels = [
    {
      id: 'C093NBZ3L67',  // bot-updates channel ID from previous deployments
      name: 'bot-updates',
      types: ['deployments', 'tasks', 'errors']  // What types of notifications go here
    },
    // Add more channels as needed:
    // {
    //   id: 'C12345678',
    //   name: 'general',
    //   types: ['general']
    // }
  ];
  
  // Update the organization
  const result = await db.orgs.updateOne(
    { _id: new ObjectId(orgId) },
    { 
      $set: { 
        'slackIntegration.channels': channels
      }
    }
  );
  
  console.log(`✅ Updated org with ${channels.length} channel(s)`);
  console.log(`   Modified: ${result.modifiedCount} document(s)`);
  
  // Verify the configuration
  const org = await db.orgs.findOne({ _id: new ObjectId(orgId) });
  console.log('\n📋 Configured channels:');
  org.slackIntegration.channels.forEach(channel => {
    console.log(`   - ${channel.name} (${channel.id}): ${channel.types.join(', ')}`);
  });
  
  console.log('\n✅ Slack channels configured!');
  console.log('Deployment notifications will now be sent to bot-updates channel.');
  
  process.exit(0);
}

configureChannels().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});