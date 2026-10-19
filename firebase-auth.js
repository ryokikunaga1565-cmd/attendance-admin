import { initializeApp } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js";
import { getAuth, setPersistence, browserSessionPersistence, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js";
import { firebaseConfig } from "./config.js";
export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const watchLogin = callback => onAuthStateChanged(auth, callback);
export async function login(email, password) {
  await setPersistence(auth, browserSessionPersistence);
  return signInWithEmailAndPassword(auth, email, password);
}
export const logout = () => signOut(auth);
