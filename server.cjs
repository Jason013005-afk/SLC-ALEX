// server.cjs
require("dotenv").config();
const express = require("express");
const fs = require("fs");
const path = require("path");
const { parse } = require("csv-parse/sync");

const app = express();
const PORT = 8080;

app.use(express.json());
app.use(express.static("public"));

/* =========================
   LOAD HUD SAFMR DATA
========================= */

const SAFMR_PATH = path.join(__dirname, "fy2024_safmrs.fixed.csv");
const safmrByZip = {};

console.log("🔄 Loading SAFMR data...");

const safmrCsv = fs.readFileSync(SAFMR_PATH);
const safmrRows = parse(safmrCsv, {
  columns: true,
  skip_empty_lines: true
});

for (const row of safmrRows) {
  const zip = row["ZIP Code"];
  if (!zip) continue;

  safmrByZip[zip] = {
    metro: row["HUD Metro Fair Market Rent Area Name"],
    rents: {
      0: parseInt(row["SAFMR 0BR"]?.replace(/[^0-9]/g, "")),
      1: parseInt(row["SAFMR 1BR"]?.replace(/[^0-9]/g, "")),
      2: parseInt(row["SAFMR 2BR"]?.replace(/[^0-9]/g, "")),
      3: parseInt(row["SAFMR 3BR"]?.replace(/[^0-9]/g, "")),
      4: parseInt(row["SAFMR 4BR"]?.replace(/[^0-9]/g, ""))
    }
  };
}

console.log(`🏠 SAFMR loaded: ${Object.keys(safmrByZip).length}`);

/* =========================
   DECISION ENGINE (SPINE)
========================= */

function monthlyPayment({ loanAmount, rate, years = 30 }) {
  const r = rate / 100 / 12;
  const n = years * 12;
  return Math.round((loanAmount * r) / (1 - Math.pow(1 + r, -n)));
}

function evaluateDeal({ rent, interestRate, purchasePrice, downPaymentPct }) {
  const down = purchasePrice * (downPaymentPct / 100);
  const loan = purchasePrice - down;
  const payment = monthlyPayment({
    loanAmount: loan,
    rate: interestRate
  });

  const cashFlow = rent - payment;

  let strategy = "pass";
  if (cashFlow > 300) strategy = "hold";
  if (cashFlow > 600) strategy = "excellent";

  return {
    monthlyPayment: payment,
    cashFlow,
    strategy
  };
}

/* =========================
   API: /api/analyze
========================= */

app.post("/api/analyze", (req, res) => {
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

  const {
    address,
    zip,
    bedrooms,
    interestRate,
    purchasePrice,
    downPaymentPct
  } = req.body;

  const hud = safmrByZip[zip];
  if (!hud) {
    return res.status(404).json({
      error: "No HUD SAFMR data found",
      zip
    });
  }

  const rent = hud.rents[bedrooms];
  if (!rent) {
    return res.status(404).json({
      error: "No rent for bedroom count",
      bedrooms
    });
  }

  const deal = evaluateDeal({
    rent,
    interestRate,
    purchasePrice,
    downPaymentPct
  });

  res.json({
    address,
    zip,
    bedrooms,
    rent,
    section8: true,
    metro: hud.metro,
    source: "HUD SAFMR 2024",
    deal
  });
});

/* =========================
   START SERVER
========================= */

app.listen(PORT, () => {
  console.log(`🚀 ALEX running at http://localhost:${PORT}`);
});