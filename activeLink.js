import { toggleTheme } from "./theme.js";

const themeIconToggle = document.getElementById("themeIconToggle");
if (themeIconToggle) {
  themeIconToggle.addEventListener("click", (e) => {
    e.preventDefault();
    toggleTheme();
  });
}



document.addEventListener("DOMContentLoaded", () => {
  const navName = document.getElementById("navUserName");
  const savedName = localStorage.getItem("userName");
  if (savedName && navName) navName.textContent = savedName;
});


// Highlight active sidebar link
const links = document.querySelectorAll("aside a");
const currentPage = window.location.pathname.split("/").pop(); // e.g. "insight.html"

links.forEach(link => {
  const linkPage = link.getAttribute("href");

  if (linkPage === currentPage) {
    link.classList.add("active");
  } else {
    link.classList.remove("active");
  }
});
