/* Pacific Paper Cups | product pricing, add to cart, and cart page
   Prices live in CATALOG below, as the price PER CASE. Set a price to null to show "Request a Quote" instead of Add to Cart.
   Customers order in full cases. The "each" price shown on the site is worked out from the case price. */
(function () {
  "use strict";

  var CATALOG = {
    cups: {
      name: "Custom Paper Cups",
      page: "custom-paper-cups.html",
      image: "images/cup-blank.png",
      caseLabel: "cups",
      hideEach: true,
      sizes: [
        { id: "8oz",  label: "8 oz",  casePack: 1000, plain: 40, printed: 120 },
        { id: "12oz", label: "12 oz", casePack: 1000, plain: 45, printed: 130 },
        { id: "14oz", label: "14 oz", casePack: 1000, plain: 50, printed: 140 }
      ]
    },
    flat: {
      name: "Flat Top Container",
      hideEach: true,
      page: "to-go-boxes.html#flat50",
      image: "images/foldtop-closed.jpg",
      caseLabel: "units",
      sizes: [
        { id: "50oz", label: "50 oz", dims: "9 x 5 x 2.5 in", casePack: 150, plain: 45, printed: 55 },
        { id: "75oz", label: "75 oz", dims: "9 x 5 x 3 in",   casePack: 120, plain: 45, printed: 55 }
      ]
    },
    shell45: {
      name: "Shell Container, 45 oz",
      hideEach: true,
      page: "to-go-boxes.html#shell45",
      image: "images/clamshell-open.jpg",
      caseLabel: "units",
      plainOnly: true,
      sizes: [{ id: "45oz", label: "45 oz", dims: "9 x 6 x 3.5 in", casePack: 150, plain: null, printed: null }]
    },
    bags: {
      name: "Kraft Paper Bags",
      page: "kraft-bags.html",
      image: "images/kraft-bag-plain.png",
      caseLabel: "bags",
      sizes: [
        { id: "small",  label: "Small",  dims: "10 x 6.75 x 12 in", casePack: 250, plain: 67.50, printed: 82.50 },
        { id: "medium", label: "Medium", dims: "12 x 7 x 14 in",    casePack: 250, plain: 70.00, printed: 90.00 },
        { id: "large",  label: "Large",  dims: "12 x 9 x 15.75 in", casePack: 250, plain: 75.00, printed: 100.00 }
      ]
    }
  };

  var KEY = "ppc-cart-v1";
  var EMAIL = "info@pacificpapercups.com";

  /* ---------- helpers ---------- */
  function money(n) { return "$" + n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ","); }
  function unitMoney(n) {
    var t = n.toFixed(3).replace(/0$/, "");
    return "$" + t;
  }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function sizeOf(p, sizeId) { for (var i = 0; i < p.sizes.length; i++) if (p.sizes[i].id === sizeId) return p.sizes[i]; return null; }
  function casePrice(p, s, finish) { return finish === "printed" ? s.printed : s.plain; }
  function priced(p, s, finish) { return !!(s && s.casePack && casePrice(p, s, finish) != null); }
  function unitPrice(p, s, finish) { return casePrice(p, s, finish) / s.casePack; }

  function load() {
    try { var c = JSON.parse(localStorage.getItem(KEY)); return Array.isArray(c) ? c : []; } catch (e) { return []; }
  }
  function save(c) { try { localStorage.setItem(KEY, JSON.stringify(c)); } catch (e) {} updateCount(); }
  function validLines() {
    return load().filter(function (l) {
      var p = CATALOG[l.id]; var s = p && sizeOf(p, l.size);
      return s && priced(p, s, l.finish) && l.qty > 0;
    });
  }
  function addLine(id, size, finish, qty) {
    var c = load(), found = false;
    c.forEach(function (l) { if (l.id === id && l.size === size && l.finish === finish) { l.qty += qty; found = true; } });
    if (!found) c.push({ id: id, size: size, finish: finish, qty: qty });
    save(c);
  }
  function updateCount() {
    var n = validLines().reduce(function (a, l) { return a + l.qty; }, 0);
    document.querySelectorAll(".cart-count").forEach(function (el) {
      el.textContent = n;
      el.hidden = n === 0;
    });
  }

  /* ---------- custom designs (logo file + mockup), kept in the browser with IndexedDB ---------- */
  var DB_NAME = "ppc-designs", STORE = "designs", dbPromise = null;
  function db() {
    if (!dbPromise) {
      dbPromise = new Promise(function (res, rej) {
        if (!window.indexedDB) { rej(new Error("no indexedDB")); return; }
        var r = indexedDB.open(DB_NAME, 1);
        r.onupgradeneeded = function () { r.result.createObjectStore(STORE, { keyPath: "id" }); };
        r.onsuccess = function () { res(r.result); };
        r.onerror = function () { rej(r.error); };
      });
    }
    return dbPromise;
  }
  function idb(mode, fn) {
    return db().then(function (d) {
      return new Promise(function (res, rej) {
        var tx = d.transaction(STORE, mode), st = tx.objectStore(STORE), out = fn(st);
        tx.oncomplete = function () { res(out && out.result); };
        tx.onerror = function () { rej(tx.error); };
      });
    });
  }
  function putDesign(d) { return idb("readwrite", function (st) { st.put(d); }); }
  function getDesign(id) { return idb("readonly", function (st) { return st.get(id); }); }
  function delDesign(id) { return idb("readwrite", function (st) { st.delete(id); }).catch(function () {}); }

  function extOf(name, type) {
    var m = /\.([a-z0-9]{2,5})$/i.exec(name || "");
    if (m) return m[1].toLowerCase();
    return ({ "image/png": "png", "image/jpeg": "jpg", "image/svg+xml": "svg", "image/webp": "webp" })[type] || "png";
  }

  /* Called by the logo preview tools: adds one case of the custom printed item with the design attached */
  function addDesign(o) {
    var p = CATALOG[o.product], s = p && sizeOf(p, o.size);
    if (!s || !o.logo) return Promise.reject(new Error("missing design"));
    var id = "d" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    var design = { id: id, logo: o.logo, logoName: o.logo.name || ("logo." + extOf("", o.logo.type)), preview: o.preview, details: o.details || {} };
    return putDesign(design).then(function () {
      var c = load();
      c.push({ id: o.product, size: o.size, finish: "printed", qty: 1, design: { id: id, logoName: design.logoName, details: design.details } });
      save(c);
      toast('<strong>Design added to cart</strong><span>' + esc(p.name) + (p.sizes.length > 1 ? ", " + esc(s.label) : "") +
        ", custom print &middot; 1 case. Your logo file is saved with this item.</span><a href=\"cart.html\">View cart &rarr;</a>");
    }, function () {
      toast("<strong>Couldn't save your design</strong><span>Your browser blocked saving the logo file. Try a regular (not private) window, or request a quote instead.</span>");
      throw new Error("save failed");
    });
  }
  window.PPCShop = { addDesign: addDesign };

  /* ---------- toast ---------- */
  var toastEl, toastTimer;
  function toast(html) {
    if (!toastEl) {
      toastEl = document.createElement("div");
      toastEl.className = "toast";
      toastEl.setAttribute("role", "status");
      document.body.appendChild(toastEl);
    }
    toastEl.innerHTML = html;
    toastEl.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove("show"); }, 4200);
  }

  /* ---------- buy box on product pages ---------- */
  function seg(name, options, current) {
    return '<div class="seg buy-seg" style="grid-template-columns:repeat(' + options.length + ',1fr)" role="group" data-seg="' + name + '">' +
      options.map(function (o) {
        return '<button type="button" data-val="' + o.val + '" aria-pressed="' + (o.val === current) + '">' + esc(o.label) + "</button>";
      }).join("") + "</div>";
  }

  function mountBuy(box) {
    var id = box.getAttribute("data-buy");
    var p = CATALOG[id];
    if (!p) return;
    var state = { size: p.sizes[p.sizes.length > 1 ? 1 : 0].id, finish: "plain", qty: 1 };
    if (box.dataset.size && sizeOf(p, box.dataset.size)) state.size = box.dataset.size;
    if (id === "flat") state.size = location.hash === "#flat75" ? "75oz" : "50oz";

    function render() {
      var s = sizeOf(p, state.size);
      var html = '<div class="buy-head"><span class="label">Order online</span></div>';
      if (p.sizes.length > 1) {
        html += '<div class="control"><span class="control-label">Size</span>' +
          seg("size", p.sizes.map(function (x) { return { val: x.id, label: x.label }; }), state.size) +
          (s.dims ? '<span class="buy-dims">' + esc(s.dims) + "</span>" : "") + "</div>";
      }
      if (!p.plainOnly) {
        html += '<div class="control"><span class="control-label">Printing</span>' +
          seg("finish", [{ val: "plain", label: "Plain" }, { val: "printed", label: "Custom print" }], state.finish) + "</div>";
      }
      if (priced(p, s, state.finish)) {
        var each = unitPrice(p, s, state.finish), perCase = casePrice(p, s, state.finish);
        html += '<div class="buy-price' + (p.hideEach ? " buy-price-single" : "") + '">' +
          (p.hideEach ? "" : '<div><strong>' + unitMoney(each) + '</strong><span>each</span></div>') +
          '<div><strong>' + money(perCase) + '</strong><span>per case of ' + s.casePack + " " + p.caseLabel + "</span></div>" +
          "</div>";
        html += '<div class="buy-row">' +
          '<div class="qty" role="group" aria-label="Number of cases">' +
          '<button type="button" data-q="-1" aria-label="Fewer cases">&minus;</button>' +
          '<input type="number" min="1" max="999" value="' + state.qty + '" aria-label="Cases" />' +
          '<button type="button" data-q="1" aria-label="More cases">+</button></div>' +
          '<button type="button" class="btn buy-add">Add to Cart <span class="buy-total">' + money(perCase * state.qty) + "</span></button>" +
          "</div>";
        html += '<p class="buy-fine">' + (state.qty === 1 ? "1 case" : state.qty + " cases") + " = " +
          (state.qty * s.casePack).toLocaleString() + " " + p.caseLabel + "." +
          (state.finish === "printed" ? " We'll reach out for your artwork and send a digital proof before printing." : "") + "</p>";
      } else {
        html += '<div class="buy-price buy-tbd"><div><strong>Pricing on request</strong><span>Online ordering for this item is coming soon</span></div></div>' +
          '<div class="buy-row"><a class="btn" href="contact.html?product=' + id + '">Request a Quote <span class="arr">&rarr;</span></a></div>';
      }
      box.innerHTML = html;
    }

    box.addEventListener("click", function (e) {
      var b = e.target.closest("button");
      if (!b || !box.contains(b)) return;
      var sg = b.closest("[data-seg]");
      if (sg) { state[sg.dataset.seg] = b.dataset.val; render(); return; }
      if (b.dataset.q) { state.qty = Math.max(1, Math.min(999, state.qty + Number(b.dataset.q))); render(); return; }
      if (b.classList.contains("buy-add")) {
        var s = sizeOf(p, state.size);
        addLine(id, state.size, state.finish, state.qty);
        toast('<strong>Added to cart</strong><span>' + esc(p.name) + (p.sizes.length > 1 ? ", " + esc(s.label) : "") +
          ", " + (state.finish === "printed" ? "custom print" : "plain") + " &middot; " + state.qty + (state.qty === 1 ? " case" : " cases") +
          '</span><a href="cart.html">View cart &rarr;</a>');
        state.qty = 1; render();
      }
    });
    box.addEventListener("change", function (e) {
      if (e.target.matches(".qty input")) {
        state.qty = Math.max(1, Math.min(999, parseInt(e.target.value, 10) || 1));
        render();
      }
    });
    render();
  }

  /* ---------- delivery (keep in sync with netlify/lib/catalog.mjs) ---------- */
  var SHIPPING = {
    pickup: { label: "Free pickup", perCase: 0 },
    la: { label: "Free local delivery", perCase: 0 },
    us: { label: "Standard shipping", perCase: 15 }
  };
  function isLAZip(zip) {
    var z = String(zip || "").trim();
    if (!/^\d{5}$/.test(z)) return false;
    var p = Number(z.slice(0, 3));
    return (p >= 900 && p <= 908) || (p >= 910 && p <= 918) || p === 935;
  }

  /* ---------- cart page ---------- */
  function mountCart(root) {
    var list = root.querySelector("[data-cart-lines]");
    var summary = root.querySelector("[data-cart-summary]");
    var layout = root.querySelector("[data-cart-layout]");
    var empty = root.querySelector("[data-cart-empty]");
    var shipInputs = root.querySelectorAll('input[name="ship"]');
    var zipField = root.querySelector("[data-zip-field]");
    var zipInput = root.querySelector("#o-zip");
    var zipMsg = root.querySelector("[data-zip-msg]");
    var notes = root.querySelector("#o-notes");
    var payBtn = root.querySelector("#checkoutBtn");
    var errBox = root.querySelector("[data-checkout-error]");
    var hasDesign = false;

    function method() {
      var m = "pickup";
      shipInputs.forEach(function (i) { if (i.checked) m = i.value; });
      return m;
    }
    function caseCount(lines) { return lines.reduce(function (a, l) { return a + l.qty; }, 0); }

    function syncZip() {
      var m = method(), z = zipInput.value.trim();
      zipField.hidden = m !== "la";
      zipMsg.textContent = "";
      zipMsg.className = "zip-msg";
      if (m === "la" && z.length === 5) {
        if (isLAZip(z)) { zipMsg.textContent = "Great, you're in our free delivery area."; zipMsg.className = "zip-msg ok"; }
        else { zipMsg.textContent = "That ZIP is outside Los Angeles County. Choose pickup or standard shipping."; zipMsg.className = "zip-msg bad"; }
      }
    }

    function render() {
      var lines = validLines();
      save(lines);
      empty.hidden = lines.length > 0;
      layout.hidden = lines.length === 0;
      if (!lines.length) return;
      var subtotal = 0, hasPrinted = false;
      hasDesign = false;
      list.innerHTML = lines.map(function (l, i) {
        var p = CATALOG[l.id], s = sizeOf(p, l.size), pc = casePrice(p, s, l.finish), line = pc * l.qty;
        subtotal += line;
        if (l.finish === "printed") hasPrinted = true;
        var d = l.design, det = (d && d.details) || {};
        if (d) hasDesign = true;
        var designHtml = d ? '<span class="cart-design"><b>Your design</b> ' + esc(d.logoName) +
          (det.text ? ' &middot; text "' + esc(det.text) + '"' + (det.font ? " in " + esc(det.font) : "") : "") +
          (det.placement ? " &middot; " + esc(det.placement) : "") +
          ' <button type="button" class="text-btn cart-art" data-design="' + d.id + '">Download artwork</button></span>' : "";
        return '<li class="cart-line' + (d ? " has-design" : "") + '">' +
          '<a href="' + p.page + '" class="cart-thumb"><img src="' + p.image + '" alt=""' + (d ? ' data-design-img="' + d.id + '"' : "") + ' /></a>' +
          '<div class="cart-info"><a href="' + p.page + '"><strong>' + esc(p.name) + "</strong></a>" +
          '<span class="cart-meta">' + (p.sizes.length > 1 ? esc(s.label) + " &middot; " : "") + (s.dims ? esc(s.dims) + " &middot; " : "") +
          (l.finish === "printed" ? "Custom print" : "Plain") + "</span>" +
          '<span class="cart-meta">' + (p.hideEach ? "" : unitMoney(unitPrice(p, s, l.finish)) + " each &middot; ") + money(pc) + " per case of " + s.casePack + "</span>" +
          designHtml +
          '<button type="button" class="text-btn cart-remove" data-i="' + i + '">Remove</button></div>' +
          '<div class="qty" role="group" aria-label="Cases"><button type="button" data-i="' + i + '" data-q="-1" aria-label="Fewer cases">&minus;</button>' +
          '<input type="number" min="1" max="999" value="' + l.qty + '" data-i="' + i + '" aria-label="Cases" />' +
          '<button type="button" data-i="' + i + '" data-q="1" aria-label="More cases">+</button></div>' +
          '<strong class="cart-line-total">' + money(line) + "</strong></li>";
      }).join("");
      var cases = caseCount(lines), ship = SHIPPING[method()], shipCost = ship.perCase * cases;
      summary.innerHTML =
        '<div class="sum-row"><span>Items</span><span>' + cases + (cases === 1 ? " case" : " cases") + "</span></div>" +
        '<div class="sum-row"><span>Subtotal</span><span>' + money(subtotal) + "</span></div>" +
        '<div class="sum-row"><span>' + ship.label + "</span><span>" + (shipCost ? money(shipCost) : "Free") + "</span></div>" +
        '<div class="sum-row"><span>Total</span><strong>' + money(subtotal + shipCost) + "</strong></div>" +
        (hasPrinted ? '<p class="sum-note">Your order includes custom printed items. ' +
          (hasDesign ? "Your logo files are sent with your order, and we'll email a digital proof before production." : "We'll contact you for artwork and email a digital proof before production.") + "</p>" : "");
      var usLabel = root.querySelector("[data-us-rate]");
      if (usLabel) usLabel.textContent = money(SHIPPING.us.perCase) + " per case" + (cases ? " (" + money(SHIPPING.us.perCase * cases) + ")" : "");
      list.querySelectorAll("[data-design-img]").forEach(function (img) {
        getDesign(img.getAttribute("data-design-img")).then(function (d) {
          if (d && d.preview) { img.src = URL.createObjectURL(d.preview); img.parentNode.classList.add("is-design"); }
        }).catch(function () {});
      });
    }

    function change(i, qty) {
      var lines = validLines();
      if (!lines[i]) return;
      if (qty <= 0) { if (lines[i].design) delDesign(lines[i].design.id); lines.splice(i, 1); }
      else lines[i].qty = Math.min(999, qty);
      save(lines); render();
    }
    function saveFile(blob, name) {
      var a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = name;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
    }
    function downloadOne(id) {
      getDesign(id).then(function (d) {
        if (!d) return;
        saveFile(d.logo, d.logoName);
        if (d.preview) setTimeout(function () { saveFile(d.preview, "mockup.png"); }, 400);
      });
    }
    list.addEventListener("click", function (e) {
      var b = e.target.closest("button");
      if (!b) return;
      if (b.classList.contains("cart-art")) { downloadOne(b.dataset.design); return; }
      var i = Number(b.dataset.i), lines = validLines();
      if (b.classList.contains("cart-remove")) change(i, 0);
      else if (b.dataset.q) change(i, Math.max(1, lines[i].qty + Number(b.dataset.q)));
    });
    list.addEventListener("change", function (e) {
      if (e.target.matches("input[data-i]")) change(Number(e.target.dataset.i), Math.max(1, parseInt(e.target.value, 10) || 1));
    });
    shipInputs.forEach(function (i) { i.addEventListener("change", function () { showError(""); syncZip(); render(); }); });
    zipInput.addEventListener("input", function () { zipInput.value = zipInput.value.replace(/\D/g, "").slice(0, 5); showError(""); syncZip(); });

    function showError(msg) {
      errBox.textContent = msg;
      errBox.hidden = !msg;
    }

    /* Upload each design's logo and mockup, then hand the cart to Stripe */
    function toBase64(blob) {
      return new Promise(function (res, rej) {
        var r = new FileReader();
        r.onload = function () { res(String(r.result).split(",")[1] || ""); };
        r.onerror = function () { rej(new Error("Your logo file couldn't be read.")); };
        r.readAsDataURL(blob);
      });
    }
    function uploadArt(line) {
      return getDesign(line.design.id).then(function (d) {
        if (!d) return null;
        if (d.logo.size > 3 * 1024 * 1024) throw new Error("Your logo file is over 3 MB. Please upload a smaller file, or email it to info@pacificpapercups.com.");
        return Promise.all([toBase64(d.logo), d.preview ? toBase64(d.preview) : Promise.resolve(null)]).then(function (b) {
          return fetch("/api/artwork-upload", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: d.logoName,
              logo: { type: d.logo.type || "image/png", data: b[0] },
              mockup: b[1] ? { type: d.preview.type || "image/png", data: b[1] } : null
            })
          });
        }).then(function (r) {
          return r.json().then(function (j) {
            if (!r.ok || !j.id) throw new Error(j.error || "Your logo couldn't be uploaded.");
            return j.id;
          });
        });
      });
    }

    payBtn.addEventListener("click", function () {
      showError("");
      var lines = validLines();
      if (!lines.length) return;
      var m = method(), zip = zipInput.value.trim();
      if (m === "la" && !isLAZip(zip)) {
        showError(zip ? "Free local delivery is for Los Angeles County ZIP codes. Choose pickup or standard shipping." : "Enter your delivery ZIP code to confirm free local delivery.");
        zipInput.focus();
        return;
      }
      payBtn.disabled = true;
      var label = payBtn.innerHTML;
      payBtn.textContent = hasDesign ? "Uploading your artwork..." : "Starting secure checkout...";
      var chain = Promise.resolve(), arts = {};
      lines.forEach(function (l, i) {
        if (!l.design) return;
        chain = chain.then(function () { return uploadArt(l).then(function (id) { arts[i] = id; }); });
      });
      chain.then(function () {
        payBtn.textContent = "Starting secure checkout...";
        return fetch("/api/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            delivery: m,
            zip: zip,
            notes: notes.value.trim(),
            lines: lines.map(function (l, i) {
              return { id: l.id, size: l.size, finish: l.finish, qty: l.qty, art: arts[i] || null, logoName: l.design ? l.design.logoName : null };
            })
          })
        });
      }).then(function (r) {
        return r.json().then(function (j) {
          if (!r.ok || !j.url) throw new Error(j.error || "We couldn't start checkout. Please try again.");
          location.href = j.url;
        });
      }).catch(function (err) {
        var msg = err && err.message && !/Failed to fetch|NetworkError|Unexpected token/i.test(err.message) ? err.message
          : "Online checkout isn't available right now. Please try again, or request a quote and we'll send an invoice.";
        showError(msg);
        payBtn.disabled = false;
        payBtn.innerHTML = label;
      });
    });

    syncZip();
    render();
  }

  /* After a successful Stripe payment, empty the cart */
  function clearCart() {
    load().forEach(function (l) { if (l.design) delDesign(l.design.id); });
    save([]);
  }

  /* ---------- start ---------- */
  document.querySelectorAll("[data-buy]").forEach(mountBuy);
  var cartRoot = document.getElementById("cartPage");
  if (cartRoot) mountCart(cartRoot);
  if (document.getElementById("orderSuccess")) clearCart();
  updateCount();
  window.addEventListener("storage", function (e) { if (e.key === KEY) updateCount(); });
})();
