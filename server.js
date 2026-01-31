import express from "express";
import fs from "fs";
import path from "path";
import csv from "csv-parser";
import cors from "cors";

const app = express();
const PORT = 8080;

app.use(cors());
app.use(express.json());

// ============================
// Helpers
// ============================
const cleanNumber = (val) => {
  if (!val) return null;
  return Number(String(val).replace(/[$,]/g, ""));
};

// ============================
// Load SAFMR (ZIP-level)
// ============================
const SAFMR = {};
const SAFMR_PATH = path.join(process.cwd(), "fy2024_safmrs.clean.csv");

fs.createReadStream(SAFMR_PATH)
  .pipe(csv())
  .on("data", (row) => {
    const zip = row["ZIP CODE"]?.replace(/"/g, "").trim();
    if (!zip) return;

    SAFMR[zip] = {
      area: row["HUD Metro Fair Market Rent Area Name"],
      areaCode: row["HUD Area Code"],
      rents: {
        0: cleanNumber(row["SAFMR 0BR"]),
        1: cleanNumber(row["SAFMR 1BR"]),
        2: cleanNumber(row["SAFMR 2BR"]),
        3: cleanNumber(row["SAFMR 3BR"]),
        4: cleanNumber(row["SAFMR 4BR"])
      }
    };
  })
  .on("end", () => {
    console.log(`🔥 SAFMR loaded: ${Object.keys(SAFMR).length} ZIPs`);
  });

// ============================
// Load FMR (Metro / County)
// ============================
const FMR = {};
const FMR_PATH = path.join(process.cwd(), "fy2024_fmr_areas.csv");

fs.createReadStream(FMR_PATH)
  .pipe(csv())
  .on("data", (row) => {
    const areaCode = row["HUD Area Code"]?.trim();
    if (!areaCode) return;

    FMR[areaCode] = {
      area: row["HUD Fair Market Rent Area Name"],
      rents: {
        0: cleanNumber(row["FMR 0BR"]),
        1: cleanNumber(row["FMR 1BR"]),
        2: cleanNumber(row["FMR 2BR"]),
        3: cleanNumber(row["FMR 3BR"]),
        4: cleanNumber(row["FMR 4BR"])
      }
    };
  })
  .on("end", () => {
    console.log(`🔥 FMR loaded: ${Object.keys(FMR).length} areas`);
  });

// ============================
// Routes
// ============================

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    safmrZips: Object.keys(SAFMR).length,
    fmrAreas: Object.keys(FMR).length
  });
});

app.post("/api/rent", (req, res) => {
  const { zip, bedrooms } = req.body;

  if (!zip || bedrooms === undefined) {
    return res.status(400).json({
      error: "zip and bedrooms are required"
    });
  }

  const safmr = SAFMR[zip];

  // ZIP not in dataset at all
  if (!safmr) {
    return res.status(404).json({
      error: "ZIP not found in HUD dataset"
    });
  }

  // 1️⃣ SAFMR exists
  const safmrRent = safmr.rents[bedrooms];
  if (safmrRent) {
    return res.json({
      source: "SAFMR",
      zip,
      bedrooms,
      area: safmr.area,
      rent: safmrRent,
      paymentStandards: {
        "90%": Math.round(safmrRent * 0.9),
        "100%": safmrRent,
        "110%": Math.round(safmrRent * 1.1)
      }
    });
  }

  // 2️⃣ FMR fallback (metro / county)
  const fmr = FMR[safmr.areaCode];
  if (fmr && fmr.rents[bedrooms]) {
    return res.json({
      source: "FMR_FALLBACK",
      zip,
      bedrooms,
      area: fmr.area,
      rent: fmr.rents[bedrooms],
      note: "SAFMR not published for this ZIP — using HUD metro/county FMR"
    });
  }

  // 3️⃣ Truthful final response
  return res.json({
    zip,
    bedrooms,
    hudStatus: "No HUD rent available",
    message:
      "HUD does not publish SAFMR or FMR for this ZIP/bedroom combination",
    nextStep: "Use market rent estimate or comps"
  });
});

// ============================
// Start server
// ============================
app.listen(PORT, () => {
  console.log(`🚀 ALEX server running at http://127.0.0.1:${PORT}`);
});