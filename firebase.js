// ============================================================
// firebase.js: Firebase setup + admin login
// ============================================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

// ------------------------------------------------------------
// STEP: Firebase Console > Project settings > Your apps > Web app se
// ye values copy karke yahan paste karna. (Ye config secret nahi hota,
// security Firestore rules se aati hai.)
// ------------------------------------------------------------
const firebaseConfig = {
  apiKey: "AIzaSyCJszbauNZdHmWUQ28s8puX_vN1tFhaO58",
  authDomain: "electroware-laptop-repair.firebaseapp.com",
  projectId: "electroware-laptop-repair",
  storageBucket: "electroware-laptop-repair.firebasestorage.app",
  messagingSenderId: "761495737946",
  appId: "1:761495737946:web:a472df9493c1794cc0aa63"
};

export const isFirebaseConfigured = !String(firebaseConfig.apiKey).startsWith("PASTE_");

let app = null;
let auth = null;
let db = null;

if (isFirebaseConfigured) {
  try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
  } catch (err) {
    console.error("Firebase start nahi hua:", err);
    app = null;
    auth = null;
    db = null;
  }
}

export { app, auth, db };

// ---------- Auth helpers ----------

// Login state badalne par callback chalta hai. Returns unsubscribe function.
export function watchAuth(callback) {
  if (!auth) {
    callback(null);
    return () => {};
  }
  return onAuthStateChanged(auth, callback);
}

export function currentUser() {
  return auth ? auth.currentUser : null;
}

export async function adminLogin(email, password) {
  if (!auth) {
    throw new Error("Firebase is not configured yet. Paste the Firebase config in firebase.js.");
  }
  const cred = await signInWithEmailAndPassword(auth, String(email || "").trim(), String(password || ""));
  return cred.user;
}

export async function adminLogout() {
  if (auth) await signOut(auth);
}

// Firebase ke error codes ko simple English message mein badalta hai.
export function friendlyAuthError(err) {
  const code = err && err.code ? err.code : "";
  switch (code) {
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "Incorrect email or password.";
    case "auth/invalid-email":
      return "Please enter a valid email address.";
    case "auth/user-disabled":
      return "This account has been disabled.";
    case "auth/too-many-requests":
      return "Too many attempts. Please wait a few minutes and try again.";
    case "auth/network-request-failed":
      return "Network error. Check your internet connection.";
    case "auth/invalid-api-key":
    case "auth/api-key-not-valid.-please-pass-a-valid-api-key.":
      return "Firebase API key is invalid. Check the config in firebase.js.";
    case "auth/unauthorized-domain":
      return "This domain is not authorized in Firebase. Add it under Authentication > Settings > Authorized domains.";
    default:
      return (err && err.message) || "Login failed. Please try again.";
  }
}
