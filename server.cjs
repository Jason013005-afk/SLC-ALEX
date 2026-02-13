const express = require("express");
const fs = require("fs");
const path = require("path");
const csv = require("csv-parser");

const app = express();
app.use(express.json());

const PORT = 8080;

// ===============================
// DATA STORES
// ===============================

let safmrData = {};
let fmrMetroData = {};
let crosswalk = {};

// ===============================
// LOAD CSV HELPERS
// ===============================

function loadSAFMR() {
  console.log("🔄 Loading SAFMR data...");
  return new Promise((resolve) => {
    fs.createReadStream(path.join(__dirname, "fy2024_safmrs.clean.csv"))
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

function loadFMRMetro() {
  console.log("🔄 Loading FMR Metro data...");
  return new Promise((resolve) => {
    fs.createReadStream(path.join(__dirname, "fy2024_fmr_metro.csv"))
      .pipe(csv())
      .on("data", (row) => {
        fmrMetroData[row.zip] = row;
      })
      .on("end", () => {
        console.log("🌆 FMR Metro loaded:", Object.keys(fmrMetroData).length);
        resolve();
      });
  });
}

function loadCrosswalk() {
  return new Promise((resolve) => {
    fs.createReadStream(path.join(__dirname, "hud_zip_metro_crosswalk.csv"))
      .pipe(csv())
      .on("data", (row) => {
        crosswalk[row.zip] = row.cbsa;
      })
      .on("end", resolve);
  });
}

// ===============================
// UTILS
// ===============================

function cleanMoney(val) {
  if (!val) return 0;
  return parseInt(val.replace(/[$,]/g, ""));
}

function getRent(zip, bedrooms) {
  const bedKey = `${bedrooms}br`;

  // SAFMR first
  if (safmrData[zip] && safmrData[zip][bedKey]) {
    return {
      rent: parseInt(safmrData[zip][bedKey]),
      source: "HUD SAFMR 2024",
      metro: safmrData[zip].metro || ""
    };
  }

  // FMR fallback
  if (fmrMetroData[zip]) {
    const row = fmrMetroData[zip];
    const rentCols = ["0br", "1br", "2br", "3br", "4br"];
    const rent = cleanMoney(row[rentCols[bedrooms]]);

    return {
      rent,
      source: "HUD FMR 2024",
      metro: row.metro || ""
    };
  }

  return null;
}

function calculateMortgage(price, downPct, rate) {
  const loan = price * (1 - downPct / 100);
  const monthlyRate = rate / 100 / 12;
  const n = 30 * 12;

  const payment =
    loan *
    (monthlyRate * Math.pow(1 + monthlyRate, n)) /
    (Math.pow(1 + monthlyRate, n) - 1);

  return Math.round(payment);
}

// ===============================
// MAIN ANALYZE ROUTE
// ===============================

app.post("/api/analyze", (req, res) => {
  const {
    address,
    zip,
    bedrooms,
    interestRate = 6.5,
    purchasePrice = 0,
    downPaymentPct = 20,
    rehab = 0
  } = req.body;

  if (!zip || bedrooms === undefined) {
    return res.status(400).json({ error: "Missing zip or bedrooms" });
  }

  const rentData = getRent(zip, bedrooms);

  if (!rentData || rentData.rent === 0) {
    return res.status(404).json({ error: "No HUD rent data found", zip });
  }

  const rent = rentData.rent;
  const mortgage = purchasePrice
    ? calculateMortgage(purchasePrice, downPaymentPct, interestRate)
    : 0;

  // ===============================
  // RENTAL ANALYSIS
  // ===============================

  const annualRent = rent * 12;
  const expenseRatio = 0.35;
  const annualExpenses = annualRent * expenseRatio;
  const annualNOI = annualRent - annualExpenses;
  const monthlyCashFlow = rent - mortgage;

  const estimatedValue =
    annualNOI > 0 ? Math.round(annualNOI / 0.08) : 0;

  let rentalVerdict = "Neutral rental.";
  if (monthlyCashFlow > 400) rentalVerdict = "Excellent rental. Strong cash flow.";
  else if (monthlyCashFlow > 0) rentalVerdict = "Good rental. Positive cash flow.";
  else rentalVerdict = "Negative cash flow. Bad rental.";

  // ===============================
  // FLIP (70% RULE)
  // ===============================

  const arv = estimatedValue;
  const maxFlipOffer = Math.round(arv * 0.7 - rehab);
  const flipProfit = arv - purchasePrice - rehab;

  let flipVerdict = "Neutral flip.";
  if (flipProfit > 40000) flipVerdict = "Strong flip";
  else if (flipProfit > 15000) flipVerdict = "Average flip";
  else flipVerdict = "Bad flip";

  // ===============================
  // WHOLESALE
  // ===============================

  const wholesaleSpread = maxFlipOffer - purchasePrice;
  const wholesaleVerdict =
    wholesaleSpread > 15000
      ? "Strong wholesale deal"
      : wholesaleSpread > 5000
      ? "Okay wholesale"
      : "Weak wholesale deal";

  // ===============================
  // BRRRR
  // ===============================

  const refinanceValue = Math.round(arv * 0.75);
  const totalCashIn =
    purchasePrice * (downPaymentPct / 100) + rehab;
  const cashOut = refinanceValue - purchasePrice;

  const brrrrVerdict =
    cashOut > totalCashIn
      ? "BRRRR viable"
      : "Not ideal for BRRRR";

  // ===============================
  // PERFORMANCE METRICS
  // ===============================

  const capRate =
    estimatedValue > 0
      ? ((annualNOI / estimatedValue) * 100).toFixed(2)
      : 0;

  const annualCashFlow = monthlyCashFlow * 12;

  const cashOnCashROI =
    totalCashIn > 0
      ? ((annualCashFlow / totalCashIn) * 100).toFixed(2)
      : 0;

  const dscr =
    mortgage > 0
      ? (annualNOI / (mortgage * 12)).toFixed(2)
      : 0;

  // ===============================
  // RESPONSE
  // ===============================

  res.json({
    address,
    zip,
    bedrooms,
    rent,
    metro: rentData.metro,
    source: rentData.source,

    // Rental
    mortgage,
    monthlyCashFlow,
    rentalVerdict,

    // Valuation
    arv,
    capRate,

    // Flip
    maxFlipOffer,
    flipProfit,
    flipVerdict,

    // Wholesale
    wholesaleSpread,
    wholesaleVerdict,

    // BRRRR
    refinanceValue,
    cashOut,
    brrrrVerdict,

    // Metrics
    cashOnCashROI,
    dscr
  });
});

// ===============================
// START SERVER
// ===============================

async function start() {
  await loadSAFMR();
  await loadFMRMetro();
  await loadCrosswalk();

  app.listen(PORT, () => {
    console.log(`🚀 ALEX running at http://localhost:${PORT}`);
  });
}

start();