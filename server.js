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

// --- DATA HOLDERS ---
const safmrByZip = {};
const fmrByArea = {};
const zipToMetro = {}; // ZIP -> CBSA code

// --- CSV LOADER FUNCTION ---
function loadCSV(path, onRow, label) {
  return new Promise((resolve, reject) => {
    fs.createReadStream(path)
      .pipe(csv())
      .on("data", onRow)
      .on("end", () => {
        console.log(`Loaded ${label}`);
        resolve();
      })
      .on("error", (err) => {
        console.error(`Error loading ${label}:`, err);
        reject(err);
      });
  });
}

// --- LOAD DATA AT STARTUP ---
async function loadAll() {
  await loadCSV("fy2024_safmrs.clean.csv", (r) => {
    safmrByZip[r["ZIP CODE"].padStart(5, "0")] = r;
  }, "SAFMR");

  await loadCSV("fy2024_fmr_metro.csv", (r) => {
    // Use CBSA code as key (adjust if your file uses different column!)
    fmrByArea[r.CBSA] = r;
  }, "FMR");

  await loadCSV("hud_zip_metro_crosswalk.csv", (r) => {
    if (r.ZIP && r.CBSA) {
      zipToMetro[r.ZIP.padStart(5, "0")] = r.CBSA;
    }
  }, "ZIP-to-Metro Crosswalk");
}

await loadAll();

// --- RENT LOOKUP LOGIC ---
function getRentTable(zip) {
  zip = zip.padStart(5, "0"); // Ensure leading zeros for ZIP
  const safmr = safmrByZip[zip];
  if (safmr) {
    return {
      source: "SAFMR",
      hudArea: safmr["HUD Area Code"] || safmr["CBSA"],
      rents: {
        0: Number(safmr["SAFMR 0BR"]),
        1: Number(safmr["SAFMR 1BR"]),
        2: Number(safmr["SAFMR 2BR"]),
        3: Number(safmr["SAFMR 3BR"]),
        4: Number(safmr["SAFMR 4BR"]),
      },
    };
  }
  // Fallback: ZIP -> CBSA (metro) -> FMR
  const cbsa = zipToMetro[zip];
  if (!cbsa) return null;
  const fmr = fmrByArea[cbsa];
  if (!fmr) return null;
  return {
    source: "FMR",
    hudArea: cbsa,
    rents: {
      0: Number(fmr["FMR 0BR"]),
      1: Number(fmr["FMR 1BR"]),
      2: Number(fmr["FMR 2BR"]),
      3: Number(fmr["FMR 3BR"]),
      4: Number(fmr["FMR 4BR"]),
    },
  };
}

// --- PAYMENT STANDARDS CALCULATOR (OPTIONAL) ---
function paymentStandards(rent) {
  return {
    "90%": Math.round(rent * 0.9),
    "100%": rent,
    "110%": Math.round(rent * 1.1),
  };
}

// --- MAIN API ENDPOINT ---
app.post("/api/analyze", (req, res) => {
  let { zip, interestRate = 6.5, price = 450000, down = 0.2 } = req.body;
  zip = zip ? zip.padStart(5, "0") : null;
  if (!zip) return res.status(400).json({ error: "No ZIP provided." });

  const rentData = getRentTable(zip);
  if (!rentData) {
    return res.status(404).json({ error: "No rent data found for ZIP: " + zip });
  }

  // Example: Simple loan/mortgage calculation
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
    source: rentData.source,
  });
});

// --- START THE SERVER ---
app.listen(PORT, () =>
  console.log(`ALEX running at http://127.0.0.1:${PORT}`)
);