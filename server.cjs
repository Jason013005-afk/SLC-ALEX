require("dotenv").config();

const express = require("express");
const fs = require("fs");
const path = require("path");
const csv = require("csv-parser");
const axios = require("axios");

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 8080;

const SAFMR_FILE = process.env.SAFMR_FILE || "fy2024_safmrs_clean.csv";
const DEFAULT_VACANCY = parseFloat(process.env.DEFAULT_VACANCY_RATE) || 8;
const DEFAULT_EXPENSE = parseFloat(process.env.DEFAULT_EXPENSE_RATE) || 35;
const LOAN_TERM = parseInt(process.env.DEFAULT_LOAN_TERM_YEARS) || 30;

const RENTCAST_API_KEY = process.env.RENTCAST_API_KEY;

const safmrData = new Map();

function normalizeZip(zip) {
  if (!zip) return null;
  return zip.toString().padStart(5, "0");
}

function cleanMoney(value) {
  if (!value) return 0;
  return parseFloat(value.replace(/[$,"]/g, ""));
}

function loadSafmr() {
  return new Promise((resolve, reject) => {
    const filePath = path.join(__dirname, SAFMR_FILE);

    if (!fs.existsSync(filePath)) {
      return reject(new Error("SAFMR file not found."));
    }

    fs.createReadStream(filePath)
      .pipe(csv())
      .on("data", (row) => {
        const zip = normalizeZip(row["ZIP Code"]);
        safmrData.set(zip, row);
      })
      .on("end", () => {
        console.log("🏠 SAFMR loaded:", safmrData.size);
        resolve();
      })
      .on("error", reject);
  });
}

function calculateMortgage(principal, rate, years) {
  const monthlyRate = rate / 100 / 12;
  const payments = years * 12;
  return (
    (principal *
      monthlyRate *
      Math.pow(1 + monthlyRate, payments)) /
    (Math.pow(1 + monthlyRate, payments) - 1)
  );
}

async function fetchRentCast(address) {
  if (!RENTCAST_API_KEY || !address) return null;

  try {
    const response = await axios.get(
      "https://api.rentcast.io/v1/properties",
      {
        headers: {
          "X-Api-Key": RENTCAST_API_KEY
        },
        params: {
          address: address
        }
      }
    );

    if (!response.data || response.data.length === 0) return null;

    return response.data[0];
  } catch (err) {
    console.log("RentCast API error — using HUD fallback");
    return null;
  }
}

app.post("/api/analyze", async (req, res) => {
  try {
    const {
      address,
      zip,
      bedrooms,
      purchasePrice,
      downPaymentPct,
      interestRate,
      rehab = 0
    } = req.body;

    const inputZip = normalizeZip(zip);
    if (!inputZip) {
      return res.status(400).json({ error: "ZIP required" });
    }

    const hudRow = safmrData.get(inputZip);
    if (!hudRow) {
      return res.status(404).json({ error: "No HUD rent data found" });
    }

    const hudRent = cleanMoney(hudRow[`SAFMR ${bedrooms}BR`]);

    let rent = hudRent;
    let propertyDetails = null;

    if (address && RENTCAST_API_KEY) {
      const rentcast = await fetchRentCast(address);
      if (rentcast) {
        propertyDetails = rentcast;
        if (rentcast.rentEstimate) {
          rent = rentcast.rentEstimate;
        }
      }
    }

    const vacancyRate = DEFAULT_VACANCY / 100;
    const expenseRate = DEFAULT_EXPENSE / 100;

    const effectiveRent = rent * (1 - vacancyRate);
    const annualRent = effectiveRent * 12;
    const annualExpenses = annualRent * expenseRate;
    const annualNOI = annualRent - annualExpenses;

    let mortgage = 0;
    let annualDebt = 0;
    let cashFlow = annualNOI;
    let capRate = 0;
    let dscr = null;

    if (purchasePrice && interestRate && downPaymentPct) {
      const downPayment = purchasePrice * (downPaymentPct / 100);
      const loanAmount = purchasePrice - downPayment;
      mortgage = calculateMortgage(loanAmount, interestRate, LOAN_TERM);
      annualDebt = mortgage * 12;
      cashFlow = annualNOI - annualDebt;
      capRate = (annualNOI / purchasePrice) * 100;
      dscr = annualNOI / annualDebt;
    }

    res.json({
      zip: inputZip,
      rent,
      vacancyRatePct: DEFAULT_VACANCY,
      expenseRatePct: DEFAULT_EXPENSE,
      effectiveRent: Math.round(effectiveRent),
      annualRent: Math.round(annualRent),
      annualExpenses: Math.round(annualExpenses),
      annualNOI: Math.round(annualNOI),
      mortgage: Math.round(mortgage),
      annualDebt: Math.round(annualDebt),
      cashFlow: Math.round(cashFlow),
      capRatePct: parseFloat(capRate.toFixed(2)),
      dscr: dscr ? parseFloat(dscr.toFixed(2)) : null,
      propertyDetails
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Server error" });
  }
});

async function start() {
  await loadSafmr();
  app.listen(PORT, () => {
    console.log(`🚀 ALEX running at http://localhost:${PORT}`);
  });
}

start();