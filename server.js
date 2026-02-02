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
const SAFMR = new Map();
const FMR = new Map();

const normalizeZip = z => z?.toString().trim().padStart(5, "0");

// ===============================
// LOAD SAFMR
// ===============================
function loadSAFMR() {
  return new Promise(resolve => {
    fs.createReadStream("fy2024_safmrs.clean.csv")
      .pipe(csv())
      .on("data", row => {
        const zip = normalizeZip(row["ZIP CODE"]);
        if (!zip) return;

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
        resolve();
      });
  });
}

// ===============================
// LOAD FMR
// ===============================
function loadFMR() {
  return new Promise(resolve => {
    fs.createReadStream("fy2024_fmr_metro.csv")
      .pipe(csv())
      .on("data", row => {
        const area = row["HUD Metro Fair Market Rent Area Name"];
        if (!area) return;

        const beds = [
          ["0", "FMR 0BR"],
          ["1", "FMR 1BR"],
          ["2", "FMR 2BR"],
          ["3", "FMR 3BR"],
          ["4", "FMR 4BR"]
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

  const key = `${z}-${b}`;
  const result = SAFMR.get(key);

  if (!result) {
    return res.json({
      error: "No SAFMR data found",
      zip: z,
      bedrooms: b
    });
  }

  res.json({
    zip: z,
    bedrooms: Number(b),
    ...result
  });
});

// ===============================
// SAFE PAGE ROUTES (NO '*')
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