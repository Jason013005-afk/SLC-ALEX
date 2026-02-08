module.exports = function decisionEngine({
  rent,
  mortgage,
  monthlyCashFlow,
  purchasePrice,
  rehab = 0,
}) {
  // Simple, deterministic rules (no guessing)

  if (monthlyCashFlow >= 300) {
    return {
      strategy: "hold",
      verdict: "Strong rental. Buy and hold.",
    };
  }

  if (monthlyCashFlow >= 0) {
    return {
      strategy: "hold",
      verdict: "Break-even rental. Proceed cautiously.",
    };
  }

  return {
    strategy: "pass",
    verdict: "Negative cash flow. Bad deal.",
  };
};