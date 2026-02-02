import express from "express";
import cors from "cors";
import fs from "fs";
import csv from "csv-parser";
import path from "path";
import dotenv from "dotenv";
import { fileURLToPath } from "url";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 8080;

app.use(cors());
app.use(express.json());

// ✅ Serve static frontend
app.use(express.static(path.join(__dirname, "public")));

// --------------------
// LOAD DATA
// --------------------
const safmrByZip = {};
const fmrByArea = {};

function loadCSV(file, onRow, label) {
  return new Promise((resolve) => {
    fs.createReadStream(file)
      .pipe(csv())
      .on("data", onRow)
      .on("end", () => {
        console.log(`🔥 Loaded ${label}`);
        resolve();
      });
  });
}

// SAFMR
await loadCSV("fy2024_safmrs.clean.csv", (r) => {
  if (r["ZIP CODE"] && r["HUD Area Code"]) {
    safmrByZip[r["ZIP CODE"]] = r["HUD Area Code"];
  }
}, "SAFMR");

// FMR
await loadCSV("fy2024_fmr_county.csv", (r) => {
  if (r.hud_area_code) {
    fmrByArea[r.hud_area_code] = {
      fmr_0: Number(r.fmr_0),
      fmr_1: Number(r.fmr_1),
      fmr_2: Number(r.fmr_2),
      fmr_3: Number(r.fmr_3),
      fmr_4: Number(r.fmr_4),
    };
  }
}, "FMR");

// --------------------
// API
// --------------------
app.post("/api/rent", (req, res) => {
  const { zip, bedrooms } = req.body;
  const br = Math.min(Number(bedrooms), 4);

  const hudArea = safmrByZip[zip];
  if (!hudArea || !fmrByArea[hudArea]) {
    return res.status(404).json({
      error: "No SAFMR or FMR available",
      zip,
      bedrooms: br,
    });
  }

  const rent = fmrByArea[hudArea][`fmr_${br}`];

  res.json({
    zip,
    bedrooms: br,
    source: "FMR",
    hudArea,
    rent,
    paymentStandards: {
      "90%": Math.round(rent * 0.9),
      "100%": rent,
      "110%": Math.round(rent * 1.1),
    },
  });
});

// --------------------
// HEALTH CHECK
// --------------------
app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

// --------------------
// START SERVER
// --------------------
app.listen(PORT, () => {
  console.log(`🚀 ALEX running at http://127.0.0.1:${PORT}`);
});