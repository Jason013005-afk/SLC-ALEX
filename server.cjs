const express = require("express");
const fs = require("fs");
const path = require("path");
const csv = require("csv-parser");

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const PORT = 8080;

let safmrData = {};

/* ===============================
   LOAD SAFMR DATA (LOCKED PATH)
================================ */

function loadSAFMR() {
  return new Promise((resolve, reject) => {
    const filePath = path.join(__dirname, "fy2024_safmrs_clean.csv");

    if (!fs.existsSync(filePath)) {
      console.error("❌ SAFMR file not found at:", filePath);
      resolve();
      return;
    }

    fs.createReadStream(filePath)
      .pipe(csv())
      .on("data", (row) => {
        const zip = row["ZIP Code"]?.trim();
        if (!zip) return;

        safmrData[zip] = {
          0: parseFloat(row["SAFMR 0BR"]) || 0,
          1: parseFloat(row["SAFMR 1BR"]) || 0,
          2: parseFloat(row["SAFMR 2BR"]) || 0,
          3: parseFloat(row["SAFMR 3BR"]) || 0,
          4: parseFloat(row["SAFMR 4BR"]) || 0,
          metro: row["HUD Metro Fair Market Rent Area Name"]
        };
      })
      .on("end", () => {
        console.log("🏠 SAFMR loaded:", Object.keys(safmrData).length);
        resolve();
      })
      .on("error", (err) => {
        console.error("CSV error:", err);
        resolve();
      });
  });
}

/* ===============================
   IRR FUNCTION
================================ */

function calculateIRR(cashFlows, guess = 0.1) {
  let rate = guess;
  for (let i = 0; i < 100; i++) {
    let npv = 0;
    let derivative = 0;
    for (let t = 0; t < cashFlows.length; t++) {
      npv += cashFlows[t] / Math.pow(1 + rate, t);
      derivative -= t * cashFlows[t] / Math.pow(1 + rate, t + 1);
    }
    const newRate = rate - npv / derivative;
    if (Math.abs(newRate - rate) < 0.00001) return newRate;
    rate = newRate;
  }
  return null;
}

/* ===============================
   DEAL ENGINE
================================ */

app.post("/api/analyze", (req, res) => {
  const {
    zip,
    bedrooms,
    purchasePrice = 0,
    downPaymentPct = 20,
    interestRate = 6.5,
    rehab = 0
  } = req.body;

  if (!safmrData[zip]) {
    return res.status(400).json({ error: "No HUD rent data found" });
  }

  const rent = safmrData[zip][bedrooms] || 0;
  const metro = safmrData[zip].metro;

  // Phase B assumptions
  const vacancyRatePct = 8;
  const expenseRatePct = 35;

  const effectiveRent = rent * (1 - vacancyRatePct / 100);
  const annualRent = effectiveRent * 12;
  const annualExpenses = annualRent * (expenseRatePct / 100);
  const annualNOI = annualRent - annualExpenses;

  // Financing
  const downPayment = purchasePrice * (downPaymentPct / 100);
  const loanAmount = purchasePrice - downPayment;

  const monthlyRate = interestRate / 100 / 12;
  const n = 30 * 12;

  const mortgage =
    loanAmount > 0
      ? loanAmount *
        (monthlyRate * Math.pow(1 + monthlyRate, n)) /
        (Math.pow(1 + monthlyRate, n) - 1)
      : 0;

  const annualDebt = mortgage * 12;
  const cashFlow = annualNOI - annualDebt;

  const capRatePct =
    purchasePrice > 0 ? (annualNOI / purchasePrice) * 100 : 0;

  const dscr =
    annualDebt > 0 ? (annualNOI / annualDebt).toFixed(2) : "N/A";

  // Exit cap grid
  const exitCaps = [5.5, 6, 6.5];
  const exitValues = exitCaps.map((cap) =>
    Math.round(annualNOI / (cap / 100))
  );

  // 5-year IRR
  const equity = downPayment + rehab;
  const saleValue = annualNOI / 0.06;
  const saleProceeds = saleValue - loanAmount;

  const cashFlows = [
    -equity,
    cashFlow,
    cashFlow,
    cashFlow,
    cashFlow,
    cashFlow + saleProceeds
  ];

  const irr = calculateIRR(cashFlows);
  const irr5YearPct = irr ? (irr * 100).toFixed(2) : null;

  // Simple risk scoring
  let dealScore = 100;
  if (dscr < 1) dealScore -= 40;
  if (capRatePct < 6) dealScore -= 20;
  if (irr5YearPct && irr5YearPct < 10) dealScore -= 20;
  if (dealScore < 0) dealScore = 0;

  const rentalVerdict =
    dscr < 1
      ? "High risk (DSCR < 1)."
      : "Stable rental candidate.";

  res.json({
    zip,
    bedrooms,
    rent,
    metro,
    vacancyRatePct,
    expenseRatePct,
    effectiveRent,
    annualRent,
    annualExpenses,
    annualNOI,
    mortgage: Math.round(mortgage),
    cashFlow: Math.round(cashFlow),
    capRatePct: capRatePct.toFixed(2),
    dscr,
    exitCaps,
    exitValues,
    irr5YearPct,
    dealScore,
    rentalVerdict
  });
});

/* ===============================
   START SERVER
================================ */

async function start() {
  await loadSAFMR();
  app.listen(PORT, () => {
    console.log("🚀 ALEX running at http://localhost:" + PORT);
  });
}

start();