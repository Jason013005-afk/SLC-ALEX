document.getElementById("dealForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const address = document.getElementById("address").value;
  const interestRate = parseFloat(document.getElementById("rate").value);

  const resultsDiv = document.getElementById("results");
  resultsDiv.innerHTML = "Analyzing deal...";

  try {
    const response = await fetch("/api/deal-grade", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        address: address,
        zip: "02724",            // temporary hardcode (we can auto-detect later)
        bedrooms: 3,             // temporary default
        purchasePrice: 250000,   // default test value
        downPaymentPct: 20,
        interestRate: interestRate,
        rehab: 20000
      })
    });

    const data = await response.json();

    if (data.error) {
      resultsDiv.innerHTML = "Error: " + data.error;
      return;
    }

    resultsDiv.innerHTML = `
      <h3>Deal Results</h3>
      <p><strong>Rent:</strong> $${data.hudRent}</p>
      <p><strong>Annual NOI:</strong> $${data.dealMetrics.annualNOI}</p>
      <p><strong>Cash Flow:</strong> $${data.dealMetrics.annualCashFlow}</p>
      <p><strong>Cap Rate:</strong> ${data.dealMetrics.capRatePct}%</p>
      <p><strong>DSCR:</strong> ${data.dealMetrics.dscr}</p>
      <p><strong>Deal Score:</strong> ${data.dealScore}</p>
    `;

  } catch (err) {
    console.error(err);
    resultsDiv.innerHTML = "System Error";
  }
});