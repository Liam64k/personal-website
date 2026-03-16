window.SnakeDemo = (function () {
  var canvas, ctx;
  var active = false;

  /* ── Map definitions (from MapSmall/Medium/Large.txt) ── */
  var MAPS = {
    small: [
      "wwwwwwwwwwww",
      "weeeeeeeeeew",
      "weeeeeeeeeew",
      "weeeeeeeeeew",
      "weeeeeeeeeew",
      "weeeeeeeeeew",
      "weseeeaeeeew",
      "weeeeeeeeeew",
      "weeeeeeeeeew",
      "weeeeeeeeeew",
      "weeeeeeeeeew",
      "wwwwwwwwwwww"
    ],
    medium: [
      "wwwwwwwwwwwwwwwwwwww",
      "weeeeeeeeeeeeeeeeeew",
      "weeeeeeeeeeeeeeeeeew",
      "weeeeeeeeeeeeeeeeeew",
      "weeeeeeeeeeeeeeeeeew",
      "weeeeeeeeeeeeeeeeeew",
      "weeeeeeeeeeeeeeeeeew",
      "weeeeeeeeeeeeeeeeeew",
      "weeeeeeeeeeeeeeeeeew",
      "weeeeeeeeeeeeeeeeeew",
      "weeeeeeeeeeeeeeeeeew",
      "weeseeeeeeeeeaeeeeew",
      "weeeeeeeeeeeeeeeeeew",
      "weeeeeeeeeeeeeeeeeew",
      "weeeeeeeeeeeeeeeeeew",
      "weeeeeeeeeeeeeeeeeew",
      "weeeeeeeeeeeeeeeeeew",
      "weeeeeeeeeeeeeeeeeew",
      "weeeeeeeeeeeeeeeeeew",
      "wwwwwwwwwwwwwwwwwwww"
    ],
    large: [
      "wwwwwwwwwwwwwwwwwwwwwwww",
      "weeeeeeeeeeeeeeeeeeeeeew",
      "weeeeeeeeeeeeeeeeeeeeeew",
      "weeeeeeeeeeeeeeeeeeeeeew",
      "weeeeeeeeeeeeeeeeeeeeeew",
      "weeeeeeeeeeeeeeeeeeeeeew",
      "weeeeeeeeeeeeeeeeeeeeeew",
      "weeeeeeeeeeeeeeeeeeeeeew",
      "weeeeeeeeeeeeeeeeeeeeeew",
      "weeeeeeeeeeeeeeeeeeeeeew",
      "weeeeeeeeeeeeeeeeeeeeeew",
      "weeeeeeeeeeeeeeeeeeeeeew",
      "weeeeseeeeeeeeaeeeeeeeew",
      "weeeeeeeeeeeeeeeeeeeeeew",
      "weeeeeeeeeeeeeeeeeeeeeew",
      "weeeeeeeeeeeeeeeeeeeeeew",
      "weeeeeeeeeeeeeeeeeeeeeew",
      "weeeeeeeeeeeeeeeeeeeeeew",
      "weeeeeeeeeeeeeeeeeeeeeew",
      "weeeeeeeeeeeeeeeeeeeeeew",
      "weeeeeeeeeeeeeeeeeeeeeew",
      "weeeeeeeeeeeeeeeeeeeeeew",
      "weeeeeeeeeeeeeeeeeeeeeew",
      "wwwwwwwwwwwwwwwwwwwwwwww"
    ]
  };

  /* ── State ── */
  var state = "menu"; // menu | playing | gameover
  var map, numTiles, tileSize;
  var shx, shy, direction, nextDirection;
  var snakeLength, hasMoved, spawnApple;
  var blockFrenzy, peaceful;
  var winCondition, speed;
  var loop;
  var gameOverText;

  // Menu selections
  var selectedMap = null;    // "small" | "medium" | "large"
  var selectedSpeed = null;  // "slow" | "medium" | "fast"
  var selectedMode = null;   // null | "blockFrenzy" | "peaceful"

  // Menu button rects (computed on resize)
  var buttons = {};

  function resize() {
    if (!canvas) return;
    var wrap = canvas.parentElement;
    var style = getComputedStyle(wrap);
    var w = wrap.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
    var s = Math.min(w, 500);
    canvas.width = s;
    canvas.height = s;
    if (state === "playing" && map) {
      tileSize = canvas.width / numTiles;
    }
    computeButtons();
    draw();
  }

  function computeButtons() {
    var s = canvas.width;
    var u = s / 600; // scale unit
    var bw = 90 * u, bh = 55 * u, gap = 15 * u;
    var totalW = bw * 3 + gap * 2;
    var startX = (s - totalW) / 2;
    var row1Y = s * 0.22;
    var row2Y = s * 0.42;
    var row3Y = s * 0.62;

    buttons = {
      small:   { x: startX, y: row1Y, w: bw, h: bh, label: "Small" },
      medium:  { x: startX + bw + gap, y: row1Y, w: bw, h: bh, label: "Medium" },
      large:   { x: startX + bw * 2 + gap * 2, y: row1Y, w: bw, h: bh, label: "Large" },
      slow:    { x: startX, y: row2Y, w: bw, h: bh, label: "Slow" },
      medSpd:  { x: startX + bw + gap, y: row2Y, w: bw, h: bh, label: "Medium" },
      fast:    { x: startX + bw * 2 + gap * 2, y: row2Y, w: bw, h: bh, label: "Fast" },
      blockF:  { x: startX, y: row3Y, w: (totalW - gap) / 2, h: bh, label: "Block Frenzy" },
      peace:   { x: startX + (totalW - gap) / 2 + gap, y: row3Y, w: (totalW - gap) / 2, h: bh, label: "Peaceful" },
      start:   { x: (s - 110 * u) / 2, y: s * 0.82, w: 110 * u, h: 45 * u, label: "START" }
    };
  }

  /* ── Map parsing (mirrors Board.readFile) ── */
  function loadMap(mapName) {
    var lines = MAPS[mapName];
    numTiles = lines[0].length;
    tileSize = canvas.width / numTiles;
    direction = "d";
    nextDirection = "d";
    snakeLength = 3;
    hasMoved = false;
    spawnApple = false;
    map = [];

    for (var r = 0; r < lines.length; r++) {
      map[r] = [];
      for (var c = 0; c < lines[r].length; c++) {
        var ch = lines[r][c];
        var counter = 0;
        if (ch === "s") {
          shx = r;
          shy = c;
          ch = "h"; // head
          counter = snakeLength - 1;
        }
        map[r][c] = { status: ch, counter: counter };
      }
    }
    winCondition = numTiles * numTiles - (numTiles * 2) - ((numTiles - 2) * 2);
  }

  /* ── Game tick (mirrors Board.run) ── */
  function tick() {
    if (state !== "playing") return;

    direction = nextDirection;
    hasMoved = false;

    var dr = 0, dc = 0;
    if (direction === "w") { dr = -1; }
    else if (direction === "s") { dr = 1; }
    else if (direction === "a") { dc = -1; }
    else if (direction === "d") { dc = 1; }

    var nr = shx + dr;
    var nc = shy + dc;

    // Peaceful mode: wrap around
    if (peaceful && map[nr] && map[nr][nc] && map[nr][nc].status === "w") {
      if (dr === -1) nr = numTiles - 1;
      else if (dr === 1) nr = 0;
      if (dc === -1) nc = numTiles - 1;
      else if (dc === 1) nc = 0;
    }

    // Collision check
    if (!peaceful) {
      if (!map[nr] || !map[nr][nc] || map[nr][nc].status === "w" || map[nr][nc].status === "s") {
        endGame();
        return;
      }
    } else {
      if (map[nr][nc].status === "s") {
        endGame();
        return;
      }
    }

    // Apple check
    if (map[nr][nc].status === "a") {
      spawnApple = true;
    }

    // Move head
    map[nr][nc].status = "h";
    map[nr][nc].counter = snakeLength - 1;
    if (map[shx][shy].status !== "w") {
      map[shx][shy].status = "s";
    }
    shx = nr;
    shy = nc;

    // Update counters & remove tail (mirrors paintComponent)
    for (var r = 0; r < numTiles; r++) {
      for (var c = 0; c < numTiles; c++) {
        if (map[r][c].status === "s" || map[r][c].status === "h") {
          map[r][c].counter--;
          if (map[r][c].counter < 0) {
            map[r][c].status = "e";
          }
        }
      }
      // Spawn apple after counter updates (per-row, matching Java)
      while (spawnApple) {
        var xa = Math.floor(Math.random() * (numTiles - 2)) + 1;
        var ya = Math.floor(Math.random() * (numTiles - 2)) + 1;
        if (map[xa][ya].status === "e") {
          map[xa][ya].status = "a";
          snakeLength++;

          if (blockFrenzy) {
            var tries = 0;
            while (tries < 200) {
              var xb = Math.floor(Math.random() * (numTiles - 2)) + 1;
              var yb = Math.floor(Math.random() * (numTiles - 2)) + 1;
              if (map[xb][yb].status === "e") {
                map[xb][yb].status = "w";
                break;
              }
              tries++;
            }
          }
          spawnApple = false;
        }
      }
    }

    // Re-set head counter (head was decremented above)
    map[shx][shy].counter = snakeLength - 1;
    map[shx][shy].status = "h";

    // Win check
    if (snakeLength >= winCondition) {
      gameOverText = "YOU WON";
      state = "gameover";
      clearInterval(loop);
      draw();
      setTimeout(showMenu, 2500);
      return;
    }

    draw();
  }

  function endGame() {
    gameOverText = "YOU LOST";
    state = "gameover";
    clearInterval(loop);
    draw();
    setTimeout(showMenu, 2500);
  }

  function showMenu() {
    state = "menu";
    selectedMap = null;
    selectedSpeed = null;
    selectedMode = null;
    draw();
  }

  function startGame() {
    if (!selectedMap || !selectedSpeed) return;
    blockFrenzy = (selectedMode === "blockFrenzy");
    peaceful = (selectedMode === "peaceful");
    speed = selectedSpeed === "slow" ? 160 : selectedSpeed === "medium" ? 120 : 80;
    loadMap(selectedMap);
    state = "playing";
    if (loop) clearInterval(loop);
    loop = setInterval(tick, speed);
    draw();
  }

  /* ── Drawing ── */
  var COLORS = {
    wall: "#8B4513",
    empty: "#1a1a1a",
    snake: "#2d8a4e",
    head: "#4fc978",
    apple: "#e63946",
    grid: "rgba(255,255,255,0.03)"
  };

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (state === "menu") drawMenu();
    else if (state === "playing") drawGame();
    else if (state === "gameover") { drawGame(); drawOverlay(); }
  }

  function drawMenu() {
    var s = canvas.width;
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, s, s);

    // Title
    ctx.fillStyle = "#4fc978";
    ctx.font = "bold " + (s * 0.09) + "px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Snake Game", s / 2, s * 0.13);

    // Section labels
    ctx.fillStyle = "rgba(255,255,255,0.4)";
    ctx.font = (s * 0.032) + "px sans-serif";
    ctx.fillText("MAP SIZE", s / 2, buttons.small.y - 6);
    ctx.fillText("SPEED", s / 2, buttons.slow.y - 6);
    ctx.fillText("GAME MODES", s / 2, buttons.blockF.y - 6);

    // Draw buttons
    drawBtn(buttons.small, selectedMap === "small");
    drawBtn(buttons.medium, selectedMap === "medium");
    drawBtn(buttons.large, selectedMap === "large");
    drawBtn(buttons.slow, selectedSpeed === "slow");
    drawBtn(buttons.medSpd, selectedSpeed === "medium");
    drawBtn(buttons.fast, selectedSpeed === "fast");
    drawBtn(buttons.blockF, selectedMode === "blockFrenzy");
    drawBtn(buttons.peace, selectedMode === "peaceful");

    // Start button
    var canStart = selectedMap && selectedSpeed;
    ctx.fillStyle = canStart ? "#4fc978" : "#333";
    var sb = buttons.start;
    ctx.fillRect(sb.x, sb.y, sb.w, sb.h);
    ctx.fillStyle = canStart ? "#000" : "#666";
    ctx.font = "bold " + (sb.h * 0.45) + "px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(sb.label, sb.x + sb.w / 2, sb.y + sb.h * 0.65);
  }

  function drawBtn(b, active) {
    ctx.fillStyle = active ? "#4fc978" : "rgba(255,255,255,0.08)";
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.strokeStyle = "rgba(255,255,255,0.15)";
    ctx.strokeRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = active ? "#000" : "rgba(255,255,255,0.7)";
    ctx.font = (b.h * 0.32) + "px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(b.label, b.x + b.w / 2, b.y + b.h * 0.62);
  }

  function drawGame() {
    for (var r = 0; r < numTiles; r++) {
      for (var c = 0; c < numTiles; c++) {
        var t = map[r][c];
        var x = c * tileSize;
        var y = r * tileSize;

        // Background
        ctx.fillStyle = t.status === "w" ? COLORS.wall : COLORS.empty;
        ctx.fillRect(x, y, tileSize + 0.5, tileSize + 0.5);
        ctx.strokeStyle = COLORS.grid;
        ctx.strokeRect(x, y, tileSize, tileSize);

        if (t.status === "a") {
          ctx.fillStyle = COLORS.apple;
          ctx.beginPath();
          ctx.arc(x + tileSize / 2, y + tileSize / 2, tileSize * 0.4, 0, Math.PI * 2);
          ctx.fill();
        } else if (t.status === "h") {
          ctx.fillStyle = COLORS.head;
          ctx.fillRect(x + 1, y + 1, tileSize - 2, tileSize - 2);
        } else if (t.status === "s") {
          ctx.fillStyle = COLORS.snake;
          ctx.fillRect(x + 1, y + 1, tileSize - 2, tileSize - 2);
        }
      }
    }

    // Score bar
    ctx.fillStyle = "rgba(0,0,0,0.7)";
    ctx.fillRect(0, 0, canvas.width, tileSize * 1.1);
    ctx.fillStyle = "#e63946";
    ctx.font = "bold " + (tileSize * 0.65) + "px monospace";
    ctx.textAlign = "left";
    ctx.fillText("Score: " + snakeLength + "/" + winCondition, tileSize * 0.4, tileSize * 0.78);

    var modeLabel = blockFrenzy ? "BLOCK FRENZY" : peaceful ? "PEACEFUL" : "";
    if (modeLabel) {
      ctx.fillStyle = "rgba(255,255,255,0.4)";
      ctx.font = (tileSize * 0.5) + "px monospace";
      ctx.textAlign = "right";
      ctx.fillText(modeLabel, canvas.width - tileSize * 0.4, tileSize * 0.78);
    }
  }

  function drawOverlay() {
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = gameOverText === "YOU WON" ? "#4fc978" : "#e63946";
    ctx.font = "bold " + (canvas.width * 0.1) + "px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(gameOverText, canvas.width / 2, canvas.height / 2);
  }

  /* ── Input: direction (mirrors Main.keyTyped with WASD) ── */
  function setDirection(d) {
    if (hasMoved) return;
    if (d === "w" && direction !== "s") { nextDirection = "w"; hasMoved = true; }
    else if (d === "a" && direction !== "d") { nextDirection = "a"; hasMoved = true; }
    else if (d === "s" && direction !== "w") { nextDirection = "s"; hasMoved = true; }
    else if (d === "d" && direction !== "a") { nextDirection = "d"; hasMoved = true; }
  }

  function onKeyDown(e) {
    if (state !== "playing") return;
    switch (e.key) {
      case "w": case "ArrowUp":    setDirection("w"); e.preventDefault(); break;
      case "a": case "ArrowLeft":  setDirection("a"); e.preventDefault(); break;
      case "s": case "ArrowDown":  setDirection("s"); e.preventDefault(); break;
      case "d": case "ArrowRight": setDirection("d"); e.preventDefault(); break;
    }
  }

  /* ── Click/tap handling for menu ── */
  function handleClick(px, py) {
    if (state === "menu") {
      if (hit(px, py, buttons.small))  selectedMap = "small";
      else if (hit(px, py, buttons.medium)) selectedMap = "medium";
      else if (hit(px, py, buttons.large))  selectedMap = "large";
      else if (hit(px, py, buttons.slow))   selectedSpeed = "slow";
      else if (hit(px, py, buttons.medSpd)) selectedSpeed = "medium";
      else if (hit(px, py, buttons.fast))   selectedSpeed = "fast";
      else if (hit(px, py, buttons.blockF)) {
        selectedMode = selectedMode === "blockFrenzy" ? null : "blockFrenzy";
      }
      else if (hit(px, py, buttons.peace)) {
        selectedMode = selectedMode === "peaceful" ? null : "peaceful";
      }
      else if (hit(px, py, buttons.start)) { startGame(); return; }
      draw();
    }
  }

  function hit(px, py, b) {
    return px >= b.x && px <= b.x + b.w && py >= b.y && py <= b.y + b.h;
  }

  function onClick(e) {
    var rect = canvas.getBoundingClientRect();
    var scaleX = canvas.width / rect.width;
    var scaleY = canvas.height / rect.height;
    handleClick((e.clientX - rect.left) * scaleX, (e.clientY - rect.top) * scaleY);
  }

  /* ── Touch swipe for gameplay ── */
  var touchStart = null;
  function onTouchStart(e) {
    if (state === "playing") {
      touchStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
  }
  function onTouchEnd(e) {
    if (state !== "playing" || !touchStart) return;
    var dx = e.changedTouches[0].clientX - touchStart.x;
    var dy = e.changedTouches[0].clientY - touchStart.y;
    if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
    if (Math.abs(dx) > Math.abs(dy)) {
      setDirection(dx > 0 ? "d" : "a");
    } else {
      setDirection(dy > 0 ? "s" : "w");
    }
    touchStart = null;
  }

  function onResize() { resize(); }

  return {
    init: function () {
      canvas = document.getElementById("snake-demo");
      if (!canvas) return;
      ctx = canvas.getContext("2d");
      active = true;
      state = "menu";
      selectedMap = null;
      selectedSpeed = null;
      selectedMode = null;
      document.addEventListener("keydown", onKeyDown);
      canvas.addEventListener("click", onClick);
      canvas.addEventListener("touchstart", onTouchStart);
      canvas.addEventListener("touchend", onTouchEnd);
      window.addEventListener("resize", onResize);
      resize();
      draw();
    },
    destroy: function () {
      active = false;
      if (loop) clearInterval(loop);
      loop = null;
      state = "menu";
      document.removeEventListener("keydown", onKeyDown);
      if (canvas) {
        canvas.removeEventListener("click", onClick);
        canvas.removeEventListener("touchstart", onTouchStart);
        canvas.removeEventListener("touchend", onTouchEnd);
      }
      window.removeEventListener("resize", onResize);
    }
  };
})();

