const express = require("express");
const fs = require("fs");
const path = require("path");
const csv = require("csv-parser");

const app = express();
app.use(express.json());

const PORT = 8080;

let safmrData = {};
let fmrMetroData = {};

// ----------------------
// Utility
// ----------------------

function parseDollar(value) {
  if (!value) return 0;
  return parseFloat(value.replace(/[$,]/g, "")) || 0;
}

function padZip(zip) {
  return zip.toString().padStart(5, "0");
}

// ----------------------
// Load SAFMR
// ----------------------

function loadSAFMR() {
  console.log("🔄 Loading SAFMR data...");

  return new Promise((resolve, reject) => {
    fs.createReadStream(path.join(__dirname, "fy2024_safmrs.clean.csv"))
      .pipe(csv())
      .on("data", (row) => {
        const zip = padZip(row.ZIP || row.zip);
        if (!zip) return;

        safmrData[zip] = {
          studio: parseDollar(row["0BR"]),
          one: parseDollar(row["1BR"]),
          two: parseDollar(row["2BR"]),
          three: parseDollar(row["3BR"]),
          four: parseDollar(row["4BR"]),
          metro: row["HUD Metro Area Name"]
        };
      })
      .on("end", () => {
        console.log("🏠 SAFMR loaded:", Object.keys(safmrData).length);
        resolve();
      })
      .on("error", reject);
  });
}

// ----------------------
// Load FMR Metro
// ----------------------

function loadFMRMetro() {
  console.log("🔄 Loading FMR Metro data...");

  return new Promise((resolve, reject) => {
    fs.createReadStream(path.join(__dirname, "fy2024_fmr_metro.csv"))
      .pipe(csv())
      .on("data", (row) => {
        const zip = padZip(row.ZIP || row.zip);
        if (!zip) return;

        fmrMetroData[zip] = {
          studio: parseDollar(row["$0BR"] || row["0BR"]),
          one: parseDollar(row["$1BR"] || row["1BR"]),
          two: parseDollar(row["$2BR"] || row["2BR"]),
          three: parseDollar(row["$3BR"] || row["3BR"]),
          four: parseDollar(row["$4BR"] || row["4BR"]),
          metro: row["HUD Metro FMR Area"] || row["Metro Name"]
        };
      })
      .on("end", () => {
        console.log("🌆 FMR Metro loaded:", Object.keys(fmrMetroData).length);
        resolve();
      })
      .on("error", reject);
  });
}

// ----------------------
// Main Analyze Route
// ----------------------

app.post("/api/analyze", (req, res) => {
  const {
    address,
    zip,
    bedrooms,
    interestRate = 7,
    purchasePrice = 0,
    downPaymentPct = 20,
    rehab = 0
  } = req.body;

  if (!zip || bedrooms == null) {
    return res.status(400).json({ error: "ZIP and bedrooms required" });
  }

  const paddedZip = padZip(zip);

  let rentData = safmrData[paddedZip];
  let source = "HUD SAFMR 2024";

  if (!rentData) {
    rentData = fmrMetroData[paddedZip];
    source = "HUD FMR 2024";
  }

  if (!rentData) {
    return res.status(404).json({ error: "No HUD rent data found", zip });
  }

  const bedroomKey =
    bedrooms === 0
      ? "studio"
      : bedrooms === 1
      ? "one"
      : bedrooms === 2
      ? "two"
      : bedrooms === 3
      ? "three"
      : "four";

  const rent = rentData[bedroomKey];

  if (!rent) {
    return res.status(404).json({ error: "No rent for bedroom size" });
  }

  // ----------------------
  // Rental Math
  // ----------------------

  const loanAmount = purchasePrice * (1 - downPaymentPct / 100);
  const monthlyRate = interestRate / 100 / 12;
  const termMonths = 30 * 12;

  const mortgage =
    loanAmount > 0
      ? Math.round(
          (loanAmount *
            monthlyRate *
            Math.pow(1 + monthlyRate, termMonths)) /
            (Math.pow(1 + monthlyRate, termMonths) - 1)
        )
      : 0;

  const monthlyCashFlow = rent - mortgage;

  const rentalStrategy =
    monthlyCashFlow > 500
      ? "Strong Hold"
      : monthlyCashFlow > 0
      ? "Hold"
      : "Pass";

  const rentalVerdict =
    monthlyCashFlow > 500
      ? "Excellent rental. Strong cash flow."
      : monthlyCashFlow > 0
      ? "Good rental. Positive cash flow."
      : "Negative cash flow. Bad deal.";

  // ----------------------
  // Performance Metrics
  // ----------------------

  const annualRent = rent * 12;
  const expenseRatio = 0.35;
  const annualExpenses = annualRent * expenseRatio;
  const annualNOI = annualRent - annualExpenses;

  const capRate =
    purchasePrice > 0
      ? ((annualNOI / purchasePrice) * 100).toFixed(2)
      : 0;

  const totalCashIn =
    purchasePrice * (downPaymentPct / 100) + rehab;

  const annualCashFlow = monthlyCashFlow * 12;

  const cashOnCashROI =
    totalCashIn > 0
      ? ((annualCashFlow / totalCashIn) * 100).toFixed(2)
      : 0;

  // ----------------------
  // ARV (Cap Rate Based)
  // ----------------------

  const targetCapRate = 0.08;
  const arv = Math.round(annualNOI / targetCapRate);

  // ----------------------
  // Flip (70% Rule)
  // ----------------------

  const maxFlipOffer = Math.round(arv * 0.7 - rehab);
  const flipProfit = arv - (purchasePrice + rehab);
  const flipVerdict =
    flipProfit > 20000
      ? "Good flip"
      : flipProfit > 0
      ? "Thin flip"
      : "Bad flip";

  // ----------------------
  // Wholesale
  // ----------------------

  const wholesaleSpread = maxFlipOffer - purchasePrice;
  const wholesaleVerdict =
    wholesaleSpread > 15000
      ? "Strong wholesale deal"
      : wholesaleSpread > 0
      ? "Weak wholesale deal"
      : "No wholesale opportunity";

  // ----------------------
  // BRRRR
  // ----------------------

  const refinanceValue = Math.round(arv * 0.75);
  const cashOut = refinanceValue - (purchasePrice + rehab);
  const brrrrVerdict =
    cashOut > 0
      ? "Viable BRRRR"
      : "Not ideal for BRRRR";

  // ----------------------
  // Response
  // ----------------------

  res.json({
    address,
    zip: paddedZip,
    bedrooms,
    metro: rentData.metro,
    source,
    rent,
    mortgage,
    monthlyCashFlow,
    annualNOI,
    capRate,
    cashOnCashROI,
    arv,
    maxFlipOffer,
    flipProfit,
    flipVerdict,
    wholesaleSpread,
    wholesaleVerdict,
    refinanceValue,
    cashOut,
    brrrrVerdict,
    rentalStrategy,
    rentalVerdict
  });
});

// ----------------------
// Start Server
// ----------------------

async function start() {
  try {
    await loadSAFMR();
    await loadFMRMetro();

    app.listen(PORT, () => {
      console.log(`🚀 ALEX running at http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error("Failed to load HUD data:", err);
  }
}

start();