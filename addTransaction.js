// ===== addTransaction.js =====
import { db } from "./firebase.js";
import {
  collection,
  addDoc,
  doc,
  updateDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";
import { currentCurrency, currentSymbol } from "./appCurrency.js";
import { logout, displayUserName } from "./authUtils.js";

// =====================================
// 🏦 INITIAL SETUP
// =====================================
const form = document.getElementById("addTransactionForm");
const symbolSpan = document.getElementById("currencySymbol");
const submitBtn = form?.querySelector('button[type="submit"]');

const loggedUser = JSON.parse(localStorage.getItem("loggedUser"));
const guestSession = JSON.parse(localStorage.getItem("guestSession"));
const currentUser = loggedUser || guestSession;

if (!currentUser) window.location.href = "login.html";

// Check for edit mode
const editTransaction = JSON.parse(localStorage.getItem("editTransaction"));

// Set the currency symbol
document.addEventListener("DOMContentLoaded", () => {
  if (symbolSpan) symbolSpan.textContent = currentSymbol;

  // Prefill if editing
  if (editTransaction) prefillForm(editTransaction);
});

// =====================================
// 🧾 PREFILL FORM
// =====================================
function prefillForm(txn) {
  document.getElementById("description").value = txn.description || "";
  document.getElementById("amount").value = txn.amount || "";
  document.getElementById("type").value = txn.type || "";
  document.getElementById("category").value = txn.category || "";
  document.getElementById("txn-date").value = txn.date || "";
  if (submitBtn) submitBtn.textContent = "Update Transaction";
}

// =====================================
// 📝 SUBMIT FORM (ADD OR EDIT)
// =====================================
form?.addEventListener("submit", async (e) => {
  e.preventDefault();

  const description = document.getElementById("description").value.trim();
  const amount = parseFloat(document.getElementById("amount").value);
  const type = document.getElementById("type").value;
  const category = document.getElementById("category").value;
  const date = document.getElementById("txn-date").value;

  // 🧠 Individual field validation with specific messages
  if (!description) {
    showPopup("Please fill in the description.", "error");
    return;
  }
  if (isNaN(amount) || amount <= 0) {
    showPopup("Please enter a valid amount.", "error");
    return;
  }
  if (!type) {
    showPopup("Please select a transaction type.", "error");
    return;
  }
  if (!category) {
    showPopup("Please select a category.", "error");
    return;
  }
  if (!date) {
    showPopup("Please select a date.", "error");
    return;
  }


  const userId = currentUser.id || currentUser.email || "guest";
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
    if (editTransaction) {
      // 🔄 UPDATE EXISTING TRANSACTION
      if (loggedUser) {
        const docRef = doc(db, "transactions", editTransaction.id);
        await updateDoc(docRef, transactionData);
      } else {
        const guestTxns =
          JSON.parse(localStorage.getItem("guestTransactions")) || [];
        const index = guestTxns.findIndex((t) => t.id === editTransaction.id);
        if (index > -1) {
          guestTxns[index] = { ...guestTxns[index], ...transactionData };
          localStorage.setItem("guestTransactions", JSON.stringify(guestTxns));
        }
      }

      showPopup("Transaction updated successfully!");
      localStorage.removeItem("editTransaction");
      setTimeout(() => (window.location.href = "transaction.html"), 1200);
    } else {
      // ➕ ADD NEW TRANSACTION
      if (guestSession && !loggedUser) {
        const guestTxns =
          JSON.parse(localStorage.getItem("guestTransactions")) || [];
        const newTxn = {
          ...transactionData,
          id: crypto.randomUUID(),
          createdAt: new Date().toISOString(),
        };
        guestTxns.unshift(newTxn);
        localStorage.setItem("guestTransactions", JSON.stringify(guestTxns));
      } else {
        await addDoc(collection(db, "transactions"), transactionData);
      }

      showPopup("Transaction added successfully!");
      form.reset();
    }
  } catch (err) {
    console.error("Error saving transaction:", err);
    showPopup("⚠Failed to save transaction.", "error");
  }
});

// =====================================
// 🔔 POPUP
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

// =====================================
// 🚪 LOGOUT + NAV USERNAME
// =====================================
const logoutBtn = document.getElementById("logoutBtn");
logoutBtn?.addEventListener("click", (e) => {
  e.preventDefault();
  logout();
});
displayUserName("navUserName");
