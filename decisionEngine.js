// decisionEngine.js

export function decideDeal({
  purchasePrice,
  rehab = 0,
  value,
  monthlyCashFlow,
  wholesaleFeeTarget = 15000,
  flipProfitTarget = 30000
}) {
  const flipProfit = value - purchasePrice - rehab;

  if (flipProfit >= flipProfitTarget) {
    return {
      strategy: "flip",
      reason: `Flip profit ${flipProfit.toLocaleString()} exceeds target`
    };
  }

  if (purchasePrice + wholesaleFeeTarget < value) {
    return {
      strategy: "wholesale",
      reason: "Enough spread for assignment"
    };
  }

  if (monthlyCashFlow > 0) {
    return {
      strategy: "hold",
      reason: "Positive cash flow"
    };
  }

  return {
    strategy: "pass",
    reason: "No viable exit"
  };
}