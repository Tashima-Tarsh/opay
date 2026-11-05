const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const DATA_DIR = path.join(__dirname, "data");
const LOG_FILE = path.join(DATA_DIR, "ledger.log");

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function appendLog(entry) {
  ensureDir();
  fs.appendFileSync(LOG_FILE, JSON.stringify(entry) + "\n");
}

// From-scratch append-only ledger (codecrafters "build your own database" style).
// Every mutation is appended to ledger.log as a JSON line; the in-memory index is
// rebuilt by replaying the log on startup. This gives durability + a natural audit trail.
class Ledger {
  constructor() {
    this.merchants = new Map();
    this.transactions = new Map();
    this.byReference = new Map();
    this.entries = [];
    this._loaded = false;
  }

  load() {
    if (this._loaded) return;
    ensureDir();
    if (fs.existsSync(LOG_FILE)) {
      fs.readFileSync(LOG_FILE, "utf8")
        .split("\n")
        .filter(Boolean)
        .forEach((line) => {
          try { this._apply(JSON.parse(line)); } catch (e) { /* ignore corrupt lines */ }
        });
    }
    this._loaded = true;
  }

  _apply(e) {
    switch (e.type) {
      case "merchant": this.merchants.set(e.id, e); break;
      case "transaction":
        this.transactions.set(e.id, e);
        if (e.reference) this.byReference.set(e.reference, e.id);
        break;
      case "ledger_entry": this.entries.push(e); break;
    }
  }

  ensureMerchant(id, name, upiId) {
    if (!this.merchants.has(id)) {
      const m = { id, name, upiId, balance: 0, createdAt: Date.now() };
      this.merchants.set(id, m);
      appendLog({ type: "merchant", ...m });
    }
    return this.merchants.get(id);
  }

  createTransaction({ reference, merchantId, type = "credit", amount, description = "", upiId }) {
    const id = "txn_" + crypto.randomBytes(8).toString("hex");
    const now = Date.now();
    const txn = {
      id, reference, merchantId, type,
      amount: Number(amount) || 0,
      status: "pending",
      description, upiId,
      utr: "", refId: "",
      createdAt: now, updatedAt: now,
    };
    this.transactions.set(id, txn);
    this.byReference.set(reference, id);
    appendLog({ type: "transaction", ...txn });
    return txn;
  }

  getTransaction(id) { return this.transactions.get(id); }
  getTransactionByReference(reference) {
    const id = this.byReference.get(reference);
    return id ? this.transactions.get(id) : undefined;
  }

  listTransactions({ merchantId, status, page = 1, limit = 20 } = {}) {
    let txns = Array.from(this.transactions.values());
    if (merchantId) txns = txns.filter((t) => t.merchantId === merchantId);
    if (status) txns = txns.filter((t) => t.status === status);
    txns.sort((a, b) => b.createdAt - a.createdAt);
    const total = txns.length;
    const start = (page - 1) * limit;
    return { transactions: txns.slice(start, start + limit), total, page, limit };
  }

  updateTransaction(id, updates) {
    const txn = this.transactions.get(id);
    if (!txn) return undefined;
    Object.assign(txn, updates, { updatedAt: Date.now() });
    appendLog({ type: "transaction", ...txn });
    return txn;
  }

  getBalance(merchantId) {
    let balance = 0;
    for (const txn of this.transactions.values()) {
      if (txn.merchantId !== merchantId) continue;
      if (txn.status === "completed") {
        balance += txn.type === "credit" ? txn.amount : -txn.amount;
      }
    }
    return balance;
  }

  addLedgerEntry({ transactionId, type, amount, balanceAfter }) {
    const id = "entry_" + crypto.randomBytes(8).toString("hex");
    const entry = { id, transactionId, type, amount: Number(amount), balanceAfter, createdAt: Date.now() };
    this.entries.push(entry);
    appendLog({ type: "ledger_entry", ...entry });
    return entry;
  }

  listLedger({ merchantId, page = 1, limit = 20 } = {}) {
    let entries = this.entries;
    if (merchantId) {
      const txnIds = new Set();
      for (const txn of this.transactions.values()) {
        if (txn.merchantId === merchantId) txnIds.add(txn.id);
      }
      entries = entries.filter((e) => txnIds.has(e.transactionId));
    }
    entries = [...entries].sort((a, b) => b.createdAt - a.createdAt);
    const total = entries.length;
    const start = (page - 1) * limit;
    return { entries: entries.slice(start, start + limit), total, page, limit };
  }
}

module.exports = { Ledger };
