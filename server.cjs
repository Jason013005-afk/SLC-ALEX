require("dotenv").config();

const express = require("express");
const axios = require("axios");
const fs = require("fs");
const csv = require("csv-parser");
const path = require("path");

const app = express();
app.use(express.json());
app.use(express.static("public"));

const PORT = process.env.PORT || 8080;
const RENTCAST_API_KEY = process.env.RENTCAST_API_KEY;
const SAFMR_FILE = process.env.SAFMR_FILE || "fy2024_safmrs_clean.csv";

let hudData = {};

// ================================
// LOAD HUD SAFMR DATA (FIXED ZIP)
// ================================
console.log("🔄 Loading SAFMR data...");

fs.createReadStream(path.join(__dirname, SAFMR_FILE))
  .pipe(csv())
  .on("data", (row) => {
    let zip = String(row["ZIP Code"]).padStart(5, "0");

    const cleanMoney = (val) =>
      parseInt(String(val || "0").replace(/[$,]/g, "")) || 0;

    hudData[zip] = {
      0: cleanMoney(row["SAFMR 0BR"]),
      1: cleanMoney(row["SAFMR 1BR"]),
      2: cleanMoney(row["SAFMR 2BR"]),
      3: cleanMoney(row["SAFMR 3BR"]),
      4: cleanMoney(row["SAFMR 4BR"]),
    };
  })
  .on("end", () => {
    console.log(`🏠 SAFMR loaded: ${Object.keys(hudData).length} ZIPs`);
  });

// ================================
// Mortgage Calculator
// ================================
function calcMortgage(principal, rate, years) {
  const monthlyRate = rate / 100 / 12;
  const totalPayments = years * 12;

  return (
    (principal *
      monthlyRate *
      Math.pow(1 + monthlyRate, totalPayments)) /
    (Math.pow(1 + monthlyRate, totalPayments) - 1)
  );
}

// ================================
// DEAL GRADE ENDPOINT (FULL AUTO)
// ================================
app.post("/api/deal-grade", async (req, res) => {
  try {
    const { address, interestRate } = req.body;

    if (!address) {
      return res.status(400).json({ error: "Address required" });
    }

    // ============================
    // 1️⃣ Get Property from RentCast
    // ============================
    const propertyResp = await axios.get(
      `https://api.rentcast.io/v1/properties`,
      {
        headers: { "X-Api-Key": RENTCAST_API_KEY },
        params: { address }
      }
    );

    const property = propertyResp.data?.[0];
    if (!property) {
      return res.status(404).json({ error: "Property not found" });
    }

    const zip = property.zipCode;
    const bedrooms = property.bedrooms;

    // ============================
    // 2️⃣ Lookup HUD Rent
    // ============================
    const zipData = hudData[zip];
    if (!zipData || !zipData[bedrooms]) {
      return res.status(404).json({ error: `Rent not found for ZIP ${zip}` });
    }

    const rent = zipData[bedrooms];

    // ============================
    // 3️⃣ ARV Pull
    // ============================
    let arv = null;
    try {
      const arvResp = await axios.get(
        `https://api.rentcast.io/v1/avm/value`,
        {
          headers: { "X-Api-Key": RENTCAST_API_KEY },
          params: { address }
        }
      );
      arv = arvResp.data?.price || null;
    } catch (e) {
      arv = null;
    }

    // ============================
    // 4️⃣ Deal Math
    // ============================
    const vacancyRate = 0.08;
    const expenseRate = 0.35;

    const effectiveRent = rent * (1 - vacancyRate);
    const annualRent = effectiveRent * 12;
    const annualExpenses = annualRent * expenseRate;
    const annualNOI = annualRent - annualExpenses;

    let mortgage = 0;
    let annualDebt = 0;

    if (arv && interestRate) {
      const principal = arv * 0.8; // assume 20% down
      mortgage = calcMortgage(principal, interestRate, 30);
      annualDebt = mortgage * 12;
    }

    const cashFlow = annualNOI - annualDebt;
    const capRate = arv ? (annualNOI / arv) * 100 : 0;
    const dscr = annualDebt ? annualNOI / annualDebt : null;

    // ============================
    // 5️⃣ Deal Score
    // ============================
    let score = "D";

    if (dscr >= 1.25 && cashFlow > 0) score = "A";
    else if (dscr >= 1.1) score = "B";
    else if (dscr >= 1) score = "C";

    // ============================
    // RETURN EVERYTHING
    // ============================
    res.json({
      address,
      zip,
      bedrooms,
      hudRent: rent,
      arv,
      dealMetrics: {
        annualNOI,
        annualRent,
        annualExpenses,
        mortgage: Math.round(mortgage),
        annualDebt: Math.round(annualDebt),
        annualCashFlow: Math.round(cashFlow),
        capRatePct: Number(capRate.toFixed(2)),
        dscr: dscr ? Number(dscr.toFixed(2)) : null
      },
      dealScore: score,
      propertyDetails: property
    });

  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Deal-grade failed" });
  }
});

// ================================
app.listen(PORT, () => {
  console.log(`🚀 ALEX running at http://localhost:${PORT}`);
});