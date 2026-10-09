(function () {
  "use strict";

  var STORAGE_KEY = "quoteslip.rates.v1";
  var MAX_AMOUNT = 100000000;

  var DEFAULTS = {
    type: { landing: 150000, business: 300000, webapp: 700000 },
    extraPage: 25000,
    addons: { form: 40000, paystack: 120000, accounts: 150000, admin: 180000, seo: 40000 },
    rushPct: 30,
    depositPct: 50
  };

  var LABELS = {
    type: { landing: "Landing page", business: "Business website", webapp: "Web app" },
    addons: {
      form: "Contact form",
      paystack: "Paystack payments",
      accounts: "Sign up and login",
      admin: "Admin dashboard",
      seo: "Search setup"
    }
  };

  var RATE_FIELDS = [
    { path: "type.landing", label: "Landing page" },
    { path: "type.business", label: "Business website" },
    { path: "type.webapp", label: "Web app" },
    { path: "extraPage", label: "Each extra page" },
    { path: "addons.form", label: "Contact form" },
    { path: "addons.paystack", label: "Paystack payments" },
    { path: "addons.accounts", label: "Sign up and login" },
    { path: "addons.admin", label: "Admin dashboard" },
    { path: "addons.seo", label: "Search setup" },
    { path: "rushPct", label: "Rush surcharge (%)", pct: true },
    { path: "depositPct", label: "Deposit to start (%)", pct: true }
  ];

  var money = new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0
  });

  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  function getPath(obj, path) {
    return path.split(".").reduce(function (o, k) { return o[k]; }, obj);
  }

  function setPath(obj, path, value) {
    var keys = path.split(".");
    var last = keys.pop();
    var target = keys.reduce(function (o, k) { return o[k]; }, obj);
    target[last] = value;
  }

  function clampInt(value, max) {
    var n = parseInt(value, 10);
    if (isNaN(n) || n < 0) return 0;
    return n > max ? max : n;
  }

  function loadRates() {
    var rates = clone(DEFAULTS);
    try {
      var raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return rates;
      var saved = JSON.parse(raw);
      RATE_FIELDS.forEach(function (f) {
        var v;
        try { v = getPath(saved, f.path); } catch (e) { return; }
        if (typeof v === "number" && isFinite(v)) {
          setPath(rates, f.path, clampInt(v, f.pct ? 100 : MAX_AMOUNT));
        }
      });
    } catch (e) { /* storage blocked or corrupt: use defaults */ }
    return rates;
  }

  function saveRates() {
    try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(rates)); } catch (e) { /* ignore */ }
  }

  var rates = loadRates();

  var form = document.getElementById("quote-form");
  var linesEl = document.getElementById("lines");
  var statusEl = document.getElementById("status");
  var lastText = "";

  /* ---------- rate editor ---------- */
  function buildRateEditor() {
    var grid = document.getElementById("rate-grid");
    RATE_FIELDS.forEach(function (f) {
      var label = document.createElement("label");
      label.textContent = f.label;
      var input = document.createElement("input");
      input.type = "number";
      input.min = "0";
      input.max = f.pct ? "100" : String(MAX_AMOUNT);
      input.inputMode = "numeric";
      input.dataset.ratePath = f.path;
      input.value = String(getPath(rates, f.path));
      label.appendChild(input);
      grid.appendChild(label);
    });
  }

  function syncRateInputs() {
    var inputs = document.querySelectorAll("[data-rate-path]");
    Array.prototype.forEach.call(inputs, function (input) {
      input.value = String(getPath(rates, input.dataset.ratePath));
    });
  }

  function paintPrices() {
    Array.prototype.forEach.call(document.querySelectorAll("[data-price]"), function (el) {
      el.textContent = money.format(getPath(rates, el.dataset.price));
    });
    Array.prototype.forEach.call(document.querySelectorAll("[data-pct]"), function (el) {
      el.textContent = getPath(rates, el.dataset.pct) + "%";
    });
    var depLabel = document.getElementById("sum-dep-label");
    depLabel.textContent = "Deposit to start (" + rates.depositPct + "%)";
  }

  /* ---------- reading the form ---------- */
  function readState() {
    var type = form.elements.type.value || "landing";
    var pages = clampInt(form.elements.pages.value, 50);
    var addons = [];
    Array.prototype.forEach.call(form.querySelectorAll('input[name="addon"]:checked'), function (el) {
      if (LABELS.addons[el.value]) addons.push(el.value);
    });
    return {
      client: (form.elements.client.value || "").trim().slice(0, 60),
      type: LABELS.type[type] ? type : "landing",
      pages: pages,
      addons: addons,
      rush: form.elements.rush.checked
    };
  }

  function compute(state) {
    var lines = [];
    lines.push({
      name: LABELS.type[state.type],
      note: "Package",
      amount: rates.type[state.type]
    });
    if (state.pages > 0) {
      lines.push({
        name: "Extra pages",
        note: state.pages + " x " + money.format(rates.extraPage),
        amount: state.pages * rates.extraPage
      });
    }
    state.addons.forEach(function (key) {
      lines.push({ name: LABELS.addons[key], note: "Add-on", amount: rates.addons[key] });
    });
    var subtotal = lines.reduce(function (sum, l) { return sum + l.amount; }, 0);
    var rush = state.rush ? Math.round(subtotal * rates.rushPct / 100) : 0;
    var total = subtotal + rush;
    var deposit = Math.round(total * rates.depositPct / 100);
    return { lines: lines, subtotal: subtotal, rush: rush, total: total, deposit: deposit, balance: total - deposit };
  }

  /* ---------- painting the slip ---------- */
  function render() {
    var state = readState();
    var q = compute(state);

    document.getElementById("slip-for").textContent = "For: " + (state.client || "not named yet");

    while (linesEl.firstChild) linesEl.removeChild(linesEl.firstChild);
    q.lines.forEach(function (l) {
      var li = document.createElement("li");
      var what = document.createElement("span");
      what.className = "what";
      what.textContent = l.name;
      var small = document.createElement("small");
      small.textContent = l.note;
      what.appendChild(small);
      var amt = document.createElement("span");
      amt.className = "amt";
      amt.textContent = money.format(l.amount);
      li.appendChild(what);
      li.appendChild(amt);
      linesEl.appendChild(li);
    });

    document.getElementById("sum-sub").textContent = money.format(q.subtotal);
    var rushRow = document.getElementById("sum-rush-row");
    rushRow.hidden = !state.rush;
    document.getElementById("sum-rush-label").textContent = "Rush (" + rates.rushPct + "%)";
    document.getElementById("sum-rush").textContent = "+ " + money.format(q.rush);
    document.getElementById("sum-total").textContent = money.format(q.total);
    document.getElementById("sum-dep").textContent = money.format(q.deposit);
    document.getElementById("sum-bal").textContent = money.format(q.balance);
    document.getElementById("bar-total").textContent = money.format(q.total);

    lastText = buildText(state, q);
  }

  function buildText(state, q) {
    var out = [];
    out.push("QUOTE");
    out.push(document.getElementById("slip-date").textContent);
    out.push("For: " + (state.client || "not named yet"));
    out.push("");
    q.lines.forEach(function (l) {
      out.push(l.name + (l.note && l.note !== "Package" && l.note !== "Add-on" ? " (" + l.note + ")" : "") + ": " + money.format(l.amount));
    });
    out.push("");
    out.push("Subtotal: " + money.format(q.subtotal));
    if (state.rush) out.push("Rush (" + rates.rushPct + "%): " + money.format(q.rush));
    out.push("Total: " + money.format(q.total));
    out.push("Deposit to start (" + rates.depositPct + "%): " + money.format(q.deposit));
    out.push("Balance on delivery: " + money.format(q.balance));
    return out.join("\n");
  }

  /* ---------- messages ---------- */
  var statusTimer;
  function say(msg, isError) {
    statusEl.textContent = msg;
    statusEl.className = "status" + (isError ? " error" : "");
    clearTimeout(statusTimer);
    statusTimer = setTimeout(function () { statusEl.textContent = ""; }, 5000);
  }

  function legacyCopy(text) {
    var ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    var ok = false;
    try { ok = document.execCommand("copy"); } catch (e) { ok = false; }
    document.body.removeChild(ta);
    return ok;
  }

  function copyQuote() {
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(lastText).then(
        function () { say("Quote copied. Paste it into WhatsApp or email."); },
        function () {
          if (legacyCopy(lastText)) say("Quote copied. Paste it into WhatsApp or email.");
          else say("Copy failed. Select the text on the slip and copy it by hand.", true);
        }
      );
    } else if (legacyCopy(lastText)) {
      say("Quote copied. Paste it into WhatsApp or email.");
    } else {
      say("Copy failed. Select the text on the slip and copy it by hand.", true);
    }
  }

  /* ---------- wiring ---------- */
  function init() {
    var now = new Date();
    document.getElementById("slip-date").textContent = now.toLocaleDateString("en-GB", {
      day: "numeric", month: "long", year: "numeric"
    });
    document.getElementById("year").textContent = String(now.getFullYear());

    buildRateEditor();
    paintPrices();
    render();

    form.addEventListener("submit", function (e) { e.preventDefault(); });
    form.addEventListener("input", function (e) {
      var t = e.target;
      if (t.dataset && t.dataset.ratePath) {
        var f = RATE_FIELDS.filter(function (x) { return x.path === t.dataset.ratePath; })[0];
        setPath(rates, t.dataset.ratePath, clampInt(t.value, f && f.pct ? 100 : MAX_AMOUNT));
        saveRates();
        paintPrices();
      }
      render();
    });
    form.addEventListener("change", function (e) {
      if (e.target.dataset && e.target.dataset.ratePath) {
        e.target.value = String(getPath(rates, e.target.dataset.ratePath));
      }
      if (e.target.name === "pages") e.target.value = String(clampInt(e.target.value, 50));
    });

    var pages = document.getElementById("pages");
    document.getElementById("pages-minus").addEventListener("click", function () {
      pages.value = String(clampInt(pages.value, 50) - 1 < 0 ? 0 : clampInt(pages.value, 50) - 1);
      render();
    });
    document.getElementById("pages-plus").addEventListener("click", function () {
      pages.value = String(Math.min(50, clampInt(pages.value, 50) + 1));
      render();
    });

    document.getElementById("reset-rates").addEventListener("click", function () {
      rates = clone(DEFAULTS);
      saveRates();
      syncRateInputs();
      paintPrices();
      render();
      say("Rates are back to the defaults.");
    });

    document.getElementById("copy").addEventListener("click", copyQuote);
    document.getElementById("print").addEventListener("click", function () { window.print(); });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
