export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { interest } = req.body;
  let riskLevel = "Moderate";

  if (interest < 4) riskLevel = "Low";
  else if (interest >= 4 && interest < 7) riskLevel = "Moderate";
  else riskLevel = "High";

  res.status(200).json({ riskLevel });
}
