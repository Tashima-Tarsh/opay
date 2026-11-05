var express = require("express");
var app = express();
var path = require("path");
var { Ledger } = require("./ledger");
var { IdempotencyStore } = require("./idempotency");

const port = process.env.PORT || process.argv[2] || 8080;

// ---------- From-scratch ledger + idempotency (build-your-own) ----------
var ledger = new Ledger();
ledger.load();
var idempotency = new IdempotencyStore();

var ADMIN_USER = process.env.OPAY_ADMIN_USER || "admin";
var ADMIN_PASS = process.env.OPAY_ADMIN_PASSWORD || "admin";
var MERCHANT = { id: "merchant_default", name: "Merchant", upiId: "nkumar906099-5@oksbi" };
ledger.ensureMerchant(MERCHANT.id, MERCHANT.name, MERCHANT.upiId);

// ---------- Simple session auth (admin / admin) ----------
var sessions = {};
function setSessionCookie(res, value) {
  res.setHeader("Set-Cookie", "opay_session=" + value + "; Path=/; HttpOnly; SameSite=Lax");
}
function clearSessionCookie(res) {
  res.setHeader("Set-Cookie", "opay_session=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT");
}
function getSession(req) {
  var cookie = req.headers.cookie || "";
  var m = cookie.match(/(?:^|;\s*)opay_session=([^;]*)/);
  return m ? m[1] : null;
}
function isAuthed(req) {
  return !!sessions[getSession(req)];
}
function requireAuth(req, res, next) {
  if (isAuthed(req)) return next();
  // HTML request -> redirect to login; API -> 401 JSON
  var accept = (req.headers.accept || "").toLowerCase();
  if (accept.includes("text/html") || req.url.startsWith("/login") || req.url.startsWith("/ledger") || req.url.startsWith("/logout")) {
    res.redirect("/login");
  } else {
    res.status(401).json({ error: "unauthorized", login: "/login" });
  }
}

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ---------- Auth routes ----------
app.get("/login", function (req, res) {
  if (isAuthed(req)) return res.redirect("/ledger");
  res.sendFile(path.join(__dirname, "login.html"));
});

app.post("/login", function (req, res) {
  var u = req.body.username || "";
  var p = req.body.password || "";
  if (u === ADMIN_USER && p === ADMIN_PASS) {
    var sid = "sess_" + Math.random().toString(36).slice(2);
    sessions[sid] = true;
    setSessionCookie(res, sid);
    return res.redirect("/ledger");
  }
  res.status(401).send(
    "<h2 style='color:#c62828'>Invalid login</h2>" +
    "<p>Use <b>admin</b> / <b>admin</b></p>" +
    "<a href='/login' style='background:#2e7d32;color:#fff;padding:8px 14px;border-radius:4px;text-decoration:none;'>Try again</a>"
  );
});

app.get("/logout", function (req, res) {
  clearSessionCookie(res);
  delete sessions[getSession(req)];
  res.redirect("/login");
});

// ---------- Public routes ----------
app.get("/health", function (req, res) {
  res.json({ status: "ok", db: "ok", cache: "ok" });
});

// UPI app callback (must stay public — called by UPI apps, no session)
app.get("/callback", function (req, res) {
  var rawStatus = (req.query.status || "pending").toString().toLowerCase();
  var terminal = rawStatus === "success" ? "completed" : "failed";
  var utr = req.query.utr || req.query.txnId || "";
  var amount = req.query.amount || "";
  var upiId = req.query.pa || "";
  var refId = req.query.refId || "";
  var reference = req.query.reference || "";

  var txn = null;
  if (reference) {
    txn = ledger.getTransactionByReference(reference);
  } else if (refId || utr) {
    ledger.transactions.forEach(function (t) {
      if (!txn && (t.refId === refId || t.utr === utr)) txn = t;
    });
  }

  if (txn) {
    var updates = { status: terminal, utr: utr, refId: refId, upiId: upiId };
    if (amount && !isNaN(amount)) updates.amount = Number(amount);
    ledger.updateTransaction(txn.id, updates);
    var balance = ledger.getBalance(MERCHANT.id);
    if (terminal === "completed") {
      ledger.addLedgerEntry({ transactionId: txn.id, type: "credit", amount: txn.amount, balanceAfter: balance });
    }
  }

  var base = "/success.html?status=" + encodeURIComponent(terminal)
    + "&utr=" + encodeURIComponent(utr)
    + "&amount=" + encodeURIComponent(amount)
    + "&pa=" + encodeURIComponent(upiId)
    + "&refId=" + encodeURIComponent(refId);
  if (reference) base += "&reference=" + encodeURIComponent(reference);

  if (terminal === "completed") {
    res.redirect(base);
  } else {
    res.redirect("/failure.html?status=" + encodeURIComponent(terminal)
      + "&utr=" + encodeURIComponent(utr)
      + "&amount=" + encodeURIComponent(amount)
      + "&pa=" + encodeURIComponent(upiId));
  }
});

// ---------- Protected API ----------
app.use("/api", requireAuth);

// POST /api/v1/transactions (idempotent, 202 Accepted)
app.post("/api/v1/transactions", function (req, res) {
  var body = req.body;
  var reference = body.reference;
  var type = body.type || "credit";
  var amount = body.amount;
  var description = body.description || "";
  var upiId = body.upiId || MERCHANT.upiId;

  if (!reference || amount === undefined || amount === null) {
    return res.status(400).json({ error: "reference and amount are required" });
  }

  var key = MERCHANT.id + ":" + reference;
  var cached = idempotency.get(key);
  if (cached) {
    return res.status(cached.status).set("Idempotency-Replayed", "true").json(cached.response);
  }

  var txn = ledger.createTransaction({
    reference: reference,
    merchantId: MERCHANT.id,
    type: type,
    amount: amount,
    description: description,
    upiId: upiId,
  });

  var response = { id: txn.id, status: txn.status, reference: txn.reference };
  idempotency.set(key, { status: 202, response: response, txnId: txn.id });
  return res.status(202).json(response);
});

app.get("/api/v1/transactions/:id", function (req, res) {
  var txn = ledger.getTransaction(req.params.id);
  if (!txn) return res.status(404).json({ error: "transaction not found" });
  res.json(txn);
});

app.get("/api/v1/transactions", function (req, res) {
  var result = ledger.listTransactions({
    merchantId: MERCHANT.id,
    status: req.query.status,
    page: parseInt(req.query.page) || 1,
    limit: parseInt(req.query.limit) || 20,
  });
  res.json(result);
});

app.get("/api/v1/balance", function (req, res) {
  res.json({ merchantId: MERCHANT.id, balance: ledger.getBalance(MERCHANT.id) });
});

app.get("/api/v1/ledger", function (req, res) {
  var result = ledger.listLedger({
    merchantId: MERCHANT.id,
    page: parseInt(req.query.page) || 1,
    limit: parseInt(req.query.limit) || 20,
  });
  res.json(result);
});

// ---------- Protected HTML: ledger dashboard ----------
app.get("/ledger", requireAuth, function (req, res) {
  res.sendFile(path.join(__dirname, "ledger.html"));
});

// ---------- Static frontend (public pages: opay.html, index.html, success, failure) ----------
app.use(express.static(__dirname));

var server = app.listen(port, function () {
  console.log("Server running at http://localhost:" + port);
});
