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

// ===============================
// DATA STORES
// ===============================

let safmrData = {};
let fmrMetroData = {};

// ===============================
// HELPERS
// ===============================

function cleanMoney(value) {
  if (!value) return 0;
  return Number(value.replace(/[$,]/g, ""));
}

function calculateMortgage(price, downPct, rate) {
  const loan = price * (1 - downPct / 100);
  const monthlyRate = rate / 100 / 12;
  const term = 30 * 12;

  return Math.round(
    loan *
      (monthlyRate * Math.pow(1 + monthlyRate, term)) /
      (Math.pow(1 + monthlyRate, term) - 1)
  );
}

// ===============================
// LOAD SAFMR
// ===============================

fs.createReadStream(path.join(__dirname, "fy2024_safmrs.clean.csv"))
  .pipe(csv())
  .on("data", (row) => {
    const zip = row["ZIP Code"]?.trim();
    if (!zip) return;
    safmrData[zip] = row;
  })
  .on("end", () => {
    console.log("🏠 SAFMR loaded:", Object.keys(safmrData).length);
  });

// ===============================
// LOAD FMR METRO
// ===============================

fs.createReadStream(path.join(__dirname, "fy2024_fmr_metro.csv"))
  .pipe(csv())
  .on("data", (row) => {
    const zip = row["ZIP Code"]?.trim();
    if (!zip) return;
    fmrMetroData[zip] = row;
  })
  .on("end", () => {
    console.log("🌆 FMR Metro loaded:", Object.keys(fmrMetroData).length);
  });

// ===============================
// API
// ===============================

app.post("/api/analyze", (req, res) => {
  const {
    address,
    zip,
    bedrooms,
    purchasePrice = 0,
    interestRate = 0,
    downPaymentPct = 20,
    rehab = 0,
  } = req.body;

  if (!zip || bedrooms === undefined) {
    return res.json({ error: "ZIP and bedrooms required" });
  }

  let rent = 0;
  let metro = "";
  let source = "";

  // SAFMR FIRST
  if (safmrData[zip]) {
    const row = safmrData[zip];
    const key = `SAFMR ${bedrooms}BR`;
    rent = cleanMoney(row[key]);
    metro = row["HUD Metro Fair Market Rent Area Name"];
    source = "HUD SAFMR 2024";
  }

  // FALLBACK TO FMR
  if (!rent && fmrMetroData[zip]) {
    const row = fmrMetroData[zip];
    const index = bedrooms + 1; // FMR format offset
    const rentValues = Object.values(row).slice(3);
    rent = cleanMoney(rentValues[index]);
    metro = row["HUD Metro Fair Market Rent Area Name"];
    source = "HUD FMR 2024";
  }

  if (!rent) {
    return res.json({ error: "No HUD rent data found", zip });
  }

  const mortgage = calculateMortgage(purchasePrice, downPaymentPct, interestRate);

  // ===============================
  // VALUE ESTIMATION (CAP RATE)
  // ===============================

  const expenseRatio = 0.35;
  const capRate = 0.08;

  const annualRent = rent * 12;
  const noi = annualRent * (1 - expenseRatio);
  const estimatedValue = Math.round(noi / capRate);

  const monthlyCashFlow = rent - mortgage;

  // ===============================
  // FLIP MATH (70% RULE)
  // ===============================

  const arv = estimatedValue;
  const maxAllowableOffer = Math.round(arv * 0.7 - rehab);
  const flipProfit = Math.round(arv - purchasePrice - rehab);

  // ===============================
  // STRATEGY ENGINE
  // ===============================

  let strategy = "pass";
  let verdict = "Bad deal.";

  if (flipProfit > 40000) {
    strategy = "flip";
    verdict = "Strong flip candidate.";
  } else if (monthlyCashFlow > 500) {
    strategy = "hold";
    verdict = "Excellent rental. Strong cash flow.";
  } else if (monthlyCashFlow > 0) {
    strategy = "hold";
    verdict = "Positive cash flow rental.";
  } else {
    strategy = "pass";
    verdict = "Negative cash flow.";
  }

  res.json({
    address,
    zip,
    bedrooms,
    rent,
    metro,
    source,
    estimatedValue,
    mortgage,
    monthlyCashFlow,
    arv,
    maxAllowableOffer,
    flipProfit,
    strategy,
    verdict,
  });
});

// ===============================
// START SERVER
// ===============================

app.listen(PORT, () => {
  console.log(`🚀 ALEX running at http://localhost:${PORT}`);
});