import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import csv from "csv-parser";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 8080;
const __dirname = new URL(".", import.meta.url).pathname;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// --------------------
// LOAD DATA
// --------------------
const SAFMR = new Map();
const FMR = new Map();

function loadCSV(file, handler) {
  return new Promise((resolve) => {
    fs.createReadStream(file)
      .pipe(csv())
      .on("data", handler)
      .on("end", resolve);
  });
}

await loadCSV("fy2024_safmrs.clean.csv", row => {
  if (row.zip && row.bedrooms) {
    SAFMR.set(`${row.zip}-${row.bedrooms}`, Number(row.rent));
  }
});

await loadCSV("fy2024_fmr_metro.csv", row => {
  if (row.zip && row.bedrooms) {
    FMR.set(`${row.zip}-${row.bedrooms}`, Number(row.rent));
  }
});

console.log(`🔥 SAFMR loaded: ${SAFMR.size} ZIPs`);
console.log(`🔥 FMR loaded: ${FMR.size} areas`);

// --------------------
// API
// --------------------
app.post("/api/analyze", (req, res) => {
  const { zip, interestRate } = req.body;

  if (!zip || !interestRate) {
    return res.status(400).json({ error: "Missing zip or interestRate" });
  }

  const results = [];

  for (let beds = 0; beds <= 4; beds++) {
    const key = `${zip}-${beds}`;
    const rent = SAFMR.get(key) || FMR.get(key);

    if (!rent) continue;

    results.push({
      unit: beds === 0 ? "Studio" : `${beds} Bedroom`,
      rent,
      p90: Math.round(rent * 0.9),
      p100: rent,
      p110: Math.round(rent * 1.1),
      source: SAFMR.has(key) ? "SAFMR" : "FMR"
    });
  }

  res.json({
    zip,
    interestRate,
    results
  });
});

// --------------------
// STATIC PAGE ROUTES (NO wildcard)
// --------------------
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

// --------------------
app.listen(PORT, () =>
  console.log(`🚀 ALEX running at http://127.0.0.1:${PORT}`)
);