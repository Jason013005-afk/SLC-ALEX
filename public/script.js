// CONTACT FORM HANDLER
async function sendMessage() {
  const name = document.getElementById("name").value.trim();
  const email = document.getElementById("email").value.trim();
  const message = document.getElementById("message").value.trim();

  if (!name || !email || !message) {
    alert("Please fill out all fields.");
    return;
  }

  try {
    const res = await fetch("/api/contact", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, message })
    });

    if (!res.ok) {
      throw new Error("Failed to send message.");
    }

    alert("Message sent successfully!");
    document.getElementById("contact-form").reset();

  } catch (err) {
    alert("Error sending message.");
  }
}


// OPTIONAL: Highlight active nav link
document.addEventListener("DOMContentLoaded", () => {
  const links = document.querySelectorAll("nav a");
  const current = window.location.pathname;

  links.forEach(link => {
    if (link.getAttribute("href") === current) {
      link.style.fontWeight = "bold";
    }
  });
});