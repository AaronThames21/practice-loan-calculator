/**
 * loanStore.js
 *
 * In-memory data layer for loans and payments.
 *
 * A loan looks like:
 * {
 *   id: "loan_1",
 *   borrowerName: "Jane Smith",
 *   principal: 1000,        // original loan amount in dollars
 *   annualRate: 5.0,        // annual interest rate as a percentage
 *   termMonths: 12,         // number of monthly payments
 *   payments: [             // array of payments made
 *     { amount: 100, date: "2024-01-15", note: "first payment" }
 *   ],
 *   createdAt: "2024-01-01T00:00:00.000Z"
 * }
 */

const loans = new Map();
let nextId = 1;

function createLoan(borrowerName, principal, annualRate, termMonths) {
  const id = `loan_${nextId++}`;
  loans.set(id, {
    id,
    borrowerName,
    principal,
    annualRate,
    termMonths,
    payments: [],
    createdAt: new Date().toISOString(),
  });
  return getLoan(id);
}

function getLoan(id) {
  return loans.get(id) || null;
}

function getAllLoans() {
  return [...loans.values()];
}

function addPayment(loanId, amount, note = "") {
  const loan = loans.get(loanId);
  if (!loan) return null;
  loan.payments.push({
    amount,
    note,
    date: new Date().toISOString(),
  });
  return getLoan(loanId);
}

function deleteLoan(id) {
  return loans.delete(id);
}

// Resets all state — used between tests
function reset() {
  loans.clear();
  nextId = 1;
}

module.exports = {
  createLoan,
  getLoan,
  getAllLoans,
  addPayment,
  deleteLoan,
  reset,
};
