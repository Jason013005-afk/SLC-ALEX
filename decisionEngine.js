function analyzeDeal({
  rent,
  purchasePrice,
  rehab = 0,
  downPaymentPct = 20,
  interestRate,
  estimatedValue
}) {
  const downPayment = purchasePrice * (downPaymentPct / 100);
  const loanAmount = purchasePrice - downPayment;

  const monthlyRate = interestRate / 100 / 12;
  const payments = 30 * 12;

  const mortgage =
    loanAmount *
    (monthlyRate * Math.pow(1 + monthlyRate, payments)) /
    (Math.pow(1 + monthlyRate, payments) - 1);

  const monthlyCashFlow = rent - mortgage;

  // ===== FLIP MATH =====
  const arv = estimatedValue;
  const flipProfit = arv - purchasePrice - rehab - (arv * 0.08); // 8% costs
  const wholesaleSpread = arv * 0.7 - rehab - purchasePrice;

  let strategy = "pass";
  let verdict = "Bad deal.";

  if (flipProfit > 40000) {
    strategy = "flip";
    verdict = "Excellent flip opportunity.";
  } else if (wholesaleSpread > 20000) {
    strategy = "wholesale";
    verdict = "Strong wholesale spread.";
  } else if (monthlyCashFlow > 300) {
    strategy = "hold";
    verdict = "Strong rental. Buy and hold.";
  } else if (monthlyCashFlow > 0) {
    strategy = "hold";
    verdict = "Marginal rental. Proceed carefully.";
  }

  return {
    mortgage: Math.round(mortgage),
    monthlyCashFlow: Math.round(monthlyCashFlow),
    estimatedValue: Math.round(arv),
    flipProfit: Math.round(flipProfit),
    wholesaleSpread: Math.round(wholesaleSpread),
    strategy,
    verdict
  };
}

module.exports = { analyzeDeal };