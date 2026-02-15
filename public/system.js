async function analyze() {
  const address = document.getElementById("address").value;
  const interestRate = Number(document.getElementById("rate").value);

  const res = await fetch("/api/deal-grade", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ address, interestRate })
  });

  const data = await res.json();
  document.getElementById("output").textContent =
    JSON.stringify(data, null, 2);
}