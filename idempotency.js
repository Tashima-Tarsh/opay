const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "data");
const FILE = path.join(DATA_DIR, "idempotency.json");

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function load() {
  ensureDir();
  if (!fs.existsSync(FILE)) return {};
  try { return JSON.parse(fs.readFileSync(FILE, "utf8")); } catch (e) { return {}; }
}

function save(map) {
  ensureDir();
  fs.writeFileSync(FILE, JSON.stringify(map, null, 2));
}

// From-scratch idempotency store (codecrafters style).
// Key = "merchantId:reference" -> cached response. Periodically flushed to disk.
class IdempotencyStore {
  constructor() {
    this.map = load();
    this.timer = null;
    this._scheduleFlush();
  }
  _scheduleFlush() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => save(this.map), 1000);
    if (this.timer && this.timer.unref) this.timer.unref();
  }
  get(key) { return this.map[key] || null; }
  set(key, value) {
    this.map[key] = value;
    this._scheduleFlush();
  }
  has(key) { return key in this.map; }
}

module.exports = { IdempotencyStore };
