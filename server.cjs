const express = require("express");
const fs = require("fs");
const path = require("path");
const csv = require("csv-parser");

const app = express();
app.use(express.json());

const PORT = 8080;

const safmrData = {};
const fmrMetroData = {};

// ------------------
// Utilities
// ------------------

function padZip(zip) {
  if (!zip) return null;
  return String(zip).trim().padStart(5, "0");
}

function parseDollar(val) {
  if (!val) return 0;
  return Number(String(val).replace(/[$,]/g, "")) || 0;
}

// ------------------
// Load SAFMR
// ------------------

function loadSAFMR() {
  console.log("🔄 Loading SAFMR data...");

  return new Promise((resolve, reject) => {
    fs.createReadStream(path.join(__dirname, "fy2024_safmrs.clean.csv"))
      .pipe(csv())
      .on("data", (row) => {
        const rawZip = row["ZIP Code"];
        const zip = padZip(rawZip);
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

// ------------------
// Load FMR Metro
// ------------------

function loadFMRMetro() {
  console.log("🔄 Loading FMR Metro data...");

  return new Promise((resolve, reject) => {
    fs.createReadStream(path.join(__dirname, "fy2024_fmr_metro.csv"))
      .pipe(csv())
      .on("data", (row) => {
        const zip = padZip(row["ZIP"]);
        if (!zip) return;

        fmrMetroData[zip] = {
          studio: parseDollar(row["$0 Bedroom"]),
          one: parseDollar(row["$1 Bedroom"]),
          two: parseDollar(row["$2 Bedroom"]),
          three: parseDollar(row["$3 Bedroom"]),
          four: parseDollar(row["$4 Bedroom"]),
          metro: row["HUD Metro FMR Area Name"]
        };
      })
      .on("end", () => {
        console.log("🌆 FMR Metro loaded:", Object.keys(fmrMetroData).length);
        resolve();
      })
      .on("error", reject);
  });
}

// ------------------
// Analyze Route
// ------------------

app.post("/api/analyze", (req, res) => {
  const {
    zip,
    bedrooms = 2,
    purchasePrice = 0,
    downPaymentPct = 20,
    interestRate = 6.5,
    rehab = 0
  } = req.body;

  const normalizedZip = padZip(zip);
  if (!normalizedZip) {
    return res.status(400).json({ error: "Invalid ZIP" });
  }

  let data = safmrData[normalizedZip];
  let source = "HUD SAFMR 2024";

  if (!data) {
    data = fmrMetroData[normalizedZip];
    source = "HUD FMR 2024";
  }

  if (!data) {
    return res.status(404).json({
      error: "No HUD rent data found",
      zip: normalizedZip
    });
  }

  const rent =
    bedrooms === 0 ? data.studio :
    bedrooms === 1 ? data.one :
    bedrooms === 2 ? data.two :
    bedrooms === 3 ? data.three :
    data.four;

  // Mortgage
  const downPayment = purchasePrice * (downPaymentPct / 100);
  const loanAmount = purchasePrice - downPayment;
  const monthlyRate = interestRate / 100 / 12;
  const payments = 30 * 12;

  const mortgage = loanAmount > 0
    ? Math.round(
        loanAmount *
          (monthlyRate * Math.pow(1 + monthlyRate, payments)) /
          (Math.pow(1 + monthlyRate, payments) - 1)
      )
    : 0;

  const monthlyCashFlow = Math.round(rent - mortgage);

  return res.json({
    zip: normalizedZip,
    bedrooms,
    rent,
    source,
    metro: data.metro,
    mortgage,
    monthlyCashFlow
  });
});

// ------------------
// Start Server
// ------------------

async function startServer() {
  try {
    await loadSAFMR();
    await loadFMRMetro();

    app.listen(PORT, () => {
      console.log(`🚀 ALEX running at http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error("Startup error:", err);
  }
}

startServer();