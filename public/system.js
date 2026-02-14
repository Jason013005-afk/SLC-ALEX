async function analyzeDeal() {
  const address = document.getElementById("address").value;
  const interestRate = parseFloat(document.getElementById("rate").value);

  const resultsDiv = document.getElementById("results");
  resultsDiv.innerHTML = "Analyzing...";

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

    if (!response.ok) {
      throw new Error(data.error || "System Error");
    }

    resultsDiv.innerHTML = `
      <h3>Deal Results</h3>
      <p><strong>ARV:</strong> $${data.arv?.toLocaleString()}</p>
      <p><strong>HUD Rent:</strong> $${data.hudRent}</p>
      <p><strong>Monthly Mortgage:</strong> $${data.dealMetrics?.mortgage}</p>
      <p><strong>Annual Cash Flow:</strong> $${data.dealMetrics?.annualCashFlow}</p>
      <p><strong>Cap Rate:</strong> ${data.dealMetrics?.capRatePct}%</p>
      <p><strong>DSCR:</strong> ${data.dealMetrics?.dscr}</p>
      <p><strong>Deal Score:</strong> ${data.dealScore}</p>
    `;

  } catch (err) {
    resultsDiv.innerHTML = `<span style="color:red;">${err.message}</span>`;
  }
}