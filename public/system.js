document.querySelector("button").addEventListener("click", async () => {
  const address = document.querySelectorAll("input")[0].value;
  const interestRate = parseFloat(document.querySelectorAll("input")[1].value);

  const response = await fetch("/api/deal-grade", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      address,
      interestRate,
      downPaymentPct: 20,
      purchasePrice: 250000,
      rehab: 20000
    })
  });

  const data = await response.json();

  document.querySelector("#results").innerHTML = `
    <h3>Deal Score: ${data.dealScore}</h3>
    <p>ARV: $${data.arv}</p>
    <p>Monthly Rent: $${data.hudRent}</p>
    <p>Annual NOI: $${data.dealMetrics.annualNOI}</p>
    <p>Cash Flow: $${data.dealMetrics.annualCashFlow}</p>
    <p>Cap Rate: ${data.dealMetrics.capRatePct}%</p>
    <p>DSCR: ${data.dealMetrics.dscr}</p>
  `;
});