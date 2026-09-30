/* Pacific Paper Cups | interactions and motion */
(function () {
  "use strict";

  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var finePointer = window.matchMedia("(pointer: fine)").matches;

  /* Header state and scroll progress */
  var header = document.querySelector(".header");
  var bar = document.querySelector(".progress");
  function onScroll() {
    var y = window.scrollY;
    if (header) header.classList.toggle("scrolled", y > 8);
    if (bar) {
      var max = document.documentElement.scrollHeight - window.innerHeight;
      bar.style.transform = "scaleX(" + (max > 0 ? Math.min(y / max, 1) : 0) + ")";
    }
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  /* Close mobile menu after choosing a link */
  document.querySelectorAll(".menu a").forEach(function (a) {
    a.addEventListener("click", function () {
      if (header) header.classList.remove("open");
    });
  });

  /* Hero headline: reveal word by word */
  var h1 = document.querySelector(".hero h1, .page-hero h1");
  if (h1 && !reduce) {
    var i = 0;
    (function wrap(node) {
      Array.prototype.slice.call(node.childNodes).forEach(function (child) {
        if (child.nodeType === 3) {
          var frag = document.createDocumentFragment();
          child.textContent.split(/(\s+)/).forEach(function (part) {
            if (!part) return;
            if (/^\s+$/.test(part)) {
              frag.appendChild(document.createTextNode(part));
            } else {
              var outer = document.createElement("span");
              outer.className = "w";
              var inner = document.createElement("span");
              inner.textContent = part;
              inner.style.transitionDelay = i++ * 70 + "ms";
              outer.appendChild(inner);
              frag.appendChild(outer);
            }
          });
          node.replaceChild(frag, child);
        } else if (child.nodeType === 1) {
          wrap(child);
        }
      });
    })(h1);
    h1.classList.add("split");
    requestAnimationFrame(function () {
      requestAnimationFrame(function () { h1.classList.add("go"); });
    });
  }
  document.documentElement.classList.add("loaded");

  /* Scroll reveal with stagger */
  var groups = [
    ".section-head", ".catalog .item", ".caps .cap", ".rows .row", ".steps .step",
    ".partner-grid .partner-card", ".reviews .review", ".trio > div", ".product",
    ".kraft-copy > *", ".cta .wrap > div", ".numbers .number", ".statement",
    ".compare-wrap", ".quote > *"
  ];
  var targets = [];
  groups.forEach(function (sel) {
    document.querySelectorAll(sel).forEach(function (el, idx) {
      el.classList.add("reveal");
      el.style.setProperty("--d", (idx % 4) * 90 + "ms");
      targets.push(el);
    });
  });

  function show(el) {
    el.classList.add("in");
    el.querySelectorAll("[data-count]").forEach(count);
  }

  if (reduce || !("IntersectionObserver" in window)) {
    targets.forEach(show);
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) {
          show(e.target);
          io.unobserve(e.target);
        }
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.12 });
    targets.forEach(function (el) { io.observe(el); });
  }

  /* Count up numbers */
  function count(el) {
    if (el.dataset.done) return;
    el.dataset.done = "1";
    var end = parseFloat(el.dataset.count);
    if (reduce) { el.textContent = end; return; }
    var start = null, dur = 1400;
    function step(t) {
      if (!start) start = t;
      var p = Math.min((t - start) / dur, 1);
      var eased = 1 - Math.pow(1 - p, 3);
      el.textContent = Math.round(end * eased);
      if (p < 1) requestAnimationFrame(step);
    }
    el.textContent = "0";
    requestAnimationFrame(step);
  }

  /* Typewriter on the hero spec tag */
  var typed = document.querySelector("[data-type]");
  if (typed && !reduce) {
    var full = typed.textContent;
    typed.textContent = "";
    typed.classList.add("typing");
    var k = 0;
    setTimeout(function tick() {
      typed.textContent = full.slice(0, ++k);
      if (k < full.length) setTimeout(tick, 38);
      else typed.classList.remove("typing");
    }, 900);
  }

  /* Subtle 3D tilt on product cards */
  if (finePointer && !reduce) {
    document.querySelectorAll(".catalog .item, .partner-card").forEach(function (card) {
      card.addEventListener("mousemove", function (e) {
        var r = card.getBoundingClientRect();
        var x = (e.clientX - r.left) / r.width - 0.5;
        var y = (e.clientY - r.top) / r.height - 0.5;
        card.style.transform = "perspective(900px) rotateY(" + x * 5 + "deg) rotateX(" + -y * 5 + "deg)";
      });
      card.addEventListener("mouseleave", function () { card.style.transform = ""; });
    });

    /* Hero image drifts with the cursor */
    var hero = document.querySelector(".hero");
    var heroImg = document.querySelector(".hero-media img");
    if (hero && heroImg) {
      hero.addEventListener("mousemove", function (e) {
        var r = hero.getBoundingClientRect();
        var x = (e.clientX - r.left) / r.width - 0.5;
        var y = (e.clientY - r.top) / r.height - 0.5;
        heroImg.style.transform = "scale(1.06) translate(" + x * -14 + "px," + y * -10 + "px)";
      });
      hero.addEventListener("mouseleave", function () { heroImg.style.transform = ""; });
    }
  }

  /* Product galleries */
  document.querySelectorAll("[data-gallery]").forEach(function (g) {
    var main = g.querySelector(".gallery-main img");
    g.querySelectorAll(".thumbs button").forEach(function (b) {
      b.addEventListener("click", function () {
        g.querySelectorAll(".thumbs button").forEach(function (x) { x.classList.remove("on"); });
        b.classList.add("on");
        main.classList.add("swap");
        setTimeout(function () {
          main.src = b.dataset.src;
          main.alt = b.dataset.alt;
          main.classList.toggle("contain", b.classList.contains("contain"));
          main.classList.remove("swap");
        }, 160);
      });
    });
  });

  /* Spec tabs */
  document.querySelectorAll("[data-tabs]").forEach(function (t) {
    var tabs = t.querySelectorAll("[role=tab]");
    var panels = t.querySelectorAll("[role=tabpanel]");
    tabs.forEach(function (tab, idx) {
      tab.addEventListener("click", function () {
        tabs.forEach(function (x, j) { x.setAttribute("aria-selected", j === idx ? "true" : "false"); });
        panels.forEach(function (p, j) {
          p.hidden = j !== idx;
          if (j === idx) { p.classList.remove("fade"); void p.offsetWidth; p.classList.add("fade"); }
        });
      });
    });
  });
})();
