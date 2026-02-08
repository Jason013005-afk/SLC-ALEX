// decisionEngine.js

module.exports = function decisionEngine(input) {
  const {
    rent,
    monthlyCashFlow,
    purchasePrice,
    rehab = 0,
  } = input;

  // ---- thresholds (you can tune later) ----
  const EXCELLENT_CASHFLOW = 500;
  const GOOD_CASHFLOW = 200;
  const WHOLESALE_SPREAD = 25000;
  const FLIP_PROFIT = 40000;

  // ---- simple derived values ----
  const arvEstimate = purchasePrice * 1.25; // conservative placeholder
  const flipProfit = arvEstimate - purchasePrice - rehab;
  const wholesaleSpread = arvEstimate - purchasePrice;

  let strategy = "pass";
  let verdict = "Does not meet investment thresholds.";

  if (monthlyCashFlow >= EXCELLENT_CASHFLOW) {
    strategy = "hold";
    verdict = "Excellent rental. Strong cash flow. Buy and hold.";
  } else if (monthlyCashFlow >= GOOD_CASHFLOW) {
    strategy = "hold";
    verdict = "Solid rental. Cash flow positive. Buy and hold.";
  } else if (flipProfit >= FLIP_PROFIT) {
    strategy = "flip";
    verdict = "Strong flip opportunity. Profit exceeds threshold.";
  } else if (wholesaleSpread >= WHOLESALE_SPREAD) {
    strategy = "wholesale";
    verdict = "Wholesale deal. Assignment spread is viable.";
  }

  return {
    strategy,
    verdict,
    flipProfit,
    wholesaleSpread,
  };
};