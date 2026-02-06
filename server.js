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

const SAFMR = new Map();
const FMR = new Map();

const normalizeZip = z => String(z || "").trim().padStart(5, "0");

// ===============================
// LOAD SAFMR (ZIP BASED)
// ===============================
function loadSAFMR() {
  return new Promise(resolve => {
    let rows = 0;

    fs.createReadStream("fy2024_safmrs.clean.csv")
      .pipe(csv())
      .on("headers", h => console.log("📄 SAFMR Headers:", h))
      .on("data", row => {
        rows++;

        const zip = normalizeZip(row["ZIP CODE"]);
        if (!/^\d{5}$/.test(zip)) return;

        const beds = [
          ["0", "SAFMR 0BR"],
          ["1", "SAFMR 1BR"],
          ["2", "SAFMR 2BR"],
          ["3", "SAFMR 3BR"],
          ["4", "SAFMR 4BR"]
        ];

        beds.forEach(([b, col]) => {
          const rent = Number(String(row[col]).replace(/[^0-9.]/g, ""));
          if (isNaN(rent)) return;

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
        console.log(`🔥 SAFMR Loaded: ${SAFMR.size}`);
        resolve();
      });
  });
}

// ===============================
// LOAD FMR (METRO BASED)
// ===============================
function loadFMR() {
  return new Promise(resolve => {
    fs.createReadStream("fy2024_fmr_metro.csv")
      .pipe(csv())
      .on("headers", h => console.log("📄 FMR Headers:", h))
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
          const rent = Number(String(row[col]).replace(/[^0-9.]/g, ""));
          if (isNaN(rent)) return;

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
        console.log(`🔥 FMR Loaded: ${FMR.size}`);
        resolve();
      });
  });
}

// ===============================
// API
// ===============================
app.post("/api/analyze", (req, res) => {
  const { zip, bedrooms = 0 } = req.body;

  const z = normalizeZip(zip);
  const b = String(bedrooms);

  const safmr = SAFMR.get(`${z}-${b}`);

  if (!safmr) {
    return res.json({
      error: "No SAFMR data found",
      zip: z,
      bedrooms: Number(b)
    });
  }

  res.json({
    zip: z,
    bedrooms: Number(b),
    ...safmr
  });
});

// ===============================
// STATIC ROUTES
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
// START
// ===============================
await loadSAFMR();
await loadFMR();

app.listen(8080, () => {
  console.log("🚀 ALEX running at http://127.0.0.1:8080");
});