// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCBzWm_KdcmxX-uNeBQbYFuIqoW2PVxdrc",
  authDomain: "finance-tracker-ee773.firebaseapp.com",
  projectId: "finance-tracker-ee773",
  storageBucket: "finance-tracker-ee773.firebasestorage.app",
  messagingSenderId: "861717987235",
  appId: "1:861717987235:web:4e96e4ad85fbd443a1a416"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
