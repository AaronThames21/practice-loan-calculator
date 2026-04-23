/**
 * server.js
 *
 * Entry point. Starts the HTTP server.
 * Run:  node src/server.js
 * Dev:  npm run dev
 */

const app = require("./app");

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Loan Repayment Tracker running on http://localhost:${PORT}`);
  console.log(`Health check: curl http://localhost:${PORT}/`);
});
