async function runTest() {
  const address = document.getElementById("address").value;
  const rate = document.getElementById("rate").value;
  const results = document.getElementById("results");

  results.classList.remove("hidden");
  results.innerHTML = "Running analysis…";

  const res = await fetch("/api/stress-test", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ address, rate })
  });

  const d = await res.json();

  results.innerHTML = `
    <div class="result-grid">
      <div><strong>Address</strong><br>${d.address}</div>
      <div><strong>Estimated Value</strong><br>$${d.estimatedValue}</div>
      <div><strong>Interest Rate</strong><br>${d.rate}%</div>
      <div><strong>Cash Flow</strong><br>$${d.cashFlow}</div>
      <div><strong>DSCR</strong><br>${d.dscr}</div>
    </div>
    <div class="risk ${d.risk.toLowerCase()}">Risk Level: ${d.risk}</div>
  `;
}