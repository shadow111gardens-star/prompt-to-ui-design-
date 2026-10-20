import { getApp, getApps, initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, setPersistence, browserLocalPersistence } from 'firebase/auth';

let ready: Promise<void> | undefined;
export function getFirebaseAuth() {
  const config = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
  };
  if (!config.apiKey || !config.authDomain || !config.projectId || !config.appId) throw new Error('Firebase configuration is missing. Add the NEXT_PUBLIC_FIREBASE_* values to .env.local and restart OpenUI.');
  const app = getApps().some(app=>app.name==='[DEFAULT]') ? getApp() : initializeApp(config);
  return getAuth(app);
}
export function prepareFirebaseAuth() {
  const auth = getFirebaseAuth();
  ready ??= setPersistence(auth, browserLocalPersistence).catch(error => { ready = undefined; throw error; });
  return ready;
}
export function googleProvider() {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  return provider;
}
