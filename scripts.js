const API_BASE_URL = "https://4000-upgraded-trout-77r44jqj5wc7rx-<yourID>.app.github.dev";
// 👆 Replace <yourID> with whatever appears in your Codespaces port URL
document.addEventListener('DOMContentLoaded', () => {
      const form = document.getElementById('stressForm');
        const resultDiv = document.getElementById('result');

          if (form) {
              form.addEventListener('submit', async (e) => {
                    e.preventDefault();
                          const address = document.getElementById('address').value;
                                const rate = document.getElementById('rate').value;

                                      resultDiv.innerHTML = `
                                              <div class="loading">
                                                        <img src="./images/slc-logo.png" class="loading-logo" />
                                                                  <p>Analyzing Deal...</p>
                                                                          </div>
                                                                                `;

                                                                                      try {
                                                                                              const response = await fetch('/api/analyze', {
                                                                                                        method: 'POST',
                                                                                                                  headers: { 'Content-Type': 'application/json' },
                                                                                                                            body: JSON.stringify({ address, rate })
                                                                                                                                    });

                                                                                                                                            const data = await response.json();

                                                                                                                                                    if (!response.ok) throw new Error(data.error || 'Server Error');

                                                                                                                                                            resultDiv.innerHTML = `
                                                                                                                                                                      <div class="result-card">
                                                                                                                                                                                  <h3>Deal Analysis Complete</h3>
                                                                                                                                                                                              <p><strong>Address:</strong> ${data.address}</p>
                                                                                                                                                                                                          <p><strong>Rate:</strong> ${data.rate}%</p>
                                                                                                                                                                                                                      <p><strong>Score:</strong> ${data.stressScore}</p>
                                                                                                                                                                                                                                  <p><strong>Verdict:</strong> ${data.verdict}</p>
                                                                                                                                                                                                                                              <p>${data.message}</p>
                                                                                                                                                                                                                                                        </div>
                                                                                                                                                                                                                                                                `;
                                                                                                                                                                                                                                                                      } catch (err) {
                                                                                                                                                                                                                                                                              resultDiv.innerHTML = `<p style="color:red;">Error: ${err.message}</p>`;
                                                                                                                                                                                                                                                                                    }
                                                                                                                                                                                                                                                                                        });
                                                                                                                                                                                                                                                                                          }
                                                                                                                                                                                                                                                                                          });
})