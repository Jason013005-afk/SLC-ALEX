require("dotenv").config();

const express = require("express");
const fs = require("fs");
const path = require("path");
const { parse } = require("csv-parse/sync");

const app = express();
const PORT = process.env.PORT || 8080;

app.use(express.json());
app.use(express.static("public"));

/* =========================
   LOAD HUD SAFMR DATA
========================= */

const SAFMR_PATH = path.join(__dirname, "fy2024_safmrs.clean.csv");

let safmrRows = [];

function normalizeZip(zip) {
  // handle "02724" vs 2724 vs "2724"
  return String(zip).trim().replace(/^0+/, "");
}

function loadSAFMR() {
  const raw = fs.readFileSync(SAFMR_PATH, "utf8");
  safmrRows = parse(raw, {
    columns: true,
    skip_empty_lines: true,
  });

  console.log("🏠 SAFMR loaded:", safmrRows.length);
}

loadSAFMR();

/* =========================
   API: ANALYZE
========================= */

app.post("/api/analyze", (req, res) => {
  const {
    address,
    zip,
    bedrooms,
    interestRate,
    purchasePrice,
    downPaymentPct,
  } = req.body;

  // 🔒 HARD GUARD — NO MORE CHAOS
  const required = [
    "address",
    "zip",
    "bedrooms",
    "interestRate",
    "purchasePrice",
    "downPaymentPct",
  ];

  for (const key of required) {
    if (req.body[key] === undefined) {
      return res.status(400).json({
        error: `Missing required field: ${key}`,
      });
    }
  }

  const normalizedZip = normalizeZip(zip);

  const row = safmrRows.find(
    (r) => normalizeZip(r["ZIP Code"]) === normalizedZip
  );

  if (!row) {
    return res.status(404).json({
      error: "No HUD SAFMR data found",
      zip,
    });
  }

  const rentKey = `SAFMR ${bedrooms}BR`;
  const rentRaw = row[rentKey];

  if (!rentRaw) {
    return res.status(404).json({
      error: "No rent data for bedroom count",
      bedrooms,
    });
  }

  const rent = Number(rentRaw.replace(/[$,]/g, ""));

  // BASIC DEAL MATH (placeholder — decision engine comes next)
  const loanAmount = purchasePrice * (1 - downPaymentPct / 100);
  const monthlyRate = interestRate / 100 / 12;
  const payment =
    (loanAmount * monthlyRate) /
    (1 - Math.pow(1 + monthlyRate, -360));

  const cashFlow = Math.round(rent - payment);

  res.json({
    address,
    zip,
    bedrooms,
    rent,
    source: "HUD SAFMR 2024",
    metro: row["HUD Metro Fair Market Rent Area Name"],
    monthlyCashFlow: cashFlow,
  });
});

/* =========================
   START SERVER
========================= */

app.listen(PORT, () => {
  console.log(`🚀 ALEX running at http://localhost:${PORT}`);
});