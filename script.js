function toggleMenu() {
  document.getElementById("navLinks").classList.toggle("show");
}

function revealSections() {
  const reveals = document.querySelectorAll(".reveal");

  reveals.forEach((section) => {
    const windowHeight = window.innerHeight;
    const revealTop = section.getBoundingClientRect().top;
    const revealPoint = 100;

    if (revealTop < windowHeight - revealPoint) {
      section.classList.add("active");
    }
  });
}

function updateSideNavActive() {
  const sections = document.querySelectorAll("header[id], section[id]");
  const navLinks = document.querySelectorAll(".side-nav a");

  let currentSection = "";

  sections.forEach((section) => {
    const sectionTop = section.offsetTop - 180;
    const sectionHeight = section.offsetHeight;

    if (window.scrollY >= sectionTop && window.scrollY < sectionTop + sectionHeight) {
      currentSection = section.getAttribute("id");
    }
  });

  navLinks.forEach((link) => {
    link.classList.remove("active");

    if (link.getAttribute("href") === "#" + currentSection) {
      link.classList.add("active");
    }
  });
}

window.addEventListener("scroll", () => {
  revealSections();
  updateSideNavActive();
});

window.addEventListener("load", () => {
  revealSections();
  updateSideNavActive();
});
