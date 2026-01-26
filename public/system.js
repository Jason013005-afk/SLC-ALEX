function runStressTest() {
  const address = document.getElementById("address").value;
  const rate = Number(document.getElementById("rate").value) / 100;

  // === INTERNAL MODEL ASSUMPTIONS (LOCKED) ===
  const estimatedValue = 450000;
  const ltv = 0.8;
  const expenseRatio = 0.25;
  const capRate = 0.06;
  const marketRent = 2800;
  const sellingCosts = 0.08;

  const loanAmount = estimatedValue * ltv;
  const annualDebt = loanAmount * rate;
  const monthlyDebt = annualDebt / 12;

  const noi = marketRent * 12 * (1 - expenseRatio);
  const monthlyCashFlow = (noi / 12) - monthlyDebt;
  const annualCashFlow = monthlyCashFlow * 12;

  const equityPct = ((estimatedValue - loanAmount) / estimatedValue) * 100;
  const breakEvenRent = monthlyDebt / (1 - expenseRatio);

  const rateShockTolerance = (noi / loanAmount) * 100;
  const confidence = Math.max(0, Math.min(100, rateShockTolerance * 10));

  const recommendation =
    monthlyCashFlow > 0 && confidence > 60 ? "Buy" :
    monthlyCashFlow > 0 ? "Hold" : "Avoid";

  document.getElementById("results").innerHTML = `
    <strong>Property:</strong> ${address}<br>
    <strong>Estimated Value:</strong> $${estimatedValue.toLocaleString()}<br>
    <strong>Loan Amount:</strong> $${loanAmount.toLocaleString()}<br>
    <strong>Monthly Rent (Modeled):</strong> $${marketRent}<br>
    <strong>Monthly Debt:</strong> $${monthlyDebt.toFixed(0)}<br>
    <strong>Monthly Cash Flow:</strong> $${monthlyCashFlow.toFixed(0)}<br>
    <strong>Annual Cash Flow:</strong> $${annualCashFlow.toFixed(0)}<br>
    <strong>Equity:</strong> ${equityPct.toFixed(1)}%<br>
    <strong>Break-even Rent:</strong> $${breakEvenRent.toFixed(0)}<br>
    <strong>Rate Shock Tolerance:</strong> ${rateShockTolerance.toFixed(2)}%<br>
    <strong>Recommended Strategy:</strong> ${recommendation}<br>
    <strong>Confidence:</strong> ${confidence.toFixed(0)}%
  `;

  buildSensitivity({
    noi,
    loanAmount,
    annualCashFlow,
    sellingCosts
  });
}

function buildSensitivity(base) {
  const caps = [0.055, 0.06, 0.065];
  const holds = [3, 5, 7];

  let html = "";

  holds.forEach(years => {
    html += `<tr><td>${years} yrs</td>`;
    caps.forEach(cap => {
      const salePrice = base.noi / cap;
      const netSale = salePrice * (1 - base.sellingCosts);

      const cashFlows = [-base.loanAmount * 0.2];
      for (let i = 1; i <= years; i++) {
        cashFlows.push(base.annualCashFlow);
      }
      cashFlows[cashFlows.length - 1] += netSale;

      html += `<td>${(calcIRR(cashFlows) * 100).toFixed(1)}%</td>`;
    });
    html += "</tr>";
  });

  document.getElementById("sensitivityTable").innerHTML = html;
}

function calcIRR(values) {
  let rate = 0.1;
  for (let i = 0; i < 1000; i++) {
    let npv = 0, dnpv = 0;
    for (let t = 0; t < values.length; t++) {
      npv += values[t] / Math.pow(1 + rate, t);
      dnpv -= t * values[t] / Math.pow(1 + rate, t + 1);
    }
    rate -= npv / dnpv;
  }
  return rate;
}
