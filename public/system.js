// public/system.js
document.addEventListener("DOMContentLoaded", () => {
  const analyzeBtn = document.getElementById("analyzeBtn");
  const resultsBox = document.getElementById("results");

  analyzeBtn.addEventListener("click", async () => {
    // Clear old results
    resultsBox.innerHTML = "";

    const zip = document.getElementById("zip").value.trim();
    if (!zip) {
      resultsBox.innerHTML = "<p style='color:red;'>ZIP is required</p>";
      return;
    }

    resultsBox.innerHTML = "<p>Analyzing…</p>";

    try {
      const response = await fetch(
        `/api/analyze?zip=${encodeURIComponent(zip)}`
      );

      if (!response.ok) {
        resultsBox.innerHTML = "<p style='color:red;'>Analysis failed</p>";
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