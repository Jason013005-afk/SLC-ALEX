const express = require("express");
const fs = require("fs");
const path = require("path");
const csv = require("csv-parser");

const app = express();
app.use(express.json());

const PORT = 8080;

let safmrData = {};

/* ===========================
   Utility Functions
=========================== */

function padZip(zip) {
  if (!zip) return null;
  return String(zip).trim().padStart(5, "0");
}

function parseDollar(value) {
  if (!value) return 0;
  return parseFloat(String(value).replace(/[$,]/g, "")) || 0;
}

function monthlyMortgage(loanAmount, ratePct, years = 30) {
  if (!loanAmount || !ratePct) return 0;
  const r = ratePct / 100 / 12;
  const n = years * 12;
  return Math.round(
    (loanAmount * r) / (1 - Math.pow(1 + r, -n))
  );
}

function calculateIRR(cashFlows, guess = 0.1) {
  let rate = guess;
  for (let i = 0; i < 1000; i++) {
    let npv = 0;
    let derivative = 0;

    for (let t = 0; t < cashFlows.length; t++) {
      npv += cashFlows[t] / Math.pow(1 + rate, t);
      derivative -= t * cashFlows[t] / Math.pow(1 + rate, t + 1);
    }

    const newRate = rate - npv / derivative;
    if (Math.abs(newRate - rate) < 1e-7) return newRate;
    rate = newRate;
  }
  return null;
}

/* ===========================
   Load SAFMR CSV
=========================== */

function loadSAFMR() {
  console.log("🔄 Loading SAFMR data...");

  return new Promise((resolve, reject) => {
    const filePath = path.join(__dirname, "fy2024_safmrs.clean.csv");

    if (!fs.existsSync(filePath)) {
      console.log("❌ SAFMR CSV not found");
      return resolve();
    }

    fs.createReadStream(filePath)
      .pipe(csv())
      .on("data", (row) => {
        const zip = padZip(row["ZIP Code"]);
        if (!zip) return;

        safmrData[zip] = {
          studio: parseDollar(row["SAFMR 0BR"]),
          one: parseDollar(row["SAFMR 1BR"]),
          two: parseDollar(row["SAFMR 2BR"]),
          three: parseDollar(row["SAFMR 3BR"]),
          four: parseDollar(row["SAFMR 4BR"]),
          metro: row["HUD Metro Fair Market Rent Area Name"] || ""
        };
      })
      .on("end", () => {
        console.log("🏠 SAFMR loaded:", Object.keys(safmrData).length);
        resolve();
      })
      .on("error", reject);
  });
}

/* ===========================
   Main API
=========================== */

app.post("/api/analyze", (req, res) => {
  const {
    zip,
    bedrooms,
    purchasePrice = 0,
    downPaymentPct = 20,
    interestRate = 6.5,
    rehab = 0
  } = req.body;

  const cleanZip = padZip(zip);

  if (!cleanZip || !bedrooms) {
    return res.status(400).json({ error: "Missing zip or bedrooms" });
  }

  const rentData = safmrData[cleanZip];
  if (!rentData) {
    return res.status(404).json({ error: "No HUD rent data found" });
  }

  const bedroomKey =
    bedrooms == 0 ? "studio" :
    bedrooms == 1 ? "one" :
    bedrooms == 2 ? "two" :
    bedrooms == 3 ? "three" :
    "four";

  const rent = rentData[bedroomKey] || 0;

  /* ===========================
     Phase B Enhancements
  =========================== */

  const vacancyRatePct = 8;
  const expenseRatePct = 35;

  const effectiveRent = Math.round(rent * (1 - vacancyRatePct / 100));
  const annualRent = effectiveRent * 12;
  const annualExpenses = Math.round(annualRent * expenseRatePct / 100);
  const annualNOI = annualRent - annualExpenses;

  const loanAmount =
    purchasePrice * (1 - downPaymentPct / 100);

  const mortgage = monthlyMortgage(loanAmount, interestRate);
  const annualDebt = mortgage * 12;

  const cashFlow = annualNOI - annualDebt;

  const capRatePct =
    purchasePrice ? (annualNOI / purchasePrice) * 100 : 0;

  const dscr =
    annualDebt ? (annualNOI / annualDebt).toFixed(2) : null;

  /* ===========================
     Exit Cap Sensitivity
  =========================== */

  const exitCaps = [5.5, 6.0, 6.5];
  const exitValues = exitCaps.map(
    cap => Math.round(annualNOI / (cap / 100))
  );

  /* ===========================
     5-Year IRR Model
  =========================== */

  let irr5YearPct = null;

  if (purchasePrice) {
    const equity = purchasePrice * (downPaymentPct / 100);
    const salePrice = annualNOI / 0.06;
    const saleProceeds = salePrice * 0.93 - loanAmount;

    const cashFlows = [
      -equity,
      cashFlow,
      cashFlow,
      cashFlow,
      cashFlow,
      cashFlow + saleProceeds
    ];

    const irr = calculateIRR(cashFlows);
    if (irr !== null) {
      irr5YearPct = (irr * 100).toFixed(2);
    }
  }

  /* ===========================
     Deal Score
  =========================== */

  let dealScore = 50;

  if (dscr && dscr >= 1.25) dealScore += 20;
  if (capRatePct >= 7) dealScore += 15;
  if (cashFlow > 0) dealScore += 15;

  dealScore = Math.max(0, Math.min(100, dealScore));

  const rentalVerdict =
    dscr && dscr < 1
      ? "High risk (DSCR < 1)."
      : cashFlow < 0
      ? "Negative cash flow."
      : "Healthy rental profile.";

  return res.json({
    zip: cleanZip,
    bedrooms,
    rent,
    metro: rentData.metro,
    vacancyRatePct,
    expenseRatePct,
    effectiveRent,
    annualRent,
    annualExpenses,
    annualNOI,
    mortgage,
    cashFlow,
    capRatePct: Number(capRatePct.toFixed(2)),
    dscr,
    exitCaps,
    exitValues,
    irr5YearPct,
    dealScore,
    rentalVerdict
  });
});

/* ===========================
   Start Server
=========================== */

async function start() {
  await loadSAFMR();
  app.listen(PORT, () => {
    console.log(`🚀 ALEX running at http://localhost:${PORT}`);
  });
}

start();