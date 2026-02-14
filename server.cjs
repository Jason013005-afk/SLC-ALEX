/************************************************************
 * FORCE LOAD .env FROM SAME DIRECTORY
 ************************************************************/
require("dotenv").config({
  path: require("path").join(__dirname, ".env")
});

const express = require("express");
const fs = require("fs");
const path = require("path");
const axios = require("axios");
const csv = require("csv-parser");

const app = express();
app.use(express.json());

/************************************************************
 * ENV CONFIGURATION
 ************************************************************/
const PORT = process.env.PORT || 8080;
const SAFMR_FILE =
  process.env.SAFMR_FILE || "fy2024_safmrs_clean.csv";

const DEFAULT_VACANCY_RATE = Number(
  process.env.DEFAULT_VACANCY_RATE || 8
);

const DEFAULT_EXPENSE_RATE = Number(
  process.env.DEFAULT_EXPENSE_RATE || 35
);

const DEFAULT_LOAN_TERM_YEARS = Number(
  process.env.DEFAULT_LOAN_TERM_YEARS || 30
);

const RENTCAST_API_KEY = process.env.RENTCAST_API_KEY;

if (!RENTCAST_API_KEY) {
  console.warn(
    "⚠️ RENTCAST_API_KEY not found in .env — property & ARV endpoints will not work!"
  );
}

/************************************************************
 * HUD SAFMR DATA LOADING
 ************************************************************/
const safmrData = {};

function normalizeZipForLookup(zip) {
  if (!zip) return null;
  const zipNum = parseInt(zip, 10);
  if (isNaN(zipNum)) return null;
  return zipNum.toString(); // drop leading zeros
}

function cleanMoney(value) {
  if (!value) return 0;
  return Number(
    String(value).replace(/[\$,"]/g, "").trim()
  );
}

function loadSafmr() {
  return new Promise((resolve, reject) => {
    const filePath = path.join(__dirname, SAFMR_FILE);

    if (!fs.existsSync(filePath)) {
      console.error("❌ SAFMR file not found:", filePath);
      return reject();
    }

    fs.createReadStream(filePath)
      .pipe(csv())
      .on("data", (row) => {
        const key = normalizeZipForLookup(
          row["ZIP Code"]
        );
        if (!key) return;

        safmrData[key] = {
          rent0: cleanMoney(row["SAFMR 0BR"]),
          rent1: cleanMoney(row["SAFMR 1BR"]),
          rent2: cleanMoney(row["SAFMR 2BR"]),
          rent3: cleanMoney(row["SAFMR 3BR"]),
          rent4: cleanMoney(row["SAFMR 4BR"])
        };
      })
      .on("end", () => {
        console.log(
          "🏠 SAFMR loaded:",
          Object.keys(safmrData).length,
          "ZIPs"
        );
        resolve();
      })
      .on("error", reject);
  });
}

function getRentFromHUD(zip, bedrooms) {
  const key = normalizeZipForLookup(zip);
  if (!key) return null;
  const row = safmrData[key];
  if (!row) return null;
  return row[`rent${bedrooms}`] || null;
}

/************************************************************
 * RENTCAST PROPERTY + ARV HELPERS
 ************************************************************/
async function getPropertyDetails(address) {
  if (!RENTCAST_API_KEY) return null;

  try {
    const res = await axios.get(
      "https://api.rentcast.io/v1/properties",
      {
        params: { address },
        headers: {
          "X-Api-Key": RENTCAST_API_KEY
        }
      }
    );

    return res.data?.[0] || null;
  } catch (err) {
    console.error(
      "RentCast property lookup failed:",
      err.message
    );
    return null;
  }
}

async function getARV(address) {
  if (!RENTCAST_API_KEY) return null;

  try {
    const res = await axios.get(
      "https://api.rentcast.io/v1/avm/value",
      {
        params: { address },
        headers: {
          "X-Api-Key": RENTCAST_API_KEY
        }
      }
    );

    return res.data?.price || null;
  } catch (err) {
    console.error("RentCast ARV lookup failed:", err.message);
    return null;
  }
}

/************************************************************
 * API ENDPOINTS
 ************************************************************/

/* --- RENT ONLY --- */
app.post("/api/rent", (req, res) => {
  const { zip, bedrooms } = req.body;

  const rent = getRentFromHUD(zip, bedrooms);

  if (!rent) {
    return res
      .status(404)
      .json({ error: "No HUD rent data found" });
  }

  res.json({ zip, bedrooms, rent });
});

/* --- PROPERTY ONLY --- */
app.post("/api/property", async (req, res) => {
  const { address } = req.body;

  if (!address) {
    return res
      .status(400)
      .json({ error: "Address required" });
  }

  const property = await getPropertyDetails(address);
  res.json({ property });
});

/* --- ARV ONLY --- */
app.post("/api/arv", async (req, res) => {
  const { address } = req.body;

  if (!address) {
    return res
      .status(400)
      .json({ error: "Address required" });
  }

  const arv = await getARV(address);
  res.json({ address, arv });
});

/* --- FULL ANALYZE --- */
app.post("/api/analyze", async (req, res) => {
  const {
    address,
    zip,
    bedrooms,
    purchasePrice = 0,
    downPaymentPct = 0,
    interestRate = 0,
    rehab = 0
  } = req.body;

  const rent = getRentFromHUD(zip, bedrooms);

  if (!rent) {
    return res
      .status(404)
      .json({ error: "No HUD rent data found" });
  }

  const vacancyRate = DEFAULT_VACANCY_RATE / 100;
  const expenseRate = DEFAULT_EXPENSE_RATE / 100;

  const effectiveRent = rent * (1 - vacancyRate);
  const annualRent = effectiveRent * 12;
  const annualExpenses = annualRent * expenseRate;
  const annualNOI = annualRent - annualExpenses;

  const totalCost = purchasePrice + rehab;
  const downPayment = totalCost * (downPaymentPct / 100);
  const loanAmount = totalCost - downPayment;

  let monthlyMortgage = 0;
  let annualDebt = 0;

  if (loanAmount > 0 && interestRate > 0) {
    monthlyMortgage = calcMortgage(
      loanAmount,
      interestRate,
      DEFAULT_LOAN_TERM_YEARS
    );
    annualDebt = monthlyMortgage * 12;
  }

  const cashFlow = annualNOI - annualDebt;
  const capRatePct = totalCost
    ? (annualNOI / totalCost) * 100
    : 0;
  const dscr =
    annualDebt > 0 ? annualNOI / annualDebt : null;

  const propertyDetails = address
    ? await getPropertyDetails(address)
    : null;

  const arv = address ? await getARV(address) : null;

  res.json({
    zip,
    bedrooms,
    rent,
    effectiveRent: Math.round(effectiveRent),
    annualRent: Math.round(annualRent),
    annualExpenses: Math.round(annualExpenses),
    annualNOI: Math.round(annualNOI),
    mortgage: Math.round(monthlyMortgage),
    annualDebt: Math.round(annualDebt),
    cashFlow: Math.round(cashFlow),
    capRatePct: Number(capRatePct.toFixed(2)),
    dscr: dscr ? Number(dscr.toFixed(2)) : null,
    propertyDetails,
    arv
  });
});

/* --- DEAL GRADE (WITH COMPS + SCORING) --- */
app.post("/api/deal-grade", async (req, res) => {
  try {
    const {
      address,
      zip,
      bedrooms,
      purchasePrice,
      downPaymentPct = 0,
      interestRate = 0,
      rehab = 0
    } = req.body;

    if (!address || !zip || !bedrooms || !purchasePrice) {
      return res
        .status(400)
        .json({ error: "Missing required fields" });
    }

    const hudRent = getRentFromHUD(zip, bedrooms);
    if (!hudRent) {
      return res
        .status(404)
        .json({ error: "No HUD rent data found" });
    }

    const propertyDetails = await getPropertyDetails(
      address
    );

    const arv = await getARV(address);

    let comps = null;
    if (RENTCAST_API_KEY) {
      try {
        const compsRes = await axios.get(
          "https://api.rentcast.io/v1/properties/comps",
          {
            headers: {
              "X-Api-Key": RENTCAST_API_KEY
            },
            params: { address }
          }
        );
        comps = compsRes.data || null;
      } catch (err) {
        console.warn(
          "Comps fetch error:",
          err.message
        );
      }
    }

    const vacancyRate = DEFAULT_VACANCY_RATE / 100;
    const expenseRate = DEFAULT_EXPENSE_RATE / 100;
    const effectiveRent = hudRent * (1 - vacancyRate);
    const annualRent = effectiveRent * 12;
    const annualExpenses = annualRent * expenseRate;
    const annualNOI = annualRent - annualExpenses;

    const totalCost = purchasePrice + rehab;
    const downPayment = totalCost * (downPaymentPct / 100);
    const loanAmount = totalCost - downPayment;

    let mortgage = 0;
    let annualDebt = 0;
    if (loanAmount > 0 && interestRate > 0) {
      mortgage = calcMortgage(
        loanAmount,
        interestRate,
        DEFAULT_LOAN_TERM_YEARS
      );
      annualDebt = mortgage * 12;
    }

    const annualCashFlow =
      annualNOI - annualDebt;

    const capRate = totalCost
      ? (annualNOI / totalCost) * 100
      : 0;

    const dscrScore =
      annualDebt > 0
        ? annualNOI / annualDebt
        : null;

    let dealScore = "C";
    if (arv && totalCost > 0) {
      const spreadPct =
        ((arv - totalCost) / totalCost) * 100;
      if (
        spreadPct > 35 &&
        capRate > 8 &&
        dscrScore > 1.2
      )
        dealScore = "A";
      else if (
        spreadPct > 20 &&
        capRate > 6 &&
        dscrScore > 1
      )
        dealScore = "B";
    }

    res.json({
      address,
      zip,
      bedrooms,
      hudRent,
      propertyDetails,
      arv,
      comps,
      dealMetrics: {
        annualNOI: Math.round(annualNOI),
        annualRent: Math.round(annualRent),
        annualExpenses: Math.round(annualExpenses),
        mortgage: Math.round(mortgage),
        annualDebt: Math.round(annualDebt),
        annualCashFlow: Math.round(
          annualCashFlow
        ),
        capRatePct: Number(capRate.toFixed(2)),
        dscr: dscrScore
          ? Number(dscrScore.toFixed(2))
          : null
      },
      dealScore
    });
  } catch (err) {
    console.error("Deal-grade error:", err);
    res.status(500).json({
      error: "Deal-grade failed"
    });
  }
});

/************************************************************
 * START SERVER
 ************************************************************/
loadSafmr().then(() => {
  app.listen(PORT, () => {
    console.log(
      `🚀 ALEX running at http://localhost:${PORT}`
    );
  });
});