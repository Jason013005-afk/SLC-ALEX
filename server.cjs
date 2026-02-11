require("dotenv").config();
const express = require("express");
const fs = require("fs");
const path = require("path");
const { parse } = require("csv-parse/sync");

const decisionEngine = require("./decisionEngine");

const app = express();
const PORT = 8080;

app.use(express.json());
app.use(express.static("public"));

/* ================================
   LOAD SAFMR DATA (ZIP BASED)
================================ */

let safmrData = {};

function loadSAFMR() {
  console.log("🔄 Loading SAFMR data...");

  const filePath = path.join(__dirname, "fy2024_safmrs.clean.csv");

  if (!fs.existsSync(filePath)) {
    console.error("❌ SAFMR file not found.");
    return;
  }

  const file = fs.readFileSync(filePath);

  const records = parse(file, {
    columns: true,
    skip_empty_lines: true,
  });

  records.forEach(row => {
    const zip = String(row["ZIP Code"]).trim().padStart(5, "0");

    safmrData[zip] = {
      metro: row["HUD Metro Fair Market Rent Area Name"],
      rents: {
        0: parseMoney(row["SAFMR 0BR"]),
        1: parseMoney(row["SAFMR 1BR"]),
        2: parseMoney(row["SAFMR 2BR"]),
        3: parseMoney(row["SAFMR 3BR"]),
        4: parseMoney(row["SAFMR 4BR"])
      }
    };
  });

  console.log(`🏠 SAFMR loaded: ${Object.keys(safmrData).length}`);
}

function parseMoney(value) {
  if (!value) return 0;
  return Number(value.replace(/[$,]/g, ""));
}

loadSAFMR();

/* ================================
   MORTGAGE CALC
================================ */

function calculateMortgage(principal, annualRate, years = 30) {
  const monthlyRate = annualRate / 100 / 12;
  const payments = years * 12;

  if (monthlyRate === 0) return principal / payments;

  return (
    principal *
    (monthlyRate * Math.pow(1 + monthlyRate, payments)) /
    (Math.pow(1 + monthlyRate, payments) - 1)
  );
}

/* ================================
   API
================================ */

app.post("/api/analyze", (req, res) => {
  const {
    address,
    zip,
    bedrooms,
    interestRate,
    purchasePrice,
    downPaymentPct,
    rehab = 0
  } = req.body;

  if (!zip || bedrooms === undefined) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  const cleanZip = String(zip).trim().padStart(5, "0");

  const row = safmrData[cleanZip];

  if (!row) {
    return res.status(404).json({
      error: "No HUD SAFMR data found",
      zip: cleanZip
    });
  }

  const rent = row.rents[bedrooms];

  if (!rent) {
    return res.status(404).json({
      error: "No rent for that bedroom count",
      bedrooms
    });
  }

  /* ===== DEAL MATH ===== */

  const downPayment = purchasePrice * (downPaymentPct / 100);
  const loanAmount = purchasePrice - downPayment;
  const mortgage = Math.round(calculateMortgage(loanAmount, interestRate));
  const monthlyCashFlow = Math.round(rent - mortgage);

  /* ===== DECISION ENGINE ===== */

  const decision = decisionEngine({
    rent,
    monthlyCashFlow,
    purchasePrice,
    rehab
  });

  return res.json({
    address,
    zip: cleanZip,
    bedrooms,
    rent,
    metro: row.metro,
    source: "HUD SAFMR 2024",
    mortgage,
    monthlyCashFlow,
    strategy: decision.strategy,
    verdict: decision.verdict
  });
});

/* ================================
   START SERVER
================================ */

app.listen(PORT, () => {
  console.log(`🚀 ALEX running at http://localhost:${PORT}`);
});