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

let safmrData = {};
let fmrMetroData = {};

/* -------------------------
   LOAD SAFMR
-------------------------- */

function loadSAFMR() {
  return new Promise((resolve) => {
    const filePath = path.join(__dirname, "fy2024_safmrs.clean.csv");

    if (!fs.existsSync(filePath)) {
      console.log("⚠️ SAFMR file missing");
      return resolve();
    }

    fs.createReadStream(filePath)
      .pipe(csv())
      .on("data", (row) => {
        const zip = String(row["ZIP Code"]).padStart(5, "0");
        safmrData[zip] = row;
      })
      .on("end", () => {
        console.log("🏠 SAFMR loaded:", Object.keys(safmrData).length);
        resolve();
      })
      .on("error", () => resolve());
  });
}

/* -------------------------
   LOAD FMR METRO
-------------------------- */

function loadFMRMetro() {
  return new Promise((resolve) => {
    const filePath = path.join(__dirname, "fy2024_fmr_metro.csv");

    if (!fs.existsSync(filePath)) {
      console.log("⚠️ FMR Metro file missing");
      return resolve();
    }

    fs.createReadStream(filePath)
      .pipe(csv({ headers: false }))
      .on("data", (row) => {
        const zip = String(row[2]).padStart(5, "0");

        fmrMetroData[zip] = {
          metro: row[0],
          rents: [
            row[3],
            row[4],
            row[5],
            row[6],
            row[7],
          ],
        };
      })
      .on("end", () => {
        console.log("🌆 FMR Metro loaded:", Object.keys(fmrMetroData).length);
        resolve();
      })
      .on("error", () => resolve());
  });
}

/* -------------------------
   RENT LOOKUP
-------------------------- */

function cleanMoney(value) {
  if (!value) return null;
  return parseInt(String(value).replace(/[^0-9]/g, ""));
}

function getRent(zip, bedrooms) {
  zip = String(zip).padStart(5, "0");

  // SAFMR first
  if (safmrData[zip]) {
    const key = `SAFMR ${bedrooms}BR`;
    const rent = cleanMoney(safmrData[zip][key]);

    if (rent) {
      return {
        rent,
        source: "HUD SAFMR 2024",
        metro: safmrData[zip]["HUD Metro Fair Market Rent Area Name"],
      };
    }
  }

  // FMR fallback
  if (fmrMetroData[zip]) {
    const index = bedrooms;
    const rent = cleanMoney(fmrMetroData[zip].rents[index]);

    if (rent) {
      return {
        rent,
        source: "HUD FMR 2024",
        metro: fmrMetroData[zip].metro,
      };
    }
  }

  return null;
}

/* -------------------------
   MORTGAGE
-------------------------- */

function calculateMortgage(price, rate, downPct) {
  const downPayment = price * (downPct / 100);
  const loan = price - downPayment;
  const monthlyRate = rate / 100 / 12;
  const payments = 30 * 12;

  const mortgage =
    loan *
    (monthlyRate * Math.pow(1 + monthlyRate, payments)) /
    (Math.pow(1 + monthlyRate, payments) - 1);

  return Math.round(mortgage);
}

/* -------------------------
   VALUE ESTIMATION
-------------------------- */

function estimateValue(rent) {
  const expenseRatio = 0.35;
  const capRate = 0.08;

  const annualRent = rent * 12;
  const noi = annualRent * (1 - expenseRatio);

  return Math.round(noi / capRate);
}

/* -------------------------
   STRATEGY ENGINE
-------------------------- */

function decideStrategy(cashFlow) {
  if (cashFlow >= 500) {
    return { strategy: "hold", verdict: "Excellent rental. Strong cash flow." };
  }

  if (cashFlow > 0) {
    return { strategy: "hold", verdict: "Good rental. Positive cash flow." };
  }

  return { strategy: "pass", verdict: "Negative cash flow. Bad deal." };
}

/* -------------------------
   API
-------------------------- */

app.post("/api/analyze", (req, res) => {
  const {
    address,
    zip,
    bedrooms,
    interestRate,
    purchasePrice,
    downPaymentPct,
    rehab = 0,
  } = req.body;

  if (!zip || bedrooms == null) {
    return res.status(400).json({ error: "Missing zip or bedrooms" });
  }

  const rentData = getRent(zip, bedrooms);

  if (!rentData) {
    return res.status(404).json({
      error: "No HUD rent data found",
      zip,
    });
  }

  let mortgage = 0;
  let cashFlow = 0;
  let estimatedValue = estimateValue(rentData.rent);

  if (purchasePrice && interestRate && downPaymentPct != null) {
    mortgage = calculateMortgage(purchasePrice, interestRate, downPaymentPct);
    cashFlow = rentData.rent - mortgage;
  }

  const decision = decideStrategy(cashFlow);

  res.json({
    address,
    zip,
    bedrooms,
    rent: rentData.rent,
    metro: rentData.metro,
    source: rentData.source,
    estimatedValue,
    mortgage,
    monthlyCashFlow: cashFlow,
    strategy: decision.strategy,
    verdict: decision.verdict,
  });
});

/* -------------------------
   START SERVER
-------------------------- */

async function start() {
  await loadSAFMR();
  await loadFMRMetro();

  app.listen(PORT, () => {
    console.log(`🚀 ALEX running at http://localhost:${PORT}`);
  });
}

start();