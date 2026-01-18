#!/usr/bin/env node

/**
 * Set or remove developer custom claim on a Firebase user
 *
 * Usage:
 *   node scripts/setDeveloperClaim.cjs <userId> [--remove]
 *
 * Examples:
 *   node scripts/setDeveloperClaim.cjs abc123xyz          # Grant developer access
 *   node scripts/setDeveloperClaim.cjs abc123xyz --remove # Revoke developer access
 *   node scripts/setDeveloperClaim.cjs --list             # List all developers
 *
 * Setup:
 *   Requires scripts/serviceAccountKey.json (see README.md)
 */

const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

// Load service account key
const serviceAccountPath = path.join(__dirname, 'serviceAccountKey.json');

if (!fs.existsSync(serviceAccountPath)) {
  console.error('Error: serviceAccountKey.json not found!');
  console.error('\nPlease download your service account key:');
  console.error('1. Go to Firebase Console -> Project Settings -> Service Accounts');
  console.error('2. Click "Generate new private key"');
  console.error('3. Save the file as scripts/serviceAccountKey.json');
  process.exit(1);
}

const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

/**
 * Set developer claim on a user
 */
async function setDeveloperClaim(userId, isDeveloper) {
  try {
    // Verify user exists
    const user = await admin.auth().getUser(userId);
    console.log(`\nUser found: ${user.email || user.uid}`);

    // Get existing claims
    const existingClaims = user.customClaims || {};
    console.log(`Current claims: ${JSON.stringify(existingClaims)}`);

    // Set new claims (merge with existing)
    const newClaims = {
      ...existingClaims,
      isDeveloper: isDeveloper,
    };

    if (!isDeveloper) {
      delete newClaims.isDeveloper;
    }

    await admin.auth().setCustomUserClaims(userId, newClaims);

    if (isDeveloper) {
      console.log(`\nDeveloper access GRANTED for ${user.email || userId}`);
    } else {
      console.log(`\nDeveloper access REVOKED for ${user.email || userId}`);
    }

    console.log(`New claims: ${JSON.stringify(newClaims)}`);
    console.log('\nNote: User must sign out and sign back in for changes to take effect.');

  } catch (error) {
    if (error.code === 'auth/user-not-found') {
      console.error(`\nError: User "${userId}" not found`);
      console.error('Check the user ID in Firebase Console -> Authentication -> Users');
    } else {
      console.error('\nError:', error.message);
    }
    process.exit(1);
  }
}

/**
 * List all users with developer claim
 */
async function listDevelopers() {
  console.log('\nScanning for users with developer access...\n');

  const developers = [];
  let nextPageToken;

  do {
    const listResult = await admin.auth().listUsers(1000, nextPageToken);

    listResult.users.forEach(user => {
      if (user.customClaims?.isDeveloper === true) {
        developers.push({
          uid: user.uid,
          email: user.email || '(no email)',
          displayName: user.displayName || '(no name)',
        });
      }
    });

    nextPageToken = listResult.pageToken;
  } while (nextPageToken);

  if (developers.length === 0) {
    console.log('No users with developer access found.');
  } else {
    console.log(`Found ${developers.length} developer(s):\n`);
    developers.forEach((dev, i) => {
      console.log(`${i + 1}. ${dev.email}`);
      console.log(`   UID: ${dev.uid}`);
      console.log(`   Name: ${dev.displayName}\n`);
    });
  }
}

/**
 * Main execution
 */
async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--list')) {
    await listDevelopers();
    process.exit(0);
  }

  if (args.length < 1 || args[0].startsWith('--')) {
    console.log('Usage: node scripts/setDeveloperClaim.cjs <userId> [options]');
    console.log('');
    console.log('Options:');
    console.log('  --remove    Revoke developer access');
    console.log('  --list      List all users with developer access');
    console.log('');
    console.log('Examples:');
    console.log('  node scripts/setDeveloperClaim.cjs abc123xyz          # Grant access');
    console.log('  node scripts/setDeveloperClaim.cjs abc123xyz --remove # Revoke access');
    console.log('  node scripts/setDeveloperClaim.cjs --list             # List developers');
    process.exit(1);
  }

  const userId = args[0];
  const shouldRemove = args.includes('--remove');

  await setDeveloperClaim(userId, !shouldRemove);
  process.exit(0);
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
