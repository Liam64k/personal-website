window.TerrainDemo = (function () {
  var canvas, ctx;
  var W, H, cols, heights, offset;
  var animId = null;

  // Simple Perlin-like noise using sine harmonics
  function noise(x) {
    return (
      Math.sin(x * 0.02) * 0.5 +
      Math.sin(x * 0.05 + 1.3) * 0.25 +
      Math.sin(x * 0.11 + 2.7) * 0.125 +
      Math.sin(x * 0.23 + 4.1) * 0.0625
    ) / 0.9375;
  }

  function resize() {
    if (!canvas) return;
    var wrap = canvas.parentElement;
    var style = getComputedStyle(wrap);
    var w = wrap.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
    var s = Math.min(w, 500);
    canvas.width = s;
    canvas.height = Math.round(s * 0.6);
    W = canvas.width;
    H = canvas.height;
    cols = Math.floor(W / 4);
  }

  function computeHeights() {
    heights = [];
    for (var i = 0; i < cols; i++) {
      var n = noise(i + offset);
      heights.push(H * 0.15 + (n + 1) * 0.5 * H * 0.65);
    }
  }

  function draw() {
    ctx.fillStyle = "#0a0a1a";
    ctx.fillRect(0, 0, W, H);

    var colW = W / cols;

    for (var i = 0; i < cols; i++) {
      var x = i * colW;
      var y = heights[i];
      var colH = H - y;

      // Snow-capped peaks
      if (y < H * 0.3) {
        var snowDepth = Math.min(12, (H * 0.3 - y) * 0.4) + Math.random() * 4;
        ctx.fillStyle = "#dde8f0";
        ctx.fillRect(x, y, colW + 1, snowDepth);

        ctx.fillStyle = "#888";
        ctx.fillRect(x, y + snowDepth, colW + 1, 8 + Math.random() * 6);

        ctx.fillStyle = "#6b4226";
        ctx.fillRect(x, y + snowDepth + 10, colW + 1, colH - snowDepth - 10);
      }
      // Cliffs (steep changes)
      else if (i > 0 && Math.abs(heights[i] - heights[i - 1]) > 15) {
        var grayVal = Math.floor(80 + Math.random() * 40);
        ctx.fillStyle = "rgb(" + grayVal + "," + grayVal + "," + grayVal + ")";
        ctx.fillRect(x, y, colW + 1, Math.abs(heights[i] - heights[i - 1]) + 10);

        ctx.fillStyle = "#6b4226";
        ctx.fillRect(x, y + Math.abs(heights[i] - heights[i - 1]) + 10, colW + 1, colH);
      }
      // Grass
      else {
        var greenVal = Math.floor(120 + Math.random() * 50);
        ctx.fillStyle = "rgb(0," + greenVal + ",0)";
        ctx.fillRect(x, y, colW + 1, 10);

        ctx.fillStyle = "#6b4226";
        ctx.fillRect(x, y + 10, colW + 1, colH - 10);
      }

      // Deeper dirt
      var dirtGrad = Math.min(100, Math.floor((H - y) * 0.15 + 40));
      ctx.fillStyle = "rgb(100," + dirtGrad + ",0)";
      ctx.fillRect(x, H - 30, colW + 1, 30);
    }
  }

  function animate() {
    offset += 0.4;
    computeHeights();
    draw();
    animId = requestAnimationFrame(animate);
  }

  function onResize() { resize(); }

  return {
    init: function () {
      canvas = document.getElementById("terrain-demo");
      if (!canvas) return;
      ctx = canvas.getContext("2d");
      offset = 0;
      window.addEventListener("resize", onResize);
      resize();
      computeHeights();
      animate();
    },
    destroy: function () {
      if (animId) cancelAnimationFrame(animId);
      animId = null;
      window.removeEventListener("resize", onResize);
    }
  };
})();
