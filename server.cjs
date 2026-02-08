require("dotenv").config();

const express = require("express");
const fs = require("fs");
const path = require("path");
const { parse } = require("csv-parse/sync");

const decisionEngine = require("./decisionEngine.js");

const app = express();
const PORT = process.env.PORT || 8080;

app.use(express.json());
app.use(express.static("public"));

/* =========================
   LOAD SAFMR DATA (ONCE)
========================= */

console.log("🔄 Loading SAFMR data...");

const safmrPath = path.join(__dirname, "fy2024_safmrs.fixed.csv");
const safmrCsv = fs.readFileSync(safmrPath);
const safmrRows = parse(safmrCsv, {
  columns: true,
  skip_empty_lines: true,
});

const SAFMR = new Map();

for (const row of safmrRows) {
  const zip = row["ZIP Code"];
  if (!zip) continue;

  SAFMR.set(zip, {
    metro: row["HUD Metro Fair Market Rent Area Name"],
    rents: {
      0: parseInt(row["SAFMR 0BR"]?.replace(/[$,]/g, "")),
      1: parseInt(row["SAFMR 1BR"]?.replace(/[$,]/g, "")),
      2: parseInt(row["SAFMR 2BR"]?.replace(/[$,]/g, "")),
      3: parseInt(row["SAFMR 3BR"]?.replace(/[$,]/g, "")),
      4: parseInt(row["SAFMR 4BR"]?.replace(/[$,]/g, "")),
    },
  });
}

console.log(`🏠 SAFMR loaded: ${SAFMR.size}`);

/* =========================
   HELPERS
========================= */

function monthlyMortgage(principal, ratePct, years = 30) {
  const r = ratePct / 100 / 12;
  const n = years * 12;
  return Math.round(
    (principal * r) / (1 - Math.pow(1 + r, -n))
  );
}

/* =========================
   API: ANALYZE
========================= */

app.post("/api/analyze", (req, res) => {
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

  const {
    address,
    zip,
    bedrooms,
    interestRate,
    purchasePrice,
    downPaymentPct,
    rehab = 0,
  } = req.body;

  const hud = SAFMR.get(zip);
  if (!hud) {
    return res.status(404).json({
      error: "No HUD SAFMR data found",
      zip,
    });
  }

  const rent = hud.rents[bedrooms];
  if (!rent) {
    return res.status(404).json({
      error: "No rent for bedroom count",
      zip,
      bedrooms,
    });
  }

  const downPayment = purchasePrice * (downPaymentPct / 100);
  const loanAmount = purchasePrice - downPayment;

  const mortgage = monthlyMortgage(
    loanAmount,
    interestRate
  );

  const monthlyCashFlow = rent - mortgage;

  /* =========================
     DECISION ENGINE
  ========================= */

  const decision = decisionEngine({
    purchasePrice,
    rehab,
    rent,
    monthlyCashFlow,
  });

  return res.json({
    address,
    zip,
    bedrooms,
    rent,
    source: "HUD SAFMR 2024",
    metro: hud.metro,
    mortgage,
    monthlyCashFlow,
    ...decision,
  });
});

/* =========================
   START SERVER
========================= */

app.listen(PORT, () => {
  console.log(`🚀 ALEX running at http://localhost:${PORT}`);
});