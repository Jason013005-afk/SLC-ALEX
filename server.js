import express from "express";
import fs from "fs";
import path from "path";
import csv from "csv-parser";
import dotenv from "dotenv";
import { fileURLToPath } from "url";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// ===============================
// DATA STORES
// ===============================

// SAFMR: ZIP-BEDROOM → rent
const SAFMR = new Map();

// ZIP → HUD METRO AREA NAME
const ZIP_TO_AREA = new Map();

// FMR: AREA-BEDROOM → rent
const FMR = new Map();

const normalizeZip = z => z?.toString().trim().padStart(5, "0");

// ===============================
// LOAD SAFMR (ZIP-LEVEL)
// ===============================
function loadSAFMR() {
  return new Promise(resolve => {
    fs.createReadStream("fy2024_safmrs.clean.csv")
      .pipe(csv())
      .on("data", row => {
        const zip = normalizeZip(row["ZIP CODE"]);
        const area = row["HUD Metro Fair Market Rent Area Name"];

        if (!zip || !area) return;

        // Map ZIP → HUD AREA
        ZIP_TO_AREA.set(zip, area);

        const beds = [
          ["0", "SAFMR 0BR"],
          ["1", "SAFMR 1BR"],
          ["2", "SAFMR 2BR"],
          ["3", "SAFMR 3BR"],
          ["4", "SAFMR 4BR"]
        ];

        beds.forEach(([b, col]) => {
          const rent = Number(row[col]);
          if (!rent) return;

          SAFMR.set(`${zip}-${b}`, {
            rent,
            p90: Math.round(rent * 0.9),
            p100: rent,
            p110: Math.round(rent * 1.1),
            source: "SAFMR"
          });
        });
      })
      .on("end", () => {
        console.log(`🔥 SAFMR loaded: ${SAFMR.size} records`);
        console.log(`🧭 ZIP→HUD areas: ${ZIP_TO_AREA.size}`);
        resolve();
      });
  });
}

// ===============================
// LOAD FMR (METRO-LEVEL)
// ===============================
function loadFMR() {
  return new Promise(resolve => {
    fs.createReadStream("fy2024_fmr_metro.csv")
      .pipe(csv())
      .on("data", row => {
        const area = row["HUD Metro Fair Market Rent Area Name"];
        if (!area) return;

        const beds = [
          ["0", "erap_fmr_br0"],
          ["1", "erap_fmr_br1"],
          ["2", "erap_fmr_br2"],
          ["3", "erap_fmr_br3"],
          ["4", "erap_fmr_br4"]
        ];

        beds.forEach(([b, col]) => {
          const rent = Number(row[col]);
          if (!rent) return;

          FMR.set(`${area}-${b}`, {
            rent,
            p90: Math.round(rent * 0.9),
            p100: rent,
            p110: Math.round(rent * 1.1),
            source: "FMR"
          });
        });
      })
      .on("end", () => {
        console.log(`🔥 FMR loaded: ${FMR.size} records`);
        resolve();
      });
  });
}

// ===============================
// API: ANALYZE
// ===============================
app.post("/api/analyze", (req, res) => {
  const { zip, bedrooms } = req.body;

  const z = normalizeZip(zip);
  const b = String(bedrooms ?? 0);

  // 1️⃣ Try SAFMR (ZIP-level)
  const safmrKey = `${z}-${b}`;
  if (SAFMR.has(safmrKey)) {
    return res.json({
      zip: z,
      bedrooms: Number(b),
      ...SAFMR.get(safmrKey)
    });
  }

  // 2️⃣ Fallback to FMR via HUD AREA
  const area = ZIP_TO_AREA.get(z);
  if (area) {
    const fmrKey = `${area}-${b}`;
    if (FMR.has(fmrKey)) {
      return res.json({
        zip: z,
        bedrooms: Number(b),
        hudArea: area,
        ...FMR.get(fmrKey)
      });
    }
  }

  // 3️⃣ Nothing found
  res.json({
    error: "No HUD rent data found",
    zip: z,
    bedrooms: Number(b)
  });
});

// ===============================
// PAGE ROUTES
// ===============================
app.get("/", (_, res) =>
  res.sendFile(path.join(__dirname, "public/index.html"))
);

app.get("/system", (_, res) =>
  res.sendFile(path.join(__dirname, "public/system.html"))
);

app.get("/pricing", (_, res) =>
  res.sendFile(path.join(__dirname, "public/pricing.html"))
);

app.get("/contact", (_, res) =>
  res.sendFile(path.join(__dirname, "public/contact.html"))
);

// ===============================
// START SERVER
// ===============================
await loadSAFMR();
await loadFMR();

app.listen(8080, () => {
  console.log("🚀 ALEX running at http://127.0.0.1:8080");
});