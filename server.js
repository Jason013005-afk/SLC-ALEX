import express from 'express';
import fetch from 'node-fetch';
import dotenv from 'dotenv';
dotenv.config();

const app = express();
app.use(express.json());

const rentcastBase = 'https://api.rentcast.io/v1';
const headers = { 'accept': 'application/json', 'X-Api-Key': process.env.RENTCAST_KEY };

// POST /api/stress
app.post('/api/stress', async (req, res) => {
  try {
    const { address, interestRate } = req.body;

    // 1️⃣  Pull property & rent estimates
    const valueRes = await fetch(`${rentcastBase}/avm/value?address=${encodeURIComponent(address)}`, { headers });
    const rentRes = await fetch(`${rentcastBase}/rent/estimate?address=${encodeURIComponent(address)}`, { headers });

    const valueData = await valueRes.json();
    const rentData = await rentRes.json();

    // 2️⃣  Compute some internal metrics
    const estimatedValue = valueData.avmValue || valueData.price || 0;
    const rentValue = rentData.rentEstimate || 0;
    const roi = ((rentValue * 12) / estimatedValue) * 100;
    const mao = estimatedValue * 0.7;
    const appreciation5yr = estimatedValue * 1.15;
    const riskIndex = Math.max(1, 10 - (roi / 2));

    // 3️⃣  Send data back
    res.json({
      address,
      estimatedValue,
      rentValue,
      roi: roi.toFixed(2),
      mao,
      appreciation5yr,
      riskIndex,
      sourceStatus: {
        rentcast: valueRes.ok && rentRes.ok,
        fallback: !valueRes.ok || !rentRes.ok
      }
    });
  } catch (err) {
    console.error('API /stress error:', err.message);
    res.status(500).json({ error: 'Failed to fetch data', details: err.message });
  }
});

// keep this at the end
app.listen(4000, () => console.log('✅ Backend running on http://localhost:4000'));
