/**
 * balanceCalculator.js
 *
 * Pure functions for loan math. Kept separate from routing so they
 * are easy to unit test and reuse without needing Express running.
 */

/**
 * Calculates the fixed monthly payment for a standard amortizing loan.
 * Uses the standard formula: M = P * [r(1+r)^n] / [(1+r)^n - 1]
 *
 * Handles the 0% APR edge case (no interest — just divide principal by term).
 *
 * @param {number} principal - original loan amount
 * @param {number} annualRate - annual interest rate as a percentage (e.g. 5 for 5%)
 * @param {number} termMonths - number of monthly payments
 * @returns {number} monthly payment rounded to 2 decimal places
 */
function calcMonthlyPayment(principal, annualRate, termMonths) {
  if (annualRate === 0) {
    return parseFloat((principal / termMonths).toFixed(2));
  }
  const r = annualRate / 100 / 12; // monthly interest rate as decimal
  const n = termMonths;
  const payment = (principal * (r * Math.pow(1 + r, n))) / (Math.pow(1 + r, n) - 1);
  return parseFloat(payment.toFixed(2));
}

/**
 * Calculates the total amount paid so far across all payments.
 *
 * @param {Array} payments - array of payment objects from the loan
 * @returns {number} total paid rounded to 2 decimal places
 */
function calcTotalPaid(payments) {
  const total = payments.reduce((sum, p) => sum + p.amount, 0);
  return parseFloat(total.toFixed(2));
}

/**
 * Calculates the remaining balance on a loan.
 * Simple model: remaining = principal - totalPaid.
 * Won't go below zero.
 *
 * @param {number} principal - original loan amount
 * @param {Array} payments - array of payment objects
 * @returns {number} remaining balance rounded to 2 decimal places
 */
function calcRemainingBalance(principal, payments) {
  const totalPaid = calcTotalPaid(payments);
  const remaining = Math.max(0, principal - totalPaid);
  return parseFloat(remaining.toFixed(2));
}

/**
 * Returns a full summary object for a loan's financial status.
 *
 * @param {Object} loan - loan object from loanStore
 * @returns {Object} summary with monthly payment, total paid, remaining balance
 */
function calcLoanSummary(loan) {
  const monthlyPayment = calcMonthlyPayment(loan.principal, loan.annualRate, loan.termMonths);
  const totalPaid = calcTotalPaid(loan.payments);
  const remainingBalance = calcRemainingBalance(loan.principal, loan.payments);
  const percentPaid = loan.principal > 0
    ? parseFloat(((totalPaid / loan.principal) * 100).toFixed(1))
    : 0;

  return {
    monthlyPayment,
    totalPaid,
    remainingBalance,
    percentPaid,
    paymentCount: loan.payments.length,
    isFullyPaid: remainingBalance === 0,
  };
}

module.exports = {
  calcMonthlyPayment,
  calcTotalPaid,
  calcRemainingBalance,
  calcLoanSummary,
};
