const express = require('express');
const fetch = require('node-fetch');
const path = require('path');
const multer = require('multer');
const FormData = require('form-data');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 10000;

// Middleware
app.use(express.json());
app.use(express.static('public'));

// Multer for voice sample uploads
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// ──────────────────────────────────────
// PROXY ENDPOINT (Pexels)
// ──────────────────────────────────────
app.all('/api/proxy', async (req, res) => {
  try {
    const targetUrl = req.query.url;
    if (!targetUrl) return res.status(400).json({ error: 'Missing url parameter' });

    const forwardHeaders = {};
    if (req.headers['content-type']) forwardHeaders['Content-Type'] = req.headers['content-type'];
    if (req.headers['model']) forwardHeaders['model'] = req.headers['model'];

    if (targetUrl.includes('api.pexels.com')) {
      forwardHeaders['Authorization'] = process.env.PEXELS_API_KEY;
    } else {
      forwardHeaders['Authorization'] = `Bearer ${process.env.DEEPINFRA_TOKEN}`;
    }

    const fetchOptions = {
      method: req.method,
      headers: forwardHeaders,
    };

    if (req.method === 'POST') {
      fetchOptions.body = JSON.stringify(req.body);
    }

    const response = await fetch(targetUrl, fetchOptions);
    const contentType = response.headers.get('content-type');
    const buffer = await response.buffer();

    res.setHeader('Content-Type', contentType);
    res.status(response.status).send(buffer);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ──────────────────────────────────────
// VOICE CREATION (upload voice sample to DeepInfra)
// ──────────────────────────────────────
app.post('/api/create-voice', upload.single('voice_sample'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No voice sample uploaded' });
    }

    const form = new FormData();
    form.append('audio', req.file.buffer, {
      filename: 'sample.wav',
      contentType: req.file.mimetype || 'audio/wav',
    });
    form.append('name', 'CustomVoice_' + Date.now());
    form.append('description', 'Uploaded via VideoForge');

    const response = await fetch('https://api.deepinfra.com/v1/voices/add', {
      method: 'POST',
      headers: {
        ...form.getHeaders(),
        Authorization: `Bearer ${process.env.DEEPINFRA_TOKEN}`,
      },
      body: form,
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.message || data.error || 'Voice creation failed');

    res.json(data); // { voice_id: "..." }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ──────────────────────────────────────
// TTS GENERATION (Chatterbox-Turbo)
// ──────────────────────────────────────
app.post('/api/tts', async (req, res) => {
  try {
    const { text, voice_id, format, temperature, exaggeration, cfg_weight } = req.body;

    if (!text) return res.status(400).json({ error: 'Text is required' });

    const body = {
      input: text,
      voice_id: voice_id || '',
      format: format || 'wav',
      temperature: temperature || 0.8,
      exaggeration: exaggeration || 0.5,
      cfg: cfg_weight || 0.5,
    };

    const response = await fetch('https://api.deepinfra.com/v1/inference/ResembleAI/chatterbox-turbo', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.DEEPINFRA_TOKEN}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`DeepInfra TTS error: ${response.status} - ${errText}`);
    }

    const audioBuffer = await response.buffer();
    const outputFormat = format === 'mp3' ? 'audio/mpeg' : 'audio/wav';
    res.setHeader('Content-Type', outputFormat);
    res.send(audioBuffer);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
