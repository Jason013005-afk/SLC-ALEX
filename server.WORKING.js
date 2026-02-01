import express from "express";
import fs from "fs";
import path from "path";
import csv from "csv-parser";
import cors from "cors";
import dotenv from "dotenv";
import { fileURLToPath } from "url";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 8080;

/* =========================
   MIDDLEWARE
========================= */
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

/* =========================
   DATA STORES
========================= */
const SAFMR = new Map(); // ZIP -> { hudArea, rents[] }
const FMR = new Map();   // hudArea -> rents[]

/* =========================
   LOAD SAFMR
========================= */
fs.createReadStream("fy2024_safmrs.clean.csv")
  .pipe(csv())
  .on("data", row => {
    const zip = row["ZIP CODE"];
    const hudArea = row["HUD Area Code"];

    if (!zip || !hudArea) return;

    const rents = [
      Number(row["0BR"]),
      Number(row["1BR"]),
      Number(row["2BR"]),
      Number(row["3BR"]),
      Number(row["4BR"])
    ];

    SAFMR.set(zip, { hudArea, rents });
  })
  .on("end", () => {
    console.log("🔥 Loaded SAFMR");
  });

/* =========================
   LOAD FMR (METRO + COUNTY)
========================= */
const loadFMR = file =>
  fs.createReadStream(file)
    .pipe(csv())
    .on("data", row => {
      const hudArea = row["HUD Area Code"];
      if (!hudArea) return;

      const rents = [
        Number(row["0BR"]),
        Number(row["1BR"]),
        Number(row["2BR"]),
        Number(row["3BR"]),
        Number(row["4BR"])
      ];

      FMR.set(hudArea, rents);
    });

loadFMR("fy2024_fmr_metro.csv");
loadFMR("fy2024_fmr_county.csv");

console.log("🔥 Loaded FMR");

/* =========================
   API: RENT LOOKUP
========================= */
app.post("/api/rent", (req, res) => {
  const { zip, bedrooms } = req.body;

  if (!zip || bedrooms === undefined) {
    return res.status(400).json({ error: "zip and bedrooms required" });
  }

  // SAFMR first
  if (SAFMR.has(zip)) {
    const { hudArea, rents } = SAFMR.get(zip);
    const rent = rents[bedrooms];

    if (rent) {
      return res.json({
        zip,
        bedrooms,
        source: "SAFMR",
        hudArea,
        rent,
        paymentStandards: {
          "90%": Math.round(rent * 0.9),
          "100%": rent,
          "110%": Math.round(rent * 1.1)
        }
      });
    }

    // fallback to FMR using HUD area
    if (FMR.has(hudArea)) {
      const fmrRent = FMR.get(hudArea)[bedrooms];
      if (fmrRent) {
        return res.json({
          zip,
          bedrooms,
          source: "FMR",
          hudArea,
          rent: fmrRent,
          paymentStandards: {
            "90%": Math.round(fmrRent * 0.9),
            "100%": fmrRent,
            "110%": Math.round(fmrRent * 1.1)
          }
        });
      }
    }
  }

  return res.status(404).json({
    zip,
    bedrooms,
    error: "No SAFMR or FMR available"
  });
});

/* =========================
   PAGE ROUTING (EXPRESS 5 SAFE)
========================= */
app.get("/", (_, res) =>
  res.sendFile(path.join(__dirname, "public/index.html"))
);

app.get("/system.html", (_, res) =>
  res.sendFile(path.join(__dirname, "public/system.html"))
);

app.get("/pricing.html", (_, res) =>
  res.sendFile(path.join(__dirname, "public/pricing.html"))
);

app.get("/contact.html", (_, res) =>
  res.sendFile(path.join(__dirname, "public/contact.html"))
);

/* =========================
   FALLBACK (NO "*" BUG)
========================= */
app.use((req, res) => {
  res.sendFile(path.join(__dirname, "public/index.html"));
});

/* =========================
   START SERVER
========================= */
app.listen(PORT, () => {
  console.log(`🚀 ALEX running at http://127.0.0.1:${PORT}`);
});