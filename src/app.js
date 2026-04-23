/**
 * app.js
 *
 * Express app setup — separated from server.js so the test suite
 * can import the app directly without binding to a port.
 */

const express = require("express");
const loanRoutes = require("./loanRoutes");

const app = express();

app.use(express.json());

// Health check
app.get("/", (req, res) => {
  res.json({
    status: "ok",
    message: "Loan Repayment Tracker API is running",
    endpoints: {
      "POST /loans": "Create a loan",
      "GET /loans": "List all loans",
      "GET /loans/:id": "Get a loan",
      "DELETE /loans/:id": "Delete a loan",
      "POST /loans/:id/payments": "Log a payment",
      "GET /loans/:id/balance": "Get balance summary",
    },
  });
});

app.use("/loans", loanRoutes);

// 404 for unknown routes
app.use((req, res) => {
  res.status(404).json({ error: `Route ${req.method} ${req.path} not found` });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: "Internal server error" });
});

module.exports = app;
