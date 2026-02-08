// decisionEngine.js

module.exports = function decisionEngine(input) {
  const {
    rent,
    mortgage,
    monthlyCashFlow,
    purchasePrice,
    rehab = 0
  } = input;

  // Default
  let strategy = "hold";
  let verdict = "Neutral.";

  // Rental logic
  if (monthlyCashFlow != null) {
    if (monthlyCashFlow > 300) {
      strategy = "hold";
      verdict = "Strong rental. Buy and hold.";
    } else if (monthlyCashFlow > 0) {
      strategy = "hold";
      verdict = "Marginal rental. Proceed cautiously.";
    } else {
      strategy = "pass";
      verdict = "Does not cash flow.";
    }
  }

  // Flip logic (simple ARV heuristic for now)
  if (purchasePrice && rehab) {
    const arvEstimate = purchasePrice * 1.25;
    const profit = arvEstimate - purchasePrice - rehab;

    if (profit > 50000) {
      strategy = "flip";
      verdict = "Strong flip spread.";
    }
  }

  return { strategy, verdict };
};