// transactions.js
import { db } from "./firebase.js";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  where,
} from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";
import { fetchRates, formatCurrency } from "./currency.js";
import { currentCurrency, currentSymbol, setCurrency } from "./appCurrency.js";

// ===================================
// 🧩 CHECK SESSION
// ===================================
const loggedUser = JSON.parse(localStorage.getItem("loggedUser"));
const guestSession = JSON.parse(localStorage.getItem("guestSession"));
const user = loggedUser || guestSession;

if (!user) {
  window.location.href = "login.html";
}

// ===================================
// 🧾 ELEMENTS
// ===================================
const container = document.getElementById("transactionsList");
const searchInput = document.querySelector(".search-input");
const categoryFilter = document.querySelector(".filter-section select");
const sortLinks = document.querySelectorAll(".transaction-sort a");
const navUserName = document.getElementById("navUserName");
const logoutBtn = document.getElementById("logoutBtn");

let allTransactions = [];
let currentSort = { field: "createdAt", direction: "desc" };
let activeCurrency = currentCurrency;
let activeSymbol = currentSymbol;

// ===================================
// 🔥 FETCH + REALTIME UPDATES
// ===================================
if (loggedUser) {
  // ✅ Logged-in user → fetch from Firestore
  const userId = loggedUser.id || loggedUser.email; // ensure unique ID from registration

  const q = query(
    collection(db, "transactions"),
    where("userId", "==", userId),
    orderBy("createdAt", "desc")
  );

  onSnapshot(q, async (snapshot) => {
    allTransactions = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    const codes = [...new Set(allTransactions.map((t) => t.currency || "NGN"))].filter(
      (c) => c !== activeCurrency
    );

    const rates = await fetchRates(activeCurrency, codes);
    renderTransactions(allTransactions, rates);
  });
} else {
  // 👤 Guest mode → use localStorage only
  function loadGuestTransactions() {
    const guestTransactions =
      JSON.parse(localStorage.getItem("guestTransactions")) || [];
    allTransactions = guestTransactions;
    renderTransactions(allTransactions);
  }

  // ✅ Load immediately
  loadGuestTransactions();

  // ✅ Listen for guest updates (triggered when adding transactions)
  window.addEventListener("guestTransactionsUpdated", loadGuestTransactions);
}

// ===================================
// 🧾 RENDER TRANSACTIONS
// ===================================
function renderTransactions(data, rates = {}) {
  container.innerHTML = "";

  if (!data.length) {
    container.innerHTML = `
      <div class="no-transactions">
        <p>No transactions.</p>
        <a href="addtransaction.html" class="add-link">Add a transaction</a>
      </div>
    `;
    return;
  }

  data.forEach((txn) => {
    const isIncome = txn.type === "income";
    const categoryClass = `${txn.category || "others"}tag`;
    const fromCurrency = txn.currency || "NGN";

    let amount = Number(txn.amount) || 0;

    // Convert if needed
    if (fromCurrency !== activeCurrency && rates[fromCurrency]) {
      amount = amount / rates[fromCurrency];
    }

    const formattedAmount = `${isIncome ? "+" : "-"}${formatCurrency(
      amount,
      activeCurrency
    )}`;

    container.insertAdjacentHTML(
      "beforeend",
      `
      <div class="transaction-table">
        <div class="transaction-details">
          <div class="transaction-indicator ${categoryClass}">
            <i class="fa-regular ${
              isIncome ? "fa-arrow-up" : "fa-arrow-down"
            }"></i>
          </div>
          <div class="transaction-title-table">
            <div class="transaction-title">
              <h4>${txn.description}</h4>
            </div>
            <div class="transaction-date">
              <div class="transaction-date-flex">
                <i class="fa-regular fa-calendar"></i>
                <span>${txn.date}</span>
                <span class="dot"></span>
              </div>
              <div>
                <i class="fa-regular fa-tag"></i>
                <span class="tag ${categoryClass}">${txn.category || "others"}</span>
              </div>
            </div>
          </div>
        </div>
        <div class="transaction-amount ${isIncome ? "credit" : "debit"}">
          <h4 data-value="${amount}" data-type="${txn.type}">
            ${formattedAmount}
          </h4>
        </div>
      </div>
    `
    );
  });
}

// ===================================
// 🔍 SEARCH + FILTER + SORT
// ===================================
searchInput?.addEventListener("input", () => {
  filterAndRender(searchInput.value.toLowerCase(), categoryFilter.value);
});

categoryFilter?.addEventListener("change", () => {
  filterAndRender(searchInput.value.toLowerCase(), categoryFilter.value);
});

sortLinks.forEach((link) => {
  link.addEventListener("click", (e) => {
    e.preventDefault();
    sortLinks.forEach((l) => l.classList.remove("active"));
    link.classList.add("active");

    const sortBy = link.textContent.trim().toLowerCase();
    if (sortBy.includes("date")) toggleSort("createdAt");
    else if (sortBy.includes("amount")) toggleSort("amount");

    filterAndRender(searchInput.value, categoryFilter.value);
  });
});

function toggleSort(field) {
  if (currentSort.field === field) {
    currentSort.direction =
      currentSort.direction === "desc" ? "asc" : "desc";
  } else {
    currentSort.field = field;
    currentSort.direction = "desc";
  }
}

function filterAndRender(searchTerm, category) {
  const filtered = allTransactions.filter((item) => {
    const matchSearch = item.description
      .toLowerCase()
      .includes(searchTerm);
    const matchCategory = !category || item.category === category;
    return matchSearch && matchCategory;
  });

  const sorted = [...filtered].sort((a, b) => {
    const dir = currentSort.direction === "desc" ? -1 : 1;
    if (currentSort.field === "amount")
      return (Number(a.amount) - Number(b.amount)) * dir;
    if (currentSort.field === "createdAt")
      return (
        ((a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0)) *
        dir
      );
    return 0;
  });

  renderTransactions(sorted);
}

// ===================================
// 🌍 REACT TO CURRENCY CHANGE
// ===================================
window.addEventListener("currencyChanged", async (e) => {
  const { code, symbol } = e.detail;
  activeCurrency = code;
  activeSymbol = symbol;
  setCurrency(code);

  const codes = [...new Set(allTransactions.map((t) => t.currency || "NGN"))].filter(
    (c) => c !== activeCurrency
  );

  const rates = await fetchRates(activeCurrency, codes);
  renderTransactions(allTransactions, rates);
});

// ===================================
// 🔔 TOAST
// ===================================
function showToast(message, type = "info") {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.className = `toast show ${type}`;
  setTimeout(() => (toast.className = "toast"), 3000);
}

// ===================================
// 🚪 LOGOUT
// ===================================
if (logoutBtn) {
  logoutBtn.addEventListener("click", (e) => {
    e.preventDefault();
    localStorage.removeItem("loggedUser");
    localStorage.removeItem("guestSession");

    showToast("Logging out...", "info");
    setTimeout(() => (window.location.href = "login.html"), 1000);
  });
}

// ===================================
// 👤 DISPLAY USERNAME
// ===================================
if (navUserName) {
  if (loggedUser && loggedUser.username) {
    navUserName.textContent = loggedUser.username;
  } else if (guestSession) {
    navUserName.textContent = "Guest";
  } else {
    navUserName.textContent = "";
  }
}
