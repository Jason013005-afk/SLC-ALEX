import express from "express";
import fs from "fs";
import path from "path";
import csv from "csv-parser";
import cors from "cors";

const app = express();
const PORT = 8080;

app.use(cors());
app.use(express.json());

// --------------------
// DATA STORES
// --------------------
const SAFMR_BY_ZIP = {};
const FMR_BY_AREA = {};

// --------------------
// LOAD SAFMR (ZIP → AREA)
// --------------------
const SAFMR_PATH = path.join(process.cwd(), "fy2024_safmrs.clean.csv");

fs.createReadStream(SAFMR_PATH)
  .pipe(csv())
  .on("data", (row) => {
    const zip = row["ZIP CODE"]?.replace(/"/g, "").trim();
    const area = row["HUD Area Code"]?.replace(/"/g, "").trim();
    if (zip && area) {
      SAFMR_BY_ZIP[zip] = area;
    }
  })
  .on("end", () => {
    console.log(`🔥 SAFMR loaded: ${Object.keys(SAFMR_BY_ZIP).length} ZIPs`);
  });

// --------------------
// LOAD FMR (AREA → RENTS)
// --------------------
const FMR_PATH = path.join(process.cwd(), "fy2024_fmr_county.csv");

fs.createReadStream(FMR_PATH)
  .pipe(csv())
  .on("data", (row) => {
    const area = row["hud_area_code"]?.trim();
    if (!area) return;

    FMR_BY_AREA[area] = {
      0: Number(row["fmr_0"]) || null,
      1: Number(row["fmr_1"]) || null,
      2: Number(row["fmr_2"]) || null,
      3: Number(row["fmr_3"]) || null,
      4: Number(row["fmr_4"]) || null
    };
  })
  .on("end", () => {
    console.log(`🔥 FMR loaded: ${Object.keys(FMR_BY_AREA).length} areas`);
  });

// --------------------
// HEALTH CHECK
// --------------------
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    zipCount: Object.keys(SAFMR_BY_ZIP).length,
    areaCount: Object.keys(FMR_BY_AREA).length
  });
});

// --------------------
// RENT LOOKUP
// --------------------
app.post("/api/rent", (req, res) => {
  const { zip, bedrooms } = req.body;
  const br = String(bedrooms);

  if (!zip || br === undefined) {
    return res.status(400).json({ error: "zip and bedrooms required" });
  }

  const area = SAFMR_BY_ZIP[zip];
  if (!area) {
    return res.json({
      zip,
      bedrooms,
      error: "ZIP not mapped to HUD area"
    });
  }

  const rents = FMR_BY_AREA[area];
  if (!rents || !rents[br]) {
    return res.json({
      zip,
      bedrooms,
      hudArea: area,
      error: "No FMR available for this area"
    });
  }

  const base = rents[br];

  res.json({
    zip,
    bedrooms,
    hudArea: area,
    rent: base,
    paymentStandards: {
      "90%": Math.round(base * 0.9),
      "100%": base,
      "110%": Math.round(base * 1.1)
    }
  });
});

// --------------------
app.listen(PORT, () => {
  console.log(`🚀 ALEX server running at http://127.0.0.1:${PORT}`);
});
