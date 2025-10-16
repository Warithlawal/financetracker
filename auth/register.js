import { db } from "../firebase.js";
import { collection, query, where, getDocs, addDoc } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";

const registerForm = document.getElementById("registerForm");
const usersRef = collection(db, "users");

// ✅ Toast function
function showToast(message, type = "info") {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.className = `toast show ${type}`;
  setTimeout(() => (toast.className = "toast"), 3000);
}

registerForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const name = document.getElementById("name").value.trim();
  const email = document.getElementById("email").value.trim().toLowerCase();
  const password = document.getElementById("password").value.trim();

  if (!name || !email || !password) return showToast("Please fill all fields", "error");

  try {
    const q = query(usersRef, where("email", "==", email));
    const snapshot = await getDocs(q);
    if (!snapshot.empty) return showToast("Email already registered!", "error");

    const hashed = await hashPassword(password);
    await addDoc(usersRef, { name, email, password: hashed });

    showToast("Account created successfully!", "success");
    setTimeout(() => (window.location.href = "login.html"), 1500);
  } catch (error) {
    console.error("Registration error:", error);
    showToast("Error creating account.", "error");
  }
});

async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, "0")).join("");
}
