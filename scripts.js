// ======================================
// ALEX™ Real Estate Stress Test - Frontend
// ======================================

const backendUrl = "http://127.0.0.1:4000/api/stress";

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("stressForm");
  const resultsBox = document.getElementById("results");

  if (!form) {
    console.error("❌ stressForm not found in DOM");
    return;
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const address = document.getElementById("address").value.trim();
    const rate = parseFloat(document.getElementById("rate").value);

    if (!address || isNaN(rate)) {
      resultsBox.innerHTML = `<p style="color:red;">Please enter both a valid address and interest rate.</p>`;
      return;
    }

    resultsBox.innerHTML = `<p>⏳ Running intelligent stress analysis...</p>`;

    try {
      const response = await fetch(backendUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address, rate }),
      });

      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }

      const data = await response.json();

      if (data.error) {
        resultsBox.innerHTML = `<p style="color:red;">${data.error}</p>`;
        return;
      }

      // Generate derived metrics
      const estimatedValue = Number(data.estimatedValue) || 0;
      const estimatedRent = Number(data.estimatedRent) || 0;
      const arv = estimatedValue * 1.05;
      const flipPrice = estimatedValue * 0.85;
      const wholesalePrice = estimatedValue * 0.70;

      // Render results cleanly
      resultsBox.innerHTML = `
        <h3>Results</h3>
        <p><strong>Address:</strong> ${data.address}</p>
        <p><strong>Estimated Value:</strong> $${estimatedValue.toLocaleString()}</p>
        <p><strong>After Repair Value (ARV):</strong> $${arv.toLocaleString()}</p>
        <p><strong>Wholesale Price (70% Rule):</strong> $${wholesalePrice.toLocaleString()}</p>
        <p><strong>Best Flip Purchase Price (85%):</strong> $${flipPrice.toLocaleString()}</p>
        <p><strong>Rent Estimate:</strong> $${estimatedRent.toLocaleString()}</p>
        <p><strong>Risk Score:</strong> ${data.riskScore}</p>
        <p><em>${data.message}</em></p>
      `;

    } catch (err) {
      console.error("Error:", err);
      resultsBox.innerHTML = `<p style="color:red;">⚠️ Error: ${err.message}</p>`;
    }
  });
});
