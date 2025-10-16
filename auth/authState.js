function getStoredUser() {
  const logged = localStorage.getItem("loggedUser");
  if (logged) {
    try { return JSON.parse(logged); } catch(e){ return null; }
  }
  const guest = localStorage.getItem("guestSession");
  if (guest) {
    try { return JSON.parse(guest); } catch(e){ return null; }
  }
  return null;
}

function showPageLoader(show = true) {
  const loader = document.getElementById("pageLoader");
  if (!loader) return;

  if (show) {
    loader.classList.remove("hidden");
  } else {
    loader.classList.add("hidden");
  }
}

async function updateNavUser() {
  const nameSpan = document.getElementById("navUserName");
  if (!nameSpan) return;

  // show loader
  showPageLoader(true);

  // simulate fetch delay (like API or localStorage delay)
  await new Promise(resolve => setTimeout(resolve, 800));

  const user = getStoredUser();
  if (!user) {
    nameSpan.textContent = "";
    showPageLoader(false);
    return;
  }

  const name = user.name || user.username || user.displayName || user.email || (user.guest ? "Guest" : "");
  const short = name ? String(name).split(" ")[0] : "User";
  nameSpan.textContent = short;

  // hide loader
  showPageLoader(false);
}

document.addEventListener("DOMContentLoaded", updateNavUser);
window.addEventListener("userChanged", updateNavUser);
