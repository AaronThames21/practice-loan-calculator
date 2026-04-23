/**
 * loans.test.js
 *
 * Full test suite for the Loan Repayment Tracker API.
 * Run: npm test
 */

const request = require("supertest");
const app = require("../src/app");
const store = require("../src/loanStore");
const {
  calcMonthlyPayment,
  calcRemainingBalance,
  calcTotalPaid,
} = require("../src/balanceCalculator");

beforeEach(() => {
  store.reset();
});

// ─── Helper ───────────────────────────────────────────────────────────────────
async function createTestLoan(overrides = {}) {
  const defaults = {
    borrowerName: "Alex Johnson",
    principal: 1200,
    annualRate: 5,
    termMonths: 12,
  };
  const res = await request(app)
    .post("/loans")
    .send({ ...defaults, ...overrides });
  return res;
}

// ─── POST /loans ──────────────────────────────────────────────────────────────

describe("POST /loans — creating a loan", () => {
  test("creates a loan with valid data", async () => {
    const res = await createTestLoan();
    expect(res.status).toBe(201);
    expect(res.body.id).toBe("loan_1");
    expect(res.body.borrowerName).toBe("Alex Johnson");
    expect(res.body.principal).toBe(1200);
    expect(res.body.payments).toEqual([]);
  });

  test("trims whitespace from borrowerName", async () => {
    const res = await createTestLoan({ borrowerName: "  Alex Johnson  " });
    expect(res.body.borrowerName).toBe("Alex Johnson");
  });

  test("returns 400 if any required field is missing", async () => {
    const res = await request(app)
      .post("/loans")
      .send({ borrowerName: "Alex" });
    expect(res.status).toBe(400);
  });

  test("returns 422 if principal is zero or negative", async () => {
    const res = await createTestLoan({ principal: -100 });
    expect(res.status).toBe(422);
  });

  test("returns 422 if annualRate is negative", async () => {
    const res = await createTestLoan({ annualRate: -1 });
    expect(res.status).toBe(422);
  });

  test("allows 0% APR (Affirm's core product)", async () => {
    const res = await createTestLoan({ annualRate: 0 });
    expect(res.status).toBe(201);
    expect(res.body.annualRate).toBe(0);
  });

  test("returns 422 if termMonths is not an integer", async () => {
    const res = await createTestLoan({ termMonths: 1.5 });
    expect(res.status).toBe(422);
  });
});

// ─── GET /loans ───────────────────────────────────────────────────────────────

describe("GET /loans — listing loans", () => {
  test("returns empty list when no loans exist", async () => {
    const res = await request(app).get("/loans");
    expect(res.status).toBe(200);
    expect(res.body.count).toBe(0);
    expect(res.body.loans).toEqual([]);
  });

  test("returns all created loans", async () => {
    await createTestLoan({ borrowerName: "Alice" });
    await createTestLoan({ borrowerName: "Bob" });
    const res = await request(app).get("/loans");
    expect(res.body.count).toBe(2);
  });
});

// ─── GET /loans/:id ───────────────────────────────────────────────────────────

describe("GET /loans/:id — getting one loan", () => {
  test("returns a specific loan by id", async () => {
    await createTestLoan();
    const res = await request(app).get("/loans/loan_1");
    expect(res.status).toBe(200);
    expect(res.body.id).toBe("loan_1");
  });

  test("returns 404 for unknown loan id", async () => {
    const res = await request(app).get("/loans/loan_999");
    expect(res.status).toBe(404);
  });
});

// ─── POST /loans/:id/payments ─────────────────────────────────────────────────

describe("POST /loans/:id/payments — logging payments", () => {
  test("logs a payment successfully", async () => {
    await createTestLoan();
    const res = await request(app)
      .post("/loans/loan_1/payments")
      .send({ amount: 100, note: "January payment" });

    expect(res.status).toBe(201);
    expect(res.body.payments).toHaveLength(1);
    expect(res.body.payments[0].amount).toBe(100);
    expect(res.body.payments[0].note).toBe("January payment");
  });

  test("logs multiple payments", async () => {
    await createTestLoan();
    await request(app).post("/loans/loan_1/payments").send({ amount: 100 });
    await request(app).post("/loans/loan_1/payments").send({ amount: 200 });
    const res = await request(app)
      .post("/loans/loan_1/payments")
      .send({ amount: 150 });

    expect(res.body.payments).toHaveLength(3);
  });

  test("returns 400 if amount is missing", async () => {
    await createTestLoan();
    const res = await request(app).post("/loans/loan_1/payments").send({});
    expect(res.status).toBe(400);
  });

  test("returns 422 if amount is zero or negative", async () => {
    await createTestLoan();
    const res = await request(app)
      .post("/loans/loan_1/payments")
      .send({ amount: -50 });
    expect(res.status).toBe(422);
  });

  test("returns 404 for payments on unknown loan", async () => {
    const res = await request(app)
      .post("/loans/loan_999/payments")
      .send({ amount: 100 });
    expect(res.status).toBe(404);
  });

  test("allows a note to be optional", async () => {
    await createTestLoan();
    const res = await request(app)
      .post("/loans/loan_1/payments")
      .send({ amount: 100 });
    expect(res.status).toBe(201);
    expect(res.body.payments[0].note).toBe("");
  });

  test("warns when payment exceeds remaining balance", async () => {
    await createTestLoan({ principal: 500 });
    const res = await request(app)
      .post("/loans/loan_1/payments")
      .send({ amount: 600 });
    expect(res.status).toBe(201);
    expect(res.body.warning).toBeDefined();
  });
});

// ─── GET /loans/:id/balance ───────────────────────────────────────────────────

describe("GET /loans/:id/balance — balance summary", () => {
  test("returns correct balance with no payments", async () => {
    await createTestLoan({ principal: 1200 });
    const res = await request(app).get("/loans/loan_1/balance");

    expect(res.status).toBe(200);
    expect(res.body.remainingBalance).toBe(1200);
    expect(res.body.totalPaid).toBe(0);
    expect(res.body.paymentCount).toBe(0);
    expect(res.body.isFullyPaid).toBe(false);
  });

  test("reflects payments in the balance", async () => {
    await createTestLoan({ principal: 1200 });
    await request(app).post("/loans/loan_1/payments").send({ amount: 400 });
    await request(app).post("/loans/loan_1/payments").send({ amount: 400 });

    const res = await request(app).get("/loans/loan_1/balance");
    expect(res.body.totalPaid).toBe(800);
    expect(res.body.remainingBalance).toBe(400);
    expect(res.body.paymentCount).toBe(2);
  });

  test("marks loan as fully paid when balance hits zero", async () => {
    await createTestLoan({ principal: 500 });
    await request(app).post("/loans/loan_1/payments").send({ amount: 500 });

    const res = await request(app).get("/loans/loan_1/balance");
    expect(res.body.remainingBalance).toBe(0);
    expect(res.body.isFullyPaid).toBe(true);
  });

  test("returns 404 for unknown loan", async () => {
    const res = await request(app).get("/loans/loan_999/balance");
    expect(res.status).toBe(404);
  });
});

// ─── DELETE /loans/:id ────────────────────────────────────────────────────────

describe("DELETE /loans/:id — deleting a loan", () => {
  test("deletes a loan successfully", async () => {
    await createTestLoan();
    const res = await request(app).delete("/loans/loan_1");
    expect(res.status).toBe(200);

    const check = await request(app).get("/loans/loan_1");
    expect(check.status).toBe(404);
  });

  test("returns 404 when deleting non-existent loan", async () => {
    const res = await request(app).delete("/loans/loan_999");
    expect(res.status).toBe(404);
  });
});

// ─── Calculator unit tests ────────────────────────────────────────────────────

describe("balanceCalculator — pure math functions", () => {
  test("calcMonthlyPayment — standard loan", () => {
    const payment = calcMonthlyPayment(1200, 5, 12);
    expect(payment).toBe(102.73); // verified against standard amortization formula
  });

  test("calcMonthlyPayment — 0% APR divides evenly", () => {
    const payment = calcMonthlyPayment(1200, 0, 12);
    expect(payment).toBe(100);
  });

  test("calcTotalPaid — sums all payment amounts", () => {
    const payments = [{ amount: 100 }, { amount: 200 }, { amount: 150 }];
    expect(calcTotalPaid(payments)).toBe(450);
  });

  test("calcRemainingBalance — principal minus total paid", () => {
    const payments = [{ amount: 300 }, { amount: 300 }];
    expect(calcRemainingBalance(1200, payments)).toBe(600);
  });

  test("calcRemainingBalance — never goes below zero", () => {
    const payments = [{ amount: 2000 }];
    expect(calcRemainingBalance(1200, payments)).toBe(0);
  });
});
