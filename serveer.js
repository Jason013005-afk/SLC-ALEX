import fs from 'fs';
import express from 'express';
import csv from 'csv-parser';

const app = express();
const PORT = 8080;

// 🔴 CHANGE NOTHING HERE
const CSV_PATH = './fy2024_safmrs.clean.csv';

// =====================
// MIDDLEWARE
// =====================
app.use(express.json());

// =====================
// LOAD CSV
// =====================
let hudData = [];

function loadCSV() {
  hudData = [];

  fs.createReadStream(CSV_PATH)
    .pipe(csv())
    .on('data', (row) => {
      const zip = String(row['ZIP CODE']).padStart(5, '0');

      hudData.push({
        zip,

        'SAFMR OBR': row['SAFMR OBR'],
        'SAFMR 1BR': row['SAFMR 1BR'],
        'SAFMR 2BR': row['SAFMR 2BR'],
        'SAFMR 3BR': row['SAFMR 3BR'],
        'SAFMR 4BR': row['SAFMR 4BR'],
      });
    })
    .on('end', () => {
      console.log(`🔥 HUD CSV loaded: ${hudData.length} rows`);
    })
    .on('error', (err) => {
      console.error('CSV LOAD ERROR:', err);
    });
}

loadCSV();

// =====================
// ROUTES
// =====================

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    rows: hudData.length,
  });
});

// Rent lookup
app.post('/api/rent', (req, res) => {
  const { zip, bedrooms } = req.body;

  if (!zip || bedrooms === undefined) {
    return res.status(400).json({ error: 'zip and bedrooms required' });
  }

  const z = String(zip).padStart(5, '0');

  const BR_KEY = {
    0: 'SAFMR OBR',
    1: 'SAFMR 1BR',
    2: 'SAFMR 2BR',
    3: 'SAFMR 3BR',
    4: 'SAFMR 4BR',
  };

  const key = BR_KEY[bedrooms];
  if (!key) {
    return res.status(400).json({ error: 'Invalid bedroom count' });
  }

  const record = hudData.find((r) => r.zip === z);
  if (!record) {
    return res.status(404).json({ error: 'ZIP not found', zip: z });
  }

  const rawRent = record[key];
  if (!rawRent) {
    return res.status(404).json({ error: 'Rent not found', key });
  }

  const rent = Number(String(rawRent).replace(/[$,]/g, ''));

  res.json({
    zip: z,
    bedrooms,
    rent,
  });
});

// =====================
// START SERVER
// =====================
app.listen(PORT, () => {
  console.log(`✅ ALEX backend running on http://127.0.0.1:${PORT}`);
});
