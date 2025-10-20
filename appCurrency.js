// appCurrency.js — runs on every page
import { auth, db } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-auth.js";
import { doc, onSnapshot, getDoc } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";
import { currencySymbols } from "./currency.js";

// -----------------------------
// Exports: currentCurrency, currentSymbol (mutable bindings)
// -----------------------------
export let currentCurrency = localStorage.getItem("userCurrency") || "NGN";
export let currentSymbol = currencySymbols[currentCurrency] || "₦";

// -----------------------------
// Broadcast helper
// -----------------------------
function broadcastCurrencyChange(code, symbol) {
  window.dispatchEvent(
    new CustomEvent("currencyChanged", {
      detail: { code, symbol },
    })
  );
}

// -----------------------------
// Internal updater
// -----------------------------
function updateCurrency(code) {
  currentCurrency = code;
  currentSymbol = currencySymbols[code] || code;
  localStorage.setItem("userCurrency", code);
  broadcastCurrencyChange(code, currentSymbol);
}

// -----------------------------
// Public helpers
// -----------------------------
export function setCurrency(code) {
  updateCurrency(code);
}

export function getCurrencySymbol(code) {
  return currencySymbols[code] || code;
}

export function getCurrencyCode() {
  return currentCurrency;
}

// -----------------------------
// Initial broadcast so pages can react on load
// -----------------------------
broadcastCurrencyChange(currentCurrency, currentSymbol);

// -----------------------------
// Firebase sync: keep user preference live
// -----------------------------
onAuthStateChanged(auth, async (user) => {
  if (!user) return;

  const settingsRef = doc(db, "users", user.uid, "meta", "settings");

  try {
    const snap = await getDoc(settingsRef);
    if (snap.exists()) {
      const userCurrency = snap.data().currency || "NGN";
      if (userCurrency !== currentCurrency) updateCurrency(userCurrency);
    }

    // subscribe to live changes
    onSnapshot(settingsRef, (s) => {
      if (s.exists()) {
        const liveCurrency = s.data().currency || "NGN";
        if (liveCurrency !== currentCurrency) updateCurrency(liveCurrency);
      }
    });
  } catch (err) {
    console.error("Error syncing currency from Firestore:", err);
  }
});

// -----------------------------
// Window globals (convenience)
// -----------------------------
window.currentCurrency = currentCurrency;
window.currentSymbol = currentSymbol;
window.addEventListener("currencyChanged", (e) => {
  window.currentCurrency = e.detail.code;
  window.currentSymbol = e.detail.symbol;
});

// -----------------------------
// Fallback/static exchange rates (exported)
// - Exported so other modules can import `exchangeRates`
// - You can update these or replace with live fetch in currency.js
// -----------------------------
export const exchangeRates = {
  NGN: 1,
  USD: 0.0012,
  GBP: 0.0009,
  EUR: 0.0011,
  CAD: 0.0016,
  // add entries as needed
};
