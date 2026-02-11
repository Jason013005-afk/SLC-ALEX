const express = require("express");
const fs = require("fs");
const path = require("path");
const csv = require("csv-parser");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static("public"));

const PORT = 8080;

let SAFMR = {};
let FMR_METRO = {};

// -----------------------------
// Utility
// -----------------------------

function cleanMoney(value) {
  if (!value) return 0;
  return parseInt(value.replace(/[$,]/g, ""), 10);
}

function mortgagePayment(principal, rate, years = 30) {
  const monthlyRate = rate / 100 / 12;
  const n = years * 12;

  return Math.round(
    (principal * monthlyRate) /
      (1 - Math.pow(1 + monthlyRate, -n))
  );
}

// -----------------------------
// Load SAFMR (ZIP based)
// -----------------------------

function loadSAFMR() {
  return new Promise((resolve) => {
    fs.createReadStream(path.join(__dirname, "fy2024_safmrs.clean.csv"))
      .pipe(csv())
      .on("data", (row) => {
        const zip = row["ZIP Code"]?.trim();
        if (!zip) return;

        SAFMR[zip] = {
          metro: row["HUD Metro Fair Market Rent Area Name"],
          rents: {
            0: cleanMoney(row["SAFMR 0BR"]),
            1: cleanMoney(row["SAFMR 1BR"]),
            2: cleanMoney(row["SAFMR 2BR"]),
            3: cleanMoney(row["SAFMR 3BR"]),
            4: cleanMoney(row["SAFMR 4BR"]),
          },
        };
      })
      .on("end", () => resolve());
  });
}

// -----------------------------
// Load FMR Metro (ZIP fallback)
// -----------------------------

function loadFMR() {
  return new Promise((resolve) => {
    fs.createReadStream(path.join(__dirname, "fy2024_fmr_metro.csv"))
      .pipe(csv({ headers: false }))
      .on("data", (row) => {
        const metro = row[0];
        const zip = row[2];

        if (!zip) return;

        FMR_METRO[zip] = {
          metro,
          rents: {
            0: cleanMoney(row[3]),
            1: cleanMoney(row[4]),
            2: cleanMoney(row[5]),
            3: cleanMoney(row[6]),
            4: cleanMoney(row[7]),
          },
        };
      })
      .on("end", () => resolve());
  });
}

// -----------------------------
// Decision Engine
// -----------------------------

function decisionEngine(cashFlow) {
  if (cashFlow > 500) {
    return {
      strategy: "hold",
      verdict: "Excellent rental. Strong cash flow."
    };
  }

  if (cashFlow > 200) {
    return {
      strategy: "hold",
      verdict: "Good rental. Solid buy and hold."
    };
  }

  if (cashFlow > 0) {
    return {
      strategy: "hold",
      verdict: "Break-even to light profit."
    };
  }

  return {
    strategy: "pass",
    verdict: "Negative cash flow. Bad deal."
  };
}

// -----------------------------
// API
// -----------------------------

app.post("/api/analyze", (req, res) => {
  const {
    address,
    zip,
    bedrooms,
    interestRate,
    purchasePrice,
    downPaymentPct,
    rehab = 0,
  } = req.body;

  if (!zip || bedrooms === undefined) {
    return res.status(400).json({ error: "zip and bedrooms required" });
  }

  let rentData = SAFMR[zip];
  let source = "HUD SAFMR 2024";

  if (!rentData) {
    rentData = FMR_METRO[zip];
    source = "HUD FMR 2024";
  }

  if (!rentData) {
    return res.status(404).json({
      error: "No HUD rent data found",
      zip,
    });
  }

  const rent =
    rentData.rents[bedrooms] ||
    rentData.rents[4];

  let mortgage = 0;
  let monthlyCashFlow = 0;

  if (purchasePrice && interestRate && downPaymentPct !== undefined) {
    const downPayment = purchasePrice * (downPaymentPct / 100);
    const loanAmount = purchasePrice - downPayment;
    mortgage = mortgagePayment(loanAmount, interestRate);
    monthlyCashFlow = rent - mortgage;
  }

  const decision = decisionEngine(monthlyCashFlow);

  // Simple property value estimate (rent x 100 rule)
  const estimatedValue = rent * 100;

  res.json({
    address,
    zip,
    bedrooms,
    rent,
    metro: rentData.metro,
    source,
    estimatedValue,
    mortgage,
    monthlyCashFlow,
    strategy: decision.strategy,
    verdict: decision.verdict,
  });
});

// -----------------------------

async function start() {
  await loadSAFMR();
  await loadFMR();
  console.log("🏠 HUD data loaded");
  app.listen(PORT, () =>
    console.log(`🚀 ALEX running at http://localhost:${PORT}`)
  );
}

start();