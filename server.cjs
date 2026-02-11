const express = require("express");
const cors = require("cors");
const fs = require("fs");
const csv = require("csv-parser");
const path = require("path");

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static("public"));

const PORT = 8080;

/* ============================
   LOAD HUD DATA (SAFMR + FMR)
============================ */

let safmrData = [];
let fmrMetroData = [];

function loadCSV(filePath, targetArray, label) {
  return new Promise((resolve, reject) => {
    fs.createReadStream(filePath)
      .pipe(csv())
      .on("data", (row) => targetArray.push(row))
      .on("end", () => {
        console.log(`🏠 ${label} loaded: ${targetArray.length}`);
        resolve();
      })
      .on("error", reject);
  });
}

async function loadHUD() {
  await loadCSV(
    path.join(__dirname, "fy2024_safmrs.clean.csv"),
    safmrData,
    "SAFMR"
  );

  await loadCSV(
    path.join(__dirname, "fy2024_fmr_metro.csv"),
    fmrMetroData,
    "FMR Metro"
  );
}

/* ============================
   RENT LOOKUP
============================ */

function cleanMoney(value) {
  if (!value) return 0;
  return parseInt(value.replace(/[$,]/g, ""));
}

function getSAFMR(zip, bedrooms) {
  const row = safmrData.find(r => r["ZIP Code"] === zip);
  if (!row) return null;
  return cleanMoney(row[`SAFMR ${bedrooms}BR`]);
}

function getFMR(zip, bedrooms) {
  const row = fmrMetroData.find(r => r[Object.keys(r)[2]] === zip);
  if (!row) return null;

  const keys = Object.keys(row);
  return cleanMoney(row[keys[3 + bedrooms]]);
}

/* ============================
   MORTGAGE CALC
============================ */

function calculateMortgage(purchasePrice, downPct, rate) {
  const downPayment = purchasePrice * (downPct / 100);
  const loan = purchasePrice - downPayment;

  const monthlyRate = rate / 100 / 12;
  const term = 30 * 12;

  const mortgage =
    (loan * monthlyRate) /
    (1 - Math.pow(1 + monthlyRate, -term));

  return Math.round(mortgage);
}

/* ============================
   MAIN ANALYZE ROUTE
============================ */

app.post("/api/analyze", (req, res) => {
  const {
    address,
    zip,
    bedrooms = 3,
    interestRate = 6.5,
    purchasePrice = 0,
    downPaymentPct = 20,
    rehab = 0
  } = req.body;

  if (!zip) {
    return res.json({ error: "ZIP required" });
  }

  /* --- RENT LOOKUP --- */
  let rent = getSAFMR(zip, bedrooms);
  let source = "HUD SAFMR 2024";

  if (!rent) {
    rent = getFMR(zip, bedrooms);
    source = "HUD FMR 2024";
  }

  if (!rent) {
    return res.json({ error: "No HUD rent data found", zip });
  }

  /* --- MORTGAGE --- */
  const mortgage = purchasePrice
    ? calculateMortgage(purchasePrice, downPaymentPct, interestRate)
    : 0;

  /* --- OPERATING MODEL --- */
  const expenseRatio = 0.35;   // 35% expenses
  const capRate = 0.08;        // 8% cap assumption

  const annualRent = rent * 12;
  const annualNOI = annualRent * (1 - expenseRatio);
  const estimatedValue = Math.round(annualNOI / capRate);

  const monthlyCashFlow = mortgage
    ? Math.round(rent - mortgage - (rent * expenseRatio))
    : 0;

  /* --- FLIP LOGIC (70% RULE) --- */
  const arv = estimatedValue;
  const maxFlipPrice = Math.round(arv * 0.7 - rehab);
  const flipProfit = Math.round(arv - purchasePrice - rehab);

  /* --- WHOLESALE SPREAD --- */
  const wholesaleSpread = Math.round(maxFlipPrice - purchasePrice);

  /* --- STRATEGY ENGINE --- */
  let strategy = "pass";
  let verdict = "Not enough margin.";

  if (monthlyCashFlow > 500) {
    strategy = "hold";
    verdict = "Excellent rental. Strong cash flow.";
  } else if (monthlyCashFlow > 150) {
    strategy = "hold";
    verdict = "Good rental. Positive cash flow.";
  } else if (flipProfit > 40000) {
    strategy = "flip";
    verdict = "Strong flip potential.";
  } else if (wholesaleSpread > 20000) {
    strategy = "wholesale";
    verdict = "Good wholesale spread.";
  } else if (monthlyCashFlow < 0) {
    strategy = "pass";
    verdict = "Negative cash flow.