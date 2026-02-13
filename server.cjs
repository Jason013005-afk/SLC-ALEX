const express = require("express");
const fs = require("fs");
const path = require("path");
const csv = require("csv-parser");

const app = express();
app.use(express.json());

let safmrData = {};
let fmrMetroData = {};

// -------------------------
// Utilities
// -------------------------

function padZip(zip) {
  if (!zip) return null;
  return zip.toString().trim().padStart(5, "0");
}

function parseDollar(value) {
  if (!value) return 0;
  return parseInt(value.replace(/[$,]/g, ""), 10) || 0;
}

// -------------------------
// Load SAFMR CSV
// -------------------------

function loadSAFMR() {
  console.log("🔄 Loading SAFMR data...");

  return new Promise((resolve, reject) => {
    safmrData = {};

    fs.createReadStream(path.join(__dirname, "fy2024_safmrs.clean.csv"))
      .pipe(csv())
      .on("data", (row) => {
        const zipRaw = row.ZIP || row.Zip || row.zip;
        const zip = padZip(zipRaw);
        if (!zip) return;

        safmrData[zip] = {
          studio: parseDollar(row["0BR"]),
          one: parseDollar(row["1BR"]),
          two: parseDollar(row["2BR"]),
          three: parseDollar(row["3BR"]),
          four: parseDollar(row["4BR"]),
          metro: row["HUD Metro Area Name"] || row.metro || ""
        };
      })
      .on("end", () => {
        console.log("🏠 SAFMR loaded:", Object.keys(safmrData).length);
        resolve();
      })
      .on("error", reject);
  });
}

// -------------------------
// Load FMR Metro CSV
// -------------------------

function loadFMRMetro() {
  console.log("🔄 Loading FMR Metro data...");

  return new Promise((resolve, reject) => {
    fmrMetroData = {};

    fs.createReadStream(path.join(__dirname, "fy2024_fmr_metro.csv"))
      .pipe(csv())
      .on("data", (row) => {
        const zipRaw = row.ZIP || row.Zip || row.zip;
        const zip = padZip(zipRaw);
        if (!zip) return;

        fmrMetroData[zip] = {
          studio: parseDollar(row["0BR"]),
          one: parseDollar(row["1BR"]),
          two: parseDollar(row["2BR"]),
          three: parseDollar(row["3BR"]),
          four: parseDollar(row["4BR"]),
          metro: row["HUD Metro Area Name"] || row.metro || ""
        };
      })
      .on("end", () => {
        console.log("🌆 FMR Metro loaded:", Object.keys(fmrMetroData).length);
        resolve();
      })
      .on("error", reject);
  });
}

// -------------------------
// Core Analysis Route
// -------------------------

app.post("/api/analyze", (req, res) => {
  try {
    const {
      address,
      zip,
      bedrooms,
      interestRate = 7,
      purchasePrice = 0,
      downPaymentPct = 20,
      rehab = 0
    } = req.body;

    const paddedZip = padZip(zip);
    if (!paddedZip) {
      return res.json({ error: "Invalid ZIP" });
    }

    let rentData = safmrData[paddedZip];
    let source = "HUD SAFMR 2024";

    if (!rentData) {
      rentData = fmrMetroData[paddedZip];
      source = "HUD FMR 2024";
    }

    if (!rentData) {
      return res.json({ error: "No HUD rent data found", zip: paddedZip });
    }

    const rent =
      bedrooms === 0
        ? rentData.studio
        : bedrooms === 1
        ? rentData.one
        : bedrooms === 2
        ? rentData.two
        : bedrooms === 3
        ? rentData.three
        : rentData.four;

    // -------------------------
    // Mortgage
    // -------------------------

    const downPayment = purchasePrice * (downPaymentPct / 100);
    const loanAmount = purchasePrice - downPayment;

    const monthlyRate = interestRate / 100 / 12;
    const payments = 30 * 12;

    const mortgage =
      loanAmount > 0
        ? Math.round(
            (loanAmount *
              (monthlyRate * Math.pow(1 + monthlyRate, payments))) /
              (Math.pow(1 + monthlyRate, payments) - 1)
          )
        : 0;

    // -------------------------
    // Rental Metrics
    // -------------------------

    const monthlyCashFlow = Math.round(rent - mortgage);
    const annualRent = rent * 12;
    const expenseRatio = 0.35;
    const annualExpenses = annualRent * expenseRatio;
    const annualNOI = annualRent - annualExpenses;

    const capRate =
      purchasePrice > 0
        ? ((annualNOI / purchasePrice) * 100).toFixed(2)
        : 0;

    const totalCashIn = downPayment + rehab;
    const annualCashFlow = monthlyCashFlow * 12;

    const cashOnCashROI =
      totalCashIn > 0
        ? ((annualCashFlow / totalCashIn) * 100).toFixed(2)
        : 0;

    let rentalVerdict = "Bad rental";
    if (monthlyCashFlow > 500) rentalVerdict = "Excellent rental";
    else if (monthlyCashFlow > 0) rentalVerdict = "Good rental";

    // -------------------------
    // ARV (Cap Rate Based)
    // -------------------------

    const targetCap = 0.08;
    const arv = Math.round(annualNOI / targetCap);

    // -------------------------
    // Flip Math (70% rule)
    // -------------------------

    const maxFlipOffer = Math.round(arv * 0.7 - rehab);
    const flipProfit = Math.round(arv - purchasePrice - rehab);
    const flipMargin =
      purchasePrice > 0
        ? ((flipProfit / purchasePrice) * 100).toFixed(2)
        : 0;

    let flipVerdict = "Bad flip";
    if (flipProfit > 30000) flipVerdict = "Strong flip";
    else if (flipProfit > 10000) flipVerdict = "Okay flip";

    // -------------------------
    // Wholesale
    // -------------------------

    const wholesaleSpread = Math.round(maxFlipOffer - purchasePrice);
    let wholesaleVerdict =
      wholesaleSpread > 20000
        ? "Strong wholesale"
        : wholesaleSpread > 0
        ? "Thin wholesale"
        : "Weak wholesale";

    // -------------------------
    // BRRRR
    // -------------------------

    const refinanceValue = Math.round(arv * 0.75);
    const cashOut = refinanceValue - (purchasePrice + rehab);

    let brrrrVerdict =
      cashOut > 20000
        ? "Strong BRRRR"
        : cashOut > 0
        ? "Possible BRRRR"
        : "Not ideal";

    // -------------------------
    // DSCR
    // -------------------------

    const dscr =
      mortgage > 0 ? (annualNOI / (mortgage * 12)).toFixed(2) : 0;

    // -------------------------
    // Final Response
    // -------------------------

    res.json({
      address,
      zip: paddedZip,
      bedrooms,
      rent,
      metro: rentData.metro,
      source,

      mortgage,
      monthlyCashFlow,
      annualNOI,
      capRate,
      cashOnCashROI,
      dscr,

      arv,

      maxFlipOffer,
      flipProfit,
      flipMargin,
      flipVerdict,

      wholesaleSpread,
      wholesaleVerdict,

      refinanceValue,
      cashOut,
      brrrrVerdict,

      rentalVerdict
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// -------------------------
// Boot
// -------------------------

async function start() {
  await loadSAFMR();
  await loadFMRMetro();

  app.listen(8080, () => {
    console.log("🚀 ALEX running at http://localhost:8080");
  });
}

start();