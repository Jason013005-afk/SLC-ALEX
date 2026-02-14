require("dotenv").config();

const express = require("express");
const fs = require("fs");
const path = require("path");
const csv = require("csv-parser");
const axios = require("axios");

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 8080;

let safmrData = {};

/* =========================
   LOAD SAFMR CSV
========================= */

function loadSafmr() {
  return new Promise((resolve, reject) => {
    const filePath = path.join(__dirname, process.env.SAFMR_FILE);

    fs.createReadStream(filePath)
      .pipe(csv())
      .on("data", (row) => {
        const zip = row["ZIP Code"];
        safmrData[zip] = row;
      })
      .on("end", () => {
        console.log("🏠 SAFMR loaded:", Object.keys(safmrData).length);
        resolve();
      })
      .on("error", reject);
  });
}

/* =========================
   RENT LOOKUP
========================= */

function getRent(zip, bedrooms) {
  const row = safmrData[zip];
  if (!row) return null;

  const col = `SAFMR ${bedrooms}BR`;
  if (!row[col]) return null;

  return parseFloat(
    row[col].replace(/\$/g, "").replace(/,/g, "")
  );
}

/* =========================
   MORTGAGE CALC
========================= */

function calculateMortgage(purchasePrice, downPct, rate, termYears) {
  const loan = purchasePrice * (1 - downPct / 100);
  const monthlyRate = rate / 100 / 12;
  const n = termYears * 12;

  return (
    (loan * monthlyRate) /
    (1 - Math.pow(1 + monthlyRate, -n))
  );
}

/* =========================
   RENTCAST: PROPERTY DETAILS
========================= */

async function getPropertyDetails(address) {
  try {
    const res = await axios.get(
      "https://api.rentcast.io/v1/properties",
      {
        params: { address },
        headers: {
          "X-Api-Key": process.env.RENTCAST_API_KEY,
        },
      }
    );

    return res.data[0] || null;
  } catch (err) {
    console.log("RentCast property error");
    return null;
  }
}

/* =========================
   RENTCAST: AVM (ARV)
========================= */

async function getARV(address) {
  try {
    const res = await axios.get(
      "https://api.rentcast.io/v1/avm",
      {
        params: { address },
        headers: {
          "X-Api-Key": process.env.RENTCAST_API_KEY,
        },
      }
    );

    return res.data || null;
  } catch (err) {
    console.log("RentCast AVM error");
    return null;
  }
}

/* =========================
   MAIN ANALYZE ENDPOINT
========================= */

app.post("/api/analyze", async (req, res) => {
  const {
    address,
    zip,
    bedrooms,
    purchasePrice,
    downPaymentPct,
    interestRate,
  } = req.body;

  const rent = getRent(zip, bedrooms);
  if (!rent)
    return res.status(404).json({
      error: "No HUD rent data found",
    });

  const vacancyPct =
    parseFloat(process.env.DEFAULT_VACANCY_RATE) || 8;

  const expensePct =
    parseFloat(process.env.DEFAULT_EXPENSE_RATE) || 35;

  const effectiveRent = rent * (1 - vacancyPct / 100);
  const annualRent = effectiveRent * 12;
  const annualExpenses = annualRent * (expensePct / 100);
  const annualNOI = annualRent - annualExpenses;

  let mortgage = 0;
  let annualDebt = 0;
  let dscr = null;

  if (purchasePrice && downPaymentPct && interestRate) {
    mortgage = calculateMortgage(
      purchasePrice,
      downPaymentPct,
      interestRate,
      parseInt(process.env.DEFAULT_LOAN_TERM_YEARS) || 30
    );
    annualDebt = mortgage * 12;
    dscr = annualNOI / annualDebt;
  }

  let propertyDetails = null;
  let arv = null;

  if (address && process.env.RENTCAST_API_KEY) {
    propertyDetails = await getPropertyDetails(address);
    arv = await getARV(address);
  }

  res.json({
    zip,
    rent,
    vacancyRatePct: vacancyPct,
    expenseRatePct: expensePct,
    effectiveRent,
    annualRent,
    annualExpenses,
    annualNOI,
    mortgage: Math.round(mortgage),
    annualDebt: Math.round(annualDebt),
    cashFlow: Math.round(annualNOI - annualDebt),
    capRatePct: purchasePrice
      ? ((annualNOI / purchasePrice) * 100).toFixed(2)
      : 0,
    dscr: dscr ? dscr.toFixed(2) : null,
    propertyDetails,
    arv,
  });
});

/* =========================
   PROPERTY ENDPOINT
========================= */

app.post("/api/property", async (req, res) => {
  const { address } = req.body;

  if (!address)
    return res
      .status(400)
      .json({ error: "Address required" });

  const property = await getPropertyDetails(address);

  res.json(property);
});

/* =========================
   ARV ENDPOINT
========================= */

app.post("/api/arv", async (req, res) => {
  const { address } = req.body;

  if (!address)
    return res
      .status(400)
      .json({ error: "Address required" });

  const arv = await getARV(address);

  res.json(arv);
});

/* =========================
   START SERVER
========================= */

async function start() {
  await loadSafmr();

  app.listen(PORT, () => {
    console.log(
      `🚀 ALEX running at http://localhost:${PORT}`
    );
  });
}

start();