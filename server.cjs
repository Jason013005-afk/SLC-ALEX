const express = require("express");
const fs = require("fs");
const path = require("path");
const csv = require("csv-parser");

const app = express();
app.use(express.json());

let safmrData = {};
let fmrMetroData = {};

/* ===========================
   DEFENSIVE ZIP NORMALIZER
=========================== */
function padZip(zip) {
  if (!zip) return null;
  const str = String(zip).trim();
  if (!str) return null;
  return str.padStart(5, "0");
}

/* ===========================
   LOAD SAFMR
=========================== */
function loadSAFMR() {
  console.log("🔄 Loading SAFMR data...");
  safmrData = {};

  return new Promise((resolve, reject) => {
    fs.createReadStream(path.join(__dirname, "fy2024_safmrs.clean.csv"))
      .pipe(csv())
      .on("data", (row) => {
        try {
          const rawZip = row.ZIP || row.zip || row.Zip;
          const zip = padZip(rawZip);
          if (!zip) return;

          safmrData[zip] = {
            studio: parseFloat(row["0BR"]?.replace(/[^\d.]/g, "")) || 0,
            one: parseFloat(row["1BR"]?.replace(/[^\d.]/g, "")) || 0,
            two: parseFloat(row["2BR"]?.replace(/[^\d.]/g, "")) || 0,
            three: parseFloat(row["3BR"]?.replace(/[^\d.]/g, "")) || 0,
            four: parseFloat(row["4BR"]?.replace(/[^\d.]/g, "")) || 0,
            metro: row["HUD Metro Area Name"] || "Unknown"
          };
        } catch (err) {
          // skip bad row
        }
      })
      .on("end", () => {
        console.log("🏠 SAFMR loaded:", Object.keys(safmrData).length);
        resolve();
      })
      .on("error", reject);
  });
}

/* ===========================
   LOAD FMR METRO
=========================== */
function loadFMRMetro() {
  console.log("🔄 Loading FMR Metro data...");
  fmrMetroData = {};

  return new Promise((resolve, reject) => {
    fs.createReadStream(path.join(__dirname, "fy2024_fmr_metro.csv"))
      .pipe(csv())
      .on("data", (row) => {
        try {
          const rawZip = row.ZIP || row.zip || row.Zip;
          const zip = padZip(rawZip);
          if (!zip) return;

          fmrMetroData[zip] = {
            studio: parseFloat(row["$0BR"]?.replace(/[^\d.]/g, "")) || 0,
            one: parseFloat(row["$1BR"]?.replace(/[^\d.]/g, "")) || 0,
            two: parseFloat(row["$2BR"]?.replace(/[^\d.]/g, "")) || 0,
            three: parseFloat(row["$3BR"]?.replace(/[^\d.]/g, "")) || 0,
            four: parseFloat(row["$4BR"]?.replace(/[^\d.]/g, "")) || 0,
            metro: row["HUD Metro FMR Area Name"] || "Metro"
          };
        } catch (err) {
          // skip bad row
        }
      })
      .on("end", () => {
        console.log("🌆 FMR Metro loaded:", Object.keys(fmrMetroData).length);
        resolve();
      })
      .on("error", reject);
  });
}

/* ===========================
   ANALYZE ROUTE
=========================== */
app.post("/api/analyze", (req, res) => {
  const {
    zip,
    bedrooms = 3,
    interestRate = 6.5,
    purchasePrice = 0,
    downPaymentPct = 20,
    rehab = 0
  } = req.body;

  const normalizedZip = padZip(zip);
  if (!normalizedZip) {
    return res.json({ error: "Invalid ZIP" });
  }

  let rentData = safmrData[normalizedZip];
  let source = "HUD SAFMR 2024";

  if (!rentData) {
    rentData = fmrMetroData[normalizedZip];
    source = "HUD FMR 2024";
  }

  if (!rentData) {
    return res.json({ error: "No HUD rent data found", zip: normalizedZip });
  }

  const rent =
    bedrooms === 0 ? rentData.studio :
    bedrooms === 1 ? rentData.one :
    bedrooms === 2 ? rentData.two :
    bedrooms === 3 ? rentData.three :
    rentData.four;

  /* ===== Mortgage ===== */
  const loanAmount = purchasePrice * (1 - downPaymentPct / 100);
  const monthlyRate = interestRate / 100 / 12;
  const mortgage =
    loanAmount > 0
      ? Math.round(
          (loanAmount *
            (monthlyRate * Math.pow(1 + monthlyRate, 360))) /
            (Math.pow(1 + monthlyRate, 360) - 1)
        )
      : 0;

  const monthlyCashFlow = rent - mortgage;

  /* ===== NOI ===== */
  const annualRent = rent * 12;
  const annualExpenses = annualRent * 0.35;
  const annualNOI = annualRent - annualExpenses;

  const arv = Math.round(annualNOI / 0.08);

  /* ===== Flip ===== */
  const maxFlipOffer = Math.round(arv * 0.7 - rehab);
  const flipProfit = arv - purchasePrice - rehab;

  /* ===== BRRRR ===== */
  const refinanceValue = Math.round(arv * 0.75);
  const totalCashIn = purchasePrice * (downPaymentPct / 100) + rehab;
  const cashOut = refinanceValue - totalCashIn;

  /* ===== ROI Metrics ===== */
  const capRate = arv > 0 ? ((annualNOI / arv) * 100).toFixed(2) : 0;
  const annualCashFlow = monthlyCashFlow * 12;
  const cashOnCashROI =
    totalCashIn > 0 ? ((annualCashFlow / totalCashIn) * 100).toFixed(2) : 0;

  res.json({
    zip: normalizedZip,
    rent,
    source,
    mortgage,
    monthlyCashFlow,
    arv,
    capRate,
    cashOnCashROI,
    maxFlipOffer,
    flipProfit,
    refinanceValue,
    cashOut
  });
});

/* ===========================
   START SERVER
=========================== */
Promise.all([loadSAFMR(), loadFMRMetro()])
  .then(() => {
    app.listen(8080, () => {
      console.log("🚀 ALEX running at http://localhost:8080");
    });
  })
  .catch(console.error);