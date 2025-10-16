import { auth, db } from "./firebase.js";
import { doc, setDoc, onSnapshot, getDoc } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-auth.js";
import { setCurrency, getCurrencySymbol } from "./appCurrency.js";
import { toggleTheme } from "./theme.js";

const themeToggle = document.getElementById("themeToggle");

if (themeToggle) {
  themeToggle.addEventListener("click", () => {
    toggleTheme();
  });

  // Sync visual state
  window.addEventListener("themeChanged", (e) => {
    const theme = e.detail.theme;
    themeToggle.classList.toggle("active", theme === "dark");
  });
}


document.addEventListener("DOMContentLoaded", () => {
  const nameInput = document.querySelector('input[type="text"]');
  const emailInput = document.querySelector('input[type="email"]');
  const currencySelect = document.getElementById("currency");
  const saveBtn = document.querySelector(".save-btn");
  const navName = document.querySelector("nav .nav-list span");

  if (!nameInput || !emailInput || !currencySelect || !saveBtn) {
    console.error("One or more settings elements not found in DOM.");
    return;
  }

  // Load saved settings
  const savedName = localStorage.getItem("userName");
  const savedEmail = localStorage.getItem("userEmail");
  const savedCurrency = localStorage.getItem("userCurrency");

  if (savedName) {
    nameInput.value = savedName;
    if (navName) navName.textContent = savedName;
  }
  if (savedEmail) emailInput.value = savedEmail;
  if (savedCurrency) currencySelect.value = savedCurrency;

  // ✅ Save button logic
  saveBtn.addEventListener("click", async () => {
    const name = nameInput.value.trim();
    const email = emailInput.value.trim();
    const currency = currencySelect.value;

    if (!name || !email) {
      showPopup("Please fill in both name and email.");
      return;
    }

    localStorage.setItem("userName", name);
    localStorage.setItem("userEmail", email);
    localStorage.setItem("userCurrency", currency);

    if (navName) navName.textContent = name;
    setCurrency(currency);
    const symbol = getCurrencySymbol(currency);
    window.dispatchEvent(new CustomEvent("currencyChanged", { detail: { currency, symbol } }));

    // 🔹 Sync to Firestore (if logged in)
    onAuthStateChanged(auth, async (user) => {
      if (user) {
        const settingsRef = doc(db, "users", user.uid, "meta", "settings");
        await setDoc(settingsRef, { name, email, currency }, { merge: true });
      }
    });

    showPopup("Settings saved successfully!");
  });

  // ✅ Popup
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

  // 🔹 Firestore sync
  onAuthStateChanged(auth, async (user) => {
    if (!user) return;
    const settingsRef = doc(db, "users", user.uid, "meta", "settings");

    const snap = await getDoc(settingsRef);
    if (snap.exists()) {
      const data = snap.data();
      if (data.currency) {
        currencySelect.value = data.currency;
        setCurrency(data.currency);
      }
    }

    onSnapshot(settingsRef, (s) => {
      if (s.exists()) {
        const data = s.data();
        if (data.currency) {
          currencySelect.value = data.currency;
          setCurrency(data.currency);
        }
      }
    });

    currencySelect.addEventListener("change", async () => {
      await setDoc(settingsRef, { currency: currencySelect.value }, { merge: true });
      showPopup(`💱 Currency changed to ${currencySelect.value}`);
      setCurrency(currencySelect.value);
    });
  });
});


// ===== Toast Function (shared) =====
function showToast(message, type = "info") {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.className = `toast show ${type}`;
  setTimeout(() => (toast.className = "toast"), 3000);
}

// ===== Logout Logic =====
const logoutBtn = document.getElementById("logoutBtn");
if (logoutBtn) {
  logoutBtn.addEventListener("click", (e) => {
    e.preventDefault();

    // Clear all possible user sessions
    localStorage.removeItem("loggedUser");
    localStorage.removeItem("guestSession");

    showToast("Logging out...", "info");

    setTimeout(() => {
      window.location.href = "login.html";
    }, 1200);
  });
}

