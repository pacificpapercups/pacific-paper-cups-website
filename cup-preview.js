/* Pacific Paper Cups | live cup preview
   Logo and text are separate layers wrapped around the blank cup photo.
   Drag either one on the cup, or use the controls. Everything runs in the browser. */
(function () {
  "use strict";

  var root = document.getElementById("cupPreview");
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
  var sizeBtns = $$("[data-oz]");
  var ozTag = $(".stage-tag b");
  var stageCup = $(".stage-cup");
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

  /* Cup geometry measured from images/cup-blank.png (1000 x 1000) */
  var W = 1000, H = 1000;
  var TOP = 285, BOTTOM = 770;
  function leftAt(y) { return 284 + (y - 271) * 0.088; }
  function rightAt(y) { return 714 - (y - 271) * 0.126; }
  function cxAt(y) { return (leftAt(y) + rightAt(y)) / 2; }
  function rAt(y) { return (rightAt(y) - leftAt(y)) / 2; }
  var MAX_THETA = 1.25;

  canvas.width = overlay.width = W;
  canvas.height = overlay.height = H;

  var cupImg = new Image();
  var cupData = null;
  var oz = "12 oz";
  var scaleFor = { "8 oz": 0.86, "12 oz": 0.94, "14 oz": 1 };
  var textColor = "#0e2a4f";
  var uploaded = null;
  var placeholder = null;
  var logoOn = true;
  var active = "logo";

  /* Each layer: pixels, center angle around the cup, vertical center (0 to 1), and its drawn bounds */
  var layers = {
    logo: { pix: null, theta: 0, v: 0.36, box: null },
    text: { pix: null, theta: 0, v: 0.7, box: null }
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
    var k = Math.min(1, (maxSide || 700) / Math.max(w, h));
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
    layers.logo.pix = src ? toPixels(src, 700) : null;
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

  /* Size of a layer on the cup: half angle and height in canvas px */
  function geometry(name) {
    var L = layers[name], p = L.pix;
    var span = BOTTOM - TOP;
    var yc = TOP + span * L.v;
    var r = rAt(yc);
    var half, h;
    if (name === "logo") {
      half = (logoSizeInput.value / 100) * (Math.PI / 2) * 0.82;
      h = 2 * half * r * (p.h / p.w);
      if (h > span * 0.9) { half *= (span * 0.9) / h; h = span * 0.9; }
    } else {
      h = textSizeInput.value * 1.5;
      half = (h * (p.w / p.h)) / (2 * r);
    }
    return { yc: yc, h: h, half: half };
  }

  /* ---------- rendering ---------- */
  function paint(o, cup, name) {
    var L = layers[name], p = L.pix;
    if (!p) { L.box = null; return; }
    var gm = geometry(name);
    var y0 = gm.yc - gm.h / 2, y1 = gm.yc + gm.h / 2;
    var minX = Infinity, maxX = -Infinity;

    for (var y = Math.max(TOP, Math.floor(y0)); y < Math.min(BOTTOM, Math.ceil(y1)); y++) {
      var v = (y - y0) / gm.h;
      if (v < 0 || v >= 1) continue;
      var ly = Math.min(p.h - 1, Math.floor(v * p.h));
      var cx = cxAt(y), r = rAt(y);
      for (var x = Math.ceil(cx - r); x < cx + r; x++) {
        var sN = (x - cx) / r;
        if (sN <= -1 || sN >= 1) continue;
        var u = 0.5 + (Math.asin(sN) - L.theta) / (2 * gm.half);
        if (u < 0 || u >= 1) continue;
        var lx = Math.min(p.w - 1, Math.floor(u * p.w));
        var li = (ly * p.w + lx) * 4;
        var la = p.d[li + 3] / 255;
        if (la <= 0) continue;
        var ci = (y * W + x) * 4;
        if (cup[ci + 3] < 200) continue;
        var edge = Math.min(1, (1 - Math.abs(sN)) / 0.08);
        var a = la * edge * 0.96;
        for (var c = 0; c < 3; c++) {
          /* multiply: ink takes on the cup's lighting, white areas disappear into the paper */
          var printed = cup[ci + c] * Math.pow(p.d[li + c] / 255, 0.92);
          o[ci + c] = o[ci + c] * (1 - a) + printed * a;
        }
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
      }
    }
    L.box = isFinite(minX) ? { x0: minX, x1: maxX, y0: Math.max(TOP, y0), y1: Math.min(BOTTOM, y1) } : null;
  }

  function render() {
    if (!cupData) return;
    var out = ctx.createImageData(W, H);
    out.data.set(cupData);
    paint(out.data, cupData, "logo");
    paint(out.data, cupData, "text");
    ctx.putImageData(out, 0, 0);
    drawOverlay();
  }

  var hover = null, dragging = null;
  /* No boxes or outlines: only a small label while something is being dragged */
  function drawOverlay() {
    octx.clearRect(0, 0, W, H);
    if (!dragging) return;
    var b = layers[dragging].box;
    if (!b) return;
    octx.save();
    octx.font = "600 22px Inter, Arial, sans-serif";
    var label = dragging === "logo" ? "LOGO" : "TEXT";
    var tw = octx.measureText(label).width + 16;
    var x = (b.x0 + b.x1) / 2 - tw / 2;
    var y = Math.max(TOP - 40, b.y0 - 40);
    octx.fillStyle = "rgba(11,19,32,0.85)";
    octx.fillRect(x, y, tw, 30);
    octx.fillStyle = "#fff";
    octx.fillText(label, x + 8, y + 22);
    octx.restore();
  }

  var pending = false;
  function queue() {
    if (pending) return;
    pending = true;
    requestAnimationFrame(function () { pending = false; render(); });
  }

  /* ---------- cup photo ---------- */
  cupImg.onload = function () {
    var c = document.createElement("canvas");
    c.width = W; c.height = H;
    var g = c.getContext("2d");
    g.drawImage(cupImg, 0, 0, W, H);
    try {
      cupData = g.getImageData(0, 0, W, H).data;
    } catch (err) {
      ctx.drawImage(cupImg, 0, 0, W, H);
      return;
    }
    render();
  };
  cupImg.src = window.PPC_CUP_IMAGE || "images/cup-blank.png";

  /* ---------- selecting and moving layers ---------- */
  function setActive(name) {
    active = name;
    layerBtns.forEach(function (b) { b.setAttribute("aria-pressed", b.dataset.layer === name ? "true" : "false"); });
    syncSliders();
    drawOverlay();
  }
  function syncSliders() {
    var L = layers[active];
    moveX.value = Math.round((L.theta / MAX_THETA) * 60);
    moveY.value = Math.round(L.v * 100);
  }
  function clampLayer(L) {
    L.theta = Math.max(-MAX_THETA, Math.min(MAX_THETA, L.theta));
    L.v = Math.max(0, Math.min(1, L.v));
  }

  layerBtns.forEach(function (b) { b.addEventListener("click", function () { setActive(b.dataset.layer); }); });
  moveX.addEventListener("input", function () { layers[active].theta = (moveX.value / 60) * MAX_THETA; queue(); });
  moveY.addEventListener("input", function () { layers[active].v = moveY.value / 100; queue(); });
  centerBtn.addEventListener("click", function () { layers[active].theta = 0; syncSliders(); render(); });

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
  overlay.addEventListener("pointerdown", function (e) {
    var pt = toCanvas(e);
    var name = hit(pt);
    if (!name) return;
    e.preventDefault();
    overlay.setPointerCapture(e.pointerId);
    setActive(name);
    dragging = name;
    var L = layers[name];
    start = { x: pt.x, y: pt.y, theta: L.theta, v: L.v };
    stageCup.classList.add("dragging");
  });
  overlay.addEventListener("pointermove", function (e) {
    var pt = toCanvas(e);
    if (dragging) {
      var L = layers[dragging];
      var r = rAt(TOP + (BOTTOM - TOP) * start.v);
      L.theta = start.theta + (pt.x - start.x) / r;
      L.v = start.v + (pt.y - start.y) / (BOTTOM - TOP);
      clampLayer(L);
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
    stageCup.classList.remove("dragging");
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
      stageCup.classList.remove("pop"); void stageCup.offsetWidth; stageCup.classList.add("pop");
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

  /* ---------- cup size, quote, download, reset ---------- */
  sizeBtns.forEach(function (b) {
    b.addEventListener("click", function () {
      sizeBtns.forEach(function (x) { x.setAttribute("aria-pressed", "false"); });
      b.setAttribute("aria-pressed", "true");
      oz = b.dataset.oz;
      ozTag.textContent = oz.toUpperCase();
      stageCup.style.setProperty("--cup-scale", scaleFor[oz]);
      updateQuote();
    });
  });

  function updateQuote() {
    var q = "contact.html?product=cups&size=" + encodeURIComponent(oz) + "&preview=1";
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
    g.drawImage(canvas, 100, 60, 1000, 1000);
    g.fillStyle = "#0b1320";
    g.font = "600 30px Inter, Arial, sans-serif";
    g.fillText("Custom Paper Cup  |  " + oz, 60, 1130);
    g.textAlign = "right";
    g.fillStyle = "#5f6878";
    g.fillText("Pacific Paper Cups preview", 1140, 1130);
    return out;
  }
  dlBtn.addEventListener("click", function () {
    var out = mockup();
    var a = document.createElement("a");
    a.download = "cup-preview-" + oz.replace(" ", "") + ".png";
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
        product: "cups",
        size: oz.replace(" ", ""),
        logo: uploadedFile,
        preview: blob,
        details: {
          item: oz + " cup",
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
    logoSizeInput.value = 50;
    textInput.value = "";
    textSizeInput.value = 40;
    fontSelect.selectedIndex = 0;
    textColor = "#0e2a4f";
    colorInput.value = textColor;
    swatches.forEach(function (x, i) { x.setAttribute("aria-pressed", i === 0 ? "true" : "false"); });
    layers.logo.theta = 0; layers.logo.v = 0.36;
    layers.text.theta = 0; layers.text.v = 0.7;
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
