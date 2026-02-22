// system.js

document.getElementById("analyzeBtn").addEventListener("click", async () => {
  const zip = document.getElementById("zip").value.trim();
  const address = document.getElementById("address").value.trim();
  const rate = document.getElementById("rate").value.trim();
  const results = document.getElementById("results");

  results.innerHTML = "";

  if (!zip || !address || !rate) {
    results.innerHTML = "<p style='color:red;'>All fields required</p>";
    return;
  }

  results.innerHTML = "<p>Analyzing…</p>";

  try {
    const response = await fetch(`http://localhost:8000/api/analyze?zip=${zip}&address=${encodeURIComponent(address)}&rate=${rate}`);

    if (!response.ok) {
      const err = await response.json();
      results.innerHTML = `<p style="color:red;">${err.error || "Analysis failed"}</p>`;
      return;
    }

    const data = await response.json();

    results.innerHTML = `
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
  } catch (error) {
    console.error(error);
    results.innerHTML = "<p style='color:red;'>Server error</p>";
  }
});