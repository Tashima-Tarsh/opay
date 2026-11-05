# OPay powered by UpiPay

The merchant creates a payment link from the home page. Customers can scan the
QR code or open their UPI app. The checkout status link calls
`/callback?reference=<order-id>` and displays the order's current state.
The browser return does not confirm a payment. Confirm it in the merchant
ledger after checking the bank record and UPI transaction reference.

See [UpiPay setup](upipay/README.md#run-the-browser-checkout) for local setup.
The existing Render service uses `npm ci --omit=dev` to install and build
UpiPay and `npm start` to launch it. It reuses `MERCHANT_UPI_ID`,
`OPAY_ADMIN_USER` and `OPAY_ADMIN_PASSWORD` from its environment.
If `OPAY_ADMIN_USER` is unset, the username defaults to `admin`.
On Render's free service, the local order file can be lost on a restart or
redeploy.
