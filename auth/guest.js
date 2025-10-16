const continueGuest = document.getElementById("continueGuest");

continueGuest.addEventListener("click", () => {
  const guestData = { id: Date.now(), name: "Guest User", guest: true };
  localStorage.setItem("guestSession", JSON.stringify(guestData));
  window.location.href = "index.html";
});
