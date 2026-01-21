// ===============================
// ALEX™ Stress Test Integration
// ===============================
const SUPABASE_URL = "https://doernvgjlswszteywylb.supabase.co";
const SUPABASE_KEY = "YOUR_SUPABASE_ANON_KEY"; // replace this with your anon key
const SUPABASE_TABLE = "stress_tests";

// Initialize Supabase client
const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_KEY);

// Handle form submit
document.getElementById("stressForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const address = document.getElementById("address").value.trim();
  const interestRate = parseFloat(document.getElementById("rate").value);

  // Example quick placeholder logic until your backend formula is ready:
  const estimatedValue = Math.floor(Math.random() * 500000) + 150000;
  const rent = Math.floor(estimatedValue * 0.004);
  const monthlyPayment = ((interestRate / 100 / 12) * estimatedValue) / (1 - Math.pow(1 + (interestRate / 100 / 12), -360));
  const roi = ((rent * 12) / estimatedValue * 100).toFixed(2);
  const appreciation5yr = (estimatedValue * 1.25).toFixed(2); // placeholder 25% growth
  const source = "alex-intelligence";

  // Save to Supabase
  const { data, error } = await db
    .from(SUPABASE_TABLE)
    .insert([
      {
        address,
        estimatedValue,
        rent,
        interestRate,
        monthlyPayment,
        roi,
        appreciation5yr,
        source
      }
    ])
    .select();

  if (error) {
    console.error(error);
    document.getElementById("results").innerHTML =
      `<p style="color:red;">Error saving to database: ${error.message}</p>`;
    return;
  }

  // Display results dynamically
  const result = data[0];
  document.getElementById("results").innerHTML = `
    <h3>Results</h3>
    <p><strong>Address:</strong> ${result.address}</p>
    <p><strong>Estimated Value:</strong> $${Number(result.estimatedValue).toLocaleString()}</p>
    <p><strong>Rent Estimate:</strong> $${Number(result.rent).toLocaleString()}</p>
    <p><strong>Interest Rate:</strong> ${result.interestRate}%</p>
    <p><strong>Monthly Payment:</strong> $${Number(result.monthlyPayment).toLocaleString()}</p>
    <p><strong>ROI:</strong> ${result.roi}%</p>
    <p><strong>5-Year Appreciation:</strong> $${Number(result.appreciation5yr).toLocaleString()}</p>
    <p><em>Saved to database successfully!</em></p>
  `;
});