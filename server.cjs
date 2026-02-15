require("dotenv").config();
const express = require("express");
const axios = require("axios");
const fs = require("fs");
const csv = require("csv-parser");
const cors = require("cors");

const app = express();
app.use(express.json());
app.use(cors());
app.use(express.static("public"));

const PORT = 8080;

/* ===========================
   LOAD HUD SAFMR DATA
=========================== */

let hudRents = {};

console.log("🔄 Loading SAFMR data...");

fs.createReadStream("fy2024_safmrs_fixed.csv")
  .pipe(csv())
  .on("data", (row) => {
    const zip = row.zip?.trim();
    const bedrooms = parseInt(row.bedrooms);
    const rent = parseFloat(row.rent);

    if (!zip || isNaN(bedrooms) || isNaN(rent)) return;

    if (!hudRents[zip]) hudRents[zip] = {};
    hudRents[zip][bedrooms] = rent;
  })
  .on("end", () => {
    console.log(`🏠 SAFMR loaded: ${Object.keys(hudRents).length} ZIPs`);
  });

/* ===========================
   UTILITIES
=========================== */

function calcMortgage(principal, rate, years = 30) {
  const r = rate / 100 / 12;
  const n = years * 12;
  return (principal * r) / (1 - Math.pow(1 + r, -n));
}

function gradeDeal(cashFlow, dscr, capRate) {
  if (cashFlow > 300 && dscr > 1.25 && capRate > 7) return "A";
  if (cashFlow > 100 && dscr > 1.1 && capRate > 5.5) return "B";
  if (cashFlow > 0 && dscr > 1.0) return "C";
  return "D";
}

/* ===========================
   DEAL GRADE ENGINE
=========================== */

app.post("/api/deal-grade", async (req, res) => {
  try {
    const { address, interestRate } = req.body;

    if (!address || !interestRate) {
      return res.status(400).json({
        error: "Address and interestRate required",
      });
    }

    /* ======================
       1️⃣ PROPERTY DETAILS
    ======================= */

    const propertyRes = await axios.get(
      "https://api.rentcast.io/v1/properties",
      {
        headers: {
          "X-Api-Key": process.env.RENTCAST_API_KEY,
        },
        params: { address },
      }
    );

    if (!propertyRes.data || propertyRes.data.length === 0) {
      return res.status(404).json({
        error: "Property not found",
      });
    }

    const property = propertyRes.data[0];

    const zip = property.zipCode;
    const bedrooms = property.bedrooms;
    const purchasePrice =
      property.lastSalePrice ||
      property.taxAssessments?.["2024"]?.value ||
      null;

    if (!zip || !bedrooms || !purchasePrice) {
      return res.status(400).json({
        error: "Incomplete property data from RentCast",
      });
    }

    /* ======================
       2️⃣ HUD RENT LOOKUP
    ======================= */

    const rent = hudRents[zip]?.[bedrooms];

    if (!rent) {
      return res.status(400).json({
        error: `Rent not found for ZIP ${zip}`,
      });
    }

    /* ======================
       3️⃣ ARV ESTIMATE
    ======================= */

    let arv = null;

    try {
      const arvRes = await axios.get(
        "https://api.rentcast.io/v1/avm",
        {
          headers: {
            "X-Api-Key": process.env.RENTCAST_API_KEY,
          },
          params: { address },
        }
      );

      arv = arvRes.data?.value || null;
    } catch (e) {
      console.log("ARV fetch failed");
    }

    /* ======================
       4️⃣ FINANCIALS
    ======================= */

    const downPaymentPct = 20;
    const downPayment = purchasePrice * (downPaymentPct / 100);
    const loanAmount = purchasePrice - downPayment;

    const monthlyMortgage = calcMortgage(
      loanAmount,
      interestRate
    );

    const vacancyRate = 0.08;
    const expenseRate = 0.35;

    const effectiveRent = rent * (1 - vacancyRate);
    const annualRent = effectiveRent * 12;
    const annualExpenses = annualRent * expenseRate;
    const annualNOI = annualRent - annualExpenses;

    const annualDebt = monthlyMortgage * 12;
    const cashFlow = annualNOI - annualDebt;
    const capRate = (annualNOI / purchasePrice) * 100;
    const dscr = annualNOI / annualDebt;

    const grade = gradeDeal(cashFlow, dscr, capRate);

    /* ======================
       5️⃣ RESPONSE
    ======================= */

    return res.json({
      address: property.formattedAddress,
      zip,
      bedrooms,
      purchasePrice,
      arv,
      rent,
      interestRate,
      monthlyMortgage: Math.round(monthlyMortgage),
      annualNOI: Math.round(annualNOI),
      cashFlow: Math.round(cashFlow),
      capRatePct: capRate.toFixed(2),
      dscr: dscr.toFixed(2),
      grade,
      recommendation:
        grade === "A" || grade === "B" ? "BUY" : "PASS",
    });
  } catch (err) {
    console.error("Deal-grade failed:", err.message);
    res.status(500).json({ error: "Deal-grade failed" });
  }
});

/* ===========================
   START SERVER
=========================== */

app.listen(PORT, () => {
  console.log(`🚀 ALEX running at http://localhost:${PORT}`);
});