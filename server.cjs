const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const csv = require("csv-parser");

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static("public"));

const PORT = 8080;

/* ==============================
   DATA STORES
============================== */

let safmrData = {};
let fmrMetroData = {};

/* ==============================
   LOAD SAFMR DATA
============================== */

function loadSAFMR() {
  console.log("🔄 Loading SAFMR data...");

  return new Promise((resolve) => {
    fs.createReadStream(path.join(__dirname, "fy2024_safmrs.clean.csv"))
      .pipe(csv())
      .on("data", (row) => {
        const zip = String(row["ZIP Code"]).trim();

        safmrData[zip] = {
          metro: row["HUD Metro Fair Market Rent Area Name"],
          rents: {
            0: parseMoney(row["SAFMR 0BR"]),
            1: parseMoney(row["SAFMR 1BR"]),
            2: parseMoney(row["SAFMR 2BR"]),
            3: parseMoney(row["SAFMR 3BR"]),
            4: parseMoney(row["SAFMR 4BR"]),
          },
        };
      })
      .on("end", () => {
        console.log("🏠 SAFMR loaded:", Object.keys(safmrData).length);
        resolve();
      });
  });
}

/* ==============================
   LOAD FMR METRO (FALLBACK)
============================== */

function loadFMRMetro() {
  console.log("🔄 Loading FMR Metro data...");

  return new Promise((resolve) => {
    fs.createReadStream(path.join(__dirname, "fy2024_fmr_metro.csv"))
      .pipe(csv())
      .on("data", (row) => {
        const zip = String(row["ZIP"]).trim();

        fmrMetroData[zip] = {
          metro: row["HUD Metro FMR Area"],
          rents: {
            0: parseMoney(row["0-BR"]),
            1: parseMoney(row["1-BR"]),
            2: parseMoney(row["2-BR"]),
            3: parseMoney(row["3-BR"]),
            4: parseMoney(row["4-BR"]),
          },
        };
      })
      .on("end", () => {
        console.log("🌆 FMR Metro loaded:", Object.keys(fmrMetroData).length);
        resolve();
      });
  });
}

/* ==============================
   HELPERS
============================== */

function parseMoney(value) {
  if (!value) return 0;
  return parseInt(value.replace(/[$,]/g, ""));
}

function calculateMortgage(principal, annualRate, years = 30) {
  const monthlyRate = annualRate / 100 / 12;
  const n = years * 12;
  return Math.round(
    (principal * monthlyRate) /
      (1 - Math.pow(1 + monthlyRate, -n))
  );
}

/* ==============================
   MARKET CAP RATE MAP
============================== */

const marketCapRates = {
  "Providence-Fall River, RI-MA HUD Metro FMR Area": 0.085,
  "Abilene, TX MSA": 0.08,
  default: 0.08,
};

/* ==============================
   ANALYZE ROUTE
============================== */

app.post("/api/analyze", (req, res) => {
  const {
    address,
    zip,
    bedrooms,
    purchasePrice,
    interestRate,
    downPaymentPct = 20,
    rehab = 0,
    propertyTaxRate = 0.012,   // 1.2% default
    insuranceAnnual = 1200,
    vacancyRate = 0.05,
    maintenanceRate = 0.08,
  } = req.body;

  if (!zip || bedrooms == null) {
    return res.json({ error: "Missing zip or bedrooms" });
  }

  let rentData = safmrData[zip];
  let source = "HUD SAFMR 2024";

  if (!rentData) {
    rentData = fmrMetroData[zip];
    source = "HUD FMR 2024";
  }

  if (!rentData) {
    return res.json({ error: "No HUD rent data found", zip });
  }

  const rent = rentData.rents[bedrooms] || 0;
  const metro = rentData.metro;

  /* ==============================
     EXPENSE MODEL
  ============================== */

  const annualRent = rent * 12;

  const propertyTax = purchasePrice * propertyTaxRate;
  const vacancyLoss = annualRent * vacancyRate;
  const maintenance = annualRent * maintenanceRate;

  const totalAnnualExpenses =
    propertyTax + insuranceAnnual + vacancyLoss + maintenance;

  const annualNOI = annualRent - totalAnnualExpenses;

  /* ==============================
     CAP RATE BASED ARV
  ============================== */

  const capRate =
    marketCapRates[metro] || marketCapRates["default"];

  const estimatedValue = Math.round(annualNOI / capRate);

  /* ==============================
     FINANCING
  ============================== */

  let mortgage = 0;
  let monthlyCashFlow = 0;
  let dscr = null;

  if (purchasePrice && interestRate) {
    const downPayment = purchasePrice * (downPaymentPct / 100);
    const loanAmount = purchasePrice - downPayment;

    mortgage = calculateMortgage(loanAmount, interestRate);

    const monthlyExpenses =
      mortgage +
      propertyTax / 12 +
      insuranceAnnual / 12 +
      vacancyLoss / 12 +
      maintenance / 12;

    monthlyCashFlow = Math.round(rent - monthlyExpenses);

    dscr = parseFloat((annualNOI / (mortgage * 12)).toFixed(2));
  }

  /* ==============================
     STRATEGY LOGIC
  ============================== */

  let strategy = "hold";
  let verdict = "Good rental. Positive cash flow.";

  if (monthlyCashFlow < 0) {
    strategy = "pass";
    verdict = "Negative cash flow. Bad deal.";
  }

  if (monthlyCashFlow > 500 && dscr > 1.25) {
    verdict = "Excellent rental. Strong cash flow.";
  }

  /* ==============================
     RESPONSE
  ============================== */

  res.json({
    address,
    zip,
    bedrooms,
    metro,
    source,
    rent,
    annualRent,
    propertyTax: Math.round(propertyTax),
    insuranceAnnual,
    vacancyLoss: Math.round(vacancyLoss),
    maintenance: Math.round(maintenance),
    annualNOI: Math.round(annualNOI),
    capRate,
    estimatedValue,
    mortgage,
    dscr,
    monthlyCashFlow,
    strategy,
    verdict,
  });
});

/* ==============================
   START SERVER
============================== */

async function start() {
  await loadSAFMR();
  await loadFMRMetro();

  app.listen(PORT, () => {
    console.log(`🚀 ALEX running at http://localhost:${PORT}`);
  });
}

start();