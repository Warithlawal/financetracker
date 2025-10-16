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

let categoryChart, weeklyChart, incomeVsExpenseChart;

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
// 📦 VARIABLES
// ==============================
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

// ==============================
// 💱 INITIAL CURRENCY SETUP
// ==============================
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
    const guestTransactions =
      JSON.parse(localStorage.getItem("guestTransactions")) || [];

    // ✅ Normalize guest data (ensure type & date)
    const normalized = guestTransactions.map((t) => ({
      ...t,
      type: t.type || "expense",
      date: t.date || new Date().toISOString(),
    }));

    updateTotals(normalized);
    renderCategoryChart(categoryTotals);
    renderWeeklyChart(dailyTotals);
    renderIncomeVsExpenseChart(normalized, {});
    return;
  }

  if (loggedUser && loggedUser.id) {
    const q = query(
      collection(db, "transactions"),
      where("userId", "==", loggedUser.id),
      orderBy("createdAt", "desc")
    );

    unsubscribe = onSnapshot(
      q,
      async (snapshot) => {
        latestSnapshot = snapshot;
        const transactions = [];
        snapshot.forEach((doc) => transactions.push(doc.data()));

        const codes = [
          ...new Set(transactions.map((t) => t.currency || "NGN")),
        ].filter((c) => c !== currentCurrency);

        const rates = codes.length
          ? await fetchRates(currentCurrency, codes)
          : {};

        updateTotals(transactions, rates);
        renderCategoryChart(categoryTotals);
        renderWeeklyChart(dailyTotals);
        renderIncomeVsExpenseChart(transactions, rates);
      },
      (err) => {
        console.error("onSnapshot error (insight):", err);
      }
    );
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

    // ✅ Defensive date handling
    const txnDate = txn.date ? new Date(txn.date) : new Date();
    if (isNaN(txnDate)) continue;

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
// 📊 CHART HELPERS
// ==============================
function getDayName(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", { weekday: "short" });
}

function renderCategoryChart(data) {
  const pieChartContainer = document.querySelector(".pie-chart");
  if (!pieChartContainer) return;

  pieChartContainer.innerHTML = "";
  const canvas = document.createElement("canvas");
  pieChartContainer.appendChild(canvas);
  const ctx = canvas.getContext("2d");

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
                  "#10B981",
                  "#F59E0B",
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
  const barChartContainer = document.querySelector(".bar-chart");
  if (!barChartContainer) return;

  barChartContainer.innerHTML = "";
  const canvas = document.createElement("canvas");
  barChartContainer.appendChild(canvas);
  const ctx = canvas.getContext("2d");

  if (weeklyChart) weeklyChart.destroy();

  const hasData = Object.keys(dailyTotals).length > 0;

  if (!hasData) {
    weeklyChart = new Chart(ctx, {
      type: "bar",
      data: {
        labels: ["No data"],
        datasets: [
          {
            label: "No recent daily data",
            data: [1],
            backgroundColor: ["#D1D5DB"],
            borderRadius: 6,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: { y: { beginAtZero: true } },
        plugins: {
          legend: { display: false },
          tooltip: { enabled: false },
        },
      },
    });
    return;
  }

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
      responsive: true,
      maintainAspectRatio: false,
      scales: { y: { beginAtZero: true } },
      plugins: { legend: { display: false } },
    },
  });
}

// ==============================
// ✅ Income vs Expenses (Last 30 Days) Chart
// ==============================
function renderIncomeVsExpenseChart(transactions = [], rates = {}) {
  const container = document.querySelector(".income-container");
  if (!container) return;

  const heading = container.querySelector("h1");
  container.innerHTML = "";
  if (heading) container.appendChild(heading);

  const canvas = document.createElement("canvas");
  canvas.style.width = "100%";
  canvas.style.height = "240px";
  container.appendChild(canvas);
  const ctx = canvas.getContext("2d");

  if (incomeVsExpenseChart) {
    try {
      incomeVsExpenseChart.destroy();
    } catch (e) {}
    incomeVsExpenseChart = null;
  }

  const txns = Array.isArray(transactions) ? transactions : [];
  if (txns.length === 0) {
    incomeVsExpenseChart = new Chart(ctx, {
      type: "bar",
      data: {
        labels: ["Income", "Expenses"],
        datasets: [
          {
            label: "No Data Yet",
            data: [0, 0],
            backgroundColor: ["#E5E7EB", "#E5E7EB"],
            borderRadius: 8,
          },
        ],
      },
      options: { responsive: true, maintainAspectRatio: false },
    });
    return;
  }

  const now = new Date();
  const last30 = txns.filter((t) => {
    const d = t.date ? new Date(t.date) : new Date();
    if (isNaN(d)) return false;
    const diff = (now - d) / (1000 * 60 * 60 * 24);
    return diff >= 0 && diff <= 30;
  });

  let totalIncome = 0;
  let totalExpenses = 0;

  for (const t of last30) {
    const amtRaw = Number(t.amount) || 0;
    const from = t.currency || "NGN";
    let converted = amtRaw;
    if (from !== currentCurrency && rates[from]) converted = amtRaw / rates[from];
    if (t.type === "income") totalIncome += converted;
    else if (t.type === "expense") totalExpenses += converted;
  }

  const hasData = last30.length > 0;

  incomeVsExpenseChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: ["Income", "Expenses"],
      datasets: [
        {
          label: hasData ? "Last 30 Days" : "No Data",
          data: hasData ? [totalIncome, totalExpenses] : [0, 0],
          backgroundColor: hasData ? ["#16A34A", "#DC2626"] : ["#E5E7EB", "#E5E7EB"],
          borderRadius: 8,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: { y: { beginAtZero: true } },
      plugins: {
        legend: { display: false },
        tooltip: {
          enabled: hasData,
          callbacks: {
            label: function (context) {
              const v = context.raw || 0;
              try {
                return formatCurrency(v, currentCurrency);
              } catch (e) {
                return `${currentCurrency} ${Number(v).toLocaleString()}`;
              }
            },
          },
        },
      },
    },
  });
}

// ==============================
// 🌍 CURRENCY CHANGE HANDLER
// ==============================
window.addEventListener("currencyChanged", async (e) => {
  const { currency } = e.detail;
  setCurrency(currency);

  if (latestSnapshot) {
    const transactions = [];
    latestSnapshot.forEach((doc) => transactions.push(doc.data()));

    const codes = [
      ...new Set(transactions.map((t) => t.currency || "NGN")),
    ].filter((c) => c !== currentCurrency);

    const rates = codes.length ? await fetchRates(currentCurrency, codes) : {};
    updateTotals(transactions, rates);
    renderCategoryChart(categoryTotals);
    renderWeeklyChart(dailyTotals);
    renderIncomeVsExpenseChart(transactions, rates);
  } else {
    const guestTransactions =
      JSON.parse(localStorage.getItem("guestTransactions")) || [];
    renderIncomeVsExpenseChart(guestTransactions, {});
  }

  if (weeklyChart) {
    weeklyChart.data.datasets[0].label = `Daily Spending (${currency})`;
    weeklyChart.update();
  }
});

// ==============================
// 🧱 DASHBOARD UI UPDATER
// ==============================
function updateDashboardUI() {
  document.querySelectorAll(".insight-details").forEach((el) => {
    const label = el.querySelector("p")?.textContent?.toLowerCase();
    const valueEl = el.querySelector("h1");

    if (label && valueEl) {
      if (label.includes("income"))
        valueEl.textContent = formatCurrency(totals.income, currentCurrency);
      else if (label.includes("expenses"))
        valueEl.textContent = formatCurrency(totals.expenses, currentCurrency);
      else if (label.includes("savings") || label.includes("balance"))
        valueEl.textContent = formatCurrency(totals.balance, currentCurrency);
    }
  });
}

// ==============================
// 🔔 TOAST
// ==============================
function showToast(message, type = "info") {
  const toast = document.getElementById("toast");
  if (!toast) return;
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
  else navUserName.textContent = "Guest";
}
