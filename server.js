const express = require('express');
const fetch = require('node-fetch');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 10000;

// Important: parse JSON bodies for POST requests
app.use(express.json());

// Serve static HTML
app.use(express.static('public'));

// ──────────────────────────────────────
// PROXY ENDPOINT – attaches API keys automatically
// ──────────────────────────────────────
app.all('/api/proxy', async (req, res) => {
  try {
    const targetUrl = req.query.url;
    if (!targetUrl) {
      return res.status(400).json({ error: 'Missing url parameter' });
    }

    // Prepare headers – copy some from original request, but NOT auth (we add our own)
    const forwardHeaders = {};
    if (req.headers['content-type']) {
      forwardHeaders['Content-Type'] = req.headers['content-type'];
    }
    if (req.headers['model']) {
      forwardHeaders['model'] = req.headers['model'];
    }

    // 🔒 Automatically attach the correct API key based on the domain
    if (targetUrl.includes('api.pexels.com')) {
      forwardHeaders['Authorization'] = process.env.PEXELS_API_KEY;
    } else if (targetUrl.includes('api.fish.audio')) {
      forwardHeaders['Authorization'] = `Bearer ${process.env.FISH_AUDIO_KEY}`;
    }

    const fetchOptions = {
      method: req.method,
      headers: forwardHeaders,
    };

    // Forward body for POST
    if (req.method === 'POST') {
      fetchOptions.body = JSON.stringify(req.body);
    }

    const response = await fetch(targetUrl, fetchOptions);
    const contentType = response.headers.get('content-type');

    // Relay the response back to the browser
    res.setHeader('Content-Type', contentType);
    response.body.pipe(res);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
