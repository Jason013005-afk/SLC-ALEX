/************************************************************
 * FORCE LOAD .env FROM SAME DIRECTORY
 ************************************************************/
require('dotenv').config({
  path: require('path').join(__dirname, '.env')
});

const express = require('express');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

const app = express();
app.use(express.json());

/************************************************************
 * ENV VARIABLES
 ************************************************************/
const PORT = process.env.PORT || 8080;
const SAFMR_FILE = process.env.SAFMR_FILE || 'fy2024_safmrs_clean.csv';
const DEFAULT_VACANCY_RATE = Number(process.env.DEFAULT_VACANCY_RATE || 8);
const DEFAULT_EXPENSE_RATE = Number(process.env.DEFAULT_EXPENSE_RATE || 35);
const DEFAULT_LOAN_TERM_YEARS = Number(process.env.DEFAULT_LOAN_TERM_YEARS || 30);
const RENTCAST_API_KEY = process.env.RENTCAST_API_KEY;

/************************************************************
 * SAFMR LOADER
 ************************************************************/
let safmrData = {};

function cleanMoney(value) {
  if (!value) return null;
  return Number(String(value).replace(/[$,",]/g, ''));
}

function loadSafmr() {
  const filePath = path.join(__dirname, SAFMR_FILE);

  if (!fs.existsSync(filePath)) {
    console.error("❌ SAFMR file not found:", filePath);
    process.exit(1);
  }

  const raw = fs.readFileSync(filePath, 'utf8');
  const lines = raw.split('\n').slice(1); // skip header

  lines.forEach(line => {
    const cols = line.split(',');
    const zip = cols[0]?.trim();
    if (!zip) return;

    safmrData[zip] = {
      0: cleanMoney(cols[3]),
      1: cleanMoney(cols[6]),
      2: cleanMoney(cols[9]),
      3: cleanMoney(cols[12]),
      4: cleanMoney(cols[15])
    };
  });

  console.log("🏠 SAFMR loaded:", Object.keys(safmrData).length);
}

function getRentFromHUD(zip, bedrooms) {
  const row = safmrData[zip];
  if (!row) return null;
  return row[bedrooms] || null;
}

/************************************************************
 * RENTCAST HELPERS
 ************************************************************/
async function getPropertyDetails(address) {
  if (!RENTCAST_API_KEY) return null;

  try {
    const res = await axios.get(
      "https://api.rentcast.io/v1/properties",
      {
        headers: { "X-Api-Key": RENTCAST_API_KEY },
        params: { address }
      }
    );
    return res.data?.[0] || null;
  } catch (err) {
    console.error("Property fetch failed");
    return null;
  }
}

async function getARV(address) {
  if (!RENTCAST_API_KEY) return null;

  try {
    const res = await axios.get(
      "https://api.rentcast.io/v1/avm/value",
      {
        headers: { "X-Api-Key": RENTCAST_API_KEY },
        params: { address }
      }
    );

    return res.data?.price || null;
  } catch (err) {
    console.error("ARV fetch failed");
    return null;
  }
}

/************************************************************
 * ENDPOINTS
 ************************************************************/

/* 1️⃣ RENT ONLY */
app.post('/api/rent', (req, res) => {
  const { zip, bedrooms } = req.body;
  const rent = getRentFromHUD(zip, bedrooms);

  if (!rent) {
    return res.status(404).json({ error: "No HUD rent data found" });
  }

  res.json({ zip, bedrooms, rent });
});

/* 2️⃣ PROPERTY ONLY */
app.post('/api/property', async (req, res) => {
  const { address } = req.body;
  if (!address) {
    return res.status(400).json({ error: "Address required" });
  }

  const property = await getPropertyDetails(address);
  res.json({ property });
});

/* 3️⃣ ARV ONLY */
app.post('/api/arv', async (req, res) => {
  const { address } = req.body;
  if (!address) {
    return res.status(400).json({ error: "Address required" });
  }

  const arv = await getARV(address);
  res.json({ address, arv });
});

/* 4️⃣ FULL ANALYSIS */
app.post('/api/analyze', async (req, res) => {
  const {
    address,
    zip,
    bedrooms,
    purchasePrice,
    downPaymentPct = 0,
    interestRate = 0,
    rehab = 0
  } = req.body;

  const rent = getRentFromHUD(zip, bedrooms);
  if (!rent) {
    return res.status(404).json({ error: "No HUD rent data found" });
  }

  const vacancyRate = DEFAULT_VACANCY_RATE / 100;
  const expenseRate = DEFAULT_EXPENSE_RATE / 100;

  const effectiveRent = rent * (1 - vacancyRate);
  const annualRent = effectiveRent * 12;
  const annualExpenses = annualRent * expenseRate;
  const annualNOI = annualRent - annualExpenses;

  let mortgage = 0;
  let annualDebt = 0;

  if (purchasePrice && interestRate) {
    const downPayment = purchasePrice * (downPaymentPct / 100);
    const loanAmount = purchasePrice - downPayment;

    const r = interestRate / 100 / 12;
    const n = DEFAULT_LOAN_TERM_YEARS * 12;

    mortgage =
      loanAmount *
      (r * Math.pow(1 + r, n)) /
      (Math.pow(1 + r, n) - 1);

    annualDebt = mortgage * 12;
  }

  const cashFlow = annualNOI - annualDebt;
  const capRatePct = purchasePrice
    ? ((annualNOI / purchasePrice) * 100).toFixed(2)
    : 0;

  const dscr =
    annualDebt > 0
      ? (annualNOI / annualDebt).toFixed(2)
      : null;

  const propertyDetails = address
    ? await getPropertyDetails(address)
    : null;

  const arv = address
    ? await getARV(address)
    : null;

  res.json({
    zip,
    bedrooms,
    rent,
    vacancyRatePct: DEFAULT_VACANCY_RATE,
    expenseRatePct: DEFAULT_EXPENSE_RATE,
    effectiveRent,
    annualRent,
    annualExpenses,
    annualNOI,
    mortgage: Math.round(mortgage),
    annualDebt: Math.round(annualDebt),
    cashFlow: Math.round(cashFlow),
    capRatePct: Number(capRatePct),
    dscr: dscr ? Number(dscr) : null,
    arv,
    propertyDetails
  });
});

/************************************************************
 * START SERVER
 ************************************************************/
loadSafmr();

app.listen(PORT, () => {
  console.log(`🚀 ALEX running at http://localhost:${PORT}`);
});