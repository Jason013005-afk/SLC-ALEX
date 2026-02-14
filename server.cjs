const express = require("express");
const fs = require("fs");
const path = require("path");
const csv = require("csv-parser");

const app = express();
app.use(express.json());

const PORT = 8080;

let safmrData = {};

/* ===============================
   Utility Helpers
=================================*/

function padZip(zip) {
  if (!zip) return null;
  return String(zip).trim().padStart(5, "0");
}

function parseDollar(value) {
  if (!value) return 0;
  return parseFloat(String(value).replace(/[$,]/g, "")) || 0;
}

function mortgagePayment(principal, ratePct, years = 30) {
  const r = ratePct / 100 / 12;
  const n = years * 12;
  if (r === 0) return principal / n;
  return (
    principal *
    ((r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1))
  );
}

function irr(cashFlows, guess = 0.1) {
  let rate = guess;
  for (let i = 0; i < 100; i++) {
    let npv = 0;
    let derivative = 0;
    for (let t = 0; t < cashFlows.length; t++) {
      npv += cashFlows[t] / Math.pow(1 + rate, t);
      derivative -=
        (t * cashFlows[t]) / Math.pow(1 + rate, t + 1);
    }
    const newRate = rate - npv / derivative;
    if (Math.abs(newRate - rate) < 0.0001) return newRate;
    rate = newRate;
  }
  return rate;
}

/* ===============================
   Load SAFMR CSV
=================================*/

function loadSAFMR() {
  return new Promise((resolve, reject) => {
    const filePath = path.join(__dirname, "fy2024_safmrs.clean.csv");

    if (!fs.existsSync(filePath)) {
      console.log("SAFMR file not found.");
      resolve();
      return;
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
          metro: row["HUD Metro Fair Market Rent Area Name"]
        };
      })
      .on("end", () => {
        console.log("🏠 SAFMR loaded:", Object.keys(safmrData).length);
        resolve();
      })
      .on("error", reject);
  });
}

/* ===============================
   Main Analyze Endpoint
=================================*/

app.post("/api/analyze", (req, res) => {
  try {
    const {
      zip,
      bedrooms = 3,
      purchasePrice = 0,
      downPaymentPct = 20,
      interestRate = 6.5,
      rehab = 0
    } = req.body;

    const cleanZip = padZip(zip);
    if (!cleanZip || !safmrData[cleanZip]) {
      return res.json({ error: "No HUD rent data found", zip });
    }

    const rentLookup = safmrData[cleanZip];
    const rent =
      bedrooms === 0
        ? rentLookup.studio
        : bedrooms === 1
        ? rentLookup.one
        : bedrooms === 2
        ? rentLookup.two
        : bedrooms === 3
        ? rentLookup.three
        : rentLookup.four;

    /* ===============================
       PHASE B LOGIC STARTS HERE
    =================================*/

    const vacancyRatePct = 8;
    const expenseRatePct = 35;

    const effectiveRent = rent * (1 - vacancyRatePct / 100);
    const annualRent = effectiveRent * 12;

    const annualExpenses = annualRent * (expenseRatePct / 100);
    const annualNOI = annualRent - annualExpenses;

    const downPayment = purchasePrice * (downPaymentPct / 100);
    const loanAmount = purchasePrice - downPayment;
    const monthlyMortgage = mortgagePayment(
      loanAmount,
      interestRate
    );

    const annualDebt = monthlyMortgage * 12;
    const cashFlow = annualNOI - annualDebt;

    const capRatePct =
      purchasePrice > 0
        ? (annualNOI / purchasePrice) * 100
        : 0;

    const dscr =
      annualDebt > 0 ? annualNOI / annualDebt : 0;

    /* ===== Exit Cap Sensitivity ===== */

    const exitCaps = [5.5, 6.0, 6.5];
    const exitValues = exitCaps.map(
      (cap) => annualNOI / (cap / 100)
    );

    /* ===== IRR Modeling (5-Year Hold) ===== */

    const holdYears = 5;
    const saleValue = annualNOI / 0.06;
    const equity = downPayment + rehab;

    const cashFlows = [-equity];
    for (let i = 1; i <= holdYears; i++) {
      cashFlows.push(cashFlow);
    }
    cashFlows[holdYears] += saleValue - loanAmount;

    const irrValue = irr(cashFlows) * 100;

    /* ===============================
       Verdict Logic
    =================================*/

    let rentalVerdict = "Average deal.";
    if (cashFlow < 0) rentalVerdict = "Negative cash flow.";
    if (cashFlow > 300) rentalVerdict = "Strong rental.";
    if (dscr < 1) rentalVerdict = "High risk (DSCR < 1).";

    const dealScore = Math.max(
      0,
      Math.min(
        100,
        capRatePct * 5 + dscr * 20 + irrValue
      )
    );

    /* ===============================
       Response
    =================================*/

    res.json({
      zip: cleanZip,
      bedrooms,
      rent,
      metro: rentLookup.metro,
      vacancyRatePct,
      expenseRatePct,
      effectiveRent,
      annualRent,
      annualExpenses,
      annualNOI,
      mortgage: Math.round(monthlyMortgage),
      cashFlow: Math.round(cashFlow),
      capRatePct: Number(capRatePct.toFixed(2)),
      dscr: Number(dscr.toFixed(2)),
      exitCaps,
      exitValues: exitValues.map((v) =>
        Math.round(v)
      ),
      irr5YearPct: Number(irrValue.toFixed(2)),
      dealScore: Math.round(dealScore),
      rentalVerdict
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

/* ===============================
   Start Server
=================================*/

async function start() {
  await loadSAFMR();
  app.listen(PORT, () =>
    console.log(`🚀 ALEX running at http://localhost:${PORT}`)
  );
}

start();