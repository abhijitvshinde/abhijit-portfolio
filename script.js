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
/* ==========================================
   INTERNAL PAGE SIDE NAVIGATION
========================================== */

function initializePageSideNavigation() {

  const sideNav =
    document.querySelector(".page-side-nav");

  if (!sideNav) {
    return;
  }

  const links = Array.from(
    sideNav.querySelectorAll('a[href^="#"]')
  );

  const sections = links
    .map((link) => {

      const selector =
        link.getAttribute("href");

      return document.querySelector(selector);

    })
    .filter(Boolean);

  if (!sections.length) {
    return;
  }

  function updatePageSideNavigation() {

    const navbarOffset = 160;

    let currentSection = sections[0];

    sections.forEach((section) => {

      const sectionTop =
        section.getBoundingClientRect().top;

      if (sectionTop <= navbarOffset) {
        currentSection = section;
      }

    });

    links.forEach((link) => {

      const targetId =
        link.getAttribute("href").replace("#", "");

      const isActive =
        currentSection.id === targetId;

      link.classList.toggle(
        "active",
        isActive
      );

      if (isActive) {

        link.setAttribute(
          "aria-current",
          "location"
        );

      } else {

        link.removeAttribute(
          "aria-current"
        );

      }

    });

  }

  links.forEach((link) => {

    link.addEventListener("click", () => {

      links.forEach((item) => {

        item.classList.remove("active");
        item.removeAttribute("aria-current");

      });

      link.classList.add("active");

      link.setAttribute(
        "aria-current",
        "location"
      );

    });

  });

  window.addEventListener(
    "scroll",
    updatePageSideNavigation,
    { passive:true }
  );

  window.addEventListener(
    "resize",
    updatePageSideNavigation
  );

  updatePageSideNavigation();
}

document.addEventListener(
  "DOMContentLoaded",
  initializePageSideNavigation
);
