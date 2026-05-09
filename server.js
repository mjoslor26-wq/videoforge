const express = require('express');
const fetch = require('node-fetch');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 10000;

app.use(express.json());
app.use(express.static('public'));

// Proxy endpoint – attaches API keys automatically
app.all('/api/proxy', async (req, res) => {
  try {
    const targetUrl = req.query.url;
    if (!targetUrl) return res.status(400).json({ error: 'Missing url parameter' });

    // Build headers to forward
    const forwardHeaders = {};
    if (req.headers['content-type']) forwardHeaders['Content-Type'] = req.headers['content-type'];
    if (req.headers['model']) forwardHeaders['model'] = req.headers['model'];

    // Attach the correct API key based on the API domain
    if (targetUrl.includes('api.pexels.com')) {
      forwardHeaders['Authorization'] = process.env.PEXELS_API_KEY;
    } else if (targetUrl.includes('api.fish.audio')) {
      forwardHeaders['Authorization'] = `Bearer ${process.env.FISH_AUDIO_KEY}`;
    }

    const fetchOptions = {
      method: req.method,
      headers: forwardHeaders,
    };

    // Forward body for POST requests
    if (req.method === 'POST') {
      fetchOptions.body = JSON.stringify(req.body);
    }

    const response = await fetch(targetUrl, fetchOptions);
    const contentType = response.headers.get('content-type');

    // 🔧 Instead of piping (which can corrupt binary data in some setups),
    // we read the entire response as a buffer and send it cleanly.
    const buffer = await response.buffer();

    res.setHeader('Content-Type', contentType);
    res.status(response.status).send(buffer);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
