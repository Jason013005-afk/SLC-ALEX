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

/* =========================
   LOAD SAFMR DATA (ONCE)
========================= */

const safmrPath = path.join(__dirname, "fy2024_safmrs.clean.csv");

const safmrRows = parse(
  fs.readFileSync(safmrPath),
  {
    columns: true,
    skip_empty_lines: true
  }
);

console.log(`🏠 SAFMR loaded: ${safmrRows.length}`);

// Fast lookup: ZIP → row
const safmrByZip = {};
for (const row of safmrRows) {
  const zip = row["ZIP Code"]?.trim();
  if (zip) safmrByZip[zip] = row;
}

/* =========================
   HELPERS
========================= */

function parseDollar(value) {
  if (!value) return null;
  return Number(value.replace(/[$,]/g, ""));
}

function monthlyMortgage({ price, downPct, rate }) {
  const loan = price * (1 - downPct / 100);
  const r = rate / 100 / 12;
  const n = 30 * 12;
  return loan * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
}

/* =========================
   API
========================= */

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

  // ---- Guard (non-negotiable)
  const required = [
    "address",
    "zip",
    "bedrooms",
    "interestRate",
    "purchasePrice",
    "downPaymentPct"
  ];

  for (const key of required) {
    if (req.body[key] === undefined) {
      return res.status(400).json({
        error: `Missing required field: ${key}`
      });
    }
  }

  // ---- HUD SAFMR lookup
  const row = safmrByZip[zip];
  if (!row) {
    return res.status(404).json({
      error: "No HUD SAFMR data found",
      zip
    });
  }

  const rentField = `SAFMR ${bedrooms}BR`;
  const rent = parseDollar(row[rentField]);

  if (!rent) {
    return res.status(404).json({
      error: "No SAFMR rent for bedroom count",
      zip,
      bedrooms
    });
  }

  // ---- Cash flow math
  const mortgage = monthlyMortgage({
    price: purchasePrice,
    downPct: downPaymentPct,
    rate: interestRate
  });

  const monthlyCashFlow = Math.round(rent - mortgage);

  // ---- Decision engine
  const decision = decisionEngine({
    value: purchasePrice,
    rent,
    rehab,
    monthlyCashFlow
  });

  // ---- Final response
  res.json({
    address,
    zip,
    bedrooms,
    rent,
    source: "HUD SAFMR 2024",
    metro: row["HUD Metro Fair Market Rent Area Name"],
    monthlyCashFlow,
    strategy: decision.strategy,
    verdict: decision.verdict
  });
});

/* =========================
   START SERVER
========================= */

app.listen(PORT, () => {
  console.log(`🚀 ALEX running at http://localhost:${PORT}`);
});