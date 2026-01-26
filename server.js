import express from "express";
import fs from "fs";
import path from "path";
import csv from "csv-parser";

const app = express();
const PORT = 8080;

/* ---------- MIDDLEWARE ---------- */
app.use(express.json());
app.use(express.static("public")); // 👈 THIS FIXES THE WEBSITE ISSUE

/* ---------- DATA ---------- */
const CSV_PATH = "./fy2024_safmrs.clean.csv";
const hudData = [];

/* ---------- LOAD CSV ---------- */
function clean(v) {
  if (v === null || v === undefined || v === "") return null;
  return Number(String(v).replace(/[$,]/g, ""));
}

function loadCSV() {
  fs.createReadStream(CSV_PATH)
    .pipe(csv({ headers: false }))
    .on("data", (row) => {
      if (!row[0] || row[0].toLowerCase().includes("zip")) return;

      const zip = String(row[0]).padStart(5, "0");

      hudData.push({
        zip,
        rents: {
          0: clean(row[3]),   // Studio
          1: clean(row[6]),   // 1BR
          2: clean(row[9]),   // 2BR
          3: clean(row[12]),  // 3BR
          4: clean(row[15])   // 4BR
        }
      });
    })
    .on("end", () => {
      console.log(`🔥 HUD CSV loaded: ${hudData.length} rows`);
    });
}

loadCSV();

/* ---------- ROUTES ---------- */
app.get("/health", (req, res) => {
  res.json({ status: "ok", rows: hudData.length });
});

app.post("/api/rent", (req, res) => {
  const { zip, bedrooms } = req.body;

  if (!zip || bedrooms === undefined) {
    return res.status(400).json({ error: "zip and bedrooms required" });
  }

  const z = String(zip).padStart(5, "0");
  const record = hudData.find(r => r.zip === z);

  if (!record) {
    return res.status(404).json({ error: "ZIP not found", zip: z });
  }

  const rent = record.rents[bedrooms];

  // IMPORTANT: 0 is valid — only null/undefined is missing
  if (rent === null || rent === undefined) {
    return res.status(404).json({
      error: "No rent for bedroom count",
      zip: z,
      bedrooms
    });
  }

  res.json({ zip: z, bedrooms, rent });
});

/* ---------- START ---------- */
app.listen(PORT, () => {
  console.log(`✅ ALEX backend running at http://127.0.0.1:${PORT}`);
});
