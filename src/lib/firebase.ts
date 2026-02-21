import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyDOkCjNyAF9Y51RbocNg0UOaJlwpjVr-Qs",
  authDomain: "vexocrm.firebaseapp.com",
  projectId: "vexocrm",
  storageBucket: "vexocrm.firebasestorage.app",
  messagingSenderId: "847527684058",
  appId: "1:847527684058:web:34160600748693f250c2e3",
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export default app;
