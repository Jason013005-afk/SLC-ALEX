import express from "express";
import fs from "fs";
import path from "path";
import csv from "csv-parser";
import cors from "cors";
import dotenv from "dotenv";
import { fileURLToPath } from "url";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 8080;

/* -------------------- MIDDLEWARE -------------------- */
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

/* -------------------- DATA STORES -------------------- */
const safmrByZip = {};     // zip -> hudArea
const fmrByArea = {};      // hudArea -> { fmr_0..fmr_4 }

/* -------------------- LOAD SAFMR -------------------- */
fs.createReadStream("fy2024_safmrs.clean.csv")
  .pipe(csv())
  .on("data", row => {
    const zip = row["ZIP CODE"];
    const area = row["HUD Area Code"];
    if (zip && area) safmrByZip[zip] = area;
  })
  .on("end", () => {
    console.log(`🔥 SAFMR loaded: ${Object.keys(safmrByZip).length} ZIPs`);
  });

/* -------------------- LOAD FMR -------------------- */
fs.createReadStream("fy2024_fmr_county.csv")
  .pipe(csv())
  .on("data", row => {
    const area = row["hud_area_code"];
    if (!area) return;

    fmrByArea[area] = {
      0: Number(row["fmr_0"]),
      1: Number(row["fmr_1"]),
      2: Number(row["fmr_2"]),
      3: Number(row["fmr_3"]),
      4: Number(row["fmr_4"])
    };
  })
  .on("end", () => {
    console.log(`🔥 FMR loaded: ${Object.keys(fmrByArea).length} areas`);
  });

/* -------------------- ANALYZE ENDPOINT -------------------- */
app.post("/api/analyze", (req, res) => {
  const { address, interestRate } = req.body;

  if (!address || !interestRate) {
    return res.status(400).json({ error: "Address and interest rate required" });
  }

  // extract ZIP from address
  const zipMatch = address.match(/\b\d{5}\b/);
  if (!zipMatch) {
    return res.status(400).json({ error: "Valid ZIP not found in address" });
  }
  const zip = zipMatch[0];

  // SAFMR → FMR fallback
  const hudArea = safmrByZip[zip];
  if (!hudArea || !fmrByArea[hudArea]) {
    return res.status(404).json({
      zip,
      error: "No SAFMR or FMR data available"
    });
  }

  const rents = fmrByArea[hudArea];

  const rentTable = Object.entries(rents).map(([br, rent]) => ({
    unit: br === "0" ? "Studio" : `${br} Bedroom`,
    rent,
    paymentStandards: {
      "90%": Math.round(rent * 0.9),
      "100%": rent,
      "110%": Math.round(rent * 1.1)
    }
  }));

  res.json({
    address,
    zip,
    interestRate,
    hudArea,
    source: "HUD SAFMR/FMR",
    rentTable
  });
});

/* -------------------- FALLBACK -------------------- */
app.get("*", (_, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

/* -------------------- START -------------------- */
app.listen(PORT, () => {
  console.log(`🚀 ALEX running at http://127.0.0.1:${PORT}`);
});
app.post("/api/analyze", async (req, res) => {
  try {
    const { address, zip, interestRate } = req.body;

    if (!zip || !interestRate) {
      return res.status(400).json({ error: "zip and interestRate required" });
    }

    // -------------------------
    // 1. HUD RENT (existing logic)
    // -------------------------
    const hudResults = getHudRentByZip(zip); 
    // you already have this logic — DO NOT rewrite it

    // -------------------------
    // 2. MODELED RENT (placeholder for Zillow/Rentometer later)
    // -------------------------
    const modeledRent = hudResults?.["2"]?.rent || null;

    // -------------------------
    // 3. CASH FLOW (simple model for now)
    // -------------------------
    const loanAmount = 360000;
    const monthlyRate = interestRate / 100 / 12;
    const payment =
      loanAmount *
      (monthlyRate * Math.pow(1 + monthlyRate, 360)) /
      (Math.pow(1 + monthlyRate, 360) - 1);

    const monthlyCashFlow = modeledRent
      ? Math.round(modeledRent - payment)
      : null;

    // -------------------------
    // 4. STRESS TEST
    // -------------------------
    const stressTest = {
      baseRate: interestRate,
      shock6: interestRate + 1,
      shock7: interestRate + 2
    };

    // -------------------------
    // 5. EXIT SENSITIVITY
    // -------------------------
    const exitSensitivity = {
      cap55: 0.818,
      cap60: 0.767,
      cap65: 0.721
    };

    res.json({
      address,
      zip,
      interestRate,
      hud: hudResults,
      modeledRent,
      cashFlow: {
        monthly: monthlyCashFlow
      },
      stressTest,
      exitSensitivity
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "analysis failed" });
  }
});