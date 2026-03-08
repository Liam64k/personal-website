import LiquidBackground from "https://cdn.jsdelivr.net/npm/threejs-components@0.0.27/build/backgrounds/liquid1.min.js";

(function () {
  "use strict";

  /* ── Mobile nav toggle ── */
  const toggle = document.querySelector(".nav-toggle");
  const links = document.querySelector(".nav-links");
  const socials = document.querySelector(".nav-socials");

  if (toggle && links) {
    toggle.addEventListener("click", function () {
      const open = links.classList.toggle("open");
      toggle.classList.toggle("active");
      toggle.setAttribute("aria-expanded", open);
      if (socials) socials.classList.toggle("open");
    });

    links.querySelectorAll("a").forEach(function (a) {
      a.addEventListener("click", function () {
        links.classList.remove("open");
        toggle.classList.remove("active");
        toggle.setAttribute("aria-expanded", "false");
        if (socials) socials.classList.remove("open");
      });
    });
  }

  /* ── Scroll-based header styling ── */
  const header = document.querySelector(".header");
  if (header) {
    let lastY = 0;
    window.addEventListener("scroll", function () {
      const y = window.scrollY;
      if (y > 60) {
        header.classList.add("scrolled");
      } else {
        header.classList.remove("scrolled");
      }
      lastY = y;
    }, { passive: true });
  }

  /* ── Liquid background effect ── */
  const canvas = document.getElementById("liquid-canvas");
  if (canvas) {
    const size = 2048;
    const off = document.createElement("canvas");
    off.width = size;
    off.height = size;
    const ctx = off.getContext("2d");

    // Nearly all-black with a subtle dark blue hint
    const g = ctx.createLinearGradient(0, 0, size, size);
    g.addColorStop(0, "#000000");
    g.addColorStop(1, "#0a0a1a");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);

    // Bake "LIAM STIER" into the texture – big, white, centred
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    var fontSize = Math.round(size * 0.18);
    ctx.font = "800 " + fontSize + "px 'Helvetica Neue', Helvetica, Arial, sans-serif";
    ctx.fillText("LIAM", size / 2, size / 2 - fontSize * 0.6);
    ctx.fillText("STIER", size / 2, size / 2 + fontSize * 0.6);

    const app = LiquidBackground(canvas);
    app.loadImage(off.toDataURL("image/png"));
    app.liquidPlane.material.metalness = 0.85;
    app.liquidPlane.material.roughness = 0.18;
    app.liquidPlane.uniforms.displacementScale.value = 2.0;
    app.setRain(false);
  }
})();
