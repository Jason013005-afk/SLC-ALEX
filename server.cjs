require("dotenv").config();
const express = require("express");
const axios = require("axios");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const csv = require("csv-parser");
const swaggerUi = require("swagger-ui-express");
const yaml = require("js-yaml");

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static("public")); // serve your 4 website pages

// ===============================
// 🔧 CONFIG
// ===============================

const PORT = 8080;
const RENTCAST_API_KEY = process.env.RENTCAST_API_KEY;

// ===============================
// 🏠 LOAD SAFMR DATA
// ===============================

let safmrData = {};

console.log("🔄 Loading SAFMR data...");

fs.createReadStream("fy2024_safmrs_fixed.csv")
  .pipe(csv())
  .on("data", (row) => {
    safmrData[row.zip] = {
      1: Number(row.one_bed),
      2: Number(row.two_bed),
      3: Number(row.three_bed),
      4: Number(row.four_bed),
    };
  })
  .on("end", () => {
    console.log(`🏠 SAFMR loaded: ${Object.keys(safmrData).length} ZIPs`);
  });

// ===============================
// 💰 Mortgage Calculator
// ===============================

function calcMortgage(loanAmount, rate, years = 30) {
  const monthlyRate = rate / 100 / 12;
  const payments = years * 12;

  return (
    (loanAmount *
      monthlyRate *
      Math.pow(1 + monthlyRate, payments)) /
    (Math.pow(1 + monthlyRate, payments) - 1)
  );
}

// ===============================
// 🏘️ RENT ENDPOINT
// ===============================

app.post("/api/rent", (req, res) => {
  const { zip, bedrooms } = req.body;

  if (!safmrData[zip]) {
    return res.status(400).json({ error: "ZIP not found in SAFMR data" });
  }

  const rent = safmrData[zip][bedrooms];

  res.json({ zip, bedrooms, rent });
});

// ===============================
// 🏠 PROPERTY DETAILS
// ===============================

app.post("/api/property", async (req, res) => {
  try {
    const { address } = req.body;

    const response = await axios.get(
      `https://api.rentcast.io/v1/properties`,
      {
        params: { address },
        headers: { "X-Api-Key": RENTCAST_API_KEY },
      }
    );

    res.json({ property: response.data[0] || null });
  } catch (err) {
    console.error("Property fetch error:", err.message);
    res.status(500).json({ error: "Property lookup failed" });
  }
});

// ===============================
// 📈 ARV
// ===============================

app.post("/api/arv", async (req, res) => {
  try {
    const { address } = req.body;

    const response = await axios.get(
      `https://api.rentcast.io/v1/avm/value`,
      {
        params: { address },
        headers: { "X-Api-Key": RENTCAST_API_KEY },
      }
    );

    res.json({ address, arv: response.data.value || null });
  } catch (err) {
    console.error("ARV error:", err.message);
    res.status(500).json({ error: "ARV lookup failed" });
  }
});

// ===============================
// 🧮 ANALYZE
// ===============================

app.post("/api/analyze", async (req, res) => {
  try {
    const {
      address,
      zip,
      bedrooms,
      purchasePrice,
      downPaymentPct,
      interestRate,
    } = req.body;

    const rent = safmrData[zip]?.[bedrooms];

    if (!rent) {
      return res.status(400).json({ error: "Rent not found for ZIP" });
    }

    const vacancyRate = 0.08;
    const expenseRate = 0.35;

    const effectiveRent = rent * (1 - vacancyRate);
    const annualRent = effectiveRent * 12;
    const annualExpenses = annualRent * expenseRate;
    const annualNOI = annualRent - annualExpenses;

    const loanAmount =
      purchasePrice * (1 - downPaymentPct / 100);

    const monthlyMortgage = calcMortgage(
      loanAmount,
      interestRate
    );

    const annualDebt = monthlyMortgage * 12;
    const cashFlow = annualNOI - annualDebt;

    const capRate = (annualNOI / purchasePrice) * 100;
    const dscr = annualNOI / annualDebt;

    res.json({
      rent,
      annualRent,
      annualNOI,
      annualDebt,
      cashFlow,
      capRatePct: Number(capRate.toFixed(2)),
      dscr: Number(dscr.toFixed(2)),
    });
  } catch (err) {
    console.error("Analyze error:", err.message);
    res.status(500).json({ error: "Analyze failed" });
  }
});

// ===============================
// 🏆 DEAL GRADE
// ===============================

app.post("/api/deal-grade", async (req, res) => {
  try {
    const analysis = await axios.post(
      `http://localhost:${PORT}/api/analyze`,
      req.body
    );

    const { capRatePct, dscr, cashFlow } = analysis.data;

    let grade = "C";

    if (capRatePct > 7 && dscr > 1.2 && cashFlow > 0) grade = "A";
    else if (capRatePct > 6 && dscr > 1.1) grade = "B";

    res.json({
      ...analysis.data,
      dealScore: grade,
    });
  } catch (err) {
    console.error("Deal-grade error:", err.message);
    res.status(500).json({ error: "Deal-grade failed" });
  }
});

// ===============================
// 🔁 BRRRR
// ===============================

app.post("/api/brrrr", async (req, res) => {
  try {
    const {
      arv,
      refinanceLtv,
      interestRate,
    } = req.body;

    const newLoan = arv * (refinanceLtv / 100);
    const newMortgage = calcMortgage(newLoan, interestRate);

    res.json({
      arv,
      newLoan,
      newMonthlyMortgage: Number(newMortgage.toFixed(0)),
    });
  } catch (err) {
    res.status(500).json({ error: "BRRRR failed" });
  }
});

// ===============================
// 📄 SWAGGER
// ===============================

const openapiSpec = yaml.load(
  fs.readFileSync(path.join(__dirname, "openapi.yaml"), "utf8")
);

app.use("/docs", swaggerUi.serve, swaggerUi.setup(openapiSpec));

// ===============================
// 🚀 START SERVER
// ===============================

app.listen(PORT, () => {
  console.log(`🚀 ALEX running at http://localhost:${PORT}`);
});