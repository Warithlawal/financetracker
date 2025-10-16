// ==============================
// 🔥 FIREBASE & IMPORTS
// ==============================
import { db } from "./firebase.js";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  where,
} from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";
import { formatCurrency, fetchRates } from "./currency.js";
import { currentCurrency, setCurrency } from "./appCurrency.js";

let categoryChart, weeklyChart;


// ==============================
// 👤 USER SESSION CHECK
// ==============================
const user =
  JSON.parse(localStorage.getItem("loggedUser")) ||
  JSON.parse(localStorage.getItem("guestSession"));

if (!user) {
  window.location.href = "login.html";
}

// ==============================
// 🔐 LOGOUT HANDLER
// ==============================
function logout() {
  localStorage.removeItem("loggedUser");
  localStorage.removeItem("guestSession");
  showToast("Logged out", "info");
  setTimeout(() => (window.location.href = "login.html"), 900);
}

// ==============================
// 📦 DOM ELEMENTS
// ==============================
const transactionsList = document.getElementById("transactionsList");
const viewAllLink = document.querySelector(".recent-header a");

let showAll = false;
let latestSnapshot = null;
let totals = { balance: 0, income: 0, expenses: 0 };
let categoryTotals = {};
let dailyTotals = {};
let unsubscribe = null;

const categoryClasses = {
  income: "income",
  housing: "utility",
  groceries: "food",
  entertainment: "entertainment",
  food: "food",
  transport: "transport",
  shopping: "shopping",
  fitness: "gym",
  medical: "medical",
  others: "others",
};

// Ensure currency is set on load
let savedCurrency = localStorage.getItem("userCurrency") || "NGN";
setCurrency(savedCurrency);

// ==============================
// 🔥 LISTEN TO TRANSACTIONS
// ==============================
function listenToTransactions() {
  if (unsubscribe) unsubscribe();
  latestSnapshot = null;

  const loggedUser = JSON.parse(localStorage.getItem("loggedUser"));
  const guestSession = JSON.parse(localStorage.getItem("guestSession"));

  if (guestSession) {
    // Guest mode → local transactions
    const guestTransactions =
      JSON.parse(localStorage.getItem("guestTransactions")) || [];
    renderGuestTransactions(guestTransactions);
    updateTotals(guestTransactions);
    renderCategoryChart(categoryTotals);
    renderWeeklyChart(dailyTotals);
    return;
  }

  if (loggedUser && loggedUser.id) {
    const q = query(
      collection(db, "transactions"),
      where("userId", "==", loggedUser.id),
      orderBy("createdAt", "desc")
    );

    unsubscribe = onSnapshot(q, async (snapshot) => {
      latestSnapshot = snapshot;
      const transactions = [];
      snapshot.forEach((doc) => transactions.push(doc.data()));

      const codes = [...new Set(transactions.map((t) => t.currency || "NGN"))].filter(
        (c) => c !== currentCurrency
      );

      const rates = await fetchRates(currentCurrency, codes);
      updateTotals(transactions, rates);
      renderTransactions(transactions, rates);
      setupViewAll(transactions, rates);
      renderCategoryChart(categoryTotals);
      renderWeeklyChart(dailyTotals);
    });
  }
}

listenToTransactions();

// ==============================
// 💰 UPDATE TOTALS + BALANCE
// ==============================
function updateTotals(transactions, rates = {}) {
  let totalIncome = 0;
  let totalExpenses = 0;
  categoryTotals = {};
  dailyTotals = {};

  for (const txn of transactions) {
    const fromCurrency = txn.currency || "NGN";
    const amount = Number(txn.amount) || 0;
    let convertedAmount = amount;

    if (fromCurrency !== currentCurrency && rates[fromCurrency]) {
      convertedAmount = amount / rates[fromCurrency];
    }

    const txnDate = new Date(txn.date);

    if (txn.type === "income") {
      totalIncome += convertedAmount;
    } else {
      totalExpenses += convertedAmount;

      const cat = txn.category || "others";
      categoryTotals[cat] = (categoryTotals[cat] || 0) + convertedAmount;

      const dayKey = txnDate.toISOString().split("T")[0];
      dailyTotals[dayKey] = (dailyTotals[dayKey] || 0) + convertedAmount;
    }
  }

  const balance = totalIncome - totalExpenses;
  totals = { balance, income: totalIncome, expenses: totalExpenses };
  updateDashboardUI();
}

// ==============================
// 🧾 RENDER GUEST TRANSACTIONS
// ==============================
function renderGuestTransactions(guestTransactions) {
  transactionsList.innerHTML = "";

  if (guestTransactions.length === 0) {
    transactionsList.innerHTML = `
      <div class="no-transactions">
        <p>No transactions yet.</p>
        <a href="addtransaction.html" class="add-link">Add a transaction</a>
      </div>
    `;
    return;
  }

  guestTransactions.slice(0, showAll ? guestTransactions.length : 5).forEach((txn) => {
    const isIncome = txn.type === "income";
    const categoryClass = categoryClasses[txn.category] || "utility";
    const amountClass = isIncome
      ? "credit-transaction-amount"
      : "debit-transaction-amount";

    const transactionHTML = `
      <div class="transaction-list">
        <div class="transaction-content">
          <div class="transaction-indicator ${categoryClass}">
            <i class="fa-regular ${isIncome ? "fa-arrow-up" : "fa-arrow-down"}"></i>
          </div>
          <div class="transaction-details-dashboard">
            <p>${txn.description}</p>
            <span><i class="fa-regular fa-calendar"></i> ${txn.date}</span>
          </div>
        </div>
        <div class="${amountClass}">
          <p>${isIncome ? "+" : "-"}${formatCurrency(txn.amount, currentCurrency)}</p>
        </div>
      </div>
    `;
    transactionsList.insertAdjacentHTML("beforeend", transactionHTML);
  });
}

// ==============================
// 🧾 RENDER FIRESTORE TRANSACTIONS
// ==============================
function renderTransactions(transactions, rates) {
  transactionsList.innerHTML = "";
  const limitedTxns = showAll ? transactions : transactions.slice(0, 5);

  if (limitedTxns.length === 0) {
    transactionsList.innerHTML = `
      <div class="no-transactions">
        <p>No recent transactions.</p>
        <a href="addtransaction.html" class="add-link">Add a transaction</a>
      </div>
    `;
    return;
  }

  limitedTxns.forEach((txn) => {
    const isIncome = txn.type === "income";
    const categoryClass = categoryClasses[txn.category] || "utility";
    const amountClass = isIncome
      ? "credit-transaction-amount"
      : "debit-transaction-amount";

    let amount = Number(txn.amount);
    const fromCurrency = txn.currency || "NGN";
    if (fromCurrency !== currentCurrency && rates[fromCurrency]) {
      amount = amount / rates[fromCurrency];
    }

    const transactionHTML = `
      <div class="transaction-list">
        <div class="transaction-content">
          <div class="transaction-indicator ${categoryClass}">
            <i class="fa-regular ${isIncome ? "fa-arrow-up" : "fa-arrow-down"}"></i>
          </div>
          <div class="transaction-details-dashboard">
            <p>${txn.description}</p>
            <span><i class="fa-regular fa-calendar"></i> ${txn.date}</span>
          </div>
        </div>
        <div class="${amountClass}">
          <p data-value="${amount}">
            ${isIncome ? "+" : "-"}${formatCurrency(amount, currentCurrency)}
          </p>
        </div>
      </div>
    `;

    transactionsList.insertAdjacentHTML("beforeend", transactionHTML);
  });
}

// ==============================
// 🔄 VIEW ALL TOGGLE
// ==============================
function setupViewAll(transactions, rates) {
  viewAllLink.onclick = (e) => {
    e.preventDefault();
    showAll = !showAll;
    viewAllLink.textContent = showAll ? "Show Less" : "View All";
    renderTransactions(transactions, rates);
  };
}

// ==============================
// 📊 CHARTS (same as before)
// ==============================

function getDayName(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", { weekday: "short" });
}

function renderCategoryChart(data) {
  const ctx = document.getElementById("categoryChart").getContext("2d");
  if (categoryChart) categoryChart.destroy();

  let categories = Object.keys(data);
  let amounts = Object.values(data);

  if (categories.length === 0) {
    categories = ["No Data"];
    amounts = [1];
  }

  categoryChart = new Chart(ctx, {
    type: "pie",
    data: {
      labels: categories,
      datasets: [
        {
          label: "Spending by Category",
          data: amounts,
          backgroundColor:
            categories[0] === "No Data"
              ? ["#E5E7EB"]
              : [
                  "#FF6384",
                  "#36A2EB",
                  "#FFCE56",
                  "#4BC0C0",
                  "#9966FF",
                  "#FF9F40",
                  "#C9CBCF",
                ],
          borderWidth: 0,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: "bottom", labels: { color: "#6B7280" } },
        tooltip: { enabled: categories[0] !== "No Data" },
      },
    },
  });
}

function renderWeeklyChart(dailyTotals) {
  const ctx = document.getElementById("weeklyChart").getContext("2d");
  if (weeklyChart) weeklyChart.destroy();

  const now = new Date();
  const days = [...Array(7)].map((_, i) => {
    const d = new Date(now);
    d.setDate(now.getDate() - (6 - i));
    return d.toISOString().split("T")[0];
  });

  const labels = days.map((d) => getDayName(d));
  const data = days.map((d) => dailyTotals[d] || 0);

  weeklyChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: `Daily Spending (${currentCurrency})`,
          data,
          backgroundColor: "#36A2EB",
          borderRadius: 6,
        },
      ],
    },
    options: {
      scales: { y: { beginAtZero: true } },
      plugins: { legend: { display: false } },
    },
  });
}

// ==============================
// 🌍 CURRENCY CHANGE HANDLER
// ==============================
window.addEventListener("currencyChanged", async (e) => {
  const { currency, symbol } = e.detail;
  setCurrency(currency);
  updateDashboardUI();

  if (weeklyChart) {
    weeklyChart.data.datasets[0].label = `Daily Spending (${currency})`;
    weeklyChart.update();
  }
});

// ==============================
// 🧱 DASHBOARD UI UPDATER
// ==============================
function updateDashboardUI() {
  document.querySelectorAll(".dashboard-details").forEach((el) => {
    const label = el.querySelector("p")?.textContent?.toLowerCase();
    const valueEl = el.querySelector("h1");

    if (label === "balance")
      valueEl.textContent = formatCurrency(totals.balance, currentCurrency);
    if (label === "income")
      valueEl.textContent = formatCurrency(totals.income, currentCurrency);
    if (label === "expenses")
      valueEl.textContent = formatCurrency(totals.expenses, currentCurrency);
  });
}

// ==============================
// 🔔 TOAST
// ==============================
function showToast(message, type = "info") {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.className = `toast show ${type}`;
  setTimeout(() => (toast.className = "toast"), 3000);
}

// ==============================
// 🚪 LOGOUT + NAV USERNAME
// ==============================
const logoutBtn = document.getElementById("logoutBtn");
if (logoutBtn) {
  logoutBtn.addEventListener("click", (e) => {
    e.preventDefault();
    logout();
  });
}

const navUserName = document.getElementById("navUserName");
if (navUserName) {
  if (user?.username) navUserName.textContent = user.username;
  else if (user) navUserName.textContent = "Guest";
}
