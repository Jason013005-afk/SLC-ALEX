document.getElementById("analyzeBtn").addEventListener("click", async () => {
  const zip = document.getElementById("zip").value.trim();
  const results = document.getElementById("results");

  results.innerHTML = "Loading...";

  if (!zip) {
    results.innerHTML = "<p style='color:red;'>ZIP required</p>";
    return;
  }

  try {
    const response = await fetch(`/api/analyze?zip=${zip}`);

    if (!response.ok) {
      const err = await response.json();
      results.innerHTML = `<p style="color:red;">${err.error}</p>`;
      return;
    }

    const data = await response.json();

    results.innerHTML = `
      <div class="results-card">
        <h2>HUD SAFMR Data</h2>
        <p><strong>Area:</strong> ${data.area}</p>
        <p><strong>Studio:</strong> ${data.studio}</p>
        <p><strong>1BR:</strong> ${data.one}</p>
        <p><strong>2BR:</strong> ${data.two}</p>
        <p><strong>3BR:</strong> ${data.three}</p>
        <p><strong>4BR:</strong> ${data.four}</p>
      </div>
    `;

  } catch (error) {
    results.innerHTML = "<p style='color:red;'>Server error</p>";
  }
});