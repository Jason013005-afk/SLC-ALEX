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

const SAFMR_FILE = path.join(__dirname, "fy2024_safmrs.clean.csv");
let safmrByZip = {};

function money(val) {
  if (!val) return null;
  return Number(String(val).replace(/[$,]/g, ""));
}

function loadSAFMR() {
  console.log("🔄 Loading SAFMR data...");
  const csv = fs.readFileSync(SAFMR_FILE);
  const rows = parse(csv, { columns: true, skip_empty_lines: true });

  for (const row of rows) {
    const zip = String(row["ZIP Code"]).padStart(5, "0");

    safmrByZip[zip] = {
      metro: row["HUD Metro Fair Market Rent Area Name"],
      rents: {
        0: money(row["SAFMR 0BR"]),
        1: money(row["SAFMR 1BR"]),
        2: money(row["SAFMR 2BR"]),
        3: money(row["SAFMR 3BR"]),
        4: money(row["SAFMR 4BR"]),
      },
    };
  }

  console.log(`🏠 SAFMR loaded: ${Object.keys(safmrByZip).length}`);
}

loadSAFMR();

/* =========================
   MORTGAGE + CASH FLOW
========================= */

function monthlyMortgage(price, downPct, ratePct, termYears = 30) {
  const loan = price * (1 - downPct / 100);
  const r = ratePct / 100 / 12;
  const n = termYears * 12;
  return Math.round(
    loan * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1)
  );
}

/* =========================
   DECISION ENGINE
========================= */

function decisionEngine({ rent, mortgage, rehab }) {
  const cashFlow = rent - mortgage;

  if (cashFlow > 300) {
    return {
      strategy: "hold",
      verdict: "Strong rental. Buy and hold.",
    };
  }

  if (rehab > 0 && cashFlow < 0) {
    return {
      strategy: "flip",
      verdict: "Weak rental. Better as a flip.",
    };
  }

  return {
    strategy: "pass",
    verdict: "Does not meet investment criteria.",
  };
}

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
    rehab = 0,
  } = req.body;

  if (!zip || bedrooms == null) {
    return res.status(400).json({ error: "zip and bedrooms required" });
  }

  const zipKey = String(zip).padStart(5, "0");
  const safmr = safmrByZip[zipKey];

  if (!safmr || safmr.rents[bedrooms] == null) {
    return res.status(404).json({
      error: "No HUD SAFMR data found",
      zip: zipKey,
    });
  }

  const rent = safmr.rents[bedrooms];

  let mortgage = null;
  let cashFlow = null;
  let decision = null;

  if (purchasePrice && interestRate && downPaymentPct != null) {
    mortgage = monthlyMortgage(
      purchasePrice,
      downPaymentPct,
      interestRate
    );
    cashFlow = rent - mortgage;
    decision = decisionEngine({ rent, mortgage, rehab });
  }

  res.json({
    address,
    zip: zipKey,
    bedrooms,
    rent,
    metro: safmr.metro,
    source: "HUD SAFMR 2024",
    mortgage,
    monthlyCashFlow: cashFlow,
    ...decision,
  });
});

/* =========================
   START SERVER
========================= */

app.listen(PORT, () => {
  console.log(`🚀 ALEX running at http://localhost:${PORT}`);
});