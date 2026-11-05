/* Pacific Paper Cups | live kraft bag preview
   Logo and text are separate layers printed onto the front panel of the plain bag photo.
   Drag either one on the bag, or use the controls. Everything runs in the browser. */
(function () {
  "use strict";

  var root = document.getElementById("bagPreview");
  if (!root) return;

  function $(sel) { return root.querySelector(sel); }
  function $$(sel) { return root.querySelectorAll(sel); }

  var canvas = $(".cup-canvas");
  var overlay = $(".cup-overlay");
  var ctx = canvas.getContext("2d", { willReadFrequently: true });
  var octx = overlay.getContext("2d");
  var fileInput = $("#logoFile");
  var drop = $(".dropzone");
  var dropName = $(".dropzone-name");
  var logoSizeInput = $("#logoSize");
  var removeLogoBtn = $("#removeLogo");
  var textInput = $("#cupText");
  var fontSelect = $("#cupFont");
  var textSizeInput = $("#textSize");
  var colorInput = $("#textColor");
  var swatches = $$("[data-color]");
  var layerBtns = $$("[data-layer]");
  var moveX = $("#moveX");
  var moveY = $("#moveY");
  var centerBtn = $("#centerLayer");
  var sizeBtns = $$("[data-bag]");
  var sizeTag = $(".stage-tag b");
  var stageBag = $(".stage-cup");
  var quoteBtn = $("#previewQuote");
  var dlBtn = $("#previewDownload");
  var cartBtn = $("#previewCart");
  var cartHint = $("#previewCartHint");
  var uploadedFile = null;
  var resetBtn = $("#previewReset");

  /* Extra display fonts for the text option */
  var fontLink = document.createElement("link");
  fontLink.rel = "stylesheet";
  fontLink.href = "https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=Oswald:wght@600&family=Dancing+Script:wght@700&family=Pacifico&family=Montserrat:wght@800&display=swap";
  document.head.appendChild(fontLink);

  /* Canvas is 1200 x 1200. The bag photo is 600 x 600, so measured points are doubled. */
  var W = 1200, H = 1200, K = W / 600;
  /* Front panel corners measured from images/kraft-bag-plain.png */
  var Q = [
    [196 * K, 184 * K], /* top left */
    [450 * K, 182 * K], /* top right */
    [449 * K, 517 * K], /* bottom right */
    [196 * K, 543 * K]  /* bottom left */
  ];
  var FACE_W = 254, FACE_H = 345; /* rough panel size in photo px, for keeping artwork proportions */
  var PAD = 0.06; /* keep artwork off the panel edges */

  /* Projective map from the unit square (s, t) to the panel quad, plus its inverse */
  function squareToQuad(q) {
    var x0 = q[0][0], y0 = q[0][1], x1 = q[1][0], y1 = q[1][1];
    var x2 = q[2][0], y2 = q[2][1], x3 = q[3][0], y3 = q[3][1];
    var sx = x0 - x1 + x2 - x3, sy = y0 - y1 + y2 - y3;
    var dx1 = x1 - x2, dx2 = x3 - x2, dy1 = y1 - y2, dy2 = y3 - y2;
    var den = dx1 * dy2 - dx2 * dy1;
    var g = (sx * dy2 - dx2 * sy) / den;
    var h = (dx1 * sy - sx * dy1) / den;
    return [
      x1 - x0 + g * x1, x3 - x0 + h * x3, x0,
      y1 - y0 + g * y1, y3 - y0 + h * y3, y0,
      g, h, 1
    ];
  }
  function invert(m) {
    var a = m[0], b = m[1], c = m[2], d = m[3], e = m[4], f = m[5], g = m[6], h = m[7], i = m[8];
    var A = e * i - f * h, B = c * h - b * i, C = b * f - c * e;
    var D = f * g - d * i, E = a * i - c * g, F = c * d - a * f;
    var G = d * h - e * g, Hh = b * g - a * h, I = a * e - b * d;
    var det = a * A + b * D + c * G;
    return [A / det, B / det, C / det, D / det, E / det, F / det, G / det, Hh / det, I / det];
  }
  var M = squareToQuad(Q), Minv = invert(M);
  function fwd(s, t) {
    var w = M[6] * s + M[7] * t + M[8];
    return [(M[0] * s + M[1] * t + M[2]) / w, (M[3] * s + M[4] * t + M[5]) / w];
  }

  canvas.width = overlay.width = W;
  canvas.height = overlay.height = H;

  var bagImg = new Image();
  var bagData = null;
  var bagSize = "Medium";
  var scaleFor = { "Small": 0.86, "Medium": 0.93, "Large": 1 };
  var textColor = "#0e2a4f";
  var uploaded = null;
  var placeholder = null;
  var logoOn = true;
  var active = "logo";

  /* Each layer: pixels, horizontal center (0 to 1 across the panel), vertical center (0 to 1), drawn bounds */
  var layers = {
    logo: { pix: null, u: 0.5, v: 0.4, box: null },
    text: { pix: null, u: 0.5, v: 0.78, box: null }
  };

  function defaultLogo() {
    var c = document.createElement("canvas");
    c.width = 640; c.height = 420;
    var g = c.getContext("2d");
    g.strokeStyle = "#0e2a4f"; g.lineWidth = 10;
    g.beginPath(); g.arc(320, 150, 100, 0, Math.PI * 2); g.stroke();
    g.fillStyle = "#c49a5c";
    g.beginPath(); g.arc(320, 150, 62, 0, Math.PI * 2); g.fill();
    g.fillStyle = "#0e2a4f";
    g.textAlign = "center";
    g.font = "800 84px Archivo, 'Helvetica Neue', Arial, sans-serif";
    g.fillText("YOUR LOGO", 320, 360);
    return c;
  }

  function toPixels(src, maxSide) {
    var w = src.width, h = src.height;
    var k = Math.min(1, (maxSide || 800) / Math.max(w, h));
    var c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(w * k));
    c.height = Math.max(1, Math.round(h * k));
    var g = c.getContext("2d");
    g.drawImage(src, 0, 0, c.width, c.height);
    return { w: c.width, h: c.height, d: g.getImageData(0, 0, c.width, c.height).data };
  }

  /* ---------- building layers ---------- */
  function buildLogo() {
    var src = uploaded || (logoOn ? (placeholder = placeholder || defaultLogo()) : null);
    layers.logo.pix = src ? toPixels(src, 800) : null;
  }

  function buildText() {
    var text = textInput.value.trim();
    if (!text) { layers.text.pix = null; return; }
    var font = fontSelect.value.replace("{px}", 160);
    var c = document.createElement("canvas");
    var g = c.getContext("2d");
    g.font = font;
    var m = g.measureText(text);
    c.width = Math.ceil(m.width + 60);
    c.height = 230;
    g = c.getContext("2d");
    g.font = font;
    g.fillStyle = textColor;
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText(text, c.width / 2, c.height / 2);
    layers.text.pix = toPixels(c, 1400);
  }

  /* Size of a layer on the panel, in panel units (0 to 1) */
  function geometry(name) {
    var L = layers[name], p = L.pix;
    var ws, hs;
    if (name === "logo") {
      ws = (logoSizeInput.value / 100) * (1 - 2 * PAD);
    } else {
      hs = textSizeInput.value / 100 * 0.16;
      ws = hs * (p.w / p.h) * (FACE_H / FACE_W);
    }
    if (ws > 1 - 2 * PAD) ws = 1 - 2 * PAD;
    hs = ws * (p.h / p.w) * (FACE_W / FACE_H);
    if (hs > 1 - 2 * PAD) { ws *= (1 - 2 * PAD) / hs; hs = 1 - 2 * PAD; }
    return { ws: ws, hs: hs };
  }

  /* Keep a layer's center so the artwork stays on the panel */
  function clampLayer(name) {
    var L = layers[name];
    if (!L.pix) return;
    var gm = geometry(name);
    var minU = PAD + gm.ws / 2, maxU = 1 - PAD - gm.ws / 2;
    var minV = PAD + gm.hs / 2, maxV = 1 - PAD - gm.hs / 2;
    L.u = minU > maxU ? 0.5 : Math.max(minU, Math.min(maxU, L.u));
    L.v = minV > maxV ? 0.5 : Math.max(minV, Math.min(maxV, L.v));
  }

  /* ---------- rendering ---------- */
  function paint(o, bag, name) {
    var L = layers[name], p = L.pix;
    if (!p) { L.box = null; return; }
    clampLayer(name);
    var gm = geometry(name);
    var s0 = L.u - gm.ws / 2, t0 = L.v - gm.hs / 2;
    var corners = [fwd(s0, t0), fwd(s0 + gm.ws, t0), fwd(s0 + gm.ws, t0 + gm.hs), fwd(s0, t0 + gm.hs)];
    var bx0 = W, bx1 = 0, by0 = H, by1 = 0;
    corners.forEach(function (c) {
      bx0 = Math.min(bx0, c[0]); bx1 = Math.max(bx1, c[0]);
      by0 = Math.min(by0, c[1]); by1 = Math.max(by1, c[1]);
    });
    bx0 = Math.max(0, Math.floor(bx0)); by0 = Math.max(0, Math.floor(by0));
    bx1 = Math.min(W - 1, Math.ceil(bx1)); by1 = Math.min(H - 1, Math.ceil(by1));

    for (var y = by0; y <= by1; y++) {
      for (var x = bx0; x <= bx1; x++) {
        var w = Minv[6] * x + Minv[7] * y + Minv[8];
        var s = (Minv[0] * x + Minv[1] * y + Minv[2]) / w;
        var t = (Minv[3] * x + Minv[4] * y + Minv[5]) / w;
        var u = (s - s0) / gm.ws, v = (t - t0) / gm.hs;
        if (u < 0 || u >= 1 || v < 0 || v >= 1) continue;
        var li = (Math.floor(v * p.h) * p.w + Math.floor(u * p.w)) * 4;
        var la = p.d[li + 3] / 255;
        if (la <= 0) continue;
        var ci = (y * W + x) * 4;
        var a = la * 0.94;
        for (var c = 0; c < 3; c++) {
          /* multiply: ink takes on the kraft color and lighting, white areas disappear into the paper */
          var printed = bag[ci + c] * Math.pow(p.d[li + c] / 255, 0.92);
          o[ci + c] = o[ci + c] * (1 - a) + printed * a;
        }
      }
    }
    L.box = { x0: bx0, x1: bx1, y0: by0, y1: by1 };
  }

  function render() {
    if (!bagData) return;
    var out = ctx.createImageData(W, H);
    out.data.set(bagData);
    paint(out.data, bagData, "logo");
    paint(out.data, bagData, "text");
    ctx.putImageData(out, 0, 0);
    drawOverlay();
  }

  var hover = null, dragging = null;
  function drawOverlay() {
    octx.clearRect(0, 0, W, H);
    if (!dragging) return;
    var b = layers[dragging].box;
    if (!b) return;
    octx.save();
    octx.font = "600 26px Inter, Arial, sans-serif";
    var label = dragging === "logo" ? "LOGO" : "TEXT";
    var tw = octx.measureText(label).width + 18;
    var x = (b.x0 + b.x1) / 2 - tw / 2;
    var y = b.y0 - 44;
    octx.fillStyle = "rgba(11,19,32,0.85)";
    octx.fillRect(x, y, tw, 34);
    octx.fillStyle = "#fff";
    octx.fillText(label, x + 9, y + 25);
    octx.restore();
  }

  var pending = false;
  function queue() {
    if (pending) return;
    pending = true;
    requestAnimationFrame(function () { pending = false; render(); });
  }

  /* ---------- bag photo ---------- */
  bagImg.onload = function () {
    var c = document.createElement("canvas");
    c.width = W; c.height = H;
    var g = c.getContext("2d");
    g.imageSmoothingQuality = "high";
    g.drawImage(bagImg, 0, 0, W, H);
    try {
      bagData = g.getImageData(0, 0, W, H).data;
    } catch (err) {
      ctx.drawImage(bagImg, 0, 0, W, H);
      return;
    }
    render();
  };
  bagImg.src = window.PPC_BAG_IMAGE || "images/kraft-bag-plain.png";

  /* ---------- selecting and moving layers ---------- */
  function setActive(name) {
    active = name;
    layerBtns.forEach(function (b) { b.setAttribute("aria-pressed", b.dataset.layer === name ? "true" : "false"); });
    syncSliders();
    drawOverlay();
  }
  function syncSliders() {
    var L = layers[active];
    moveX.value = Math.round((L.u - 0.5) * 100);
    moveY.value = Math.round(L.v * 100);
  }

  layerBtns.forEach(function (b) { b.addEventListener("click", function () { setActive(b.dataset.layer); }); });
  moveX.addEventListener("input", function () { layers[active].u = 0.5 + moveX.value / 100; queue(); });
  moveY.addEventListener("input", function () { layers[active].v = moveY.value / 100; queue(); });
  centerBtn.addEventListener("click", function () { layers[active].u = 0.5; syncSliders(); render(); });

  function toCanvas(e) {
    var r = overlay.getBoundingClientRect();
    return { x: (e.clientX - r.left) * (W / r.width), y: (e.clientY - r.top) * (H / r.height) };
  }
  function hit(pt) {
    var order = ["text", "logo"];
    for (var i = 0; i < order.length; i++) {
      var b = layers[order[i]].box;
      if (b && pt.x >= b.x0 - 14 && pt.x <= b.x1 + 14 && pt.y >= b.y0 - 14 && pt.y <= b.y1 + 14) return order[i];
    }
    return null;
  }

  var start = null;
  var PANEL_W = Q[1][0] - Q[0][0], PANEL_H = Q[3][1] - Q[0][1];
  overlay.addEventListener("pointerdown", function (e) {
    var pt = toCanvas(e);
    var name = hit(pt);
    if (!name) return;
    e.preventDefault();
    overlay.setPointerCapture(e.pointerId);
    setActive(name);
    dragging = name;
    var L = layers[name];
    start = { x: pt.x, y: pt.y, u: L.u, v: L.v };
    stageBag.classList.add("dragging");
  });
  overlay.addEventListener("pointermove", function (e) {
    var pt = toCanvas(e);
    if (dragging) {
      var L = layers[dragging];
      L.u = start.u + (pt.x - start.x) / PANEL_W;
      L.v = start.v + (pt.y - start.y) / PANEL_H;
      clampLayer(dragging);
      syncSliders();
      queue();
      return;
    }
    var h = hit(pt);
    if (h !== hover) { hover = h; drawOverlay(); }
    overlay.style.cursor = h ? "grab" : "default";
  });
  function endDrag() {
    if (!dragging) return;
    dragging = null;
    stageBag.classList.remove("dragging");
    drawOverlay();
  }
  overlay.addEventListener("pointerup", endDrag);
  overlay.addEventListener("pointercancel", endDrag);
  overlay.addEventListener("pointerleave", function () { if (!dragging && hover) { hover = null; drawOverlay(); } });

  /* ---------- logo controls ---------- */
  function loadFile(file) {
    if (!file || !/^image\//.test(file.type)) {
      dropName.textContent = "Please choose a PNG, JPG, or SVG image";
      return;
    }
    var url = URL.createObjectURL(file);
    var img = new Image();
    img.onload = function () {
      var w = img.naturalWidth || 600, h = img.naturalHeight || 600;
      var k = Math.min(1, 900 / Math.max(w, h));
      uploaded = document.createElement("canvas");
      uploaded.width = Math.round(w * k); uploaded.height = Math.round(h * k);
      uploaded.getContext("2d").drawImage(img, 0, 0, uploaded.width, uploaded.height);
      URL.revokeObjectURL(url);
      uploadedFile = file;
      syncCartBtn();
      logoOn = true;
      dropName.textContent = file.name;
      root.classList.add("has-logo");
      buildLogo();
      setActive("logo");
      render();
      stageBag.classList.remove("pop"); void stageBag.offsetWidth; stageBag.classList.add("pop");
    };
    img.onerror = function () { dropName.textContent = "That file couldn't be read. Try a PNG or JPG."; };
    img.src = url;
  }

  fileInput.addEventListener("change", function () { loadFile(fileInput.files[0]); });
  ["dragenter", "dragover"].forEach(function (ev) {
    drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.add("over"); });
  });
  ["dragleave", "drop"].forEach(function (ev) {
    drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.remove("over"); });
  });
  drop.addEventListener("drop", function (e) { loadFile(e.dataTransfer.files[0]); });

  logoSizeInput.addEventListener("input", queue);
  removeLogoBtn.addEventListener("click", function () {
    uploaded = null;
    uploadedFile = null;
    syncCartBtn();
    logoOn = false;
    fileInput.value = "";
    dropName.textContent = "No logo";
    root.classList.remove("has-logo");
    buildLogo();
    if (layers.text.pix) setActive("text");
    render();
  });

  /* ---------- text controls ---------- */
  function rebuildText() {
    var text = textInput.value.trim();
    var had = !!layers.text.pix;
    function go() {
      buildText();
      if (!had && layers.text.pix) setActive("text");
      render();
    }
    if (text && document.fonts && document.fonts.load) {
      document.fonts.load(fontSelect.value.replace("{px}", 60), text).then(go, go);
    } else {
      go();
    }
  }
  textInput.addEventListener("input", function () { rebuildText(); updateQuote(); });
  fontSelect.addEventListener("change", function () { rebuildText(); updateQuote(); });
  textSizeInput.addEventListener("input", queue);
  colorInput.addEventListener("input", function () {
    textColor = colorInput.value;
    swatches.forEach(function (x) { x.setAttribute("aria-pressed", "false"); });
    buildText(); queue(); updateQuote();
  });
  swatches.forEach(function (b) {
    b.addEventListener("click", function () {
      swatches.forEach(function (x) { x.setAttribute("aria-pressed", "false"); });
      b.setAttribute("aria-pressed", "true");
      textColor = b.dataset.color;
      colorInput.value = textColor;
      buildText(); render(); updateQuote();
    });
  });

  /* ---------- bag size, quote, download, reset ---------- */
  sizeBtns.forEach(function (b) {
    b.addEventListener("click", function () {
      sizeBtns.forEach(function (x) { x.setAttribute("aria-pressed", "false"); });
      b.setAttribute("aria-pressed", "true");
      bagSize = b.dataset.bag;
      sizeTag.textContent = bagSize.toUpperCase();
      stageBag.style.setProperty("--cup-scale", scaleFor[bagSize]);
      updateQuote();
    });
  });

  function updateQuote() {
    var q = "contact.html?product=bags&kind=bag&size=" + encodeURIComponent(bagSize.toLowerCase()) + "&preview=1";
    var t = textInput.value.trim();
    if (t) {
      q += "&text=" + encodeURIComponent(t) +
        "&font=" + encodeURIComponent(fontSelect.options[fontSelect.selectedIndex].text) +
        "&color=" + encodeURIComponent(textColor);
    }
    quoteBtn.href = q;
  }

  function mockup() {
    var out = document.createElement("canvas");
    out.width = 1200; out.height = 1200;
    var g = out.getContext("2d");
    g.fillStyle = "#f3f1ec"; g.fillRect(0, 0, 1200, 1200);
    g.drawImage(canvas, 100, 40, 1000, 1000);
    g.fillStyle = "#0b1320";
    g.font = "600 30px Inter, Arial, sans-serif";
    g.fillText("Kraft Paper Bag  |  " + bagSize, 60, 1130);
    g.textAlign = "right";
    g.fillStyle = "#5f6878";
    g.fillText("Pacific Paper Cups preview", 1140, 1130);
    return out;
  }
  dlBtn.addEventListener("click", function () {
    var out = mockup();
    var a = document.createElement("a");
    a.download = "bag-preview-" + bagSize.toLowerCase() + ".png";
    a.href = out.toDataURL("image/png");
    document.body.appendChild(a); a.click(); a.remove();
  });

  function syncCartBtn() {
    if (!cartBtn) return;
    cartBtn.disabled = !uploadedFile;
    if (cartHint) cartHint.textContent = uploadedFile
      ? "Adds 1 case with custom print. Your logo file and this mockup are saved with the item."
      : "Upload your logo to add this design to your cart. It adds 1 case with custom print, and you can change the quantity in your cart.";
  }
  if (cartBtn) cartBtn.addEventListener("click", function () {
    if (!uploadedFile || !window.PPCShop) return;
    cartBtn.disabled = true;
    var t = textInput.value.trim();
    mockup().toBlob(function (blob) {
      window.PPCShop.addDesign({
        product: "bags",
        size: bagSize.toLowerCase(),
        logo: uploadedFile,
        preview: blob,
        details: {
          item: bagSize + " bag",
          text: t,
          font: t ? fontSelect.options[fontSelect.selectedIndex].text : "",
          color: t ? textColor : "",
          placement: ""
        }
      }).then(syncCartBtn, syncCartBtn);
    }, "image/png");
  });

  function reset() {
    uploaded = null;
    uploadedFile = null;
    syncCartBtn();
    logoOn = true;
    fileInput.value = "";
    dropName.textContent = "No file chosen";
    root.classList.remove("has-logo");
    logoSizeInput.value = 60;
    textInput.value = "";
    textSizeInput.value = 40;
    fontSelect.selectedIndex = 0;
    textColor = "#0e2a4f";
    colorInput.value = textColor;
    swatches.forEach(function (x, i) { x.setAttribute("aria-pressed", i === 0 ? "true" : "false"); });
    layers.logo.u = 0.5; layers.logo.v = 0.4;
    layers.text.u = 0.5; layers.text.v = 0.78;
    buildLogo();
    buildText();
    setActive("logo");
    render();
    updateQuote();
  }
  resetBtn.addEventListener("click", reset);

  reset();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { buildLogo(); buildText(); render(); });
})();
