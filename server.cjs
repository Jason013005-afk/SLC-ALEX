const express = require("express");
const fs = require("fs");
const csv = require("csv-parser");

const app = express();
app.use(express.json());

let safmrData = {};

// -----------------------------
// LOAD SAFMR DATA
// -----------------------------
function loadSAFMR() {
  return new Promise((resolve) => {
    fs.createReadStream("fy2024_safmrs_clean.csv")
      .pipe(csv())
      .on("data", (row) => {
        safmrData[row.zip] = row;
      })
      .on("end", () => {
        console.log("🏠 SAFMR loaded:", Object.keys(safmrData).length);
        resolve();
      });
  });
}

// -----------------------------
// IRR CALCULATION (Newton)
// -----------------------------
function calculateIRR(cashFlows, guess = 0.1) {
  const maxIterations = 1000;
  const tolerance = 1e-6;

  for (let i = 0; i < maxIterations; i++) {
    let npv = 0;
    let derivative = 0;

    for (let t = 0; t < cashFlows.length; t++) {
      npv += cashFlows[t] / Math.pow(1 + guess, t);
      derivative -= t * cashFlows[t] / Math.pow(1 + guess, t + 1);
    }

    const newGuess = guess - npv / derivative;
    if (Math.abs(newGuess - guess) < tolerance) {
      return newGuess;
    }
    guess = newGuess;
  }

  return null;
}

// -----------------------------
// ANALYZE ROUTE
// -----------------------------
app.post("/api/analyze", (req, res) => {
  const {
    zip,
    bedrooms,
    purchasePrice,
    downPaymentPct = 20,
    interestRate = 6.5,
    rehab = 0
  } = req.body;

  if (!zip || !bedrooms) {
    return res.status(400).json({ error: "Missing zip or bedrooms" });
  }

  const data = safmrData[zip];
  if (!data) {
    return res.status(404).json({ error: "No SAFMR data found", zip });
  }

  const rent = parseInt(data[`rent_${bedrooms}`]);
  const metro = data.metro;

  if (!rent) {
    return res.status(400).json({ error: "Invalid bedroom count" });
  }

  // -----------------------------
  // RENTAL MODEL
  // -----------------------------
  const vacancyRatePct = 8;
  const expenseRatePct = 35;

  const effectiveRent = rent * (1 - vacancyRatePct / 100);
  const annualRent = effectiveRent * 12;
  const annualExpenses = annualRent * (expenseRatePct / 100);
  const annualNOI = annualRent - annualExpenses;

  // -----------------------------
  // LOAN + AMORTIZATION
  // -----------------------------
  const totalCost = purchasePrice + rehab;
  const downPayment = totalCost * (downPaymentPct / 100);
  const loanAmount = totalCost - downPayment;

  const monthlyRate = interestRate / 100 / 12;
  const termMonths = 360;

  const mortgage =
    (loanAmount * monthlyRate) /
    (1 - Math.pow(1 + monthlyRate, -termMonths));

  const annualDebtService = mortgage * 12;

  const dscr = annualNOI / annualDebtService;

  const annualCashFlow = annualNOI - annualDebtService;

  const capRatePct = ((annualNOI / totalCost) * 100).toFixed(2);

  // -----------------------------
  // 5 YEAR AMORTIZATION
  // -----------------------------
  let remainingBalance = loanAmount;
  for (let i = 0; i < 60; i++) {
    const interest = remainingBalance * monthlyRate;
    const principal = mortgage - interest;
    remainingBalance -= principal;
  }

  const debtPaidDown = loanAmount - remainingBalance;

  // -----------------------------
  // 5 YEAR SALE
  // -----------------------------
  const exitCap = 6;
  const exitValue = annualNOI / (exitCap / 100);
  const sellingCosts = exitValue * 0.06;
  const saleProceeds = exitValue - sellingCosts - remainingBalance;

  // -----------------------------
  // IRR
  // -----------------------------
  const initialEquity = downPayment;

  const cashFlows = [
    -initialEquity,
    annualCashFlow,
    annualCashFlow,
    annualCashFlow,
    annualCashFlow,
    annualCashFlow + saleProceeds
  ];

  const irr = calculateIRR(cashFlows);
  const irr5YearPct = irr ? (irr * 100).toFixed(2) : null;

  // -----------------------------
  // EQUITY MULTIPLE
  // -----------------------------
  const totalCashReceived =
    annualCashFlow * 5 + saleProceeds;

  const equityMultiple = (
    totalCashReceived / initialEquity
  ).toFixed(2);

  // -----------------------------
  // DEAL SCORE
  // -----------------------------
  let dealScore = 50;

  if (dscr > 1.25) dealScore += 20;
  if (irr5YearPct && irr5YearPct > 15) dealScore += 15;
  if (parseFloat(capRatePct) > 7) dealScore += 10;
  if (annualCashFlow > 0) dealScore += 10;

  if (dealScore > 100) dealScore = 100;
  if (dealScore < 0) dealScore = 0;

  const rentalVerdict =
    dscr < 1
      ? "High risk (DSCR < 1)."
      : irr5YearPct > 15
      ? "Strong long-term hold."
      : "Moderate deal.";

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
    annualCashFlow: Math.round(annualCashFlow),

    capRatePct,
    dscr: dscr.toFixed(2),

    remainingBalance: Math.round(remainingBalance),
    debtPaidDown: Math.round(debtPaidDown),

    exitValue: Math.round(exitValue),
    saleProceeds: Math.round(saleProceeds),

    irr5YearPct,
    equityMultiple,

    dealScore,
    rentalVerdict
  });
});

// -----------------------------
loadSAFMR().then(() => {
  app.listen(8080, () => {
    console.log("🚀 ALEX running at http://localhost:8080");
  });
});