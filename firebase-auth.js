
import { initializeApp } from "https://www.gstatic.com/firebasejs/13.0.0/firebase-app.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/13.0.0/firebase-auth.js";

// Firebaseの設定情報（次のステップで入力）
const firebaseConfig = {
    apiKey: "AIzaSyA1VGVdOPktRfdxRWaFKX2dMIc0WpJEDgU",
    authDomain: "attendance-admin-ee719.firebaseapp.com",
    projectId: "attendance-admin-ee719",
    storageBucket: "attendance-admin-ee719.firebasestorage.app",
    messagingSenderId: "653854375196",
    appId: "1:653854375196:web:769d671fca81fa36c64ed9"
  };

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// メールアドレスとパスワードでログイン
export async function login(email, password) {
  return signInWithEmailAndPassword(auth, email, password);
}

// ログイン状態を確認
export function watchLogin(callback) {
  return onAuthStateChanged(auth, callback);
}

// ログアウト
export async function logout() {
  return signOut(auth);
}

// バックエンドに送る認証トークンを取得
export async function getLoginToken() {
  if (!auth.currentUser) {
    throw new Error("ログインしていません");
  }
  return auth.currentUser.getIdToken();
}
