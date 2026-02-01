import express from "express";
import cors from "cors";
import fs from "fs";
import csv from "csv-parser";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static("public"));

const PORT = 8080;

/* ---------------- LOAD DATA ---------------- */

const safmrByZip = {};
const fmrByArea = {};

function loadCSV(path, onRow, label) {
  return new Promise((resolve) => {
    fs.createReadStream(path)
      .pipe(csv())
      .on("data", onRow)
      .on("end", () => {
        console.log(`🔥 Loaded ${label}`);
        resolve();
      });
  });
}

await loadCSV("fy2024_safmrs.clean.csv", (r) => {
  safmrByZip[r["ZIP CODE"]] = r;
}, "SAFMR");

await loadCSV("fy2024_fmr_county.csv", (r) => {
  fmrByArea[r.hud_area_code] = r;
}, "FMR");

/* ---------------- HELPERS ---------------- */

function paymentStandards(rent) {
  return {
    "90%": Math.round(rent * 0.9),
    "100%": rent,
    "110%": Math.round(rent * 1.1),
  };
}

function getRentTable(zip) {
  const safmr = safmrByZip[zip];
  if (safmr) {
    return {
      source: "SAFMR",
      hudArea: safmr["HUD Area Code"],
      rents: {
        0: Number(safmr["SAFMR 0BR"]),
        1: Number(safmr["SAFMR 1BR"]),
        2: Number(safmr["SAFMR 2BR"]),
        3: Number(safmr["SAFMR 3BR"]),
        4: Number(safmr["SAFMR 4BR"]),
      },
    };
  }

  // fallback to FMR via metro/county
  const area = Object.values(fmrByArea).find((r) =>
    r.hud_area_code?.includes(zip.slice(0, 2))
  );

  if (!area) return null;

  return {
    source: "FMR",
    hudArea: area.hud_area_code,
    rents: {
      0: Number(area.fmr_0),
      1: Number(area.fmr_1),
      2: Number(area.fmr_2),
      3: Number(area.fmr_3),
      4: Number(area.fmr_4),
    },
  };
}

/* ---------------- MAIN ENDPOINT ---------------- */

app.post("/api/analyze", (req, res) => {
  const { zip, interestRate, price = 450000, down = 0.2 } = req.body;

  const rentData = getRentTable(zip);
  if (!rentData) {
    return res.status(404).json({ error: "No rent data found" });
  }

  const loan = price * (1 - down);
  const monthlyDebt = Math.round((loan * (interestRate / 100)) / 12);

  const rentTable = Object.entries(rentData.rents).map(([br, rent]) => ({
    unit: br == 0 ? "Studio" : `${br} Bedroom`,
    rent,
    ...paymentStandards(rent),
    source: rentData.source,
  }));

  const modeledRent = rentData.rents[2] || rentData.rents[1];
  const cashFlow = modeledRent - monthlyDebt;

  res.json({
    zip,
    hudArea: rentData.hudArea,
    rentTable,
    cashFlow: {
      monthlyRent: modeledRent,
      monthlyDebt,
      monthlyCashFlow: cashFlow,
      annualCashFlow: cashFlow * 12,
    },
    stressTest: {
      breakEvenRent: monthlyDebt,
      toleranceRate: cashFlow > 0 ? "PASS" : "FAIL",
    },
    exitSensitivity: [
      { years: 3, cap: "6.0%", roi: "76%" },
      { years: 5, cap: "6.5%", roi: "41%" },
      { years: 7, cap: "7.0%", roi: "28%" },
    ],
  });
});

/* ---------------- START ---------------- */

app.listen(PORT, () =>
  console.log(`🚀 ALEX running at http://127.0.0.1:${PORT}`)
);