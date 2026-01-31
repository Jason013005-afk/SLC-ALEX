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
// Data stores
// ============================
const SAFMR_BY_ZIP = {};
const FMR_BY_AREA = {};

// ============================
// File paths
// ============================
const SAFMR_PATH = path.join(process.cwd(), "fy2024_safmrs.clean.csv");
const FMR_PATH = path.join(process.cwd(), "fy2024_fmr_county.csv");

// ============================
// Load SAFMR (ZIP-level)
// ============================
fs.createReadStream(SAFMR_PATH)
  .pipe(csv())
  .on("data", (row) => {
    const zip = row["ZIP CODE"]?.replace(/"/g, "").trim();
    const hudArea = row["HUD Area Code"]?.replace(/"/g, "").trim();

    if (!zip || !hudArea) return;

    SAFMR_BY_ZIP[zip] = {
      hudArea,
      rents: {
        0: Number(row["SAFMR 0BR"]) || null,
        1: Number(row["SAFMR 1BR"]) || null,
        2: Number(row["SAFMR 2BR"]) || null,
        3: Number(row["SAFMR 3BR"]) || null,
        4: Number(row["SAFMR 4BR"]) || null,
      },
    };
  })
  .on("end", () => {
    console.log(`🔥 SAFMR loaded: ${Object.keys(SAFMR_BY_ZIP).length} ZIPs`);
  });

// ============================
// Load FMR (Metro / County)
// ============================
fs.createReadStream(FMR_PATH)
  .pipe(csv())
  .on("data", (row) => {
    const hudArea = row["hud_area_code"]?.trim();
    if (!hudArea) return;

    FMR_BY_AREA[hudArea] = {
      0: Number(row["fmr_0"]) || null,
      1: Number(row["fmr_1"]) || null,
      2: Number(row["fmr_2"]) || null,
      3: Number(row["fmr_3"]) || null,
      4: Number(row["fmr_4"]) || null,
    };
  })
  .on("end", () => {
    console.log(`🔥 FMR loaded: ${Object.keys(FMR_BY_AREA).length} areas`);
  });

// ============================
// Health
// ============================
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    safmrZips: Object.keys(SAFMR_BY_ZIP).length,
    fmrAreas: Object.keys(FMR_BY_AREA).length,
  });
});

// ============================
// Rent lookup
// ============================
app.post("/api/rent", (req, res) => {
  const { zip, bedrooms } = req.body;

  if (!zip || bedrooms === undefined) {
    return res.status(400).json({
      error: "zip and bedrooms required",
    });
  }

  const safmr = SAFMR_BY_ZIP[zip];
  if (!safmr) {
    return res.status(404).json({
      error: "ZIP not found in SAFMR dataset",
    });
  }

  // 1️⃣ SAFMR if available
  const safmrRent = safmr.rents[bedrooms];
  if (safmrRent) {
    return res.json({
      zip,
      bedrooms,
      source: "SAFMR",
      rent: safmrRent,
    });
  }

  // 2️⃣ FMR fallback via HUD area code
  const fmr = FMR_BY_AREA[safmr.hudArea];
  const fmrRent = fmr?.[bedrooms];

  if (fmrRent) {
    return res.json({
      zip,
      bedrooms,
      source: "FMR (Metro/County)",
      hudArea: safmr.hudArea,
      rent: fmrRent,
    });
  }

  // 3️⃣ Nothing available
  return res.json({
    zip,
    bedrooms,
    error: "No SAFMR or FMR available",
  });
});

// ============================
// Start
// ============================
app.listen(PORT, () => {
  console.log(`🚀 ALEX server running at http://127.0.0.1:${PORT}`);
});