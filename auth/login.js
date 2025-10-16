import { db } from "../firebase.js";
import { collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";

const loginForm = document.getElementById("loginForm");
const guestBtn = document.getElementById("guestBtn");
const usersRef = collection(db, "users");

// ✅ Toast function
function showToast(message, type = "info") {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.className = `toast show ${type}`;
  setTimeout(() => (toast.className = "toast"), 3000);
}

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const email = document.getElementById("email").value.trim().toLowerCase();
  const password = document.getElementById("password").value.trim();

  try {
    const q = query(usersRef, where("email", "==", email));
    const snapshot = await getDocs(q);

    if (snapshot.empty) return showToast("User not found!", "error");

    const userDoc = snapshot.docs[0];
    const userData = userDoc.data();
    const hashed = await hashPassword(password);

    if (hashed !== userData.password) return showToast("Incorrect password!", "error");

    // after verifying password and saving session
    localStorage.setItem("loggedUser", JSON.stringify({
      id: userDoc.id,
      name: userData.name,
      email: userData.email,
    }));

    // notify other scripts (updates nav immediately)
    window.dispatchEvent(new CustomEvent("userChanged", { detail: { action: "login", userId: userDoc.id } }));

    showToast("Login successful!", "success");
    setTimeout(() => (window.location.href = "index.html"), 900);

  } catch (error) {
    console.error("Login error:", error);
    showToast("Login failed.", "error");
  }
});

guestBtn.addEventListener("click", () => {
  const guestData = { id: Date.now(), name: "Guest", guest: true };
  localStorage.setItem("guestSession", JSON.stringify(guestData));
  showToast("Continuing as guest...", "info");
  setTimeout(() => (window.location.href = "index.html"), 1200);
});

async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, "0")).join("");
}
