import express from "express";
import fs from "fs";
import csv from "csv-parser";
import path from "path";

const app = express();
const PORT = 8080;

app.use(express.json());
app.use(express.static("public"));

/* ---------- LOAD SAFMR (ZIP → HUD AREA) ---------- */
const safmrByZip = new Map();

fs.createReadStream("fy2024_safmrs.clean.csv")
  .pipe(csv())
  .on("data", (row) => {
    const zip = row["ZIP CODE"];
    const hud = row["HUD Area Code"];
    if (zip && hud) safmrByZip.set(zip, hud);
  })
  .on("end", () => {
    console.log(`🔥 SAFMR loaded: ${safmrByZip.size} ZIPs`);
  });

/* ---------- LOAD FMR (HUD AREA → RENTS) ---------- */
const fmrByArea = new Map();

fs.createReadStream("fy2024_fmr_county.csv")
  .pipe(csv())
  .on("data", (row) => {
    const area = row.hud_area_code;
    if (!area || fmrByArea.has(area)) return;

    fmrByArea.set(area, {
      0: Number(row.fmr_0),
      1: Number(row.fmr_1),
      2: Number(row.fmr_2),
      3: Number(row.fmr_3),
      4: Number(row.fmr_4),
    });
  })
  .on("end", () => {
    console.log(`🔥 FMR loaded: ${fmrByArea.size} areas`);
  });

/* ---------- ROUTES ---------- */
app.get("/", (req, res) => {
  res.sendFile(path.join(process.cwd(), "public", "index.html"));
});

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", zipCount: safmrByZip.size });
});

app.post("/api/rent", (req, res) => {
  const { zip, bedrooms } = req.body;
  const br = Number(bedrooms);

  const hudArea = safmrByZip.get(zip);
  if (!hudArea) {
    return res.status(404).json({ error: "ZIP not found in SAFMR" });
  }

  const fmr = fmrByArea.get(hudArea);
  if (!fmr || fmr[br] == null) {
    return res.status(404).json({ error: "FMR missing for HUD area" });
  }

  const rent = fmr[br];

  res.json({
    zip,
    bedrooms: br,
    hudArea,
    rent,
    paymentStandards: {
      "90%": Math.round(rent * 0.9),
      "100%": rent,
      "110%": Math.round(rent * 1.1),
    },
  });
});

/* ---------- START ---------- */
app.listen(PORT, () => {
  console.log(`🚀 ALEX server running at http://127.0.0.1:${PORT}`);
});