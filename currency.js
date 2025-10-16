// currency.js
import { doc, onSnapshot, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";
import { db } from "./firebase.js";

// ✅ Currency symbols
export const currencySymbols = {
  NGN: "₦",
  USD: "$",
  EUR: "€",
  GBP: "£",
};

// --- RATE CACHE (in-memory + localStorage) ---
const RATE_CACHE_KEY = "fx_rates_cache_v1";

function saveRateCache(obj) {
  localStorage.setItem(RATE_CACHE_KEY, JSON.stringify(obj));
}

function loadRateCache() {
  try {
    return JSON.parse(localStorage.getItem(RATE_CACHE_KEY) || "{}");
  } catch (e) {
    return {};
  }
}

// --- Fetch latest rates from exchangerate.host ---
export async function fetchRates(base = "USD", symbols = []) {
  const cache = loadRateCache();
  const cacheKey = `${base}_${symbols.join(",")}`;
  const now = Date.now();

  // ✅ Cache valid for 1 hour
  if (cache[cacheKey] && now - cache[cacheKey].ts < 1000 * 60 * 60) {
    return cache[cacheKey].rates;
  }

  const symbolParam = symbols.length ? `&symbols=${symbols.join(",")}` : "";
  const url = `https://api.exchangerate.host/latest?base=${base}${symbolParam}`;

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error("Failed to fetch rates");
    const json = await res.json();
    const rates = json.rates || {};

    cache[cacheKey] = { ts: now, rates };
    saveRateCache(cache);
    return rates;
  } catch (error) {
    console.error("Currency API Error:", error);
    // ✅ fallback to last cached rates if available
    return cache[cacheKey]?.rates || {};
  }
}

// --- Convert amount from one currency to another ---
export async function convert(amount, from = "NGN", to = "NGN") {
  if (from === to) return Number(amount);

  try {
    const rates = await fetchRates(from, [to]);
    const rate = rates[to];
    if (!rate) throw new Error(`No conversion rate found for ${from}→${to}`);
    return Number(amount) * Number(rate);
  } catch (error) {
    console.warn("Currency conversion failed:", error);
    return Number(amount); // fallback to same amount
  }
}

// --- Format with currency symbol ---
export function formatCurrency(amount, code = "NGN") {
  const symbol = currencySymbols[code] || code + " ";
  const formatted = Number(amount).toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
  return `${symbol}${formatted}`;
}
