async function run() {
  const res = await fetch("/api/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      address: document.getElementById("address").value,
      zip: document.getElementById("zip").value,
      bedrooms: 3,
      interestRate: Number(document.getElementById("rate").value),
      purchasePrice: Number(document.getElementById("price").value),
      downPaymentPct: 20
    })
  });

  const data = await res.json();
  document.getElementById("output").textContent =
    JSON.stringify(data, null, 2);
}