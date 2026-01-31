import express from "express";
import fs from "fs";
import path from "path";
import csv from "csv-parser";
import cors from "cors";

const app = express();
const PORT = 8080;

// ---------- Middleware ----------
app.use(cors());
app.use(express.json());
app.use(express.static("public")); // <-- THIS is why "/" works

// ---------- Data Stores ----------
const SAFMR_BY_ZIP = {};
const FMR_BY_METRO = {};

// ---------- Load SAFMR ----------
fs.createReadStream("fy2024_safmrs.clean.csv")
  .pipe(csv())
  .on("data", (row) => {
    const zip = row["ZIP CODE"];
    const metro = row["HUD Area Code"];

    if (!zip) return;

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
  });

// ---------- Load FMR ----------
fs.createReadStream("fy2024_fmr_county.csv")
  .pipe(csv())
  .on("data", (row) => {
    const metro = row.hud_area_code;
    if (!metro) return;

    FMR_BY_METRO[metro] = {
      0: Number(row.fmr_0),
      1: Number(row.fmr_1),
      2: Number(row.fmr_2),
      3: Number(row.fmr_3),
      4: Number(row.fmr_4)
    };
  })
  .on("end", () => {
    console.log(`🔥 FMR loaded: ${Object.keys(FMR_BY_METRO).length} areas`);
  });

// ---------- API ----------
app.post("/api/rent", (req, res) => {
  const { zip, bedrooms } = req.body;
  const br = Number(bedrooms);

  if (!zip || isNaN(br)) {
    return res.status(400).json({ error: "zip and bedrooms required" });
  }

  const safmr = SAFMR_BY_ZIP[zip];
  if (!safmr) {
    return res.status(404).json({ error: "ZIP not found" });
  }

  // Try SAFMR first
  let rent = safmr.rents[br];
  let source = "SAFMR";

  // Fallback to FMR
  if (!rent) {
    const metro = safmr.metro;
    const fmr = FMR_BY_METRO[metro];
    if (fmr && fmr[br]) {
      rent = fmr[br];
      source = "FMR";
    }
  }

  if (!rent) {
    return res.json({ zip, bedrooms: br, error: "No rent available" });
  }

  res.json({
    zip,
    bedrooms: br,
    source,
    hudArea: safmr.metro,
    rent,
    paymentStandards: {
      "90%": Math.round(rent * 0.9),
      "100%": rent,
      "110%": Math.round(rent * 1.1)
    }
  });
});

// ---------- Health ----------
app.get("/api/health", (_, res) => {
  res.json({ status: "ok" });
});

// ---------- Start ----------
app.listen(PORT, () => {
  console.log(`🚀 ALEX running at http://127.0.0.1:${PORT}`);
});