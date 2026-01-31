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
// DATA STORES
// ============================

const SAFMR = {}; // ZIP → { area, rents }
const FMR = {};   // HUD_AREA_CODE → rents

// ============================
// FILE PATHS
// ============================

const ROOT = process.cwd();
const SAFMR_PATH = path.join(ROOT, "fy2024_safmrs.clean.csv");
const FMR_PATH = path.join(ROOT, "fy2024_fmr_county.csv");

// ============================
// LOAD SAFMR (ZIP-LEVEL)
// ============================

if (!fs.existsSync(SAFMR_PATH)) {
  console.error("❌ SAFMR CSV not found:", SAFMR_PATH);
  process.exit(1);
}

fs.createReadStream(SAFMR_PATH)
  .pipe(csv())
  .on("data", (row) => {
    const zip = row["ZIP CODE"]?.replace(/"/g, "").trim();
    if (!zip) return;

    const rawArea = row["HUD Area Code"]?.replace(/"/g, "").trim();
    const areaCode = rawArea?.match(/\d{5}/)?.[0]; // 🔑 FIX

    SAFMR[zip] = {
      area: areaCode || null,
      rents: {
        0: Number(row["SAFMR 0BR"]) || null,
        1: Number(row["SAFMR 1BR"]) || null,
        2: Number(row["SAFMR 2BR"]) || null,
        3: Number(row["SAFMR 3BR"]) || null,
        4: Number(row["SAFMR 4BR"]) || null
      }
    };
  })
  .on("end", () => {
    console.log(`🔥 SAFMR loaded: ${Object.keys(SAFMR).length} ZIPs`);
  });

// ============================
// LOAD FMR (METRO / COUNTY)
// ============================

if (!fs.existsSync(FMR_PATH)) {
  console.error("❌ FMR CSV not found:", FMR_PATH);
  process.exit(1);
}

fs.createReadStream(FMR_PATH)
  .pipe(csv())
  .on("data", (row) => {
    const area = row["hud_area_code"]?.trim();
    if (!area) return;

    FMR[area] = {
      0: Number(row["fmr_0"]) || null,
      1: Number(row["fmr_1"]) || null,
      2: Number(row["fmr_2"]) || null,
      3: Number(row["fmr_3"]) || null,
      4: Number(row["fmr_4"]) || null
    };
  })
  .on("end", () => {
    console.log(`🔥 FMR loaded: ${Object.keys(FMR).length} areas`);
  });

// ============================
// ROUTES
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

  const br = String(bedrooms);
  const safmr = SAFMR[zip];

  // 1️⃣ SAFMR (ZIP-level)
  if (safmr && safmr.rents[br] != null) {
    return res.json({
      zip,
      bedrooms,
      source: "SAFMR (ZIP)",
      rent: safmr.rents[br]
    });
  }

  // 2️⃣ FMR fallback (Metro / County)
  if (safmr?.area && FMR[safmr.area]?.[br] != null) {
    return res.json({
      zip,
      bedrooms,
      source: "FMR (Metro/County)",
      rent: FMR[safmr.area][br]
    });
  }

  // 3️⃣ Honest failure
  return res.json({
    zip,
    bedrooms,
    hudStatus: "No SAFMR or FMR available",
    message: "HUD does not publish rent for this ZIP/bedroom combo"
  });
});

// ============================
// START SERVER
// ============================

app.listen(PORT, () => {
  console.log(`🚀 ALEX server running at http://127.0.0.1:${PORT}`);
});