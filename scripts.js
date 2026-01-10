document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("stressForm");
  const resultBox = document.getElementById("result");

  form?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const address = document.getElementById("address").value.trim();
    const rate = parseFloat(document.getElementById("rate").value.trim());

    if (!address || isNaN(rate)) {
      resultBox.innerHTML = `<p style="color:red;">Please enter valid details.</p>`;
      return;
    }

    resultBox.innerHTML = `<p style="color:yellow;">Processing...</p>`;

    try {
      const response = await fetch(`http://localhost:4000/api/property?address=${encodeURIComponent(address)}&rate=${rate}`);
      if (!response.ok) throw new Error("Server error");

      const data = await response.json();

      resultBox.innerHTML = `
        <h3>Stress Test Result</h3>
        <p><strong>Address:</strong> ${data.address}</p>
        <p><strong>Estimated Value:</strong> $${data.estimatedValue.toLocaleString()}</p>
        <p><strong>Taxes:</strong> $${data.taxes.toLocaleString()}</p>
        <p><strong>Beds/Baths:</strong> ${data.beds}/${data.baths}</p>
        <p><strong>Recommendation:</strong> ${data.recommendation}</p>
        <hr>
        <p><strong>Interest Rate:</strong> ${rate}%</p>
        <p><strong>Risk Level:</strong> ${data.risk}</p>
      `;
    } catch (err) {
      console.error(err);
      resultBox.innerHTML = `<p style="color:red;">Error: Failed to fetch data. Check backend connection.</p>`;
    }
  });
});
