const express = require("express");
const fs = require("fs");
const csv = require("csv-parser");
const path = require("path");

const app = express();
const PORT = 8080;

app.use(express.json());
app.use(express.static("public"));

let safmrData = {};
let fmrMetroData = {};

/* =========================
   LOAD SAFMR DATA
========================= */
console.log("🔄 Loading SAFMR data...");

fs.createReadStream(path.join(__dirname, "fy2024_safmrs.clean.csv"))
  .pipe(csv())
  .on("data", (row) => {
    safmrData[row["ZIP Code"]] = row;
  })
  .on("end", () => {
    console.log("🏠 SAFMR loaded:", Object.keys(safmrData).length);
  });

/* =========================
   LOAD FMR METRO DATA
========================= */
console.log("🔄 Loading FMR Metro data...");

fs.createReadStream(path.join(__dirname, "fy2024_fmr_metro.csv"))
  .pipe(csv())
  .on("data", (row) => {
    const zip = row["ZIP Code"] || row["ZIP\nCode"];
    if (zip) fmrMetroData[zip] = row;
  })
  .on("end", () => {
    console.log("🌆 FMR Metro loaded:", Object.keys(fmrMetroData).length);
  });

/* =========================
   MAIN ANALYSIS ENGINE
========================= */
app.post("/api/analyze", (req, res) => {
  const {
    address,
    zip,
    bedrooms,
    interestRate = 6.5,
    purchasePrice = 0,
    downPaymentPct = 20,
    rehab = 0
  } = req.body;

  if (!zip || bedrooms === undefined) {
    return res.status(400).json({ error: "ZIP and bedrooms required" });
  }

  let rent = 0;
  let source = "";
  let metro = "";

  /* SAFMR FIRST */
  if (safmrData[zip]) {
    const row = safmrData[zip];
    rent = parseInt(
      row[`SAFMR ${bedrooms}BR`]?.replace(/[^0-9]/g, "") || 0
    );
    metro = row["HUD Metro Fair Market Rent Area Name"];
    source = "HUD SAFMR 2024";
  }

  /* FALLBACK TO FMR */
  if (!rent && fmrMetroData[zip]) {
    const row = fmrMetroData[zip];
    rent = parseInt(
      row[`erap_fmr_br${bedrooms}`]?.replace(/[^0-9]/g, "") || 0
    );
    metro = row["HUD Metro Fair Market Rent Area Name"];
    source = "HUD FMR 2024";
  }

  if (!rent) {
    return res.json({ error: "No HUD rent data found", zip });
  }

  /* =========================
     RENTAL MATH
  ========================= */

  const downPayment = purchasePrice * (downPaymentPct / 100);
  const loanAmount = purchasePrice - downPayment;
  const monthlyRate = interestRate / 100 / 12;
  const months = 30 * 12;

  const mortgage =
    loanAmount > 0
      ? Math.round(
          (loanAmount *
            monthlyRate *
            Math.pow(1 + monthlyRate, months)) /
            (Math.pow(1 + monthlyRate, months) - 1)
        )
      : 0;

  const monthlyCashFlow = rent - mortgage;

  let rentalVerdict = "Neutral";
  let rentalStrategy = "pass";

  if (monthlyCashFlow > 500) {
    rentalVerdict = "Excellent rental. Strong cash flow.";
    rentalStrategy = "hold";
  } else if (monthlyCashFlow > 0) {
    rentalVerdict = "Good rental. Positive cash flow.";
    rentalStrategy = "hold";
  } else {
    rentalVerdict = "Negative cash flow. Bad deal.";
    rentalStrategy = "pass";
  }

  /* =========================
     FLIP MATH (70% RULE)
  ========================= */

  const arv = rent * 120; // simple ARV estimate (rent × 120 rule)
  const maxFlipOffer = Math.round(arv * 0.7 - rehab);
  const flipProfit = Math.round(arv - purchasePrice - rehab);

  let flipVerdict = "Bad flip";
  if (flipProfit > 40000) flipVerdict = "Excellent flip";
  else if (flipProfit > 20000) flipVerdict = "Good flip";

  /* =========================
     WHOLESALE MATH
  ========================= */

  const wholesaleSpread = Math.round(maxFlipOffer - purchasePrice);

  let wholesaleVerdict =
    wholesaleSpread > 15000
      ? "Strong wholesale deal"
      : "Weak wholesale deal";

  /* =========================
     BRRRR ANALYSIS
  ========================= */

  const refinanceValue = Math.round(arv * 0.75);
  const cashOut = refinanceValue - purchasePrice - rehab;

  const brrrrVerdict =
    cashOut > 0
      ? "BRRRR viable – cash out possible"
      : "Not ideal for BRRRR";

  res.json({
    address,
    zip,
    bedrooms,
    rent,
    metro,
    source,

    mortgage,
    monthlyCashFlow,
    rentalStrategy,
    rentalVerdict,

    arv,
    maxFlipOffer,
    flipProfit,
    flipVerdict,

    wholesaleSpread,
    wholesaleVerdict,

    refinanceValue,
    cashOut,
    brrrrVerdict
  });
});

app.listen(PORT, () => {
  console.log(`🚀 ALEX running at http://localhost:${PORT}`);
});