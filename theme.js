// theme.js — global theme controller
import { auth, db } from "./firebase.js";
import { doc, getDoc, setDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-auth.js";

let currentTheme = localStorage.getItem("userTheme") || "light";

// 🔹 Apply theme and update visuals
function applyTheme(theme) {
  document.body.setAttribute("data-theme", theme);
  localStorage.setItem("userTheme", theme);

  // 🌓 Update nav icon
  const themeIcon = document.getElementById("themeIcon");
  if (themeIcon) {
    // Clear old classes first
    themeIcon.className = "fa-regular";
    themeIcon.classList.add(theme === "dark" ? "fa-sun" : "fa-moon");
  }

  // 🏷 Update settings label
  const themeLabel = document.getElementById("themeLabel");
  if (themeLabel) {
    themeLabel.textContent = theme === "dark" ? "Dark Mode" : "Light Mode";
  }

  // 🎚 Update toggle appearance (if in settings)
  const themeToggle = document.getElementById("themeToggle");
  if (themeToggle) {
    themeToggle.classList.toggle("active", theme === "dark");
  }

  // 🔔 Broadcast global event
  window.dispatchEvent(new CustomEvent("themeChanged", { detail: { theme } }));
}

// 🔹 Toggle theme
export function toggleTheme() {
  const newTheme = currentTheme === "light" ? "dark" : "light";
  currentTheme = newTheme;
  applyTheme(newTheme);
  saveThemeToFirestore(newTheme);
}

// 🔹 Save theme to Firestore
async function saveThemeToFirestore(theme) {
  const user = auth.currentUser;
  if (!user) return;
  const settingsRef = doc(db, "users", user.uid, "meta", "settings");
  await setDoc(settingsRef, { theme }, { merge: true });
}

// 🔹 Listen to user’s settings
onAuthStateChanged(auth, (user) => {
  if (!user) return;

  const settingsRef = doc(db, "users", user.uid, "meta", "settings");
  onSnapshot(settingsRef, (snap) => {
    if (snap.exists() && snap.data().theme) {
      const theme = snap.data().theme;
      currentTheme = theme;
      applyTheme(theme);
    }
  });
});

// 🔹 Apply on first load
applyTheme(currentTheme);
