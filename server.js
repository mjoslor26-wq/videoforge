const express = require('express');
const fetch = require('node-fetch');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 10000;

// Serve static files (the HTML) from the "public" folder
app.use(express.static('public'));

// Proxy endpoint: /api/proxy?url=ENCODED_URL
app.all('/api/proxy', async (req, res) => {
  try {
    const targetUrl = req.query.url;
    if (!targetUrl) return res.status(400).json({ error: 'Missing url parameter' });

    // Forward the request with the same method and body
    const fetchOptions = {
      method: req.method,
      headers: { ...req.headers },
    };

    // Copy authorization header from the original request (sent by the HTML)
    if (req.headers['authorization']) {
      fetchOptions.headers['Authorization'] = req.headers['authorization'];
    }
    if (req.headers['model']) {
      fetchOptions.headers['model'] = req.headers['model'];
    }

    // If it's a POST, forward the body
    if (req.method === 'POST') {
      fetchOptions.body = JSON.stringify(req.body);
      fetchOptions.headers['Content-Type'] = 'application/json';
    }

    const response = await fetch(targetUrl, fetchOptions);
    const contentType = response.headers.get('content-type');

    // Stream the response back to the browser
    res.setHeader('Content-Type', contentType);
    response.body.pipe(res);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));