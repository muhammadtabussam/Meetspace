const express = require('express');
const rateLimit = require('express-rate-limit');

const router = express.Router();
const MAX_MESSAGE_LENGTH = 2000;
const MAX_HISTORY_MESSAGES = 10;

const chatLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  message: {
    success: false,
    error: 'Too many assistant requests. Please wait a minute and try again.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

router.post('/chat', chatLimiter, async (req, res) => {
  const apiUrl = process.env.AI_API_URL || 'https://api.openai.com/v1/chat/completions';
  const apiKey = process.env.AI_API_KEY;
  const model = process.env.AI_MODEL || 'gpt-4o-mini';
  if (!apiKey) {
    return res.status(503).json({
      success: false,
      error: 'OpenAI needs an API key. Add AI_API_KEY to server/.env and restart MeetSpace; the built-in help guide is available in the meantime.',
    });
  }

  const { message, history = [] } = req.body || {};
  if (typeof message !== 'string' || !message.trim() || message.length > MAX_MESSAGE_LENGTH) {
    return res.status(400).json({
      success: false,
      error: `Message must contain 1 to ${MAX_MESSAGE_LENGTH} characters.`,
    });
  }

  if (!Array.isArray(history) || history.length > MAX_HISTORY_MESSAGES) {
    return res.status(400).json({
      success: false,
      error: `Conversation history must contain no more than ${MAX_HISTORY_MESSAGES} messages.`,
    });
  }

  const validHistory = history.every(
    (item) =>
      item &&
      (item.role === 'user' || item.role === 'assistant') &&
      typeof item.content === 'string' &&
      item.content.trim().length > 0 &&
      item.content.length <= MAX_MESSAGE_LENGTH
  );
  if (!validHistory) {
    return res.status(400).json({
      success: false,
      error: 'Conversation history contains an invalid message.',
    });
  }

  let providerUrl;
  try {
    providerUrl = new URL(apiUrl);
    if (providerUrl.protocol !== 'https:' && providerUrl.hostname !== 'localhost' && providerUrl.hostname !== '127.0.0.1') {
      return res.status(500).json({
        success: false,
        error: 'The configured AI endpoint must use HTTPS.',
      });
    }
  } catch (error) {
    console.error('[Assistant] Invalid AI_API_URL configuration:', error.message);
    return res.status(500).json({
      success: false,
      error: 'The AI provider endpoint is incorrectly configured.',
    });
  }

  const messages = [
    {
      role: 'system',
      content:
        'You are MeetSpace Help, a friendly assistant for a browser-based video meeting app. Help users in plain language with creating and joining meetings, camera and microphone permissions, WebRTC calls, screen sharing, chat, and local recording. Give concise, safe, step-by-step guidance. Prefer actions in the MeetSpace interface and browser settings; do not ask users to run terminal commands. Never claim you have changed settings, started services, or fixed their device. Do not request passwords, API keys, or private meeting content. If a task requires access to the user’s device or account, explain that you can guide them but cannot operate it for them. Mention that meeting recordings are currently local and record only the local camera/microphone.',
    },
    ...history,
    { role: 'user', content: message.trim() },
  ];

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch(providerUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.4,
        max_tokens: 500,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      console.error(`[Assistant] AI provider returned HTTP ${response.status}.`);
      return res.status(502).json({
        success: false,
        error: 'The AI provider could not answer right now. Check the provider settings or try again shortly.',
      });
    }

    const data = await response.json();
    const reply = data?.choices?.[0]?.message?.content;
    if (typeof reply !== 'string' || !reply.trim()) {
      console.error('[Assistant] AI provider returned an empty or unsupported response.');
      return res.status(502).json({
        success: false,
        error: 'The AI provider returned an empty reply. Please try again.',
      });
    }

    return res.status(200).json({ success: true, reply: reply.trim() });
  } catch (error) {
    const timedOut = error.name === 'AbortError';
    console.error('[Assistant] AI request failed:', timedOut ? 'request timed out' : error.message);
    return res.status(502).json({
      success: false,
      error: timedOut
        ? 'The AI provider took too long to respond. Please try again.'
        : 'Could not connect to the AI provider. Check the server connection and try again.',
    });
  } finally {
    clearTimeout(timeout);
  }
});

module.exports = router;
