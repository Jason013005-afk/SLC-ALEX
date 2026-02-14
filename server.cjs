require("dotenv").config();
const express = require("express");
const fs = require("fs");
const path = require("path");
const csv = require("csv-parser");
const axios = require("axios");

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 8080;
const SAFMR_FILE = process.env.SAFMR_FILE || "fy2024_safmrs_clean.csv";

let safmrData = {};

// ---------------------------
// LOAD HUD SAFMR CSV
// ---------------------------
function loadSafmr() {
  return new Promise((resolve, reject) => {
    const filePath = path.join(__dirname, SAFMR_FILE);

    if (!fs.existsSync(filePath)) {
      console.error("❌ SAFMR file not found:", filePath);
      process.exit(1);
    }

    fs.createReadStream(filePath)
      .pipe(csv())
      .on("data", (row) => {
        const zip = row["ZIP Code"];
        if (zip) {
          safmrData[zip.padStart(5, "0")] = row;
        }
      })
      .on("end", () => {
        console.log("🏠 SAFMR loaded:", Object.keys(safmrData).length);
        resolve();
      })
      .on("error", reject);
  });
}

// ---------------------------
// CLEAN MONEY STRINGS
// ---------------------------
function cleanMoney(val) {
  if (!val) return 0;
  return parseFloat(val.replace(/[$,]/g, ""));
}

// ---------------------------
// MORTGAGE CALC
// ---------------------------
function calcMortgage(principal, rate, years) {
  const r = rate / 100 / 12;
  const n = years * 12;
  return (
    (principal * r * Math.pow(1 + r, n)) /
    (Math.pow(1 + r, n) - 1)
  );
}

// ---------------------------
// RENTCAST PROPERTY
// ---------------------------
async function getPropertyDetails(address) {
  try {
    const res = await axios.get(
      "https://api.rentcast.io/v1/properties",
      {
        headers: {
          "X-Api-Key": process.env.RENTCAST_API_KEY
        },
        params: { address }
      }
    );

    return res.data[0] || null;
  } catch (err) {
    console.log("⚠️ Property lookup failed");
    return null;
  }
}

// ---------------------------
// RENTCAST ARV
// ---------------------------
async function getARV(address) {
  try {
    const res = await axios.get(
      "https://api.rentcast.io/v1/avm/value",
      {
        headers: {
          "X-Api-Key": process.env.RENTCAST_API_KEY
        },
        params: { address }
      }
    );

    return res.data?.price || null;
  } catch (err) {
    console.log("⚠️ ARV lookup failed");
    return null;
  }
}

// ---------------------------
// MAIN ANALYZE ENDPOINT
// ---------------------------
app.post("/api/analyze", async (req, res) => {
  const {
    zip,
    bedrooms,
    purchasePrice,
    downPaymentPct,
    interestRate,
    rehab,
    address
  } = req.body;

  if (!zip || !bedrooms) {
    return res.status(400).json({ error: "zip and bedrooms required" });
  }

  const row = safmrData[zip];
  if (!row) {
    return res.status(404).json({ error: "No HUD rent data found" });
  }

  const rent = cleanMoney(row[`SAFMR ${bedrooms}BR`]);
  const vacancyRate = parseFloat(process.env.DEFAULT_VACANCY_RATE) || 8;
  const expenseRate = parseFloat(process.env.DEFAULT_EXPENSE_RATE) || 35;

  const effectiveRent = rent * (1 - vacancyRate / 100);
  const annualRent = effectiveRent * 12;
  const annualExpenses = annualRent * (expenseRate / 100);
  const annualNOI = annualRent - annualExpenses;

  let mortgage = 0;
  let annualDebt = 0;
  let capRate = 0;
  let dscr = null;
  let cashFlow = annualNOI;

  if (purchasePrice && downPaymentPct && interestRate) {
    const downPayment = purchasePrice * (downPaymentPct / 100);
    const loanAmount = purchasePrice - downPayment;

    mortgage = calcMortgage(
      loanAmount,
      interestRate,
      parseInt(process.env.DEFAULT_LOAN_TERM_YEARS) || 30
    );

    annualDebt = mortgage * 12;
    cashFlow = annualNOI - annualDebt;
    capRate = (annualNOI / purchasePrice) * 100;
    dscr = annualDebt > 0 ? annualNOI / annualDebt : null;
  }

  // Optional property + ARV pull
  let propertyDetails = null;
  let arv = null;

  if (address && process.env.RENTCAST_API_KEY) {
    propertyDetails = await getPropertyDetails(address);
    arv = await getARV(address);
  }

  res.json({
    zip,
    bedrooms,
    rent,
    vacancyRatePct: vacancyRate,
    expenseRatePct: expenseRate,
    effectiveRent: Math.round(effectiveRent),
    annualRent: Math.round(annualRent),
    annualExpenses: Math.round(annualExpenses),
    annualNOI: Math.round(annualNOI),
    mortgage: Math.round(mortgage),
    annualDebt: Math.round(annualDebt),
    cashFlow: Math.round(cashFlow),
    capRatePct: parseFloat(capRate.toFixed(2)),
    dscr: dscr ? parseFloat(dscr.toFixed(2)) : null,
    arv,
    propertyDetails
  });
});

// ---------------------------
loadSafmr().then(() => {
  app.listen(PORT, () => {
    console.log(`🚀 ALEX running at http://localhost:${PORT}`);
  });
});