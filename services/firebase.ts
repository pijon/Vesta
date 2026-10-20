/// <reference types="vite/client" />
import { initializeApp } from 'firebase/app';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, initializeFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getFunctions } from 'firebase/functions';

const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Firebase restores a saved session over the network (token refresh + account lookup), which
// can take seconds on a slow connection. Remember the last signed-in uid so the app can open
// from its cache meanwhile. Firestore and Storage queue requests until auth is ready, so data
// calls made in the meantime run as the restored user.
const LAST_UID_KEY = 'vesta_last_uid';
let lastUid: string | null = null;
try { lastUid = localStorage.getItem(LAST_UID_KEY); } catch { /* storage blocked */ }
/** The uid from the previous session, until Firebase has restored the real one */
export const lastSignedInUid = lastUid;
let authRestored = false;
onAuthStateChanged(auth, user => {
    authRestored = true;
    try {
        if (user) localStorage.setItem(LAST_UID_KEY, user.uid);
        else localStorage.removeItem(LAST_UID_KEY);
    } catch { /* storage blocked */ }
});

/** The signed-in uid, or while the session is still being restored, the uid it is expected to be */
export const currentUid = (): string | null =>
    authRestored ? auth.currentUser?.uid ?? null : lastUid;

// Firestore falls back to long polling by itself where a proxy breaks its streaming connection
// (the default). Forcing it everywhere made every read on launch slower.
export const db = initializeFirestore(app, {
    ignoreUndefinedProperties: true,
});

import { enableMultiTabIndexedDbPersistence } from 'firebase/firestore';
enableMultiTabIndexedDbPersistence(db).catch((err) => {
    if (err.code == 'failed-precondition') {
        console.warn('Persistence failed: Multiple tabs open');
    } else if (err.code == 'unimplemented') {
        console.warn('Persistence failed: Browser not supported');
    }
});

export const storage = getStorage(app);
export const functions = getFunctions(app, 'europe-west1');

export default app;
