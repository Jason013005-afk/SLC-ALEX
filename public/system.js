// public/system.js
document.addEventListener("DOMContentLoaded", () => {
  const analyzeBtn = document.getElementById("analyzeBtn");
  const resultsBox = document.getElementById("results");

  analyzeBtn.addEventListener("click", async () => {
    resultsBox.innerHTML = "";

    const zip = document.getElementById("zip").value.trim();
    const address = document.getElementById("address").value.trim();
    const rate = document.getElementById("rate").value.trim();

    if (!zip || !address || !rate) {
      resultsBox.innerHTML = "<p style='color:red;'>Fill in all fields</p>";
      return;
    }

    resultsBox.innerHTML = "<p>Analyzing…</p>";

    try {
      // Actually POST to the correct running backend
      const response = await fetch("http://localhost:8080/api/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ zip, address, rate: parseFloat(rate) })
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        resultsBox.innerHTML = `<p style="color:red;">${errJson.error || "Analysis failed"}</p>`;
        return;
      }

      const data = await response.json();

      resultsBox.innerHTML = `
        <div class="results-card">
          <h3>Analysis Results</h3>
          <p><strong>Area:</strong> ${data.area || "n/a"}</p>
          <p><strong>Studio:</strong> ${data.studio || "n/a"}</p>
          <p><strong>1BR:</strong> ${data.one || "n/a"}</p>
          <p><strong>2BR:</strong> ${data.two || "n/a"}</p>
          <p><strong>3BR:</strong> ${data.three || "n/a"}</p>
          <p><strong>4BR:</strong> ${data.four || "n/a"}</p>
        </div>
      `;
    } catch (err) {
      console.error(err);
      resultsBox.innerHTML = "<p style='color:red;'>Server error — check backend</p>";
    }
  });
});