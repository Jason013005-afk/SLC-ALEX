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
// Load SAFMR (ZIP-level)
// ============================
const SAFMR = {};
const SAFMR_PATH = path.join(process.cwd(), "fy2024_safmrs.clean.csv");

fs.createReadStream(SAFMR_PATH)
  .pipe(csv())
  .on("data", (row) => {
    const zip = row["ZIP CODE"]?.trim();
    if (!zip) return;

    SAFMR[zip] = {
      area: row["HUD Area Code"],
      rents: {
        0: Number(row["SAFMR 0BR"]) || null,
        1: Number(row["SAFMR 1BR"]) || null,
        2: Number(row["SAFMR 2BR"]) || null,
        3: Number(row["SAFMR 3BR"]) || null,
        4: Number(row["SAFMR 4BR"]) || null
      }
    };
  });

// ============================
// Load FMR (Metro / County)
// ============================
const FMR = {};
const FMR_PATH = path.join(process.cwd(), "fy2024_fmr_county.csv");

fs.createReadStream(FMR_PATH)
  .pipe(csv())
  .on("data", (row) => {
    const area = row["HUD Area Code"];
    if (!area) return;

    FMR[area] = {
      0: Number(row["Efficiency"]) || null,
      1: Number(row["One-Bedroom"]) || null,
      2: Number(row["Two-Bedroom"]) || null,
      3: Number(row["Three-Bedroom"]) || null,
      4: Number(row["Four-Bedroom"]) || null
    };
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
    return res.status(400).json({ error: "zip and bedrooms required" });
  }

  const safmr = SAFMR[zip];
  if (!safmr) {
    return res.status(404).json({ error: "ZIP not found in HUD dataset" });
  }

  // 1️⃣ SAFMR first
  const safmrRent = safmr.rents[bedrooms];
  if (safmrRent) {
    return res.json({
      zip,
      bedrooms,
      source: "SAFMR",
      rent: safmrRent
    });
  }

  // 2️⃣ FMR fallback
  const fmrRent = FMR[safmr.area]?.[bedrooms];
  if (fmrRent) {
    return res.json({
      zip,
      bedrooms,
      source: "FMR (Metro/County)",
      rent: fmrRent
    });
  }

  return res.status(404).json({
    zip,
    bedrooms,
    error: "No SAFMR or FMR available"
  });
});

// ============================
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://127.0.0.1:${PORT}`);
});