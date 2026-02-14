const express = require("express");
const fs = require("fs");
const path = require("path");
const csv = require("csv-parser");
const axios = require("axios");
require("dotenv").config();

const app = express();
app.use(express.json());

/* ================================
   CONFIG
================================ */

const PORT = process.env.PORT || 8080;
const SAFMR_FILE =
  process.env.SAFMR_FILE || "fy2024_safmrs_clean.csv";

const DEFAULT_VACANCY =
  parseFloat(process.env.DEFAULT_VACANCY_RATE) || 8;

const DEFAULT_EXPENSE =
  parseFloat(process.env.DEFAULT_EXPENSE_RATE) || 35;

const LOAN_TERM_YEARS =
  parseInt(process.env.DEFAULT_LOAN_TERM_YEARS) || 30;

const RENTCAST_API_KEY = process.env.RENTCAST_API_KEY || null;

/* ================================
   UTILITIES
================================ */

function normalizeZip(zip) {
  if (!zip) return null;
  return zip.toString().padStart(5, "0");
}

function cleanMoney(value) {
  if (!value) return 0;
  return parseInt(
    value.toString().replace(/\$/g, "").replace(/,/g, "")
  );
}

function calculateMortgage(
  loanAmount,
  annualRate,
  years
) {
  const monthlyRate = annualRate / 100 / 12;
  const n = years * 12;

  if (!loanAmount || !annualRate) return 0;

  return (
    (loanAmount *
      monthlyRate *
      Math.pow(1 + monthlyRate, n)) /
    (Math.pow(1 + monthlyRate, n) - 1)
  );
}

/* ================================
   HUD SAFMR LOAD
================================ */

const safmrData = new Map();

function loadSafmr() {
  return new Promise((resolve, reject) => {
    const filePath = path.join(__dirname, SAFMR_FILE);

    if (!fs.existsSync(filePath)) {
      return reject(
        new Error(`SAFMR file not found: ${filePath}`)
      );
    }

    console.log("🔄 Loading SAFMR data...");

    fs.createReadStream(filePath)
      .pipe(csv())
      .on("data", (row) => {
        const zip = normalizeZip(row["ZIP Code"]);
        if (!zip) return;
        safmrData.set(zip, row);
      })
      .on("end", () => {
        console.log(
          "🏠 SAFMR loaded:",
          safmrData.size
        );
        resolve();
      })
      .on("error", reject);
  });
}

function getRentFromHUD(zip, bedrooms) {
  const normalized = normalizeZip(zip);
  const row = safmrData.get(normalized);
  if (!row) return null;

  const column = `SAFMR ${bedrooms}BR`;
  return cleanMoney(row[column]);
}

/* ================================
   RENTCAST HELPERS
================================ */

async function fetchPropertyDetails(address) {
  if (!RENTCAST_API_KEY) return null;

  try {
    const response = await axios.get(
      "https://api.rentcast.io/v1/properties",
      {
        headers: {
          "X-Api-Key": RENTCAST_API_KEY,
        },
        params: {
          address,
        },
      }
    );

    return response.data?.[0] || null;
  } catch (err) {
    console.error("Property fetch error");
    return null;
  }
}

async function fetchARV(address) {
  if (!RENTCAST_API_KEY) return null;

  try {
    const response = await axios.get(
      "https://api.rentcast.io/v1/avm",
      {
        headers: {
          "X-Api-Key": RENTCAST_API_KEY,
        },
        params: {
          address,
        },
      }
    );

    return response.data?.price || null;
  } catch (err) {
    console.error("ARV fetch error");
    return null;
  }
}

/* ================================
   ENDPOINTS
================================ */

/* RENT ONLY */
app.post("/api/rent", (req, res) => {
  const { zip, bedrooms } = req.body;

  const rent = getRentFromHUD(zip, bedrooms);

  if (!rent) {
    return res
      .status(404)
      .json({ error: "No HUD rent data found" });
  }

  res.json({ zip, bedrooms, rent });
});

/* PROPERTY ONLY */
app.post("/api/property", async (req, res) => {
  const { address } = req.body;

  if (!address) {
    return res
      .status(400)
      .json({ error: "Address required" });
  }

  const property = await fetchPropertyDetails(
    address
  );

  res.json({ property });
});

/* ARV ONLY */
app.post("/api/arv", async (req, res) => {
  const { address } = req.body;

  if (!address) {
    return res
      .status(400)
      .json({ error: "Address required" });
  }

  const arv = await fetchARV(address);

  res.json({ address, arv });
});

/* FULL ANALYSIS */
app.post("/api/analyze", async (req, res) => {
  const {
    zip,
    bedrooms,
    purchasePrice,
    downPaymentPct,
    interestRate,
    rehab,
    address,
  } = req.body;

  const rent = getRentFromHUD(zip, bedrooms);

  if (!rent) {
    return res
      .status(404)
      .json({ error: "No HUD rent data found" });
  }

  const vacancyRate = DEFAULT_VACANCY;
  const expenseRate = DEFAULT_EXPENSE;

  const effectiveRent =
    rent * (1 - vacancyRate / 100);

  const annualRent = effectiveRent * 12;
  const annualExpenses =
    annualRent * (expenseRate / 100);
  const annualNOI =
    annualRent - annualExpenses;

  let mortgage = 0;
  let annualDebt = 0;
  let dscr = null;
  let capRatePct = 0;

  if (purchasePrice && interestRate) {
    const downPayment =
      purchasePrice *
      (downPaymentPct / 100 || 0);

    const loanAmount =
      purchasePrice - downPayment;

    mortgage = calculateMortgage(
      loanAmount,
      interestRate,
      LOAN_TERM_YEARS
    );

    annualDebt = mortgage * 12;

    dscr =
      annualDebt > 0
        ? annualNOI / annualDebt
        : null;

    capRatePct =
      (annualNOI / purchasePrice) * 100;
  }

  let propertyDetails = null;
  let arv = null;

  if (address) {
    propertyDetails =
      await fetchPropertyDetails(address);
    arv = await fetchARV(address);
  }

  res.json({
    zip,
    bedrooms,
    rent,
    vacancyRatePct: vacancyRate,
    expenseRatePct: expenseRate,
    effectiveRent: Math.round(effectiveRent),
    annualRent: Math.round(annualRent),
    annualExpenses: Math.round(annualExpenses),
    annualNOI: Math.round(annualNOI),
    mortgage: Math.round(mortgage),
    annualDebt: Math.round(annualDebt),
    cashFlow:
      Math.round(annualNOI - annualDebt),
    capRatePct: parseFloat(
      capRatePct.toFixed(2)
    ),
    dscr:
      dscr !== null
        ? parseFloat(dscr.toFixed(2))
        : null,
    arv,
    propertyDetails,
  });
});

/* ================================
   START SERVER
================================ */

async function start() {
  try {
    await loadSafmr();

    app.listen(PORT, () => {
      console.log(
        `🚀 ALEX running at http://localhost:${PORT}`
      );
    });
  } catch (err) {
    console.error(
      "Server failed to start:",
      err.message
    );
    process.exit(1);
  }
}

start();