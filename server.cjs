const express = require("express");
const fs = require("fs");
const csv = require("csv-parser");
const path = require("path");

const app = express();
app.use(express.json());

const safmrData = {};
const fmrMetroData = {};

/* ---------------- ZIP HELPERS ---------------- */

function padZip(zip) {
  if (!zip) return null;
  return String(zip).trim().padStart(5, "0");
}

function parseDollar(val) {
  if (!val) return 0;
  return Number(String(val).replace(/[^0-9.-]+/g, ""));
}

/* ---------------- LOAD SAFMR ---------------- */

function loadSAFMR() {
  console.log("🔄 Loading SAFMR data...");

  return new Promise((resolve, reject) => {
    fs.createReadStream(path.join(__dirname, "fy2024_safmrs.clean.csv"))
      .pipe(csv())
      .on("data", (row) => {
        const zip = padZip(row.ZIP || row.zip || row.Zip);
        if (!zip) return;

        safmrData[zip] = {
          studio: parseDollar(row["0BR"]),
          one: parseDollar(row["1BR"]),
          two: parseDollar(row["2BR"]),
          three: parseDollar(row["3BR"]),
          four: parseDollar(row["4BR"]),
          metro: row["HUD Metro Area Name"] || row.metro || null,
        };
      })
      .on("end", () => {
        console.log("🏠 SAFMR loaded:", Object.keys(safmrData).length);
        resolve();
      })
      .on("error", reject);
  });
}

/* ---------------- LOAD FMR METRO ---------------- */

function loadFMRMetro() {
  console.log("🔄 Loading FMR Metro data...");

  return new Promise((resolve, reject) => {
    fs.createReadStream(path.join(__dirname, "fy2024_fmr_metro.csv"))
      .pipe(csv())
      .on("data", (row) => {
        const metro = row["HUD Metro Area Name"];
        if (!metro) return;

        fmrMetroData[metro] = {
          studio: parseDollar(row["0BR"]),
          one: parseDollar(row["1BR"]),
          two: parseDollar(row["2BR"]),
          three: parseDollar(row["3BR"]),
          four: parseDollar(row["4BR"]),
        };
      })
      .on("end", () => {
        console.log("🌆 FMR Metro loaded:", Object.keys(fmrMetroData).length);
        resolve();
      })
      .on("error", reject);
  });
}

/* ---------------- ANALYZE ROUTE ---------------- */

app.post("/api/analyze", (req, res) => {
  const {
    zip,
    bedrooms = 3,
    purchasePrice = 250000,
    downPaymentPct = 20,
    interestRate = 6.5,
    rehab = 0,
  } = req.body;

  const paddedZip = padZip(zip);

  if (!paddedZip || !safmrData[paddedZip]) {
    return res.status(400).json({
      error: "No HUD rent data found",
      zip,
    });
  }

  const zipData = safmrData[paddedZip];

  let rent;
  if (bedrooms <= 0) rent = zipData.studio;
  else if (bedrooms === 1) rent = zipData.one;
  else if (bedrooms === 2) rent = zipData.two;
  else if (bedrooms === 3) rent = zipData.three;
  else rent = zipData.four;

  /* ----- Rental Math ----- */

  const annualRent = rent * 12;
  const expenseRatio = 0.35;
  const annualExpenses = annualRent * expenseRatio;
  const annualNOI = annualRent - annualExpenses;

  const capRateAssumption = 0.08;
  const arv = Math.round(annualNOI / capRateAssumption);

  const loanAmount = purchasePrice * (1 - downPaymentPct / 100);
  const monthlyRate = interestRate / 100 / 12;
  const months = 30 * 12;

  const mortgage =
    (loanAmount *
      monthlyRate *
      Math.pow(1 + monthlyRate, months)) /
    (Math.pow(1 + monthlyRate, months) - 1);

  const monthlyCashFlow = rent - mortgage;
  const annualCashFlow = monthlyCashFlow * 12;

  const totalCashIn =
    purchasePrice * (downPaymentPct / 100) + rehab;

  const cashOnCash =
    totalCashIn > 0
      ? ((annualCashFlow / totalCashIn) * 100).toFixed(2)
      : 0;

  const capRate = ((annualNOI / purchasePrice) * 100).toFixed(2);

  /* ----- Flip Math ----- */

  const maxFlipOffer = Math.round(arv * 0.7 - rehab);
  const flipProfit = arv - purchasePrice - rehab;
  const flipROI =
    maxFlipOffer > 0
      ? ((flipProfit / maxFlipOffer) * 100).toFixed(2)
      : 0;

  /* ----- BRRRR ----- */

  const refinanceValue = Math.round(arv * 0.75);
  const cashOut =
    refinanceValue - purchasePrice - rehab;

  /* ----- RESPONSE ----- */

  res.json({
    zip: paddedZip,
    bedrooms,
    rent,
    arv,
    mortgage: Math.round(mortgage),
    monthlyCashFlow: Math.round(monthlyCashFlow),

    capRate,
    cashOnCash,
    flipROI,

    refinanceValue,
    cashOut,
  });
});

/* ---------------- START SERVER ---------------- */

async function start() {
  await loadSAFMR();
  await loadFMRMetro();

  app.listen(8080, () => {
    console.log("🚀 ALEX running at http://localhost:8080");
  });
}

start();