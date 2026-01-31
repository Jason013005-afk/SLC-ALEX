import fs from "fs";
import csv from "csv-parser";
import express from "express";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());

const SAFMR_FILE = "fy2024_safmrs.clean.csv";
const FMR_FILE = "fy2024_fmr_county.csv";

const safmrByZip = new Map();        // zip -> { areaCode, rents[] }
const fmrByArea = new Map();         // METROxxxx -> { fmr_0..fmr_4 }

// ---------- LOAD SAFMR ----------
fs.createReadStream(SAFMR_FILE)
  .pipe(csv())
  .on("data", (row) => {
    const zip = row["ZIP CODE"]?.replace(/"/g, "");
    if (!zip) return;

    const areaCode = row["HUD Area Code"]?.replace(/"/g, "");

    const rents = [
      row["SAFMR 0BR"],
      row["SAFMR 1BR"],
      row["SAFMR 2BR"],
      row["SAFMR 3BR"],
      row["SAFMR 4BR"],
    ].map(v => {
      if (!v) return null;
      return Number(v.replace(/[^0-9]/g, ""));
    });

    safmrByZip.set(zip, { areaCode, rents });
  })
  .on("end", () => {
    console.log(`🔥 SAFMR loaded: ${safmrByZip.size} ZIPs`);
  });

// ---------- LOAD FMR ----------
fs.createReadStream(FMR_FILE)
  .pipe(csv())
  .on("data", (row) => {
    const area = row["hud_area_code"];
    if (!area) return;

    fmrByArea.set(area, {
      0: Number(row["fmr_0"]),
      1: Number(row["fmr_1"]),
      2: Number(row["fmr_2"]),
      3: Number(row["fmr_3"]),
      4: Number(row["fmr_4"]),
    });
  })
  .on("end", () => {
    console.log(`🔥 FMR loaded: ${fmrByArea.size} areas`);
  });

// ---------- HEALTH ----------
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    safmrZips: safmrByZip.size,
    fmrAreas: fmrByArea.size
  });
});

// ---------- RENT ----------
app.post("/api/rent", (req, res) => {
  const zip = String(req.body.zip || "").trim();
  const br = Number(req.body.bedrooms);

  if (!zip || isNaN(br) || br < 0 || br > 4) {
    return res.status(400).json({ error: "Invalid zip or bedrooms" });
  }

  const safmr = safmrByZip.get(zip);

  // 1️⃣ SAFMR (ZIP LEVEL)
  if (safmr && safmr.rents[br]) {
    return res.json({
      zip,
      bedrooms: br,
      source: "SAFMR",
      rent: safmr.rents[br]
    });
  }

  // 2️⃣ FMR FALLBACK (METRO / COUNTY)
  if (safmr?.areaCode) {
    const fmr = fmrByArea.get(safmr.areaCode);
    if (fmr && fmr[br]) {
      return res.json({
        zip,
        bedrooms: br,
        source: "FMR",
        hudArea: safmr.areaCode,
        rent: fmr[br]
      });
    }
  }

  // 3️⃣ FINAL FAILURE (EXPLICIT)
  return res.status(404).json({
    zip,
    bedrooms: br,
    error: "No SAFMR or FMR available"
  });
});

// ---------- START ----------
const PORT = 8080;
app.listen(PORT, () => {
  console.log(`🚀 ALEX server running at http://127.0.0.1:${PORT}`);
});