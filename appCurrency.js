// appCurrency.js — runs on every page
import { auth, db } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-auth.js";
import { doc, onSnapshot, getDoc } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";
import { currencySymbols } from "./currency.js";

// 🔹 Default currency setup (from localStorage or fallback)
export let currentCurrency = localStorage.getItem("userCurrency") || "NGN";
export let currentSymbol = currencySymbols[currentCurrency] || "₦";

// 🔹 Helper: Broadcast current currency to all scripts/pages
function broadcastCurrencyChange(code, symbol) {
  window.dispatchEvent(
    new CustomEvent("currencyChanged", {
      detail: { code, symbol },
    })
  );
}

// 🔹 Internal: Update global currency and broadcast
function updateCurrency(code) {
  currentCurrency = code;
  currentSymbol = currencySymbols[code] || code;

  // Persist locally for guest users
  localStorage.setItem("userCurrency", code);

  // Immediately broadcast the update
  broadcastCurrencyChange(code, currentSymbol);
}

// 🔹 Public helper: Allow manual currency setting
export function setCurrency(code) {
  updateCurrency(code);
}

// 🔹 Public helper: Get symbol by code
export function getCurrencySymbol(code) {
  return currencySymbols[code] || code;
}

// 🔹 Public helper: Get active currency code
export function getCurrencyCode() {
  return currentCurrency;
}

// ✅ Broadcast the initial local value on page load
broadcastCurrencyChange(currentCurrency, currentSymbol);

// ===============================
// 🔥 FIREBASE SYNC (LIVE CURRENCY UPDATES)
// ===============================
onAuthStateChanged(auth, async (user) => {
  if (!user) return;

  const settingsRef = doc(db, "users", user.uid, "meta", "settings");

  try {
    // Load once
    const snap = await getDoc(settingsRef);
    if (snap.exists()) {
      const userCurrency = snap.data().currency || "NGN";
      if (userCurrency !== currentCurrency) {
        updateCurrency(userCurrency);
      }
    }

    // Subscribe to live changes (Firestore onSnapshot)
    onSnapshot(settingsRef, (s) => {
      if (s.exists()) {
        const liveCurrency = s.data().currency || "NGN";
        if (liveCurrency !== currentCurrency) {
          updateCurrency(liveCurrency);
        }
      }
    });
  } catch (err) {
    console.error("Error syncing currency from Firestore:", err);
  }
});

// ===============================
// 🌍 GLOBAL ACCESS
// ===============================
window.currentCurrency = currentCurrency;
window.currentSymbol = currentSymbol;

// Keep window globals updated when currency changes
window.addEventListener("currencyChanged", (e) => {
  window.currentCurrency = e.detail.code;
  window.currentSymbol = e.detail.symbol;
});
