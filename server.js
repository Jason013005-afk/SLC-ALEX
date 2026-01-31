import express from "express";
import fs from "fs";
import path from "path";
import csv from "csv-parser";
import cors from "cors";

const app = express();
const PORT = 8080;

app.use(cors());
app.use(express.json());

const SAFMR_BY_ZIP = {};
const FMR_BY_METRO = {};

const loadSAFMR = () =>
  new Promise((resolve, reject) => {
    fs.createReadStream(path.join(process.cwd(), "fy2024_safmrs.clean.csv"))
      .pipe(csv())
      .on("data", row => {
        const zip = row["ZIP CODE"]?.replace(/"/g, "").trim();
        const metro = row["HUD Area Code"]?.replace(/"/g, "").trim();
        if (!zip || !metro) return;

        SAFMR_BY_ZIP[zip] = {
          metro,
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
        console.log(`🔥 SAFMR loaded: ${Object.keys(SAFMR_BY_ZIP).length} ZIPs`);
        resolve();
      })
      .on("error", reject);
  });

const loadFMR = () =>
  new Promise((resolve, reject) => {
    fs.createReadStream(path.join(process.cwd(), "fy2024_fmr_county.csv"))
      .pipe(csv())
      .on("data", row => {
        const metro = row["hud_area_code"]?.trim();
        if (!metro) return;

        FMR_BY_METRO[metro] = {
          0: Number(row["fmr_0"]) || null,
          1: Number(row["fmr_1"]) || null,
          2: Number(row["fmr_2"]) || null,
          3: Number(row["fmr_3"]) || null,
          4: Number(row["fmr_4"]) || null
        };
      })
      .on("end", () => {
        console.log(`🔥 FMR loaded: ${Object.keys(FMR_BY_METRO).length} metros`);
        resolve();
      })
      .on("error", reject);
  });

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    safmrZips: Object.keys(SAFMR_BY_ZIP).length,
    fmrMetros: Object.keys(FMR_BY_METRO).length
  });
});

app.post("/api/rent", (req, res) => {
  const { zip, bedrooms } = req.body;
  const br = Number(bedrooms);

  const zipData = SAFMR_BY_ZIP[zip];
  if (!zipData) {
    return res.status(404).json({ error: "ZIP not found in SAFMR dataset" });
  }

  const safmr = zipData.rents[br];
  if (safmr) {
    return res.json({
      zip,
      bedrooms: br,