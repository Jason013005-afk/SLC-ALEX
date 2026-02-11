const express = require("express");
const fs = require("fs");
const csv = require("csv-parser");
const path = require("path");

const decisionEngine = require("./decisionEngine");

const app = express();
const PORT = 8080;

app.use(express.json());
app.use(express.static("public"));

let safmrData = {};

console.log("🔄 Loading SAFMR data...");

fs.createReadStream(path.join(__dirname, "fy2024_safmrs.clean.csv"))
  .pipe(csv())
  .on("data", (row) => {
    const zip = row["ZIP Code"]?.trim();
    if (zip) {
      safmrData[zip] = row;
    }
  })
  .on("end", () => {
    console.log("🏠 SAFMR loaded:", Object.keys(safmrData).length);
  });

function cleanMoney(value) {
  if (!value) return 0;
  return Number(value.replace(/[$,]/g, ""));
}

app.post("/api/analyze", (req, res) => {
  const {
    address,
    zip,
    bedrooms,
    interestRate,
    purchasePrice,
    downPaymentPct,
    rehab = 0
  } = req.body;

  const row = safmrData[zip];

  if (!row) {
    return res.status(404).json({
      error: "No HUD SAFMR data found",
      zip
    });
  }

  const rent = cleanMoney(row[`SAFMR ${bedrooms}BR`]);
  const metro = row["HUD Metro Fair Market Rent Area Name"];

  const deal = decisionEngine({
    rent,
    purchasePrice,
    downPaymentPct,
    interestRate,
    rehab
  });

  res.json({
    address,
    zip,
    bedrooms,
    rent,
    metro,
    source: "HUD SAFMR 2024",
    ...deal
  });
});

app.listen(PORT, () => {
  console.log(`🚀 ALEX running at http://localhost:${PORT}`);
});