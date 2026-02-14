require("dotenv").config();
const express = require("express");
const fs = require("fs");
const csv = require("csv-parser");
const axios = require("axios");
const path = require("path");

const app = express();
app.use(express.json());
app.use(express.static("public"));

const PORT = process.env.PORT || 8080;

const SAFMR_FILE = process.env.SAFMR_FILE;
const RENTCAST_API_KEY = process.env.RENTCAST_API_KEY;

let safmrData = {};

// -----------------------------
// LOAD SAFMR CSV
// -----------------------------
function loadSafmr() {
  return new Promise((resolve, reject) => {
    console.log("🔄 Loading SAFMR data...");

    fs.createReadStream(path.join(__dirname, SAFMR_FILE))
      .pipe(csv())
      .on("data", (row) => {
        const zip = row["ZIP Code"]?.toString().padStart(5, "0");
        if (!zip) return;

        safmrData[zip] = {
          metro: row["HUD Metro Fair Market Rent Area Name"],
          rent1: parseMoney(row["SAFMR 1BR"]),
          rent2: parseMoney(row["SAFMR 2BR"]),
          rent3: parseMoney(row["SAFMR 3BR"]),
          rent4: parseMoney(row["SAFMR 4BR"])
        };
      })
      .on("end", () => {
        console.log(`🏠 SAFMR loaded: ${Object.keys(safmrData).length}`);
        resolve();
      })
      .on("error", reject);
  });
}

function parseMoney(value) {
  if (!value) return 0;
  return parseFloat(value.replace(/[$,]/g, ""));
}

// -----------------------------
// RENTCAST CALL
// -----------------------------
async function getRentcastValue(address) {
  if (!RENTCAST_API_KEY || !address) return null;

  try {
    const response = await axios.get(
      `https://api.rentcast.io/v1/properties`,
      {
        headers: {
          "X-Api-Key": RENTCAST_API_KEY
        },
        params: {
          address: address
        }
      }
    );

    if (response.data && response.data.length > 0) {
      return response.data[0].price || null;
    }

    return null;
  } catch (err) {
    console.log("⚠️ RentCast error:", err.response?.data || err.message);
    return null;
  }
}

// -----------------------------
// ANALYZE ROUTE
// -----------------------------
app.post("/api/analyze", async (req, res) => {
  const {
    zip,
    bedrooms,
    purchasePrice,
    downPaymentPct,
    interestRate,
    rehab,
    address
  } = req.body;

  if (!zip || !bedrooms) {
    return res.status(400).json({ error: "zip and bedrooms required" });
  }

  const zipStr = zip.toString().padStart(5, "0");
  const data = safmrData[zipStr];

  if (!data) {
    return res.json({ error: "No HUD rent data found" });
  }

  const rent =
    bedrooms == 1
      ? data.rent1
      : bedrooms == 2
      ? data.rent2
      : bedrooms == 3
      ? data.rent3
      : data.rent4;

  const vacancyRate = parseFloat(process.env.DEFAULT_VACANCY_RATE) / 100;
  const expenseRate = parseFloat(process.env.DEFAULT_EXPENSE_RATE) / 100;

  const effectiveRent = rent * (1 - vacancyRate);
  const annualRent = effectiveRent * 12;
  const annualExpenses = annualRent * expenseRate;
  const annualNOI = annualRent - annualExpenses;

  let mortgage = 0;
  let annualDebt = 0;

  if (purchasePrice && downPaymentPct && interestRate) {
    const loanAmount = purchasePrice * (1 - downPaymentPct / 100);
    const monthlyRate = interestRate / 100 / 12;
    const numPayments = 30 * 12;

    mortgage =
      (loanAmount *
        monthlyRate *
        Math.pow(1 + monthlyRate, numPayments)) /
      (Math.pow(1 + monthlyRate, numPayments) - 1);

    annualDebt = mortgage * 12;
  }

  const cashFlow = annualNOI - annualDebt;
  const capRatePct = purchasePrice
    ? (annualNOI / purchasePrice) * 100
    : 0;

  const dscr =
    annualDebt > 0 ? parseFloat((annualNOI / annualDebt).toFixed(2)) : null;

  const arv = await getRentcastValue(address);

  res.json({
    zip: zipStr,
    bedrooms,
    rent,
    metro: data.metro,
    arv,
    vacancyRatePct: vacancyRate * 100,
    expenseRatePct: expenseRate * 100,
    annualNOI: Math.round(annualNOI),
    mortgage: Math.round(mortgage),
    annualDebt: Math.round(annualDebt),
    cashFlow: Math.round(cashFlow),
    capRatePct: parseFloat(capRatePct.toFixed(2)),
    dscr
  });
});

// -----------------------------
async function start() {
  await loadSafmr();
  console.log("✅ HUD data loaded.");
  app.listen(PORT, () => {
    console.log(`🚀 ALEX running at http://localhost:${PORT}`);
  });
}

start();