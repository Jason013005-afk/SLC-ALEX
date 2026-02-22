// public/system.js
document.addEventListener("DOMContentLoaded", () => {
  const analyzeBtn = document.getElementById("analyzeBtn");
  const resultsBox = document.getElementById("results");

  analyzeBtn.addEventListener("click", async () => {
    resultsBox.innerHTML = "";

    const zipInput = document.getElementById("zip").value.trim();

    // Frontend expects ZIP exactly as in your dataset
    if (!zipInput) {
      resultsBox.innerHTML = "<p style='color:red;'>Enter a ZIP code</p>";
      return;
    }

    resultsBox.innerHTML = "<p>Analyzing…</p>";

    try {
      const response = await fetch(`/api/analyze?zip=${encodeURIComponent(zipInput)}`);

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        resultsBox.innerHTML = `<p style="color:red;">${err.error || "Analysis failed"}</p>`;
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
      resultsBox.innerHTML = "<p style='color:red;'>Server error</p>";
    }
  });
});