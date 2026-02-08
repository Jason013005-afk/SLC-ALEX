// server.cjs
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

console.log("🔄 Loading SAFMR data...");

const safmrPath = path.join(__dirname, "fy2024_safmrs.fixed.csv");
const safmrCsv = fs.readFileSync(safmrPath, "utf8");

const safmrRows = parse(safmrCsv, {
  columns: true,
  skip_empty_lines: true
});

const safmrByZip = {};
for (const row of safmrRows) {
  safmrByZip[row["ZIP Code"]] = row;
}

console.log(`🏠 SAFMR loaded: ${Object.keys(safmrByZip).length}`);

/* =========================
   HELPERS
========================= */

function dollars(val) {
  if (!val) return 0;
  return Number(String(val).replace(/[$,]/g, ""));
}

function mortgagePayment(loan, ratePct) {
  const r = ratePct / 100 / 12;
  const n = 30 * 12;
  return Math.round((loan * r) / (1 - Math.pow(1 + r, -n)));
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
    downPaymentPct = 20,
    rehab = 0
  } = req.body;

  if (!zip || bedrooms == null) {
    return res.status(400).json({ error: "zip and bedrooms required" });
  }

  const row = safmrByZip[zip];
  if (!row) {
    return res.status(404).json({ error: "No HUD SAFMR data found", zip });
  }

  const rentKey = `SAFMR ${bedrooms}BR`;
  const rent = dollars(row[rentKey]);

  if (!rent) {
    return res.status(404).json({ error: "Rent not found", zip, bedrooms });
  }

  let mortgage = null;
  let monthlyCashFlow = null;

  if (purchasePrice && interestRate) {
    const down = purchasePrice * (downPaymentPct / 100);
    const loan = purchasePrice - down + rehab;
    mortgage = mortgagePayment(loan, interestRate);
    monthlyCashFlow = rent - mortgage;
  }

  const decision = decisionEngine({
    rent,
    mortgage,
    monthlyCashFlow,
    purchasePrice,
    rehab
  });

  res.json({
    address,
    zip,
    bedrooms,
    rent,
    metro: row["HUD Metro Fair Market Rent Area Name"],
    source: "HUD SAFMR 2024",
    mortgage,
    monthlyCashFlow,
    strategy: decision.strategy,
    verdict: decision.verdict
  });
});

/* =========================
   START
========================= */

app.listen(PORT, () => {
  console.log(`🚀 ALEX running at http://localhost:${PORT}`);
});