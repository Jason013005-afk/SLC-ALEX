function calculateMortgage(purchasePrice, downPaymentPct, interestRate) {
  const loanAmount = purchasePrice * (1 - downPaymentPct / 100);
  const monthlyRate = interestRate / 100 / 12;
  const termMonths = 30 * 12;

  const mortgage =
    (loanAmount *
      monthlyRate *
      Math.pow(1 + monthlyRate, termMonths)) /
    (Math.pow(1 + monthlyRate, termMonths) - 1);

  return Math.round(mortgage);
}

function analyzeDeal(input) {
  const {
    rent,
    purchasePrice,
    rehab = 0,
    interestRate,
    downPaymentPct
  } = input;

  const mortgage = calculateMortgage(
    purchasePrice,
    downPaymentPct,
    interestRate
  );

  const monthlyCashFlow = Math.round(rent - mortgage);

  // Rental strategy
  let rentalStrategy = "pass";
  if (monthlyCashFlow > 500) rentalStrategy = "excellent";
  else if (monthlyCashFlow > 200) rentalStrategy = "hold";
  else if (monthlyCashFlow > 0) rentalStrategy = "break-even";

  // ARV placeholder (we improve later)
  const arv = rent * 100;

  // 70% rule
  const mao = Math.round(arv * 0.7 - rehab);
  const flipProfit = Math.round(arv - purchasePrice - rehab);

  let flipWorks = purchasePrice <= mao;

  // Final decision logic
  let strategy = "pass";
  let verdict = "Bad deal.";

  if (flipWorks && flipProfit > 30000) {
    strategy = "flip";
    verdict = "Strong flip opportunity.";
  } else if (monthlyCashFlow > 200) {
    strategy = "hold";
    verdict = "Strong rental. Buy and hold.";
  } else if (monthlyCashFlow > 0) {
    strategy = "hold";
    verdict = "Marginal rental. Tight margins.";
  } else {
    strategy = "pass";
    verdict = "Negative cash flow. Bad deal.";
  }

  return {
    mortgage,
    monthlyCashFlow,
    estimatedValue: arv,
    mao,
    flipProfit,
    strategy,
    verdict
  };
}

module.exports = { analyzeDeal };