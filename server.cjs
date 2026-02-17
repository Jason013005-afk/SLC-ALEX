const express = require('express');
const path = require('path');
const fs = require('fs');
const csv = require('csv-parser');

const app = express();
const PORT = 8080;

app.use(express.static(path.join(__dirname, 'public')));

let safmrData = {};

console.log("🔄 Loading SAFMR data...");

fs.createReadStream(path.join(__dirname, 'fy2024_safmrs_clean.csv'))
  .pipe(csv())
  .on('data', (row) => {
    const zip = row["ZIP Code"];

    if (zip) {
      safmrData[zip.trim()] = {
        area: row["HUD Metro Fair Market Rent Area Name"],
        studio: row["SAFMR 0BR"],
        one: row["SAFMR 1BR"],
        two: row["SAFMR 2BR"],
        three: row["SAFMR 3BR"],
        four: row["SAFMR 4BR"]
      };
    }
  })
  .on('end', () => {
    console.log(`🏠 SAFMR loaded: ${Object.keys(safmrData).length} ZIPs`);
  })
  .on('error', (err) => {
    console.error("CSV Load Error:", err);
  });

app.get('/api/analyze', (req, res) => {
  const zip = req.query.zip;

  if (!zip) {
    return res.status(400).json({ error: "ZIP required" });
  }

  const cleanZip = zip.trim();
  const data = safmrData[cleanZip];

  if (!data) {
    return res.status(404).json({ error: "ZIP not found" });
  }

  res.json(data);
});

app.listen(PORT, () => {
  console.log(`🚀 ALEX running at http://localhost:${PORT}`);
});