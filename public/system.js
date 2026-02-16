async function analyzeDeal() {
  const address = document.getElementById("address").value.trim();
  const interestRate = parseFloat(document.getElementById("rate").value);

  const resultsDiv = document.getElementById("results");
  resultsDiv.innerHTML = "";

  if (!address || isNaN(interestRate)) {
    resultsDiv.innerHTML = "<p style='color:red;'>Please enter address and interest rate.</p>";
    return;
  }

  try {
    const res = await fetch("/api/deal-grade", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address, interestRate })
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Server error");
    }

    const data = await res.json();

    renderResults(data);

  } catch (err) {
    resultsDiv.innerHTML = `<p style="color:red;">${err.message}</p>`;
  }
}

function renderResults(data) {
  const resultsDiv = document.getElementById("results");

  resultsDiv.innerHTML = `
    <hr>
    <h3>Address:</h3> ${data.address}
    <h3>ZIP:</h3> ${data.zip}
    <h3>Bedrooms:</h3> ${data.bedrooms}
    <h3>HUD Rent:</h3> $${data.hudRent.toLocaleString()}
    <h3>ARV:</h3> $${data.arv.toLocaleString()}

    <hr>

    <h3>Annual Rent:</h3> $${data.dealMetrics.annualRent.toLocaleString()}
    <h3>Annual Expenses:</h3> $${data.dealMetrics.annualExpenses.toLocaleString()}
    <h3>NOI:</h3> $${data.dealMetrics.annualNOI.toLocaleString()}
    <h3>Mortgage:</h3> $${data.dealMetrics.mortgage.toLocaleString()}
    <h3>Annual Cash Flow:</h3> $${data.dealMetrics.annualCashFlow.toLocaleString()}
    <h3>Cap Rate:</h3> ${data.dealMetrics.capRatePct}%
    <h3>DSCR:</h3> ${data.dealMetrics.dscr}

    <h2 style="margin-top:20px;">Deal Grade: ${data.dealScore}</h2>
  `;
}