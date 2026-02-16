/**
 * main.js — Liam Stier Personal Website
 */

(function () {
  "use strict";

  /* ==========================================================
     Mobile Navigation Toggle
     ========================================================== */

  const navToggle = document.querySelector(".nav-toggle");
  const navMenu = document.querySelector(".nav-menu");

  if (navToggle && navMenu) {
    navToggle.addEventListener("click", function () {
      const isOpen = navMenu.classList.toggle("open");
      navToggle.classList.toggle("active");
      navToggle.setAttribute("aria-expanded", isOpen);
    });

    // Close menu when a nav link is clicked
    navMenu.querySelectorAll(".nav-link").forEach(function (link) {
      link.addEventListener("click", function () {
        navMenu.classList.remove("open");
        navToggle.classList.remove("active");
        navToggle.setAttribute("aria-expanded", "false");
      });
    });
  }

  /* ==========================================================
     Smooth Scroll for Anchor Links
     ========================================================== */

  document.querySelectorAll('a[href^="#"]').forEach(function (anchor) {
    anchor.addEventListener("click", function (e) {
      var targetId = this.getAttribute("href");
      if (targetId === "#") return;

      var target = document.querySelector(targetId);
      if (target) {
        e.preventDefault();
        var headerHeight = document.querySelector(".header").offsetHeight;
        var targetPosition = target.getBoundingClientRect().top + window.pageYOffset - headerHeight;

        window.scrollTo({
          top: targetPosition,
          behavior: "smooth",
        });
      }
    });
  });

  /* ==========================================================
     Active Nav Link on Scroll
     ========================================================== */

  var sections = document.querySelectorAll("section[id]");
  var navLinks = document.querySelectorAll(".nav-link");

  function highlightNavOnScroll() {
    var scrollPos = window.scrollY + 100;

    sections.forEach(function (section) {
      var top = section.offsetTop;
      var height = section.offsetHeight;
      var id = section.getAttribute("id");

      if (scrollPos >= top && scrollPos < top + height) {
        navLinks.forEach(function (link) {
          link.classList.remove("active");
          if (link.getAttribute("href") === "#" + id) {
            link.classList.add("active");
          }
        });
      }
    });
  }

  window.addEventListener("scroll", highlightNavOnScroll);
  highlightNavOnScroll();

  /* ==========================================================
     Contact Form Handler (placeholder)
     ========================================================== */

  var contactForm = document.querySelector(".contact-form");

  if (contactForm) {
    contactForm.addEventListener("submit", function (e) {
      e.preventDefault();

      var name = contactForm.querySelector("#name").value.trim();
      var email = contactForm.querySelector("#email").value.trim();
      var message = contactForm.querySelector("#message").value.trim();

      if (!name || !email || !message) {
        alert("Please fill in all fields.");
        return;
      }

      // TODO: Replace with actual form submission (e.g., Formspree, Netlify Forms, or a custom API)
      console.log("Form submitted:", { name: name, email: email, message: message });
      alert("Thanks for your message, " + name + "! I'll get back to you soon.");
      contactForm.reset();
    });
  }
})();
