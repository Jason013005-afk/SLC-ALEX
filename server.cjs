require("dotenv").config();

const express = require("express");
const fs = require("fs");
const path = require("path");
const csv = require("csv-parser");

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 8080;

/* ===========================
   ENV CONFIG
=========================== */

const SAFMR_FILE = process.env.SAFMR_FILE || "fy2024_safmrs_clean.csv";

const DEFAULT_VACANCY = Number(process.env.DEFAULT_VACANCY_RATE) || 8;
const DEFAULT_EXPENSE = Number(process.env.DEFAULT_EXPENSE_RATE) || 35;

/* ===========================
   HELPERS
=========================== */

function normalizeZip(zip) {
  if (!zip) return null;
  return zip.toString().padStart(5, "0");
}

function parseMoney(value) {
  if (!value) return 0;
  return Number(value.replace(/[$,"]/g, ""));
}

function getBedroomColumn(bedrooms) {
  const map = {
    0: "SAFMR 0BR",
    1: "SAFMR 1BR",
    2: "SAFMR 2BR",
    3: "SAFMR 3BR",
    4: "SAFMR 4BR"
  };
  return map[bedrooms];
}

function calculateMortgage(principal, ratePct, termYears = 30) {
  if (!principal || !ratePct) return 0;

  const monthlyRate = ratePct / 100 / 12;
  const payments = termYears * 12;

  return (
    (principal *
      monthlyRate *
      Math.pow(1 + monthlyRate, payments)) /
    (Math.pow(1 + monthlyRate, payments) - 1)
  );
}

/* ===========================
   LOAD HUD DATA
=========================== */

const safmrData = new Map();

console.log("🔄 Loading SAFMR data...");

fs.createReadStream(path.join(__dirname, SAFMR_FILE))
  .pipe(csv())
  .on("data", (row) => {
    const zip = normalizeZip(row["ZIP Code"]);
    safmrData.set(zip, row);
  })
  .on("end", () => {
    console.log("🏠 SAFMR loaded:", safmrData.size);
    startServer();
  })
  .on("error", (err) => {
    console.error("❌ Failed loading SAFMR:", err.message);
  });

/* ===========================
   API ROUTE
=========================== */

app.post("/api/analyze", (req, res) => {
  const {
    zip,
    bedrooms,
    purchasePrice = 0,
    downPaymentPct = 0,
    interestRate = 0,
    rehab = 0
  } = req.body;

  const normalizedZip = normalizeZip(zip);

  const row = safmrData.get(normalizedZip);

  if (!row) {
    return res.status(404).json({
      error: "No HUD rent data found"
    });
  }

  const bedroomColumn = getBedroomColumn(Number(bedrooms));

  if (!bedroomColumn || !row[bedroomColumn]) {
    return res.status(400).json({
      error: "Invalid bedroom count"
    });
  }

  const rent = parseMoney(row[bedroomColumn]);

  /* ===========================
     INVESTMENT MATH
  =========================== */

  const vacancyRate = DEFAULT_VACANCY / 100;
  const expenseRate = DEFAULT_EXPENSE / 100;

  const effectiveRent = rent * (1 - vacancyRate);
  const annualRent = effectiveRent * 12;
  const annualExpenses = annualRent * expenseRate;
  const annualNOI = annualRent - annualExpenses;

  const downPayment = purchasePrice * (downPaymentPct / 100);
  const loanAmount = purchasePrice - downPayment;

  const monthlyMortgage = calculateMortgage(
    loanAmount,
    interestRate
  );

  const annualDebt = monthlyMortgage * 12;

  const cashFlow = annualNOI - annualDebt;

  const capRate =
    purchasePrice > 0
      ? (annualNOI / purchasePrice) * 100
      : 0;

  const dscr =
    annualDebt > 0
      ? annualNOI / annualDebt
      : null;

  /* ===========================
     RESPONSE
  =========================== */

  res.json({
    zip: normalizedZip,
    bedrooms,
    rent,
    vacancyRatePct: DEFAULT_VACANCY,
    expenseRatePct: DEFAULT_EXPENSE,
    effectiveRent: Math.round(effectiveRent),
    annualRent: Math.round(annualRent),
    annualExpenses: Math.round(annualExpenses),
    annualNOI: Math.round(annualNOI),
    mortgage: Math.round(monthlyMortgage),
    annualDebt: Math.round(annualDebt),
    cashFlow: Math.round(cashFlow),
    capRatePct: Number(capRate.toFixed(2)),
    dscr: dscr ? Number(dscr.toFixed(2)) : null
  });
});

/* ===========================
   START SERVER
=========================== */

function startServer() {
  app.listen(PORT, () => {
    console.log(`🚀 ALEX running at http://localhost:${PORT}`);
  });
}