const express = require("express");
const axios = require("axios");
const fs = require("fs");
const csv = require("csv-parser");
const cors = require("cors");
require("dotenv").config();

const app = express();
app.use(express.json());
app.use(cors());
app.use(express.static("public"));

const PORT = process.env.PORT || 8080;
const RENTCAST_KEY = process.env.RENTCAST_API_KEY;

let hudRents = {};

/* ================================
   LOAD HUD SAFMR FILE (FIXED)
================================ */
console.log("🔄 Loading SAFMR data...");

fs.createReadStream("fy2024_safmrs_clean.csv")
  .pipe(csv())
  .on("data", (row) => {
    try {
      const zip = row["ZIP Code"]?.trim();
      if (!zip) return;

      // Clean currency values properly
      const clean = (val) =>
        parseInt(
          String(val || "0")
            .replace(/\$/g, "")
            .replace(/,/g, "")
            .replace(/"/g, "")
            .trim()
        ) || 0;

      hudRents[zip] = {
        0: clean(row["SAFMR 0BR"]),
        1: clean(row["SAFMR 1BR"]),
        2: clean(row["SAFMR 2BR"]),
        3: clean(row["SAFMR 3BR"]),
        4: clean(row["SAFMR 4BR"]),
      };
    } catch (err) {
      console.log("CSV parse error:", err.message);
    }
  })
  .on("end", () => {
    console.log(`🏠 SAFMR loaded: ${Object.keys(hudRents).length} ZIPs`);
  });

/* ================================
   Mortgage Calculator
================================ */
function calcMortgage(principal, rate, years = 30) {
  const monthlyRate = rate / 100 / 12;
  const n = years * 12;
  return (
    principal *
    ((monthlyRate * Math.pow(1 + monthlyRate, n)) /
      (Math.pow(1 + monthlyRate, n) - 1))
  );
}

/* ================================
   RentCast Property Fetch
================================ */
async function getProperty(address) {
  const url = `https://api.rentcast.io/v1/properties?address=${encodeURIComponent(
    address
  )}`;

  const res = await axios.get(url, {
    headers: { "X-Api-Key": RENTCAST_KEY },
  });

  return res.data?.[0] || null;
}

/* ================================
   ARV (Estimate Value)
================================ */
async function getARV(address) {
  const property = await getProperty(address);
  return property?.estimatedValue || property?.value || null;
}

/* ================================
   DEAL GRADE – FULL AUTO
================================ */
app.post("/api/deal-grade", async (req, res) => {
  try {
    const { address, interestRate } = req.body;
    if (!address || !interestRate)
      return res.status(400).json({ error: "Address + interestRate required" });

    // 1️⃣ Get Property Data
    const property = await getProperty(address);
    if (!property)
      return res.status(404).json({ error: "Property not found" });

    const zip = property.zipCode;
    const bedrooms = property.bedrooms;

    // 2️⃣ Get HUD Rent
    const rent = hudRents?.[zip]?.[bedrooms];
    if (!rent)
      return res
        .status(404)
        .json({ error: `Rent not found for ZIP ${zip}` });

    // 3️⃣ ARV
    const arv = property.estimatedValue || property.value || null;

    // 4️⃣ Purchase Assumption (70% of ARV)
    const purchasePrice = arv ? Math.round(arv * 0.7) : 0;
    const downPayment = purchasePrice * 0.2;
    const loanAmount = purchasePrice - downPayment;

    const monthlyMortgage = calcMortgage(
      loanAmount,
      interestRate,
      30
    );

    // 5️⃣ Deal Math
    const vacancyRate = 0.08;
    const expenseRate = 0.35;

    const effectiveRent = rent * (1 - vacancyRate);
    const annualRent = effectiveRent * 12;
    const annualExpenses = annualRent * expenseRate;
    const annualNOI = annualRent - annualExpenses;
    const annualDebt = monthlyMortgage * 12;
    const cashFlow = annualNOI - annualDebt;
    const capRate =
      purchasePrice > 0 ? (annualNOI / purchasePrice) * 100 : 0;
    const dscr =
      annualDebt > 0 ? annualNOI / annualDebt : null;

    // 6️⃣ Score
    let score = "C";
    if (dscr > 1.25 && capRate > 8) score = "A";
    else if (dscr > 1.1 && capRate > 6) score = "B";
    else if (dscr < 0.9) score = "F";

    res.json({
      address,
      zip,
      bedrooms,
      hudRent: rent,
      arv,
      assumedPurchasePrice: purchasePrice,
      metrics: {
        annualNOI,
        annualRent,
        annualExpenses,
        monthlyMortgage: Math.round(monthlyMortgage),
        annualDebt: Math.round(annualDebt),
        annualCashFlow: Math.round(cashFlow),
        capRatePct: Number(capRate.toFixed(2)),
        dscr: dscr ? Number(dscr.toFixed(2)) : null,
      },
      dealScore: score,
      propertyDetails: property,
    });
  } catch (err) {
    console.error("Deal-grade error:", err.message);
    res.status(500).json({ error: "Deal analysis failed" });
  }
});

/* ================================
   SERVER START
================================ */
app.listen(PORT, () => {
  console.log(`🚀 ALEX running at http://localhost:${PORT}`);
});