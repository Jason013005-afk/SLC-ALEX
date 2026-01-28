const API_BASE =
  "https://orange-succotash-4jp59p697gqqh5559-4000.app.github.dev";

  const form = document.getElementById("stressForm");
  const resultBox = document.getElementById("result");

  if (form) {
    form.addEventListener("submit", async (e) => {
        e.preventDefault();

            const address = document.getElementById("address").value;
                const interestRate = Number(
                      document.getElementById("interestRate").value
                          );

                              resultBox.textContent = "⏳ Running analysis...";

                                  try {
                                        const res = await fetch(`${API_BASE}/api/stress`, {
                                                method: "POST",
                                                        headers: { "Content-Type": "application/json" },
                                                                body: JSON.stringify({ address, interestRate })
                                                                      });

                                                                            const data = await res.json();
                                                                                  resultBox.textContent = JSON.stringify(data, null, 2);
                                                                                      } catch (err) {
                                                                                            console.error(err);
                                                                                                  resultBox.textContent = "❌ Backend connection failed";
                                                                                                      }
                                                                                                        });
                                                                                                        }