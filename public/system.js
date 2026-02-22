// system.js

document.addEventListener("DOMContentLoaded", () => {
  const analyzeBtn = document.getElementById("analyzeBtn");
  const resultsBox = document.getElementById("results");

  analyzeBtn.addEventListener("click", async () => {
    resultsBox.innerHTML = "";
    const zip = document.getElementById("zip").value.trim();
    const address = document.getElementById("address").value.trim();
    const rate = document.getElementById("rate").value.trim();

    if (!zip || !address || !rate) {
      resultsBox.innerHTML = "<p style='color:red;'>All fields required</p>";
      return;
    }

    resultsBox.innerHTML = "<p>Loading…</p>";

    try {
      // Adjust this to your actual API endpoint
      const response = await fetch(`http://localhost:8000/api/analyze?zip=${zip}&address=${encodeURIComponent(address)}&rate=${rate}`);

      if (!response.ok) {
        const err = await response.json();
        resultsBox.innerHTML = `<p style="color:red;">${err.error || "Analysis failed"}</p>`;
        return;
      }

      const data = await response.json();

      resultsBox.innerHTML = `
        <div class="results-card">
          <h3>HUD SAFMR Data</h3>
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
      resultsBox.innerHTML = "<p style='color:red;'>Server error</p>";
    }
  });
});