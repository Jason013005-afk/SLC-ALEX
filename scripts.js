console.log("✅ ALEX frontend loaded successfully");

// Backend API endpoint
const backendUrl = "http://localhost:4000/api/stress";
console.log("Using backend:", backendUrl);

document.addEventListener("DOMContentLoaded", () => {
  const form = document.querySelector("form");
  const addressInput = document.getElementById("propertyAddress");
  const rateInput = document.getElementById("interestRate");
  const runButton = document.getElementById("runButton");
  const resultBox = document.getElementById("results");

  if (!form || !addressInput || !rateInput || !runButton || !resultBox) {
    console.error("❌ Missing elements in system.html — check IDs.");
    return;
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const address = addressInput.value.trim();
    const rate = parseFloat(rateInput.value.trim());

    if (!address || isNaN(rate)) {
      alert("Please enter a valid address and interest rate.");
      return;
    }

    runButton.disabled = true;
    runButton.textContent = "Running...";
    resultBox.innerHTML = "<p>Running analysis...</p>";

    try {
      const res = await fetch(backendUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address, rate }),
      });

      if (!res.ok) throw new Error(`Backend returned ${res.status}`);

      const data = await res.json();
      console.log("✅ Got response from backend:", data);

      resultBox.innerHTML = `
        <h3>Results</h3>
        <p><strong>Address:</strong> ${data.address || address}</p>
        <p><strong>Estimated Value:</strong> $${data.estimatedValue?.toLocaleString() || "N/A"}</p>
        <p><strong>Rent Estimate:</strong> $${data.estimatedRent?.toLocaleString() || "N/A"}</p>
        <p><strong>Risk Score:</strong> ${data.riskScore || "N/A"}</p>
      `;
    } catch (err) {
      console.error("❌ Error:", err);
      resultBox.innerHTML = `<p style="color:red;">Error: ${err.message}</p>`;
    } finally {
      runButton.disabled = false;
      runButton.textContent = "Run Stress Test";
    }
  });
});