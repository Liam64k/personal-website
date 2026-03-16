// ── Interactive D3.js Globe with real continent shapes ──
// Uses D3 orthographic projection + TopoJSON world data for smooth land shapes.

(function () {
  const container = document.getElementById("globe-container");
  if (!container) return;

  // ── visited locations: [lng, lat, name] (D3 uses [lng, lat]) ──
  const locations = [
    [-114.0719, 51.0447, "Calgary"],
    [-123.3656, 48.4284, "Victoria"],
    [-123.1207, 49.2827, "Vancouver"],
    [-73.5673, 45.5017, "Montreal"],
    [-75.6972, 45.4215, "Ottawa"],
    [-86.8515, 21.1619, "Cancún"],
    [-77.9878, 21.4691, "Cuba"],
    [-68.3725, 18.5601, "Punta Cana"],
    [10.4515, 51.1657, "Germany"],
  ];

  const width = container.clientWidth;
  const height = container.clientHeight;
  const size = Math.min(width, height);

  // ── SVG setup ──
  const svg = d3
    .select(container)
    .append("svg")
    .attr("width", width)
    .attr("height", height);

  // ── projection ──
  const projection = d3
    .geoOrthographic()
    .scale(size * 0.42)
    .translate([width / 2, height / 2])
    .rotate([-30, -20, 0]);

  const path = d3.geoPath().projection(projection);

  // ── graticule (grid lines) ──
  const graticule = d3.geoGraticule10();

  // ── globe background (ocean) ──
  svg
    .append("circle")
    .attr("class", "globe-ocean")
    .attr("cx", width / 2)
    .attr("cy", height / 2)
    .attr("r", projection.scale())
    .attr("fill", "#0a0a14")
    .attr("stroke", "rgba(255,255,255,0.08)")
    .attr("stroke-width", 1);

  // ── graticule lines ──
  const graticulePath = svg
    .append("path")
    .datum(graticule)
    .attr("class", "globe-graticule")
    .attr("d", path)
    .attr("fill", "none")
    .attr("stroke", "rgba(255,255,255,0.06)")
    .attr("stroke-width", 0.5);

  // ── land group ──
  const landGroup = svg.append("g").attr("class", "globe-land");

  // ── marker group ──
  const markerGroup = svg.append("g").attr("class", "globe-markers");

  // ── load world data ──
  fetch("https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json")
    .then((r) => r.json())
    .then((world) => {
      const land = topojson.feature(world, world.objects.land);

      // draw land
      landGroup
        .selectAll("path")
        .data(land.features)
        .enter()
        .append("path")
        .attr("d", path)
        .attr("fill", "rgba(255,255,255,0.12)")
        .attr("stroke", "rgba(255,255,255,0.2)")
        .attr("stroke-width", 0.5);

      // draw markers
      drawMarkers();
      startRotation();
    });

  function drawMarkers() {
    markerGroup.selectAll("*").remove();

    locations.forEach((loc) => {
      const coords = projection(loc);
      if (!coords) return;

      // check if point is on visible side
      const d = d3.geoDistance(loc, projection.invert([width / 2, height / 2]));
      if (d > Math.PI / 2) return;

      // pulse ring
      markerGroup
        .append("circle")
        .attr("cx", coords[0])
        .attr("cy", coords[1])
        .attr("r", 8)
        .attr("fill", "none")
        .attr("stroke", "#ff3333")
        .attr("stroke-width", 1.5)
        .attr("opacity", 0.4)
        .attr("class", "globe-pulse");

      // red dot
      markerGroup
        .append("circle")
        .attr("cx", coords[0])
        .attr("cy", coords[1])
        .attr("r", 4)
        .attr("fill", "#ff3333")
        .attr("stroke", "#ff6666")
        .attr("stroke-width", 1)
        .attr("class", "globe-marker-dot");
    });
  }

  function update() {
    svg.selectAll(".globe-land path").attr("d", path);
    graticulePath.attr("d", path(graticule));
    drawMarkers();
  }

  // ── drag interaction ──
  let isDragging = false;

  const drag = d3
    .drag()
    .on("start", () => {
      isDragging = true;
    })
    .on("drag", (event) => {
      const r = projection.rotate();
      const sensitivity = 0.4;
      projection.rotate([
        r[0] + event.dx * sensitivity,
        Math.max(-60, Math.min(60, r[1] - event.dy * sensitivity)),
        r[2],
      ]);
      update();
    })
    .on("end", () => {
      isDragging = false;
    });

  svg.call(drag);
  svg.style("cursor", "grab");

  // ── auto-rotation ──
  function startRotation() {
    d3.timer(() => {
      if (isDragging) return;
      const r = projection.rotate();
      projection.rotate([r[0] + 0.15, r[1], r[2]]);
      update();
    });
  }

  // ── pulse animation via CSS ──
  // (handled in styles.css)

  // ── resize ──
  window.addEventListener("resize", () => {
    const w = container.clientWidth;
    const h = container.clientHeight;
    const s = Math.min(w, h);
    svg.attr("width", w).attr("height", h);
    projection.scale(s * 0.42).translate([w / 2, h / 2]);
    svg
      .select(".globe-ocean")
      .attr("cx", w / 2)
      .attr("cy", h / 2)
      .attr("r", projection.scale());
    update();
  });
})();
