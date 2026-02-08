require("dotenv").config();
const express = require("express");
const fs = require("fs");
const path = require("path");
const csv = require("csv-parser");

const app = express();
const PORT = 8080;

app.use(express.json());
app.use(express.static("public"));

/* ===============================
   LOAD SAFMR DATA
================================ */

const SAFMR = new Map();

function cleanMoney(val) {
  if (!val) return 0;
  return Number(String(val).replace(/[^0-9.]/g, ""));
}

function normalizeZip(zip) {
  return zip.toString().trim().padStart(5, "0");
}

function loadSAFMR() {
  return new Promise((resolve) => {
    fs.createReadStream("fy2024_safmrs.clean.csv")
      .pipe(csv())
      .on("data", (row) => {
        const zip = normalizeZip(row["ZIP Code"]);
        if (!zip) return;

        const rent = cleanMoney(row["SAFMR 3BR"]);
        if (!rent) return;

        SAFMR.set(zip, {
          rent,
          metro: row["HUD Metro Fair Market Rent Area Name"],
          source: "HUD SAFMR 2024"
        });
      })
      .on("end", () => {
        console.log(`🏠 SAFMR loaded: ${SAFMR.size}`);
        resolve();
      });
  });
}

/* ===============================
   DECISION ENGINE
================================ */

function mortgagePayment(price, rate, downPct) {
  const loan = price * (1 - downPct / 100);
  const r = rate / 100 / 12;
  const n = 30 * 12;
  return Math.round((loan * r) / (1 - Math.pow(1 + r, -n)));
}

function evaluateDeal({ rent, mortgage }) {
  const cashFlow = rent - mortgage;

  let verdict = "Bad deal.";
  let strategy = "pass";

  if (cashFlow > 500) {
    verdict = "Strong rental. Buy and hold.";
    strategy = "hold";
  } else if (cashFlow > 200) {
    verdict = "Decent rental.";
    strategy = "hold";
  }

  return { cashFlow, verdict, strategy };
}

/* ===============================
   API
================================ */

app.post("/api/analyze", (req, res) => {
  const {
    address,
    zip,
    interestRate,
    purchasePrice,
    downPaymentPct
  } = req.body;

  const z = normalizeZip(zip);
  const safmr = SAFMR.get(z);

  if (!safmr) {
    return res.json({ error: "No HUD SAFMR data found", zip: z });
  }

  const mortgage = mortgagePayment(
    purchasePrice,
    interestRate,
    downPaymentPct
  );

  const decision = evaluateDeal({
    rent: safmr.rent,
    mortgage
  });

  res.json({
    address,
    zip: z,
    rent: safmr.rent,
    metro: safmr.metro,
    source: safmr.source,
    mortgage,
    monthlyCashFlow: decision.cashFlow,
    strategy: decision.strategy,
    verdict: decision.verdict
  });
});

/* ===============================
   START
================================ */

loadSAFMR().then(() => {
  app.listen(PORT, () =>
    console.log(`🚀 ALEX running at http://localhost:${PORT}`)
  );
});