async function analyzeDeal() {
  const address = document.getElementById("address").value;
  const interestRate = parseFloat(document.getElementById("interestRate").value);

  const resultDiv = document.getElementById("results");
  resultDiv.innerHTML = "Analyzing...";

  try {
    const response = await fetch("/api/deal-grade", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        address,
        interestRate
      })
    });

    const data = await response.json();

    if (data.error) {
      resultDiv.innerHTML = `<div style="color:red;">Error: ${data.error}</div>`;
      return;
    }

    resultDiv.innerHTML = `
      <h3>Deal Results</h3>
      <p><strong>Address:</strong> ${data.propertyDetails.formattedAddress}</p>
      <p><strong>ZIP:</strong> ${data.zip}</p>
      <p><strong>Bedrooms:</strong> ${data.bedrooms}</p>
      <p><strong>HUD Rent:</strong> $${data.hudRent}</p>
      <p><strong>ARV:</strong> $${data.arv.toLocaleString()}</p>

      <h4>Financial Metrics</h4>
      <p>Annual Rent: $${data.dealMetrics.annualRent.toLocaleString()}</p>
      <p>Annual NOI: $${data.dealMetrics.annualNOI.toLocaleString()}</p>
      <p>Annual Cash Flow: $${data.dealMetrics.annualCashFlow.toLocaleString()}</p>
      <p>Cap Rate: ${data.dealMetrics.capRatePct}%</p>
      <p>DSCR: ${data.dealMetrics.dscr}</p>

      <h3>Deal Score: ${data.dealScore}</h3>
    `;
  } catch (err) {
    resultDiv.innerHTML = `<div style="color:red;">System Error</div>`;
  }
}