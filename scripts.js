document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("stressTestForm");
  if (!form) return; // Prevents null form errors

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const address = document.getElementById("address").value;
    const rate = parseFloat(document.getElementById("rate").value);

    try {
      const res = await fetch("/api/stress-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address, rate }),
      });

      const data = await res.json();

      document.getElementById("resultAddress").textContent = data.address || "N/A";
      document.getElementById("resultValue").textContent = data.estimated_value || "N/A";
      document.getElementById("resultRate").textContent = data.rate || "N/A";
      document.getElementById("resultStatus").textContent = data.status || "Error";
    } catch (err) {
      console.error("Error:", err);
      document.getElementById("resultStatus").textContent = "Server error.";
    }
  });
});
