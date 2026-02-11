function estimateValueFromRent(monthlyRent, capRate = 0.07) {
  if (!monthlyRent) return null;
  return Math.round((monthlyRent * 12) / capRate);
}

function analyzeDeal({
  rent,
  purchasePrice,
  rehab = 0,
  interestRate,
  downPaymentPct
}) {

  const estimatedValue = estimateValueFromRent(rent);

  let mortgage = null;
  let monthlyCashFlow = null;

  if (purchasePrice && interestRate && downPaymentPct !== undefined) {
    const loanAmount = purchasePrice * (1 - downPaymentPct / 100);
    const monthlyRate = interestRate / 100 / 12;
    const termMonths = 30 * 12;

    mortgage = Math.round(
      loanAmount *
        (monthlyRate * Math.pow(1 + monthlyRate, termMonths)) /
        (Math.pow(1 + monthlyRate, termMonths) - 1)
    );

    monthlyCashFlow = Math.round(rent - mortgage);
  }

  // Strategy logic
  let strategy = "pass";
  let verdict = "Deal unclear.";

  if (estimatedValue && purchasePrice) {
    const discount = estimatedValue - (purchasePrice + rehab);

    if (discount > 50000) {
      strategy = "flip";
      verdict = "Excellent flip opportunity.";
    } else if (monthlyCashFlow && monthlyCashFlow > 300) {
      strategy = "hold";
      verdict = "Strong rental. Buy and hold.";
    } else if (monthlyCashFlow && monthlyCashFlow > 0) {
      strategy = "hold";
      verdict = "Rental works. Thin margin.";
    } else {
      strategy = "pass";
      verdict = "Negative cash flow. Bad deal.";
    }
  }

  return {
    estimatedValue,
    mortgage,
    monthlyCashFlow,
    strategy,
    verdict
  };
}

module.exports = { analyzeDeal };