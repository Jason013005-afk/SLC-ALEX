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
   LOAD SAFMR DATA
========================= */

const safmrPath = path.join(__dirname, "fy2024_safmrs.clean.csv");
const safmrRows = parse(fs.readFileSync(safmrPath), {
  columns: true,
  skip_empty_lines: true,
});

console.log("🏠 SAFMR loaded:", safmrRows.length);

// Index by ZIP
const safmrByZip = new Map();
for (const row of safmrRows) {
  safmrByZip.set(row["ZIP Code"], row);
}

/* =========================
   API: ANALYZE PROPERTY
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

  const row = safmrByZip.get(zip);
  if (!row) {
    return res.json({ error: "No HUD SAFMR data found", zip });
  }

  const rentRaw = row[`SAFMR ${bedrooms}BR`];
  const rent = Number(String(rentRaw).replace(/[^0-9]/g, ""));

  const downPayment = purchasePrice * (downPaymentPct / 100);
  const loanAmount = purchasePrice - downPayment;
  const monthlyRate = interestRate / 100 / 12;
  const mortgage =
    loanAmount *
    (monthlyRate / (1 - Math.pow(1 + monthlyRate, -360)));

  const monthlyCashFlow = Math.round(rent - mortgage);

  const decision = decisionEngine({
    rent,
    mortgage,
    purchasePrice,
    rehab,
  });

  res.json({
    address,
    zip,
    bedrooms,
    rent,
    metro: row["HUD Metro Fair Market Rent Area Name"],
    source: "HUD SAFMR 2024",
    mortgage: Math.round(mortgage),
    monthlyCashFlow,
    strategy: decision.strategy,
    verdict: decision.verdict,
  });
});

/* =========================
   START SERVER
========================= */

app.listen(PORT, () => {
  console.log(`🚀 ALEX running at http://localhost:${PORT}`);
});