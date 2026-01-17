#!/usr/bin/env node

/**
 * Copy recipes from one user to another in Firebase
 *
 * Usage:
 *   node scripts/copyRecipes.cjs <sourceUserId> <targetUserId>
 *
 * Setup:
 *   1. Download service account key from Firebase Console:
 *      Project Settings → Service Accounts → Generate new private key
 *   2. Save as scripts/serviceAccountKey.json
 *   3. Install firebase-admin: npm install --save-dev firebase-admin
 */

const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

// Load service account key
const serviceAccountPath = path.join(__dirname, 'serviceAccountKey.json');

if (!fs.existsSync(serviceAccountPath)) {
  console.error('❌ Error: serviceAccountKey.json not found!');
  console.error('\nPlease download your service account key:');
  console.error('1. Go to Firebase Console → Project Settings → Service Accounts');
  console.error('2. Click "Generate new private key"');
  console.error('3. Save the file as scripts/serviceAccountKey.json');
  process.exit(1);
}

const serviceAccount = require('./serviceAccountKey.json');

// Initialize Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

/**
 * Copy all recipes from source user to target user
 */
async function copyRecipes(sourceUserId, targetUserId, options = {}) {
  const { dryRun = false, overwrite = false } = options;

  console.log('\n🔍 Starting recipe copy...');
  console.log(`   Source: ${sourceUserId}`);
  console.log(`   Target: ${targetUserId}`);
  console.log(`   Dry Run: ${dryRun ? 'Yes' : 'No'}`);
  console.log(`   Overwrite: ${overwrite ? 'Yes' : 'No'}`);
  console.log('');

  try {
    // Fetch source recipes
    console.log('📥 Fetching source recipes...');
    const sourceRecipes = await db
      .collection('users')
      .doc(sourceUserId)
      .collection('recipes')
      .get();

    if (sourceRecipes.empty) {
      console.log('⚠️  No recipes found for source user');
      return;
    }

    console.log(`✓ Found ${sourceRecipes.size} recipes\n`);

    // Check if target user exists
    const targetUserDoc = await db.collection('users').doc(targetUserId).get();
    if (!targetUserDoc.exists) {
      console.log('⚠️  Target user does not exist in database');
      console.log('   (This is okay - recipes will be created under this user ID)');
    }

    if (dryRun) {
      console.log('🔍 DRY RUN - No changes will be made\n');
      console.log('Recipes that would be copied:');
      sourceRecipes.forEach(doc => {
        const data = doc.data();
        console.log(`  - ${data.name} (${data.calories} cal)`);
      });
      console.log(`\nTotal: ${sourceRecipes.size} recipes would be copied`);
      return;
    }

    // Check for existing recipes in target
    if (!overwrite) {
      const existingRecipes = await db
        .collection('users')
        .doc(targetUserId)
        .collection('recipes')
        .get();

      if (!existingRecipes.empty) {
        console.log(`⚠️  Target user already has ${existingRecipes.size} recipes`);
        console.log('   Use --overwrite flag to merge/overwrite\n');
      }
    }

    // Copy recipes using batch write
    console.log('📝 Copying recipes...');
    const batch = db.batch();
    let count = 0;

    sourceRecipes.forEach(doc => {
      const targetRef = db
        .collection('users')
        .doc(targetUserId)
        .collection('recipes')
        .doc(doc.id);

      batch.set(targetRef, doc.data(), { merge: !overwrite });
      count++;

      const data = doc.data();
      console.log(`  ✓ ${data.name}`);
    });

    await batch.commit();

    console.log(`\n✅ Successfully copied ${count} recipes!`);
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    throw error;
  }
}

/**
 * Main execution
 */
async function main() {
  const args = process.argv.slice(2);

  // Parse flags
  const dryRun = args.includes('--dry-run');
  const overwrite = args.includes('--overwrite');
  const userArgs = args.filter(arg => !arg.startsWith('--'));

  if (userArgs.length < 2) {
    console.log('Usage: node scripts/copyRecipes.cjs <sourceUserId> <targetUserId> [options]');
    console.log('');
    console.log('Options:');
    console.log('  --dry-run     Show what would be copied without making changes');
    console.log('  --overwrite   Overwrite existing recipes (default: merge)');
    console.log('');
    console.log('Examples:');
    console.log('  node scripts/copyRecipes.cjs user123 user456');
    console.log('  node scripts/copyRecipes.cjs user123 user456 --dry-run');
    console.log('  node scripts/copyRecipes.cjs user123 user456 --overwrite');
    process.exit(1);
  }

  const [sourceUserId, targetUserId] = userArgs;

  await copyRecipes(sourceUserId, targetUserId, { dryRun, overwrite });

  process.exit(0);
}

// Run
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
