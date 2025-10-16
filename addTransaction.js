import { db } from "./firebase.js";
import { collection, addDoc, serverTimestamp, query, where, orderBy, getDocs } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";
import { currentCurrency, currentSymbol } from "./appCurrency.js";

// =====================================
// 🏦 INITIAL SETUP
// =====================================
let activeSymbol = currentSymbol;
const form = document.getElementById("addTransactionForm");
const transactionsList = document.getElementById("transactionsList");
const symbolSpan = document.getElementById("currencySymbol");

const loggedUser = JSON.parse(localStorage.getItem("loggedUser"));
const guestSession = JSON.parse(localStorage.getItem("guestSession"));
const currentUser = loggedUser || guestSession;

// ✅ Redirect if no session
if (!currentUser) {
  window.location.href = "login.html";
}

// 🪙 Display current symbol
document.addEventListener("DOMContentLoaded", () => {
  if (symbolSpan) symbolSpan.textContent = activeSymbol;
  loadTransactions(); // Load all user or guest transactions on page load
});

// ✅ Ensure live sync once user currency loads from Firestore
window.addEventListener("currencyChanged", (e) => {
  const { symbol } = e.detail;
  activeSymbol = symbol;
  if (symbolSpan) symbolSpan.textContent = activeSymbol;
});

// =====================================
// 🧩 CATEGORY CLASSES
// =====================================
const categoryClasses = {
  medical: "medicaltag",
  entertainment: "entertainmenttag",
  income: "incometag",
  gym: "gymtag",
  food: "foodtag",
  shopping: "shoppingtag",
  utility: "utilitytag",
  transport: "transporttag",
  health: "fitnesstag",
  groceries: "groceriestag",
  others: "otherstag",
};

// =====================================
// 📝 HANDLE FORM SUBMIT
// =====================================
if (form) {
  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const description = document.getElementById("description")?.value.trim();
    const amount = parseFloat(document.getElementById("amount")?.value);
    const type = document.getElementById("type")?.value;
    const category = document.getElementById("category")?.value;
    const date = document.getElementById("txn-date")?.value;

    if (!description || isNaN(amount) || !type || !category || !date) {
      showPopup("⚠️ Please fill all fields correctly.", "error");
      return;
    }

    // Use a stable unique user ID for Firestore
    const userId = currentUser?.id || currentUser?.email || currentUser?.username || "guest";

    const transactionData = {
      description,
      amount,
      type,
      category,
      date,
      currency: currentCurrency,
      createdAt: serverTimestamp(),
      userId,
    };

    try {
      // 👤 Guest mode → save locally
      if (!loggedUser) {
        const guestTxns = JSON.parse(localStorage.getItem("guestTransactions")) || [];
        guestTxns.unshift({ ...transactionData, createdAt: new Date().toISOString() });
        localStorage.setItem("guestTransactions", JSON.stringify(guestTxns));
        addTransactionToUI(transactionData);
        showPopup("Transaction saved locally (Guest mode)");
      } 
      // 👤 Logged-in → save to Firestore
      else {
        await addDoc(collection(db, "transactions"), transactionData);
        addTransactionToUI(transactionData);
        showPopup("Transaction added successfully!");
      }

      form.reset();
      if (symbolSpan) symbolSpan.textContent = activeSymbol;
    } catch (err) {
      console.error("Error adding transaction:", err);
      showPopup("⚠️ Failed to add transaction.", "error");
    }
  });
}

// =====================================
// 💰 LOAD USER OR GUEST TRANSACTIONS
// =====================================
async function loadTransactions() {
  if (!transactionsList) return;

  transactionsList.innerHTML = "";
  const userId = currentUser?.id || currentUser?.email || currentUser?.username || "guest";

  try {
    if (!loggedUser) {
      // Guest transactions
      const guestTxns = JSON.parse(localStorage.getItem("guestTransactions")) || [];
      guestTxns.forEach(txn => addTransactionToUI(txn));
    } else {
      // Logged-in user transactions from Firestore
      const q = query(
        collection(db, "transactions"),
        where("userId", "==", userId),
        orderBy("createdAt", "desc")
      );
      const snapshot = await getDocs(q);
      snapshot.forEach(doc => addTransactionToUI(doc.data()));
    }
  } catch (err) {
    console.error("Error loading transactions:", err);
  }
}

// =====================================
// 💰 RENDER TRANSACTION PREVIEW
// =====================================
function addTransactionToUI(txn) {
  if (!transactionsList) return;

  const categoryClass = categoryClasses[txn.category] || "otherstag";
  const amountClass = txn.type === "income" ? "credit" : "debit";
  const arrowIcon =
    txn.type === "income"
      ? '<i class="fa-regular fa-arrow-up"></i>'
      : '<i class="fa-regular fa-arrow-down"></i>';

  const formattedAmount = `${txn.type === "income" ? "+" : "-"}${activeSymbol}${txn.amount.toLocaleString()}`;

  const transactionHTML = `
    <div class="transaction-table">
      <div class="transaction-details">
        <div class="transaction-indicator ${categoryClass}">
          ${arrowIcon}
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
              <span class="tag ${categoryClass}">${txn.category}</span>
            </div>
          </div>
        </div>
      </div>
      <div class="transaction-amount ${amountClass}">
        <h4 data-value="${txn.amount}" data-type="${txn.type}">${formattedAmount}</h4>
      </div>
    </div>
  `;

  transactionsList.insertAdjacentHTML("afterbegin", transactionHTML);
}

// =====================================
// 🔔 POPUP MESSAGE SYSTEM
// =====================================
function showPopup(message, type = "success") {
  let popup = document.getElementById("popup");
  if (!popup) {
    popup = document.createElement("div");
    popup.id = "popup";
    popup.className = "popup hidden";
    popup.innerHTML = `<p id="popup-message"></p>`;
    document.body.appendChild(popup);
  }

  const msg = document.getElementById("popup-message");
  if (msg) msg.textContent = message;

  popup.classList.remove("hidden", "error");
  popup.classList.add("show");
  if (type === "error") popup.classList.add("error");

  setTimeout(() => {
    popup.classList.remove("show");
    setTimeout(() => popup.classList.add("hidden"), 300);
  }, 3000);
}

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
    localStorage.removeItem("loggedUser");
    localStorage.removeItem("guestSession");
    showToast("Logging out...", "info");
    setTimeout(() => (window.location.href = "login.html"), 1200);
  });
}
