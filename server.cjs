const express = require("express");
const fs = require("fs");
const path = require("path");
const csv = require("csv-parser");
const axios = require("axios");
require("dotenv").config();

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 8080;
const RENTCAST_API_KEY = process.env.RENTCAST_API_KEY;
const SAFMR_FILE = process.env.SAFMR_FILE;

let safmrData = {};

/* -------------------------
   LOAD HUD SAFMR CSV
-------------------------- */
function loadSafmr() {
  return new Promise((resolve) => {
    const filePath = path.join(__dirname, SAFMR_FILE);

    fs.createReadStream(filePath)
      .pipe(csv())
      .on("data", (row) => {
        const zip = String(row["ZIP Code"]).padStart(5, "0");

        const rent = parseInt(
          String(row["SAFMR 3BR"]).replace(/\$|,/g, "")
        );

        safmrData[zip] = rent;
      })
      .on("end", () => {
        console.log("🏠 SAFMR loaded:", Object.keys(safmrData).length);
        resolve();
      });
  });
}

/* -------------------------
   RENTCAST PROPERTY DETAILS
-------------------------- */
async function getPropertyDetails(address) {
  if (!RENTCAST_API_KEY || !address) return null;

  try {
    const res = await axios.get(
      "https://api.rentcast.io/v1/properties",
      {
        headers: {
          "X-Api-Key": RENTCAST_API_KEY
        },
        params: { address }
      }
    );

    return res.data?.[0] || null;
  } catch (err) {
    console.log("RentCast property error");
    return null;
  }
}

/* -------------------------
   RENTCAST ARV (AVM VALUE)
-------------------------- */
async function getARV(address) {
  if (!RENTCAST_API_KEY || !address) return null;

  try {
    const res = await axios.get(
      "https://api.rentcast.io/v1/avm/value",
      {
        headers: {
          "X-Api-Key": RENTCAST_API_KEY
        },
        params: { address }
      }
    );

    return res.data || null;
  } catch (err) {
    console.log("RentCast ARV error");
    return null;
  }
}

/* -------------------------
   ENDPOINT: PROPERTY ONLY
-------------------------- */
app.post("/api/property", async (req, res) => {
  const { address } = req.body;

  const property = await getPropertyDetails(address);

  res.json(property);
});

/* -------------------------
   ENDPOINT: ARV ONLY
-------------------------- */
app.post("/api/arv", async (req, res) => {
  const { address } = req.body;

  const arv = await getARV(address);

  res.json(arv);
});

/* -------------------------
   FULL DEAL ANALYSIS
-------------------------- */
app.post("/api/analyze", async (req, res) => {
  const {
    address,
    zip,
    bedrooms,
    purchasePrice,
    downPaymentPct = 20,
    interestRate = 6.5,
    rehab = 0
  } = req.body;

  const rent = safmrData[zip];

  if (!rent) {
    return res.status(400).json({ error: "No HUD rent data found" });
  }

  const vacancyRate = Number(process.env.DEFAULT_VACANCY_RATE || 8);
  const expenseRate = Number(process.env.DEFAULT_EXPENSE_RATE || 35);
  const loanTerm = Number(process.env.DEFAULT_LOAN_TERM_YEARS || 30);

  const effectiveRent = rent * (1 - vacancyRate / 100);
  const annualRent = effectiveRent * 12;
  const annualExpenses = annualRent * (expenseRate / 100);
  const annualNOI = annualRent - annualExpenses;

  let mortgage = 0;
  let annualDebt = 0;

  if (purchasePrice) {
    const loanAmount =
      (purchasePrice + rehab) *
      (1 - downPaymentPct / 100);

    const monthlyRate = interestRate / 100 / 12;
    const totalPayments = loanTerm * 12;

    mortgage =
      loanAmount *
      (monthlyRate *
        Math.pow(1 + monthlyRate, totalPayments)) /
      (Math.pow(1 + monthlyRate, totalPayments) - 1);

    annualDebt = mortgage * 12;
  }

  const cashFlow = annualNOI - annualDebt;
  const capRatePct = purchasePrice
    ? (annualNOI / purchasePrice) * 100
    : 0;
  const dscr = annualDebt
    ? annualNOI / annualDebt
    : null;

  const propertyDetails = await getPropertyDetails(address);
  const arv = await getARV(address);

  res.json({
    zip,
    rent,
    effectiveRent,
    annualNOI,
    mortgage: Math.round(mortgage),
    annualDebt: Math.round(annualDebt),
    cashFlow: Math.round(cashFlow),
    capRatePct: Number(capRatePct.toFixed(2)),
    dscr: dscr ? Number(dscr.toFixed(2)) : null,
    propertyDetails,
    arv
  });
});

/* -------------------------
   START SERVER
-------------------------- */
async function start() {
  await loadSafmr();

  app.listen(PORT, () => {
    console.log(`🚀 ALEX running at http://localhost:${PORT}`);
  });
}

start();