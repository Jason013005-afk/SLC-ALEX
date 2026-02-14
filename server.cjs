require("dotenv").config();

const express = require("express");
const fs = require("fs");
const path = require("path");
const csv = require("csv-parser");

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 8080;

/* ===============================
   ZIP NORMALIZATION
================================ */
function normalizeZip(zip) {
  if (!zip) return null;
  return zip.toString().padStart(5, "0");
}

/* ===============================
   LOAD SAFMR DATA
================================ */
const safmrData = new Map();

function cleanMoney(value) {
  if (!value) return 0;
  return Number(value.toString().replace(/[$,"]/g, ""));
}

function loadSAFMR() {
  return new Promise((resolve, reject) => {
    const filePath = path.join(__dirname, process.env.SAFMR_FILE);

    console.log("🔄 Loading SAFMR data...");

    fs.createReadStream(filePath)
      .pipe(csv())
      .on("data", (row) => {
        const zip = normalizeZip(row["ZIP Code"]);
        safmrData.set(zip, row);
      })
      .on("end", () => {
        console.log("🏠 SAFMR loaded:", safmrData.size);
        resolve();
      })
      .on("error", reject);
  });
}

/* ===============================
   DEAL CALCULATIONS
================================ */
function calculateMortgage(principal, rate, termYears) {
  const monthlyRate = rate / 100 / 12;
  const payments = termYears * 12;

  if (monthlyRate === 0) return principal / payments;

  return (
    (principal * monthlyRate) /
    (1 - Math.pow(1 + monthlyRate, -payments))
  );
}

/* ===============================
   API ROUTE
================================ */
app.post("/api/analyze", (req, res) => {
  try {
    const inputZip = normalizeZip(req.body.zip);
    const bedrooms = Number(req.body.bedrooms);

    if (!inputZip || !bedrooms) {
      return res.status(400).json({ error: "zip and bedrooms required" });
    }

    const row = safmrData.get(inputZip);

    if (!row) {
      return res.status(404).json({ error: "No HUD rent data found" });
    }

    const rentField = `SAFMR ${bedrooms}BR`;
    const rent = cleanMoney(row[rentField]);

    if (!rent) {
      return res.status(404).json({ error: "No rent found for bedroom count" });
    }

    /* ===== Financial Inputs ===== */
    const purchasePrice = Number(req.body.purchasePrice || 0);
    const downPaymentPct = Number(req.body.downPaymentPct || 0);
    const interestRate = Number(req.body.interestRate || 0);
    const rehab = Number(req.body.rehab || 0);

    const vacancyRate = Number(process.env.DEFAULT_VACANCY_RATE || 8) / 100;
    const expenseRate = Number(process.env.DEFAULT_EXPENSE_RATE || 35) / 100;
    const loanTerm = Number(process.env.DEFAULT_LOAN_TERM_YEARS || 30);

    /* ===== Income ===== */
    const effectiveRent = rent * (1 - vacancyRate);
    const annualRent = effectiveRent * 12;
    const annualExpenses = annualRent * expenseRate;
    const annualNOI = annualRent - annualExpenses;

    /* ===== Financing ===== */
    const downPayment = purchasePrice * (downPaymentPct / 100);
    const loanAmount = purchasePrice - downPayment;

    const monthlyMortgage =
      loanAmount > 0
        ? calculateMortgage(loanAmount, interestRate, loanTerm)
        : 0;

    const annualDebt = monthlyMortgage * 12;
    const cashFlow = annualNOI - annualDebt;
    const capRate = purchasePrice > 0 ? (annualNOI / purchasePrice) * 100 : 0;
    const dscr = annualDebt > 0 ? annualNOI / annualDebt : null;

    /* ===== Response ===== */
    res.json({
      zip: inputZip,
      bedrooms,
      rent,
      vacancyRatePct: vacancyRate * 100,
      expenseRatePct: expenseRate * 100,
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

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

/* ===============================
   START SERVER
================================ */
async function start() {
  try {
    await loadSAFMR();
    app.listen(PORT, () => {
      console.log(`🚀 ALEX running at http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error("Failed to start:", err);
  }
}

start();