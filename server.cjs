require("dotenv").config();

const express = require("express");
const fs = require("fs");
const path = require("path");
const { parse } = require("csv-parse/sync");

const decisionEngine = require("./decisionEngine");

const app = express();
const PORT = process.env.PORT || 8080;

app.use(express.json());
app.use(express.static("public"));

/* =========================
   LOAD SAFMR DATA (ONCE)
========================= */

console.log("🔄 Loading SAFMR data...");

const safmrCsv = fs.readFileSync(
  path.join(__dirname, "fy2024_safmrs.fixed.csv"),
  "utf8"
);

const safmrRows = parse(safmrCsv, {
  columns: true,
  skip_empty_lines: true,
});

const SAFMR_BY_ZIP = new Map();

for (const row of safmrRows) {
  const zip = row["ZIP Code"]?.trim();
  if (!zip) continue;
  SAFMR_BY_ZIP.set(zip, row);
}

console.log(`🏠 SAFMR loaded: ${SAFMR_BY_ZIP.size}`);

/* =========================
   HELPERS
========================= */

function money(val) {
  if (!val) return null;
  return Number(val.replace(/[$,]/g, ""));
}

function getSafmr(zip, bedrooms) {
  const row = SAFMR_BY_ZIP.get(zip);
  if (!row) return null;

  const key = `SAFMR ${bedrooms}BR`;
  const rent = money(row[key]);

  if (!rent) return null;

  return {
    rent,
    metro: row["HUD Metro Fair Market Rent Area Name"],
    source: "HUD SAFMR 2024",
  };
}

function mortgagePayment(loan, ratePct, years = 30) {
  const r = ratePct / 100 / 12;
  const n = years * 12;
  return Math.round(
    (loan * r * Math.pow(1 + r, n)) /
      (Math.pow(1 + r, n) - 1)
  );
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
    rehab = 0,
  } = req.body;

  if (
    !zip ||
    bedrooms === undefined ||
    interestRate === undefined ||
    purchasePrice === undefined ||
    downPaymentPct === undefined
  ) {
    return res.status(400).json({
      error: "Missing required fields",
    });
  }

  const safmr = getSafmr(zip, bedrooms);

  if (!safmr) {
    return res.status(404).json({
      error: "No HUD SAFMR data found",
      zip,
    });
  }

  const downPayment = purchasePrice * (downPaymentPct / 100);
  const loanAmount = purchasePrice - downPayment;
  const mortgage = mortgagePayment(loanAmount, interestRate);

  const monthlyCashFlow = safmr.rent - mortgage;

  const decision = decisionEngine({
    rent: safmr.rent,
    mortgage,
    monthlyCashFlow,
    purchasePrice,
    rehab,
  });

  res.json({
    address,
    zip,
    bedrooms,
    rent: safmr.rent,
    metro: safmr.metro,
    source: safmr.source,
    mortgage,
    monthlyCashFlow,
    strategy: decision.strategy,
    verdict: decision.verdict,
  });
});

/* =========================
   START
========================= */

app.listen(PORT, () => {
  console.log(`🚀 ALEX running at http://localhost:${PORT}`);
});