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
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyDOkCjNyAF9Y51RbocNg0UOaJlwpjVr-Qs",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "vexocrm.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "vexocrm",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "vexocrm.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "847527684058",
  appId:
    import.meta.env.VITE_FIREBASE_APP_ID || "1:847527684058:web:34160600748693f250c2e3",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-LD7WE9NC73",
};

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
