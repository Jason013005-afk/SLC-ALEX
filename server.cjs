// ===============================
// ALEX - Clean Production Server
// ===============================

require("dotenv").config();

const express = require("express");
const fs = require("fs");
const path = require("path");
const csv = require("csv-parser");

const app = express();
app.use(express.json());

// ===============================
// CONFIG (with safe fallbacks)
// ===============================

const PORT = process.env.PORT || 8080;

const SAFMR_FILE =
  process.env.SAFMR_FILE || "fy2024_safmrs_clean.csv";

const DEFAULT_VACANCY =
  parseFloat(process.env.DEFAULT_VACANCY_RATE) || 8;

const DEFAULT_EXPENSE =
  parseFloat(process.env.DEFAULT_EXPENSE_RATE) || 35;

const LOAN_TERM_YEARS =
  parseInt(process.env.DEFAULT_LOAN_TERM_YEARS) || 30;

// ===============================
// DATA STORE
// ===============================

let safmrData = {};

// ===============================
// HELPERS
// ===============================

function padZip(zip) {
  return zip.toString().padStart(5, "0");
}

function cleanMoney(val) {
  if (!val) return 0;
  return parseInt(val.replace(/[^0-9]/g, ""));
}

function calcMortgage(principal, rate, years) {
  const monthlyRate = rate / 100 / 12;
  const payments = years * 12;

  if (!principal || !rate) return 0;

  return (
    (principal *
      monthlyRate *
      Math.pow(1 + monthlyRate, payments)) /
    (Math.pow(1 + monthlyRate, payments) - 1)
  );
}

// ===============================
// LOAD SAFMR
// ===============================

function loadSafmr() {
  return new Promise((resolve, reject) => {
    const filePath = path.join(__dirname, SAFMR_FILE);

    if (!fs.existsSync(filePath)) {
      console.error("❌ SAFMR FILE NOT FOUND:", filePath);
      return reject("SAFMR file missing");
    }

    fs.createReadStream(filePath)
      .pipe(csv())
      .on("data", (row) => {
        const zip = padZip(row["ZIP Code"]);
        safmrData[zip] = {
          metro: row["HUD Metro Fair Market Rent Area Name"],
          rent0: cleanMoney(row["SAFMR 0BR"]),
          rent1: cleanMoney(row["SAFMR 1BR"]),
          rent2: cleanMoney(row["SAFMR 2BR"]),
          rent3: cleanMoney(row["SAFMR 3BR"]),
          rent4: cleanMoney(row["SAFMR 4BR"])
        };
      })
      .on("end", () => {
        console.log("🏠 SAFMR loaded:", Object.keys(safmrData).length);
        resolve();
      })
      .on("error", reject);
  });
}

// ===============================
// API ROUTE
// ===============================

app.post("/api/analyze", (req, res) => {
  const {
    zip,
    bedrooms,
    purchasePrice,
    downPaymentPct,
    interestRate,
    rehab
  } = req.body;

  if (!zip || !bedrooms) {
    return res.status(400).json({
      error: "zip and bedrooms required"
    });
  }

  const formattedZip = padZip(zip);

  if (!safmrData[formattedZip]) {
    return res.status(404).json({
      error: "No HUD rent data found"
    });
  }

  const rent =
    safmrData[formattedZip][`rent${bedrooms}`];

  // ===============================
  // RENTAL CALCULATIONS
  // ===============================

  const vacancyRate = DEFAULT_VACANCY / 100;
  const expenseRate = DEFAULT_EXPENSE / 100;

  const effectiveRent = Math.round(rent * (1 - vacancyRate));
  const annualRent = effectiveRent * 12;
  const annualExpenses = Math.round(annualRent * expenseRate);
  const annualNOI = annualRent - annualExpenses;

  let mortgage = 0;
  let annualDebt = 0;
  let dscr = null;
  let cashFlow = annualNOI;

  if (purchasePrice && downPaymentPct && interestRate) {
    const downPayment = purchasePrice * (downPaymentPct / 100);
    const loanAmount = purchasePrice - downPayment;

    mortgage = Math.round(
      calcMortgage(loanAmount, interestRate, LOAN_TERM_YEARS)
    );

    annualDebt = mortgage * 12;
    dscr = parseFloat((annualNOI / annualDebt).toFixed(2));
    cashFlow = annualNOI - annualDebt;
  }

  return res.json({
    zip: formattedZip,
    bedrooms,
    rent,
    vacancyRatePct: DEFAULT_VACANCY,
    expenseRatePct: DEFAULT_EXPENSE,
    effectiveRent,
    annualRent,
    annualExpenses,
    annualNOI,
    mortgage,
    annualDebt,
    cashFlow,
    capRatePct: purchasePrice
      ? parseFloat(((annualNOI / purchasePrice) * 100).toFixed(2))
      : 0,
    dscr
  });
});

// ===============================
// START SERVER
// ===============================

async function start() {
  try {
    await loadSafmr();
    app.listen(PORT, () => {
      console.log("🚀 ALEX running at http://localhost:" + PORT);
    });
  } catch (err) {
    console.error("Startup failed:", err);
  }
}

start();