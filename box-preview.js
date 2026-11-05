/* Pacific Paper Cups | live flat top box preview
   Logo and text are separate layers printed onto the lid or the front panel of the plain box photo.
   Drag either one on the box, or use the controls. Everything runs in the browser. */
(function () {
  "use strict";

  var root = document.getElementById("boxPreview");
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
  var faceBtns = $$("[data-face]");
  var moveX = $("#moveX");
  var moveY = $("#moveY");
  var centerBtn = $("#centerLayer");
  var sizeBtns = $$("[data-box]");
  var sizeTag = $(".stage-tag b");
  var stageBox = $(".stage-cup");
  var quoteBtn = $("#previewQuote");
  var dlBtn = $("#previewDownload");
  var cartBtn = $("#previewCart");
  var cartHint = $("#previewCartHint");
  var uploadedFile = null;
  var resetBtn = $("#previewReset");

  var fontLink = document.createElement("link");
  fontLink.rel = "stylesheet";
  fontLink.href = "https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=Oswald:wght@600&family=Dancing+Script:wght@700&family=Pacifico&family=Montserrat:wght@800&display=swap";
  document.head.appendChild(fontLink);

  /* Photo is images/large-closed.jpg cropped to 1408 x 910 (offset 40, 90). Corners are listed top left, top right, bottom right, bottom left
     as the artwork should read: the top of the lid artwork faces the back of the box. */
  var W = 1408, H = 910;
  var FACES = {
    lid:   { q: [[196, 236], [914, 108], [1258, 266], [479, 466]], aspect: 9 / 5, pad: 0.07 },
    front: { q: [[479, 510], [1254, 320], [1172, 560], [491, 764]], aspect: 9 / 2.4, pad: 0.08 }
  };

  function squareToQuad(q) {
    var x0 = q[0][0], y0 = q[0][1], x1 = q[1][0], y1 = q[1][1];
    var x2 = q[2][0], y2 = q[2][1], x3 = q[3][0], y3 = q[3][1];
    var sx = x0 - x1 + x2 - x3, sy = y0 - y1 + y2 - y3;
    var dx1 = x1 - x2, dx2 = x3 - x2, dy1 = y1 - y2, dy2 = y3 - y2;
    var den = dx1 * dy2 - dx2 * dy1;
    var g = (sx * dy2 - dx2 * sy) / den;
    var h = (dx1 * sy - sx * dy1) / den;
    return [x1 - x0 + g * x1, x3 - x0 + h * x3, x0, y1 - y0 + g * y1, y3 - y0 + h * y3, y0, g, h, 1];
  }
  function invert(m) {
    var a = m[0], b = m[1], c = m[2], d = m[3], e = m[4], f = m[5], g = m[6], h = m[7], i = m[8];
    var A = e * i - f * h, B = c * h - b * i, C = b * f - c * e;
    var D = f * g - d * i, E = a * i - c * g, F = c * d - a * f;
    var G = d * h - e * g, Hh = b * g - a * h, I = a * e - b * d;
    var det = a * A + b * D + c * G;
    return [A / det, B / det, C / det, D / det, E / det, F / det, G / det, Hh / det, I / det];
  }
  Object.keys(FACES).forEach(function (k) {
    var f = FACES[k];
    f.M = squareToQuad(f.q);
    f.Minv = invert(f.M);
  });
  function fwd(f, s, t) {
    var M = f.M, w = M[6] * s + M[7] * t + M[8];
    return [(M[0] * s + M[1] * t + M[2]) / w, (M[3] * s + M[4] * t + M[5]) / w];
  }
  function inv(f, x, y) {
    var m = f.Minv, w = m[6] * x + m[7] * y + m[8];
    return [(m[0] * x + m[1] * y + m[2]) / w, (m[3] * x + m[4] * y + m[5]) / w];
  }

  canvas.width = overlay.width = W;
  canvas.height = overlay.height = H;

  var boxImg = new Image();
  var boxData = null;
  var boxSize = "50 oz";
  var scaleFor = { "50 oz": 0.9, "75 oz": 1 };
  var textColor = "#0e2a4f";
  var uploaded = null;
  var placeholder = null;
  var logoOn = true;
  var active = "logo";

  var layers = {
    logo: { pix: null, face: "lid", u: 0.5, v: 0.5, box: null },
    text: { pix: null, face: "front", u: 0.5, v: 0.55, box: null }
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

  /* Size of a layer on its face, in face units (0 to 1) */
  function geometry(name) {
    var L = layers[name], p = L.pix, f = FACES[L.face];
    var room = 1 - 2 * f.pad, ws, hs;
    if (name === "logo") {
      ws = (logoSizeInput.value / 100) * room;
    } else {
      hs = (textSizeInput.value / 100) * (L.face === "front" ? 0.7 : 0.3);
      ws = hs * (p.w / p.h) / f.aspect;
    }
    if (ws > room) ws = room;
    hs = ws * (p.h / p.w) * f.aspect;
    if (hs > room) { ws *= room / hs; hs = room; }
    return { ws: ws, hs: hs };
  }

  function clampLayer(name) {
    var L = layers[name];
    if (!L.pix) return;
    var f = FACES[L.face], gm = geometry(name);
    var minU = f.pad + gm.ws / 2, maxU = 1 - f.pad - gm.ws / 2;
    var minV = f.pad + gm.hs / 2, maxV = 1 - f.pad - gm.hs / 2;
    L.u = minU > maxU ? 0.5 : Math.max(minU, Math.min(maxU, L.u));
    L.v = minV > maxV ? 0.5 : Math.max(minV, Math.min(maxV, L.v));
  }

  function paint(o, base, name) {
    var L = layers[name], p = L.pix;
    if (!p) { L.box = null; return; }
    clampLayer(name);
    var f = FACES[L.face], m = f.Minv, gm = geometry(name);
    var s0 = L.u - gm.ws / 2, t0 = L.v - gm.hs / 2;
    var corners = [fwd(f, s0, t0), fwd(f, s0 + gm.ws, t0), fwd(f, s0 + gm.ws, t0 + gm.hs), fwd(f, s0, t0 + gm.hs)];
    var bx0 = W, bx1 = 0, by0 = H, by1 = 0;
    corners.forEach(function (c) {
      bx0 = Math.min(bx0, c[0]); bx1 = Math.max(bx1, c[0]);
      by0 = Math.min(by0, c[1]); by1 = Math.max(by1, c[1]);
    });
    bx0 = Math.max(0, Math.floor(bx0)); by0 = Math.max(0, Math.floor(by0));
    bx1 = Math.min(W - 1, Math.ceil(bx1)); by1 = Math.min(H - 1, Math.ceil(by1));

    for (var y = by0; y <= by1; y++) {
      for (var x = bx0; x <= bx1; x++) {
        var w = m[6] * x + m[7] * y + m[8];
        var s = (m[0] * x + m[1] * y + m[2]) / w;
        var t = (m[3] * x + m[4] * y + m[5]) / w;
        var u = (s - s0) / gm.ws, v = (t - t0) / gm.hs;
        if (u < 0 || u >= 1 || v < 0 || v >= 1) continue;
        var li = (Math.floor(v * p.h) * p.w + Math.floor(u * p.w)) * 4;
        var la = p.d[li + 3] / 255;
        if (la <= 0) continue;
        var ci = (y * W + x) * 4;
        var a = la * 0.94;
        for (var c = 0; c < 3; c++) {
          var printed = base[ci + c] * Math.pow(p.d[li + c] / 255, 0.92);
          o[ci + c] = o[ci + c] * (1 - a) + printed * a;
        }
      }
    }
    L.box = { x0: bx0, x1: bx1, y0: by0, y1: by1 };
  }

  function render() {
    if (!boxData) return;
    var out = ctx.createImageData(W, H);
    out.data.set(boxData);
    paint(out.data, boxData, "logo");
    paint(out.data, boxData, "text");
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
    octx.font = "600 28px Inter, Arial, sans-serif";
    var label = dragging === "logo" ? "LOGO" : "TEXT";
    var tw = octx.measureText(label).width + 18;
    var x = (b.x0 + b.x1) / 2 - tw / 2;
    var y = b.y0 - 46;
    octx.fillStyle = "rgba(11,19,32,0.85)";
    octx.fillRect(x, y, tw, 36);
    octx.fillStyle = "#fff";
    octx.fillText(label, x + 9, y + 27);
    octx.restore();
  }

  var pending = false;
  function queue() {
    if (pending) return;
    pending = true;
    requestAnimationFrame(function () { pending = false; render(); });
  }

  boxImg.onload = function () {
    var c = document.createElement("canvas");
    c.width = W; c.height = H;
    var g = c.getContext("2d");
    g.drawImage(boxImg, 0, 0, W, H);
    try {
      boxData = g.getImageData(0, 0, W, H).data;
    } catch (err) {
      ctx.drawImage(boxImg, 0, 0, W, H);
      return;
    }
    render();
  };
  boxImg.src = window.PPC_BOX_IMAGE || "images/large-closed-crop.jpg";

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
    faceBtns.forEach(function (b) { b.setAttribute("aria-pressed", b.dataset.face === L.face ? "true" : "false"); });
  }

  layerBtns.forEach(function (b) { b.addEventListener("click", function () { setActive(b.dataset.layer); }); });
  faceBtns.forEach(function (b) {
    b.addEventListener("click", function () {
      var L = layers[active];
      L.face = b.dataset.face; L.u = 0.5; L.v = 0.5;
      syncSliders(); render();
    });
  });
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
  overlay.addEventListener("pointerdown", function (e) {
    var pt = toCanvas(e);
    var name = hit(pt);
    if (!name) return;
    e.preventDefault();
    overlay.setPointerCapture(e.pointerId);
    setActive(name);
    dragging = name;
    var L = layers[name], st = inv(FACES[L.face], pt.x, pt.y);
    start = { s: st[0], t: st[1], u: L.u, v: L.v };
    stageBox.classList.add("dragging");
  });
  overlay.addEventListener("pointermove", function (e) {
    var pt = toCanvas(e);
    if (dragging) {
      var L = layers[dragging], st = inv(FACES[L.face], pt.x, pt.y);
      L.u = start.u + (st[0] - start.s);
      L.v = start.v + (st[1] - start.t);
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
    stageBox.classList.remove("dragging");
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
      stageBox.classList.remove("pop"); void stageBox.offsetWidth; stageBox.classList.add("pop");
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

  /* ---------- size, quote, download, reset ---------- */
  sizeBtns.forEach(function (b) {
    b.addEventListener("click", function () {
      sizeBtns.forEach(function (x) { x.setAttribute("aria-pressed", "false"); });
      b.setAttribute("aria-pressed", "true");
      boxSize = b.dataset.box;
      sizeTag.textContent = boxSize.toUpperCase();
      stageBox.style.setProperty("--cup-scale", scaleFor[boxSize]);
      updateQuote();
    });
  });

  function updateQuote() {
    var q = "contact.html?product=flat&kind=box&size=" + encodeURIComponent(boxSize) + "&preview=1";
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
    out.width = 1400; out.height = 1200;
    var g = out.getContext("2d");
    g.fillStyle = "#f3f1ec"; g.fillRect(0, 0, 1400, 1200);
    g.globalCompositeOperation = "multiply";
    g.drawImage(canvas, 70, 80, 1260, 814);
    g.globalCompositeOperation = "source-over";
    g.fillStyle = "#0b1320";
    g.font = "600 30px Inter, Arial, sans-serif";
    g.fillText("Flat Top Container  |  " + boxSize, 60, 1130);
    g.textAlign = "right";
    g.fillStyle = "#5f6878";
    g.fillText("Pacific Paper Cups preview", 1340, 1130);
    return out;
  }
  dlBtn.addEventListener("click", function () {
    var out = mockup();
    var a = document.createElement("a");
    a.download = "box-preview-" + boxSize.replace(" ", "") + ".png";
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
        product: "flat",
        size: boxSize.replace(" ", ""),
        logo: uploadedFile,
        preview: blob,
        details: {
          item: boxSize + " flat top box",
          text: t,
          font: t ? fontSelect.options[fontSelect.selectedIndex].text : "",
          color: t ? textColor : "",
          placement: "Logo on " + layers.logo.face + (layers.text.pix ? ", text on " + layers.text.face : "")
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
    logoSizeInput.value = 55;
    textInput.value = "";
    textSizeInput.value = 40;
    fontSelect.selectedIndex = 0;
    textColor = "#0e2a4f";
    colorInput.value = textColor;
    swatches.forEach(function (x, i) { x.setAttribute("aria-pressed", i === 0 ? "true" : "false"); });
    layers.logo.face = "lid"; layers.logo.u = 0.5; layers.logo.v = 0.5;
    layers.text.face = "front"; layers.text.u = 0.5; layers.text.v = 0.55;
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
