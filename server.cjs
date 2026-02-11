require("dotenv").config();

const express = require("express");
const fs = require("fs");
const path = require("path");
const { parse } = require("csv-parse/sync");

const app = express();
const PORT = 8080;

app.use(express.json());
app.use(express.static("public"));

/* ================================
   LOAD SAFMR + FMR DATA
================================ */

function cleanMoney(val) {
  if (!val) return 0;
  return parseInt(val.replace(/[$,]/g, "").trim());
}

function loadCSV(filePath) {
  const raw = fs.readFileSync(path.join(__dirname, filePath));
  return parse(raw, { columns: true, skip_empty_lines: true });
}

console.log("🔄 Loading SAFMR data...");
const safmrData = loadCSV("fy2024_safmrs.clean.csv");
console.log("🏠 SAFMR loaded:", safmrData.length);

console.log("🔄 Loading FMR Metro data...");
const fmrMetroData = loadCSV("fy2024_fmr_metro.csv");
console.log("🌆 FMR Metro loaded:", fmrMetroData.length);

/* ================================
   RENT LOOKUP ENGINE
================================ */

function getRent(zip, bedrooms) {
  // 1️⃣ Try SAFMR first
  const safmrRow = safmrData.find(
    (row) => row["ZIP Code"] === zip
  );

  if (safmrRow) {
    const rent = cleanMoney(
      safmrRow[`SAFMR ${bedrooms}BR`]
    );

    return {
      rent,
      metro: safmrRow["HUD Metro Fair Market Rent Area Name"],
      source: "HUD SAFMR 2024"
    };
  }

  // 2️⃣ Fallback to Metro FMR
  const fmrRow = fmrMetroData.find(
    (row) => row["ZIP Code"] === zip || row["ZIP\nCode"] === zip
  );

  if (fmrRow) {
    const rent = cleanMoney(
      fmrRow[`erap_fmr_br${bedrooms}`] ||
      fmrRow[`erap_fmr_br${bedrooms}`]
    );

    return {
      rent,
      metro: fmrRow["HUD Metro Fair Market Rent Area Name"],
      source: "HUD FMR 2024"
    };
  }

  return null;
}

/* ================================
   MORTGAGE CALC
================================ */

function calculateMortgage(
  purchasePrice,
  downPaymentPct,
  interestRate
) {
  const down = purchasePrice * (downPaymentPct / 100);
  const loan = purchasePrice - down;

  const monthlyRate = interestRate / 100 / 12;
  const months = 30 * 12;

  const payment =
    (loan *
      monthlyRate *
      Math.pow(1 + monthlyRate, months)) /
    (Math.pow(1 + monthlyRate, months) - 1);

  return Math.round(payment);
}

/* ================================
   STRATEGY ENGINE
================================ */

function strategyEngine(monthlyCashFlow) {
  if (monthlyCashFlow > 400) {
    return {
      strategy: "hold",
      verdict: "Strong rental. Buy and hold."
    };
  }

  if (monthlyCashFlow > 0) {
    return {
      strategy: "hold",
      verdict: "Break-even rental. Conservative hold."
    };
  }

  return {
    strategy: "pass",
    verdict: "Negative cash flow. Bad deal."
  };
}

/* ================================
   MAIN API
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
    return res.status(400).json({
      error: "zip and bedrooms required"
    });
  }

  const rentData = getRent(zip, bedrooms);

  if (!rentData) {
    return res.status(404).json({
      error: "No HUD rent data found",
      zip
    });
  }

  let mortgage = 0;
  let monthlyCashFlow = null;
  let strategy = null;
  let verdict = null;

  if (
    purchasePrice &&
    downPaymentPct !== undefined &&
    interestRate
  ) {
    mortgage = calculateMortgage(
      purchasePrice,
      downPaymentPct,
      interestRate
    );

    monthlyCashFlow = rentData.rent - mortgage;

    const decision = strategyEngine(monthlyCashFlow);
    strategy = decision.strategy;
    verdict = decision.verdict;
  }

  return res.json({
    address,
    zip,
    bedrooms,
    rent: rentData.rent,
    metro: rentData.metro,
    source: rentData.source,
    mortgage,
    monthlyCashFlow,
    strategy,
    verdict
  });
});

/* ================================
   START SERVER
================================ */

app.listen(PORT, () => {
  console.log(`🚀 ALEX running at http://localhost:${PORT}`);
});