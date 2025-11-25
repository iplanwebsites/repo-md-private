import dotenv from 'dotenv';
dotenv.config();

import { connectDb, db } from '../db.js';
import { ObjectId } from 'mongodb';

async function fixSlackSetup() {
  await connectDb();
  
  console.log('🔧 Fixing Slack Setup...\n');
  
  const orgId = '6806c04d80750e59ba5797d6';
  const correctTeamId = 'T093WGZV3FW';
  
  // Update the organization
  const result = await db.orgs.updateOne(
    { _id: new ObjectId(orgId) },
    { 
      $set: { 
        slackIntegration: {
          teamId: correctTeamId,
          teamName: "Repo team",
          installedAt: new Date(),
          installedBy: "U093WH00NFS"
        }
      }
    }
  );
  
  console.log(`✅ Updated org slackIntegration.teamId to ${correctTeamId}`);
  console.log(`   Modified: ${result.modifiedCount} document(s)`);
  
  // Also update the Slack installation to have the correct orgId
  const installResult = await db.slackInstallations.updateOne(
    { teamId: correctTeamId },
    {
      $set: {
        orgId: new ObjectId(orgId)
      }
    }
  );
  
  console.log(`\n✅ Updated Slack installation orgId`);
  console.log(`   Modified: ${installResult.modifiedCount} document(s)`);
  
  // Verify the fix
  console.log('\n📋 Verification:');
  const org = await db.orgs.findOne({ _id: new ObjectId(orgId) });
  console.log(`   Org ${org.name} now has teamId: ${org.slackIntegration.teamId}`);
  
  const installation = await db.slackInstallations.findOne({ teamId: correctTeamId });
  console.log(`   Installation for ${correctTeamId} has orgId: ${installation.orgId}`);
  
  console.log('\n✅ Slack setup fixed! Your ping command should work now.');
  
  process.exit(0);
}

fixSlackSetup().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});