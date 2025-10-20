// ===============================
// 🔥 IMPORTS
// ===============================
import { db } from "./firebase.js";
import {
  doc,
  setDoc,
  getDoc,
  onSnapshot,
} from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";
import { setCurrency, getCurrencySymbol } from "./appCurrency.js";
import { toggleTheme } from "./theme.js";
import { logout, displayUserName } from "./authUtils.js";

// ===============================
// 🌗 THEME TOGGLE
// ===============================
const themeToggle = document.getElementById("themeToggle");
if (themeToggle) {
  themeToggle.addEventListener("click", () => toggleTheme());
  window.addEventListener("themeChanged", (e) => {
    themeToggle.classList.toggle("active", e.detail.theme === "dark");
  });
}

// ===============================
// ⚙️ SETTINGS LOGIC
// ===============================
document.addEventListener("DOMContentLoaded", async () => {
  const nameInput = document.getElementById("username");
  const emailInput = document.getElementById("email");
  const currencySelect = document.getElementById("currency");
  const saveBtn = document.querySelector(".save-btn");
  const navName = document.querySelector("nav .nav-list span");

  if (!nameInput || !emailInput || !currencySelect || !saveBtn) {
    console.error("❌ One or more settings elements not found in DOM.");
    return;
  }

  // Disable email visually (read-only)
  emailInput.readOnly = true;
  emailInput.style.opacity = "0.7";
  emailInput.style.cursor = "not-allowed";

  // ===============================
  // 👤 DETECT USER SESSION
  // ===============================
  const loggedUser = JSON.parse(localStorage.getItem("loggedUser"));
  const guestSession = JSON.parse(localStorage.getItem("guestSession"));
  let activeUser = null;

  if (loggedUser) {
    activeUser = loggedUser;
  } else if (guestSession) {
    activeUser = guestSession;
  }

  // ===============================
  // 🔥 AUTO-POPULATE USER DATA
  // ===============================
  if (activeUser) {
    nameInput.value = activeUser.name || "Guest";
    emailInput.value = activeUser.email || "guest@example.com";
    if (navName) navName.textContent = activeUser.name || "Guest";

    // Load currency
    const savedCurrency = localStorage.getItem("userCurrency");
    if (savedCurrency) {
      currencySelect.value = savedCurrency;
      setCurrency(savedCurrency);
    } else {
      currencySelect.value = "USD";
    }

    // Firestore sync (optional)
    if (loggedUser && loggedUser.id) {
      const settingsRef = doc(db, "users", loggedUser.id, "meta", "settings");
      const snap = await getDoc(settingsRef);

      if (snap.exists()) {
        const data = snap.data();
        if (data.currency) {
          currencySelect.value = data.currency;
          setCurrency(data.currency);
        }
      }

      // Live updates from Firestore
      onSnapshot(settingsRef, (s) => {
        if (s.exists()) {
          const data = s.data();
          if (data.currency) {
            currencySelect.value = data.currency;
            setCurrency(data.currency);
          }
        }
      });

      // Auto update when currency changes
      currencySelect.addEventListener("change", async () => {
        await setDoc(settingsRef, { currency: currencySelect.value }, { merge: true });
        showPopup(`💱 Currency changed to ${currencySelect.value}`);
        setCurrency(currencySelect.value);
        localStorage.setItem("userCurrency", currencySelect.value);
      });
    }
  } else {
    // No user session at all
    console.log("⚠️ No user or guest session found.");
    nameInput.value = "";
    emailInput.value = "";
    if (navName) navName.textContent = "";
  }

  // ===============================
  // 💾 SAVE SETTINGS
  // ===============================
  saveBtn.addEventListener("click", async () => {
    const name = nameInput.value.trim();
    const email = emailInput.value.trim();
    const currency = currencySelect.value;

    if (!name || !email) {
      showPopup("Please fill in both name and email.");
      return;
    }

    // Update localStorage
    if (loggedUser) {
      const updatedUser = { ...loggedUser, name, email };
      localStorage.setItem("loggedUser", JSON.stringify(updatedUser));
    } else if (guestSession) {
      const updatedGuest = { ...guestSession, name };
      localStorage.setItem("guestSession", JSON.stringify(updatedGuest));
    }

    localStorage.setItem("userCurrency", currency);

    if (navName) navName.textContent = name;
    setCurrency(currency);
    const symbol = getCurrencySymbol(currency);
    window.dispatchEvent(new CustomEvent("currencyChanged", { detail: { currency, symbol } }));

    // Save to Firestore if logged in
    if (loggedUser && loggedUser.id) {
      const settingsRef = doc(db, "users", loggedUser.id, "meta", "settings");
      await setDoc(settingsRef, { name, email, currency }, { merge: true });

      const userRef = doc(db, "users", loggedUser.id);
      await setDoc(userRef, { name, email }, { merge: true });
    }

    showPopup("✅ Settings saved successfully!");
  });

  // ===============================
  // 🔔 POPUP MESSAGE
  // ===============================
  function showPopup(message) {
    const popup = document.createElement("div");
    popup.className = "popup";
    popup.textContent = message;
    document.body.appendChild(popup);
    setTimeout(() => popup.classList.add("show"), 50);
    setTimeout(() => {
      popup.classList.remove("show");
      setTimeout(() => popup.remove(), 300);
    }, 2000);
  }
});

// ===============================
// 🚪 LOGOUT HANDLER
// ===============================
const logoutBtn = document.getElementById("logoutBtn");
if (logoutBtn) {
  logoutBtn.addEventListener("click", (e) => {
    e.preventDefault();
    logout();
  });
}

// ✅ Show username in navbar
displayUserName("navUserName");
