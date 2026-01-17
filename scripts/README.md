# Firebase Admin Scripts

Administrative scripts for managing Firebase data.

## Setup

### 1. Install Firebase Admin SDK

```bash
npm install firebase-admin --save-dev
```

### 2. Download Service Account Key

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Go to **Project Settings** → **Service Accounts**
4. Click **"Generate new private key"**
5. Save the downloaded JSON file as `scripts/serviceAccountKey.json`

**⚠️ IMPORTANT:** Never commit `serviceAccountKey.json` to git! It's already in `.gitignore`.

## Copy Recipes Script

Copy all recipes from one user to another.

### Usage

```bash
node scripts/copyRecipes.cjs <sourceUserId> <targetUserId> [options]
```

### Options

- `--dry-run` - Show what would be copied without making changes
- `--overwrite` - Overwrite existing recipes (default: merge)

### Examples

**Preview what would be copied:**
```bash
node scripts/copyRecipes.cjs user123abc user456def --dry-run
```

**Copy recipes:**
```bash
node scripts/copyRecipes.cjs user123abc user456def
```

**Copy and overwrite existing recipes:**
```bash
node scripts/copyRecipes.cjs user123abc user456def --overwrite
```

## Finding User IDs

User IDs can be found in:
1. Firebase Console → Authentication → Users
2. Firebase Console → Firestore → `users` collection
3. In your app's auth state: `auth.currentUser.uid`

## Troubleshooting

**Error: serviceAccountKey.json not found**
- Make sure you downloaded the service account key
- Save it exactly as `scripts/serviceAccountKey.json`

**Error: Permission denied**
- Check that your service account has Firestore read/write permissions
- Service accounts have full admin access by default

**Error: User not found**
- Double-check the user ID
- User IDs are case-sensitive
- The target user doesn't need to exist beforehand
