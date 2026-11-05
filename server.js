var express = require("express");
var app = express();
var path = require("path");
var { Ledger } = require("./ledger");
var { IdempotencyStore } = require("./idempotency");

const port = process.argv[2] || 8080;

// From-scratch ledger + idempotency (codecrafters: build your own database / idempotency).
var ledger = new Ledger();
ledger.load();
var idempotency = new IdempotencyStore();

// Default single merchant (opay). In a multi-tenant build this maps X-API-Key -> merchant.
var MERCHANT = { id: "merchant_default", name: "opay Merchant", upiId: "nkumar906099-5@oksbi" };
ledger.ensureMerchant(MERCHANT.id, MERCHANT.name, MERCHANT.upiId);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ---------- API (mirrors payment-ledger-service) ----------

app.get("/health", function (req, res) {
  res.json({ status: "ok", db: "ok", cache: "ok" });
});

// POST /api/v1/transactions  (idempotent, returns 202 Accepted)
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

// ---------- Callback: UPI app returns here after payment ----------
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

// ---------- Static frontend ----------
app.use(express.static(__dirname));

var server = app.listen(port, function () {
  console.log("Server running at http://localhost:" + port);
});
