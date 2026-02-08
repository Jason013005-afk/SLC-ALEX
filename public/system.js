async function analyze() {
  const payload = {
    address: document.getElementById("address").value,
    zip: document.getElementById("zip").value,
    bedrooms: Number(document.getElementById("bedrooms").value),
    purchasePrice: Number(document.getElementById("price").value),
    interestRate: Number(document.getElementById("rate").value),
    downPaymentPct: Number(document.getElementById("down").value),
  };

  const res = await fetch("/api/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = await res.json();
  document.getElementById("output").textContent =
    JSON.stringify(data, null, 2);
}