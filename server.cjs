const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static("public"));

/* ============================================================
   CONFIG — Investor Assumptions
============================================================ */

const OPERATING_EXPENSE_RATIO = 0.35; // 35% of rent
const TARGET_CAP_RATE = 0.08;         // 8% cap rate
const FLIP_RULE = 0.7;                // 70% rule
const WHOLESALE_FEE = 15000;          // assignment fee target

/* ============================================================
   CSV LOADER
============================================================ */

function loadCSV(filePath) {
  const raw = fs.readFileSync(filePath, "utf8");
  const lines = raw.split("\n").slice(1);

  return lines
    .filter(Boolean)
    .map(line => {
      const cols = line.split(",");
      return cols.map(c => c.replace(/"/g, "").trim());
    });
}

/* ============================================================
   LOAD HUD DATA
============================================================ */

console.log("🔄 Loading HUD data...");

const SAFMR = loadCSV(path.join(__dirname, "fy2024_safmrs.clean.csv"));
const FMR_METRO = loadCSV(path.join(__dirname, "fy2024_fmr_metro.csv"));

console.log("🏠 SAFMR loaded:", SAFMR.length);
console.log("🌆 FMR Metro loaded:", FMR_METRO.length);

/* ============================================================
   RENT LOOKUP
============================================================ */

function getRent(zip, bedrooms) {
  // SAFMR first
  const safmrRow = SAFMR.find(r => r[0] === zip);
  if (safmrRow) {
    const rent = parseInt(safmrRow[bedrooms + 1]);
    if (!isNaN(rent)) {
      return {
        rent,
        source: "HUD SAFMR 2024",
        metro: safmrRow[1] || "N/A"
      };
    }
  }

  // FMR fallback
  const fmrRow = FMR_METRO.find(r => r[2] === zip);
  if (fmrRow) {
    const rentStr = fmrRow[bedrooms + 3];
    const rent = parseInt(rentStr?.replace(/\$/g, "").replace(/,/g, ""));
    if (!isNaN(rent)) {
      return {
        rent,
        source: "HUD FMR 2024",
        metro: fmrRow[0]
      };
    }
  }

  return null;
}

/* ============================================================
   MORTGAGE CALCULATOR
============================================================ */

function calculateMortgage(price, downPct, rate) {
  const loan = price * (1 - downPct / 100);
  const monthlyRate = rate / 100 / 12;
  const payments = 30 * 12;

  return Math.round(
    (loan * monthlyRate) /
      (1 - Math.pow(1 + monthlyRate, -payments))
  );
}

/* ============================================================
   INVESTOR ENGINE
============================================================ */

function analyzeDeal(data) {
  const {
    zip,
    bedrooms,
    purchasePrice = 0,
    downPaymentPct = 20,
    interestRate = 7,
    rehab = 0
  } = data;

  const rentData = getRent(zip, bedrooms);
  if (!rentData) {
    return { error: "No HUD rent data found", zip };
  }

  const { rent, source, metro } = rentData;

  /* -----------------------
     RENTAL ANALYSIS
  ----------------------- */

  const mortgage = calculateMortgage(
    purchasePrice,
    downPaymentPct,
    interestRate
  );

  const annualRent = rent * 12;
  const annualExpenses = annualRent * OPERATING_EXPENSE_RATIO;
  const annualNOI = annualRent - annualExpenses;

  const monthlyCashFlow = Math.round(
    rent - mortgage - annualExpenses / 12
  );

  const capRate = annualNOI / purchasePrice;

  /* -----------------------
     ARV (Cap Rate Based)
  ----------------------- */

  const arv = Math.round(annualNOI / TARGET_CAP_RATE);

  /* -----------------------
     FLIP ANALYSIS (70% rule)
  ----------------------- */

  const maxFlipOffer = Math.round(arv * FLIP_RULE - rehab);
  const flipMargin = arv - purchasePrice - rehab;

  /* -----------------------
     WHOLESALE ANALYSIS
  ----------------------- */

  const wholesaleMax = maxFlipOffer - WHOLESALE_FEE;
  const wholesaleSpread = purchasePrice <= wholesaleMax;

  /* -----------------------
     STRATEGY DECISION
  ----------------------- */

  let strategy = "pass";
  let verdict = "Bad deal.";

  if (monthlyCashFlow > 300 && capRate >= 0.08) {
    strategy = "buy_hold";
    verdict = "Excellent rental. Strong cash flow.";
  } else if (monthlyCashFlow > 0) {
    strategy = "buy_hold";
    verdict = "Good rental. Positive cash flow.";
  }

  if (purchasePrice <= maxFlipOffer) {
    strategy = "flip";
    verdict = "Strong flip candidate (meets 70% rule).";
  }

  if (wholesaleSpread) {
    strategy = "wholesale";
    verdict = "Wholesale opportunity.";
  }

  return {
    address: data.address,
    zip,
    bedrooms,
    rent,
    metro,
    source,

    purchasePrice,
    rehab,

    mortgage,
    monthlyCashFlow,
    capRate: Number(capRate.toFixed(3)),

    arv,
    maxFlipOffer,
    flipMargin,

    wholesaleMax,

    strategy,
    verdict
  };
}

/* ============================================================
   API
============================================================ */

app.post("/api/analyze", (req, res) => {
  const result = analyzeDeal(req.body);
  res.json(result);
});

/* ============================================================
   START SERVER
============================================================ */

const PORT = 8080;
app.listen(PORT, () => {
  console.log(`🚀 ALEX running at http://localhost:${PORT}`);
});