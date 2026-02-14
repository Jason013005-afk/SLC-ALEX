/**
 * ALEX server.cjs (CommonJS)
 * - Robust SAFMR + FMR loaders (header-safe)
 * - Investor-grade deal logic: Hold / Flip / Wholesale / BRRRR + score
 */

const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const csv = require("csv-parser");

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname, "public")));

// -------------------- CONFIG --------------------
const PORT = process.env.PORT || 8080;

// Rental underwriting defaults
const DEFAULTS = {
  expenseRatio: 0.35,          // 35% operating expense ratio
  vacancyRatio: 0.05,          // optional (already baked in by expenseRatio? keep separate if you want)
  targetCapRate: 0.08,         // used for value-from-income if no value provided
  dscrMin: 1.15,

  // Flip underwriting defaults
  flipRulePct: 0.70,           // 70% rule
  sellCostPct: 0.08,           // agent + closing + holding buffer (basic)
  wholesaleFeeDefault: 10000,  // typical assignment fee target

  // BRRRR defaults
  refiLtv: 0.75,
  refiRateBump: 0.5            // refi rate = interestRate + 0.5 (simple placeholder)
};

// -------------------- DATA STORES --------------------
const safmrByZip = new Map();   // zip -> { studio, one, two, three, four, metro }
const fmrMetroByZip = new Map(); // zip -> { studio, one, two, three, four, metro }

// -------------------- HELPERS --------------------
function padZip(zip) {
  if (zip === undefined || zip === null) return null;
  const s = String(zip).trim();
  if (!s) return null;
  // If someone passes "02724-1234", keep first 5
  const five = s.includes("-") ? s.split("-")[0] : s;
  return String(five).trim().padStart(5, "0").slice(0, 5);
}

function parseDollar(x) {
  if (x === undefined || x === null) return 0;
  const s = String(x).replace(/[\$,"]/g, "").trim();
  if (!s) return 0;
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

function num(x, fallback = 0) {
  const n = Number(x);
  return Number.isFinite(n) ? n : fallback;
}

function pmtMonthly(principal, annualRatePct, termYears = 30) {
  const r = (annualRatePct / 100) / 12;
  const n = termYears * 12;
  if (principal <= 0) return 0;
  if (r <= 0) return principal / n;
  return principal * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
}

function pickRentByBedrooms(rentRow, bedrooms) {
  const b = num(bedrooms, 0);
  if (!rentRow) return 0;
  if (b <= 0) return rentRow.studio || 0;
  if (b === 1) return rentRow.one || 0;
  if (b === 2) return rentRow.two || 0;
  if (b === 3) return rentRow.three || 0;
  return rentRow.four || 0;
}

// Try to locate a column in a CSV row by checking multiple candidate header names
function getField(row, candidates) {
  for (const c of candidates) {
    if (row[c] !== undefined) return row[c];
  }
  return undefined;
}

// -------------------- CSV LOADERS --------------------
function loadSAFMR() {
  console.log("🔄 Loading SAFMR data...");
  const file = path.join(__dirname, "fy2024_safmrs.clean.csv");
  if (!fs.existsSync(file)) {
    console.log("⚠️ SAFMR CSV not found:", file);
    return Promise.resolve();
  }

  safmrByZip.clear();

  return new Promise((resolve, reject) => {
    fs.createReadStream(file)
      .pipe(csv())
      .on("data", (row) => {
        // Your header (confirmed):
        // "ZIP Code", "HUD Metro Fair Market Rent Area Name", "SAFMR 0BR", "SAFMR 1BR", ...
        const rawZip = getField(row, ["ZIP Code", "ZIP", "zip", "Zip"]);
        const zip = padZip(rawZip);
        if (!zip) return;

        const metro = getField(row, [
          "HUD Metro Fair Market Rent Area Name",
          "HUD Metro Area Name",
          "Metro",
          "metro"
        ]) || "";

        const studio = parseDollar(getField(row, ["SAFMR 0BR", "0BR", "SAFMR0BR"]));
        const one = parseDollar(getField(row, ["SAFMR 1BR", "1BR", "SAFMR1BR"]));
        const two = parseDollar(getField(row, ["SAFMR 2BR", "2BR", "SAFMR2BR"]));
        const three = parseDollar(getField(row, ["SAFMR 3BR", "3BR", "SAFMR3BR"]));
        const four = parseDollar(getField(row, ["SAFMR 4BR", "4BR", "SAFMR4BR"]));

        // Only store if we got at least one meaningful rent number
        if ((studio + one + two + three + four) <= 0) return;

        safmrByZip.set(zip, { studio, one, two, three, four, metro });
      })
      .on("end", () => {
        console.log("🏠 SAFMR loaded:", safmrByZip.size);
        resolve();
      })
      .on("error", (err) => reject(err));
  });
}

function loadFMRMetro() {
  console.log("🔄 Loading FMR Metro data...");
  const file = path.join(__dirname, "fy2024_fmr_metro.csv");
  if (!fs.existsSync(file)) {
    console.log("⚠️ FMR Metro CSV not found:", file);
    return Promise.resolve();
  }

  fmrMetroByZip.clear();

  return new Promise((resolve, reject) => {
    fs.createReadStream(file)
      .pipe(csv())
      .on("data", (row) => {
        // We don’t know your exact header row for this file,
        // so we search for likely column names.
        const rawZip = getField(row, ["ZIP", "Zip", "zip", "ZIP Code", "Zip Code"]);
        const zip = padZip(rawZip);
        if (!zip) return;

        // One of your example lines:
        // "Providence-Fall River, RI-MA HUD Metro FMR Area",...,02724,"$1,289","$1,398","$1,693","$2,047","$2,536"
        const metro = getField(row, [
          "HUD Metro Fair Market Rent Area Name",
          "HUD Metro Area Name",
          "metro",
          "Metro",
          "FMR Area Name",
          "Geography"
        ]) || "";

        // Bedroom columns might be labeled many ways; we try a bunch.
        const studio = parseDollar(getField(row, ["0BR", "FMR 0BR", "Studio", "EFF", "SAFMR 0BR"]));
        const one = parseDollar(getField(row, ["1BR", "FMR 1BR", "One-Bedroom", "SAFMR 1BR"]));
        const two = parseDollar(getField(row, ["2BR", "FMR 2BR", "Two-Bedroom", "SAFMR 2BR"]));
        const three = parseDollar(getField(row, ["3BR", "FMR 3BR", "Three-Bedroom", "SAFMR 3BR"]));
        const four = parseDollar(getField(row, ["4BR", "FMR 4BR", "Four-Bedroom", "SAFMR 4BR"]));

        // If the file is “wide” with numeric columns but unknown headers,
        // try to detect the last 5 columns as 0-4 BR (common HUD export pattern).
        if ((studio + one + two + three + four) <= 0) {
          const vals = Object.values(row).map(parseDollar).filter((v) => v > 0);
          // not reliable enough without headers; skip if no direct match
          return;
        }

        fmrMetroByZip.set(zip, { studio, one, two, three, four, metro });
      })
      .on("end", () => {
        console.log("🌆 FMR Metro loaded:", fmrMetroByZip.size);
        resolve();
      })
      .on("error", (err) => reject(err));
  });
}

async function loadAllData() {
  // Load SAFMR first; FMR Metro as fallback
  await loadSAFMR();
  await loadFMRMetro();
  console.log("✅ HUD data loaded.");
}

// -------------------- CORE ANALYSIS --------------------
function analyzeDeal(input) {
  const address = (input.address || "").trim();
  const zip = padZip(input.zip);
  const bedrooms = num(input.bedrooms, 0);

  if (!zip) {
    return { error: "ZIP is required", zip: input.zip };
  }

  const purchasePrice = num(input.purchasePrice, 0);
  const downPaymentPct = num(input.downPaymentPct, 0);
  const interestRate = num(input.interestRate, 0);
  const rehab = num(input.rehab, 0);

  // Rent lookup: SAFMR first, then FMR Metro
  const safmrRow = safmrByZip.get(zip);
  const fmrRow = fmrMetroByZip.get(zip);

  let rentRow = safmrRow || fmrRow || null;
  let source = safmrRow ? "HUD SAFMR 2024" : (fmrRow ? "HUD FMR 2024" : null);

  if (!rentRow) {
    return { error: "No HUD rent data found", zip };
  }

  const rent = pickRentByBedrooms(rentRow, bedrooms);
  if (!rent || rent <= 0) {
    return { error: "No HUD rent data found for that bedroom count", zip, bedrooms };
  }

  const metro = rentRow.metro || "";

  // ---------------- Rental math ----------------
  const annualRent = rent * 12;
  const annualExpenses = annualRent * DEFAULTS.expenseRatio;
  const annualNOI = annualRent - annualExpenses;

  // Financing
  const downPayment = purchasePrice > 0 ? (purchasePrice * (downPaymentPct / 100)) : 0;
  const loanAmount = Math.max(purchasePrice - downPayment, 0);
  const mortgage = (purchasePrice > 0 && interestRate > 0) ? Math.round(pmtMonthly(loanAmount, interestRate)) : 0;

  const monthlyNOI = annualNOI / 12;
  const monthlyCashFlow = Math.round(monthlyNOI - mortgage);

  const dscr = mortgage > 0 ? (monthlyNOI / mortgage) : 0;

  const totalCashIn = downPayment + rehab;
  const annualCashFlow = monthlyCashFlow * 12;
  const cashOnCashROI = totalCashIn > 0 ? (annualCashFlow / totalCashIn) : 0;

  // Cap rate needs a value. If user didn’t pass value, we can estimate “income value” using target cap.
  const estimatedValue = (purchasePrice > 0) ? purchasePrice : Math.round(annualNOI / DEFAULTS.targetCapRate);
  const capRate = estimatedValue > 0 ? (annualNOI / estimatedValue) : 0;

  // Verdict tiers (rental)
  let rentalVerdict = "Pass";
  if (monthlyCashFlow >= 500) rentalVerdict = "Excellent rental. Strong cash flow.";
  else if (monthlyCashFlow >= 150) rentalVerdict = "Good rental. Positive cash flow.";
  else if (monthlyCashFlow >= 0) rentalVerdict = "Thin deal. Barely positive.";
  else rentalVerdict = "Negative cash flow. Bad deal.";

  // ---------------- Flip math (70% rule) ----------------
  // ARV: if caller provides arv use it; else use income-derived approximation from NOI/cap (works as proxy only)
  const arv = num(input.arv, 0) > 0 ? num(input.arv, 0) : Math.round(annualNOI / DEFAULTS.targetCapRate);

  // Max allowable offer (MAO)
  const maxFlipOffer = Math.max(Math.round((arv * DEFAULTS.flipRulePct) - rehab), 0);

  // Simple flip profit estimate if buying at purchasePrice:
  // Profit = ARV - purchasePrice - rehab - sellCosts
  const sellCosts = Math.round(arv * DEFAULTS.sellCostPct);
  const flipProfit = Math.round(arv - purchasePrice - rehab - sellCosts);
  const flipROI = (purchasePrice + rehab) > 0 ? (flipProfit / (purchasePrice + rehab)) : 0;

  let flipVerdict = "Pass";
  if (purchasePrice > 0) {
    if (flipProfit >= 40000) flipVerdict = "Excellent flip";
    else if (flipProfit >= 20000) flipVerdict = "Good flip";
    else if (flipProfit >= 0) flipVerdict = "Thin flip";
    else flipVerdict = "Bad flip";
  }

  // ---------------- Wholesale math ----------------
  const wholesaleFee = num(input.wholesaleFee, DEFAULTS.wholesaleFeeDefault);
  const wholesalePrice = maxFlipOffer - wholesaleFee; // what you'd want to contract at to leave fee for assignment
  const wholesaleSpread = Math.round(maxFlipOffer - purchasePrice);

  let wholesaleVerdict = "Pass";
  if (purchasePrice > 0) {
    if (wholesaleSpread >= 25000) wholesaleVerdict = "Strong wholesale deal";
    else if (wholesaleSpread >= 10000) wholesaleVerdict = "Okay wholesale deal";
    else wholesaleVerdict = "Weak wholesale deal";
  }

  // ---------------- BRRRR math ----------------
  const allIn = purchasePrice + rehab;
  const refiLtv = num(input.refiLtv, DEFAULTS.refiLtv);
  const refinanceValue = Math.round(arv * refiLtv);
  const cashOut = Math.round(refinanceValue - allIn);

  const refiRate = interestRate > 0 ? (interestRate + DEFAULTS.refiRateBump) : 0;
  const refiMortgage = (refinanceValue > 0 && refiRate > 0) ? Math.round(pmtMonthly(refinanceValue, refiRate)) : 0;
  const brrrrDSCR = refiMortgage > 0 ? (monthlyNOI / refiMortgage) : 0;

  let brrrrVerdict = "Pass";
  if (allIn > 0) {
    if (cashOut >= -5000 && brrrrDSCR >= DEFAULTS.dscrMin) brrrrVerdict = "Solid BRRRR candidate";
    else if (cashOut >= -20000 && brrrrDSCR >= 1.05) brrrrVerdict = "Marginal BRRRR";
    else brrrrVerdict = "Not ideal for BRRRR";
  }

  // ---------------- Deal Score (0-100) + Best Strategy ----------------
  // Simple scoring heuristic: reward cash flow, DSCR, cap rate, flip profit, wholesale spread, BRRRR cash-out
  function clamp01(x) { return Math.max(0, Math.min(1, x)); }

  const scoreRental =
    clamp01((monthlyCashFlow + 200) / 800) * 35 +
    clamp01((dscr - 1.0) / 0.6) * 15 +
    clamp01((capRate - 0.05) / 0.08) * 10;

  const scoreFlip =
    clamp01((flipProfit) / 60000) * 30 +
    clamp01((flipROI) / 0.25) * 10;

  const scoreWholesale =
    clamp01((wholesaleSpread) / 30000) * 25;

  const scoreBRRRR =
    clamp01((cashOut + 20000) / 25000) * 20 +
    clamp01((brrrrDSCR - 1.0) / 0.5) * 10;

  const rawScore = scoreRental + scoreFlip + scoreWholesale + scoreBRRRR;
  const dealScore = Math.round(Math.max(0, Math.min(100, rawScore)));

  const strategies = [
    { name: "hold", score: scoreRental, pass: monthlyCashFlow > 0 && dscr >= 1.0 },
    { name: "flip", score: scoreFlip, pass: flipProfit > 0 && purchasePrice > 0 },
    { name: "wholesale", score: scoreWholesale, pass: wholesaleSpread > 0 && purchasePrice > 0 },
    { name: "brrrr", score: scoreBRRRR, pass: brrrrDSCR >= 1.0 && allIn > 0 }
  ].sort((a, b) => b.score - a.score);

  const best = strategies.find(s => s.pass) || strategies[0];

  // Investor-friendly summary
  const bestStrategy = best.name;

  return {
    address: address || undefined,
    zip,
    bedrooms,

    rent,
    metro,
    source,

    // Rental
    purchasePrice: purchasePrice || undefined,
    downPaymentPct: downPaymentPct || undefined,
    rehab: rehab || undefined,
    loanAmount: loanAmount || undefined,
    mortgage,
    monthlyCashFlow,

    annualRent,
    annualExpenses: Math.round(annualExpenses),
    annualNOI: Math.round(annualNOI),
    capRatePct: Number((capRate * 100).toFixed(2)),
    cashOnCashROIPct: Number((cashOnCashROI * 100).toFixed(2)),
    dscr: Number(dscr.toFixed(2)),
    rentalVerdict,
    rentalStrategy: monthlyCashFlow > 0 ? "hold" : "pass",

    // Flip
    arv,
    maxFlipOffer,
    sellCosts,
    flipProfit,
    flipROIPct: Number((flipROI * 100).toFixed(2)),
    flipVerdict,

    // Wholesale
    wholesaleFee,
    wholesalePrice,
    wholesaleSpread,
    wholesaleVerdict,

    // BRRRR
    allIn,
    refinanceValue,
    cashOut,
    refiRatePct: refiRate,
    refiMortgage,
    brrrrDSCR: Number(brrrrDSCR.toFixed(2)),
    brrrrVerdict,

    // Decision
    dealScore,
    bestStrategy
  };
}

// -------------------- ROUTES --------------------
app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    safmrLoaded: safmrByZip.size,
    fmrMetroLoaded: fmrMetroByZip.size
  });
});

app.post("/api/analyze", (req, res) => {
  try {
    const result = analyzeDeal(req.body || {});
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: "Server error", details: String(e) });
  }
});

// -------------------- STARTUP --------------------
async function start() {
  try {
    await loadAllData();
    const server = app.listen(PORT, () => {
      console.log(`🚀 ALEX running at http://localhost:${PORT}`);
    });

    // prevent crash on EADDRINUSE & show readable message
    server.on("error", (err) => {
      if (err && err.code === "EADDRINUSE") {
        console.error(`❌ Port ${PORT} already in use. Run: pkill node || true`);
        process.exit(1);
      } else {
        console.error("❌ Server error:", err);
        process.exit(1);
      }
    });
  } catch (err) {
    console.error("❌ Startup failed:", err);
    process.exit(1);
  }
}

start();