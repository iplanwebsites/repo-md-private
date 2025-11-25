import dotenv from 'dotenv';
dotenv.config();

import { connectDb, db } from '../db.js';

async function checkSetup() {
  await connectDb();
  
  console.log('=== Checking Slack Setup ===\n');
  
  // Check organizations
  const orgs = await db.orgs.find({}).toArray();
  console.log(`Found ${orgs.length} organization(s):`);
  
  for (const org of orgs) {
    console.log(`\nOrg: ${org.name} (${org._id})`);
    console.log('Slack Integration:', JSON.stringify(org.slackIntegration || 'Not configured', null, 2));
  }
  
  // Check Slack installations
  const installations = await db.slackInstallations.find({}).toArray();
  console.log(`\n\nFound ${installations.length} Slack installation(s):`);
  
  for (const install of installations) {
    console.log(`\nTeam: ${install.teamName} (${install.teamId})`);
    console.log(`Org ID: ${install.orgId}`);
    console.log(`Bot Token: ${install.botToken ? 'Present' : 'Missing'}`);
  }
  
  // Check for the specific team
  const targetTeamId = 'T093WGZV3FW';
  console.log(`\n\n=== Checking for team ${targetTeamId} ===`);
  
  const orgWithTeam = await db.orgs.findOne({
    "slackIntegration.teamId": targetTeamId
  });
  
  if (orgWithTeam) {
    console.log(`✅ Found org with this team: ${orgWithTeam.name}`);
  } else {
    console.log(`❌ No org found with slackIntegration.teamId = ${targetTeamId}`);
    
    // Suggest fix
    if (orgs.length > 0) {
      console.log('\nTo fix, update your org with:');
      console.log(`
db.orgs.updateOne(
  { _id: ObjectId("${orgs[0]._id}") },
  { 
    $set: { 
      slackIntegration: {
        teamId: "${targetTeamId}",
        teamName: "Your Workspace",
        installedAt: new Date()
      }
    }
  }
)`);
    }
  }
  
  await db.client.close();
}

checkSetup().catch(console.error);