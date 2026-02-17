document.addEventListener("DOMContentLoaded", () => {

  const button = document.querySelector(".gold-btn");

  button.addEventListener("click", async () => {

    const zip = document.querySelectorAll("input")[0].value.trim();

    if (!zip) {
      alert("Enter ZIP Code");
      return;
    }

    try {

      const response = await fetch(`/api/analyze?zip=${zip}`);
      const data = await response.json();

      if (!response.ok) {
        document.getElementById("results").innerHTML =
          `<p style="color:red;">${data.error}</p>`;
        return;
      }

      document.getElementById("results").innerHTML = `
        <div class="result-card">
          <h2>HUD SAFMR Data</h2>
          <p><strong>Area:</strong> ${data["HUD Metro Fair Market Rent Area Name"]}</p>
          <p><strong>0BR:</strong> ${data["SAFMR 0BR"]}</p>
          <p><strong>1BR:</strong> ${data["SAFMR 1BR"]}</p>
          <p><strong>2BR:</strong> ${data["SAFMR 2BR"]}</p>
          <p><strong>3BR:</strong> ${data["SAFMR 3BR"]}</p>
          <p><strong>4BR:</strong> ${data["SAFMR 4BR"]}</p>
        </div>
      `;

    } catch (err) {
      console.error(err);
      document.getElementById("results").innerHTML =
        `<p style="color:red;">Server error</p>`;
    }

  });

});