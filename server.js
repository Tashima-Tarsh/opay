var express = require("express");
var app = express();
const port = process.argv[2] || 8080;
const path = require("path");

app.use(express.urlencoded({ extended: true }));

// Payment callback endpoint (UPI app returns here after payment)
app.get("/callback", function (req, res) {
  const status = (req.query.status || "pending").toLowerCase();
  const utr = req.query.utr || req.query.txnId || "";
  const amount = req.query.amount || "";
  const upiId = req.query.pa || "";
  const refId = req.query.refId || "";

  if (status === "success") {
    res.redirect(
      "/success.html?status=success&utr=" +
        encodeURIComponent(utr) +
        "&amount=" +
        encodeURIComponent(amount) +
        "&pa=" +
        encodeURIComponent(upiId) +
        "&refId=" +
        encodeURIComponent(refId)
    );
  } else {
    res.redirect(
      "/failure.html?status=" +
        encodeURIComponent(status) +
        "&utr=" +
        encodeURIComponent(utr) +
        "&amount=" +
        encodeURIComponent(amount) +
        "&pa=" +
        encodeURIComponent(upiId)
    );
  }
});

app.use(express.static(__dirname));

var server = app.listen(port, function () {
  console.log("Server running at http://localhost:" + port);
});
