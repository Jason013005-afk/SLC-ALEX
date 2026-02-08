module.exports = function decisionEngine({
  rent,
  mortgage,
  purchasePrice,
  rehab,
}) {
  const cashFlow = rent - mortgage;
  const totalCost = purchasePrice + rehab;

  if (cashFlow >= 400) {
    return {
      strategy: "hold",
      verdict: "Strong rental. Buy and hold.",
    };
  }

  if (cashFlow >= 0) {
    return {
      strategy: "borderline",
      verdict: "Break-even. Only proceed with appreciation upside.",
    };
  }

  if (totalCost < purchasePrice * 0.7) {
    return {
      strategy: "flip",
      verdict: "Discounted enough to consider a flip.",
    };
  }

  return {
    strategy: "pass",
    verdict: "Bad deal. Walk away.",
  };
};