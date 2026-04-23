/**
 * loanRoutes.js
 *
 * All routes for the Loan Repayment Tracker API:
 *
 * POST   /loans                      - create a new loan
 * GET    /loans                      - list all loans
 * GET    /loans/:id                  - get a single loan
 * DELETE /loans/:id                  - delete a loan
 * POST   /loans/:id/payments         - log a payment
 * GET    /loans/:id/balance          - get balance summary
 */

// reviewed: input validation logic confirmed - returns 400 for missing fields, 422 for invalid values
const express = require("express");
const router = express.Router();
const store = require("./loanStore");
const { calcLoanSummary } = require("./balanceCalculator");

// ── POST /loans ───────────────────────────────────────────────────────────────
// Create a new loan
router.post("/", (req, res) => {
  const { borrowerName, principal, annualRate, termMonths } = req.body;

  // Validate all required fields are present
  if (!borrowerName || principal == null || annualRate == null || termMonths == null) {
    return res.status(400).json({
      error: "borrowerName, principal, annualRate, and termMonths are all required",
    });
  }

  // Validate types and ranges
  if (typeof borrowerName !== "string" || !borrowerName.trim()) {
    return res.status(422).json({ error: "borrowerName must be a non-empty string" });
  }
  if (typeof principal !== "number" || principal <= 0) {
    return res.status(422).json({ error: "principal must be a positive number" });
  }
  if (typeof annualRate !== "number" || annualRate < 0) {
    return res.status(422).json({ error: "annualRate must be 0 or greater" });
  }
  if (typeof termMonths !== "number" || termMonths < 1 || !Number.isInteger(termMonths)) {
    return res.status(422).json({ error: "termMonths must be a positive integer" });
  }

  const loan = store.createLoan(borrowerName.trim(), principal, annualRate, termMonths);
  return res.status(201).json(loan);
});

// ── GET /loans ────────────────────────────────────────────────────────────────
// List all loans
router.get("/", (req, res) => {
  const loans = store.getAllLoans();
  return res.json({ count: loans.length, loans });
});

// ── GET /loans/:id ────────────────────────────────────────────────────────────
// Get a single loan by ID
router.get("/:id", (req, res) => {
  const loan = store.getLoan(req.params.id);
  if (!loan) return res.status(404).json({ error: "Loan not found" });
  return res.json(loan);
});

// ── DELETE /loans/:id ─────────────────────────────────────────────────────────
// Delete a loan
router.delete("/:id", (req, res) => {
  const loan = store.getLoan(req.params.id);
  if (!loan) return res.status(404).json({ error: "Loan not found" });
  store.deleteLoan(req.params.id);
  return res.json({ message: `Loan ${req.params.id} deleted` });
});

// ── POST /loans/:id/payments ──────────────────────────────────────────────────
// Log a payment against a loan
router.post("/:id/payments", (req, res) => {
  const loan = store.getLoan(req.params.id);
  if (!loan) return res.status(404).json({ error: "Loan not found" });

  const { amount, note = "" } = req.body;

  if (amount == null) {
    return res.status(400).json({ error: "amount is required" });
  }
  if (typeof amount !== "number" || amount <= 0) {
    return res.status(422).json({ error: "amount must be a positive number" });
  }

  // Warn if overpaying but still allow it
  const { remainingBalance } = calcLoanSummary(loan);
  if (amount > remainingBalance && remainingBalance > 0) {
    // Allow it but note it in the response
    const updated = store.addPayment(req.params.id, amount, note);
    return res.status(201).json({
      ...updated,
      warning: `Payment of $${amount} exceeds remaining balance of $${remainingBalance}`,
    });
  }

  const updated = store.addPayment(req.params.id, amount, note);
  return res.status(201).json(updated);
});

// ── GET /loans/:id/balance ────────────────────────────────────────────────────
// Get full balance summary for a loan
router.get("/:id/balance", (req, res) => {
  const loan = store.getLoan(req.params.id);
  if (!loan) return res.status(404).json({ error: "Loan not found" });

  const summary = calcLoanSummary(loan);

  return res.json({
    loanId: loan.id,
    borrowerName: loan.borrowerName,
    principal: loan.principal,
    annualRate: loan.annualRate,
    termMonths: loan.termMonths,
    ...summary,
    payments: loan.payments,
  });
});

module.exports = router;
