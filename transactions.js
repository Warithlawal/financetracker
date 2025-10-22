// transactions.js
import { db } from "./firebase.js";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  where,
  deleteDoc,
  doc,
  getDoc,
} from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";
import { fetchRates, formatCurrency } from "./currency.js";
import { currentCurrency, currentSymbol, setCurrency } from "./appCurrency.js";
import { logout, displayUserName, showToast } from "./authUtils.js";

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

let allTransactions = [];
let currentSort = { field: "createdAt", direction: "desc" };
let activeCurrency = currentCurrency;
let activeSymbol = currentSymbol;

// ===================================
// 🔥 FETCH + REALTIME UPDATES
// ===================================
if (loggedUser) {
  // ✅ Logged-in user → fetch from Firestore
  const userId = loggedUser.id || loggedUser.email;

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

  loadGuestTransactions();
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
      <div class="transaction-table" data-id="${txn.id}">
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
          <div class="transaction-actions">
          <button class="edit-btn" data-id="${txn.id}">Edit</button>
          <button class="delete-btn" data-id="${txn.id}"><i class="fa-solid fa-trash"></i></button>
        </div>
        </div>
      </div>
    `
    );
  });

  attachActionListeners();
}

// ===================================
// ✏️ EDIT & 🗑️ DELETE HANDLERS
// ===================================
function attachActionListeners() {
  document.querySelectorAll(".delete-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = btn.dataset.id;
      if (confirm("Are you sure you want to delete this transaction?")) {
        await deleteTransaction(id);
      }
    });
  });

  document.querySelectorAll(".edit-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = btn.dataset.id;
      await editTransaction(id);
    });
  });
}

async function deleteTransaction(id) {
  if (guestSession) {
    let guestTransactions =
      JSON.parse(localStorage.getItem("guestTransactions")) || [];
    guestTransactions = guestTransactions.filter((txn) => txn.id !== id);
    localStorage.setItem("guestTransactions", JSON.stringify(guestTransactions));
    showToast("Transaction deleted!", "success");
    renderTransactions(guestTransactions);
  } else {
    try {
      await deleteDoc(doc(db, "transactions", id));
      showToast("Transaction deleted!", "success");
    } catch (err) {
      console.error("Delete error:", err);
      showToast("Failed to delete transaction.", "error");
    }
  }
}

async function editTransaction(id) {
  if (guestSession) {
    const guestTransactions =
      JSON.parse(localStorage.getItem("guestTransactions")) || [];
    const txn = guestTransactions.find((t) => t.id === id);
    if (txn) {
      localStorage.setItem("editTransaction", JSON.stringify(txn));
      window.location.href = "addtransaction.html";
    }
  } else if (loggedUser) {
    const docRef = doc(db, "transactions", id);
    const txnSnap = await getDoc(docRef);
    if (txnSnap.exists()) {
      const txn = txnSnap.data();
      txn.id = id;
      localStorage.setItem("editTransaction", JSON.stringify(txn));
      window.location.href = "addtransaction.html";
    }
  }
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
    if (sortBy.includes("date")) toggleSort("createdAt", "asc"); // default: oldest → newest
    else if (sortBy.includes("amount")) toggleSort("amount", "desc");

    filterAndRender(searchInput.value, categoryFilter.value);
  });
});

function toggleSort(field, defaultDirection = "asc") {
  if (currentSort.field === field) {
    currentSort.direction =
      currentSort.direction === "desc" ? "asc" : "desc";
  } else {
    currentSort.field = field;
    currentSort.direction = defaultDirection;
  }
}

function filterAndRender(searchTerm, category) {
  const filtered = allTransactions.filter((item) => {
    const matchSearch = item.description
      ?.toLowerCase()
      .includes(searchTerm || "");
    const matchCategory = !category || item.category === category;
    return matchSearch && matchCategory;
  });

  const sorted = [...filtered].sort((a, b) => {
    const dir = currentSort.direction === "desc" ? -1 : 1;

    if (currentSort.field === "amount") {
      return (Number(a.amount) - Number(b.amount)) * dir;
    }

    if (currentSort.field === "createdAt") {
      const aDate = a.createdAt?.seconds
        ? a.createdAt.seconds * 1000
        : new Date(a.createdAt || 0).getTime();
      const bDate = b.createdAt?.seconds
        ? b.createdAt.seconds * 1000
        : new Date(b.createdAt || 0).getTime();
      return (aDate - bDate) * dir;
    }

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
// 🚪 LOGOUT
// ===================================
const logoutBtn = document.getElementById("logoutBtn");
if (logoutBtn) {
  logoutBtn.addEventListener("click", (e) => {
    e.preventDefault();
    logout();
  });
}

// ✅ Show username in navbar
displayUserName("navUserName");
