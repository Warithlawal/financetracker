// ===== authUtils.js =====

// ✅ Shared logout function
export async function logout() {
  try {
    // Clear all local data
    localStorage.removeItem("loggedUser");
    localStorage.removeItem("guestSession");
    localStorage.removeItem("activeCurrency");

    // Optional: clear per-user data keys
    Object.keys(localStorage).forEach((key) => {
      if (key.startsWith("userData_")) localStorage.removeItem(key);
    });

    showToast("Logging out...", "info");

    setTimeout(() => {
      window.location.href = "login.html";
    }, 1200);
  } catch (err) {
    console.warn("Logout failed:", err.message);
  }
}

// ✅ Shared username display
export function displayUserName(navElementId = "navUserName") {
  const navUserName = document.getElementById(navElementId);
  if (!navUserName) return;

  const loggedUser = JSON.parse(localStorage.getItem("loggedUser"));
  const guestSession = JSON.parse(localStorage.getItem("guestSession"));

  if (loggedUser && loggedUser.name) {
    navUserName.textContent = loggedUser.name;
  } else if (guestSession) {
    navUserName.textContent = "Guest";
  } else {
    navUserName.textContent = "";
  }
}

// ✅ Shared toast
export function showToast(message, type = "info") {
  const toast = document.getElementById("toast");
  if (!toast) return;
  toast.textContent = message;
  toast.className = `toast show ${type}`;
  setTimeout(() => (toast.className = "toast"), 3000);
}
