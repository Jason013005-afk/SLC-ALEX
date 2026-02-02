async function analyze() {
  const zip = document.getElementById("zip").value.trim();
  const rate = Number(document.getElementById("rate").value);

  if (!zip || !rate) {
    alert("Enter ZIP and interest rate");
    return;
  }

  const res = await fetch("/api/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ zip, interestRate: rate })
  });

  const data = await res.json();

  const table = document.getElementById("results");
  const body = table.querySelector("tbody");
  body.innerHTML = "";

  data.results.forEach(r => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${r.unit}</td>
      <td>$${r.rent}</td>
      <td>$${r.p90}</td>
      <td>$${r.p100}</td>
      <td>$${r.p110}</td>
      <td>${r.source}</td>
    `;
    body.appendChild(tr);
  });

  table.hidden = false;
}