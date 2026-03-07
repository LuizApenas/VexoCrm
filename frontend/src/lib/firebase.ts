// VexoCrm/src/lib/firebase.ts
import { FirebaseApp, getApp, getApps, initializeApp } from "firebase/app";
import {
  Auth,
  EmailAuthProvider,
  User,
  createUserWithEmailAndPassword,
  getAuth,
  onAuthStateChanged,
  reauthenticateWithCredential,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  updatePassword,
  updateProfile,
} from "firebase/auth";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
  throw new Error(
    "Missing Firebase env vars. Set VITE_FIREBASE_API_KEY and VITE_FIREBASE_PROJECT_ID in .env"
  );
}

const app: FirebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);
const auth: Auth = getAuth(app);

export async function loginWithEmail(email: string, password: string): Promise<User> {
  const userCredential = await signInWithEmailAndPassword(auth, email, password);
  return userCredential.user;
}

export async function registerWithEmail(
  email: string,
  password: string,
  displayName?: string
): Promise<User> {
  const userCredential = await createUserWithEmailAndPassword(auth, email, password);

  if (displayName) {
    await updateProfile(userCredential.user, { displayName });
  }

  return userCredential.user;
}

export async function logout(): Promise<void> {
  await signOut(auth);
}

export async function getIdToken(forceRefresh = false): Promise<string | null> {
  if (!auth.currentUser) return null;
  return auth.currentUser.getIdToken(forceRefresh);
}

export function getCurrentUser(): User | null {
  return auth.currentUser;
}

export function onAuthChange(callback: (user: User | null) => void): () => void {
  return onAuthStateChanged(auth, callback);
}

export async function resetPassword(email: string): Promise<void> {
  await sendPasswordResetEmail(auth, email);
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  const user = auth.currentUser;

  if (!user?.email) {
    throw new Error("Usuário não autenticado");
  }

  const credential = EmailAuthProvider.credential(user.email, currentPassword);
  await reauthenticateWithCredential(user, credential);
  await updatePassword(user, newPassword);
}

export async function updateUserProfile(displayName: string): Promise<void> {
  const user = auth.currentUser;

  if (!user) {
    throw new Error("Usuário não autenticado");
  }

  await updateProfile(user, { displayName });
}

export { app, auth };
export type { User };
