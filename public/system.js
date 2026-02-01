async function analyze() {
  const zip = document.getElementById("zip").value.trim();
  const bedrooms = Number(document.getElementById("bedrooms").value);
  const output = document.getElementById("output");

  if (!zip || Number.isNaN(bedrooms)) {
    output.textContent = "Please enter a ZIP code and bedroom count.";
    return;
  }

  output.textContent = "Running analysis...";

  try {
    const res = await fetch("/api/rent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ zip, bedrooms })
    });

    const data = await res.json();

    if (!res.ok) {
      output.textContent = data.error || "Error running analysis.";
      return;
    }

    output.textContent = JSON.stringify(data, null, 2);
  } catch (err) {
    output.textContent = "Server error. Is backend running?";
    console.error(err);
  }
}