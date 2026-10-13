const express = require('express');
const rateLimit = require('express-rate-limit');
const authService = require('../services/authService');

const router = express.Router();
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { success: false, error: 'Too many sign-in attempts. Please wait 15 minutes and try again.' },
  standardHeaders: true,
  legacyHeaders: false,
});

function validateCredentials(req, res) {
  const email = req.body?.email;
  const password = req.body?.password;
  if (typeof email !== 'string' || email.length > 254 || !emailPattern.test(email.trim())) {
    res.status(400).json({ success: false, error: 'Enter a valid email address.' });
    return null;
  }
  if (typeof password !== 'string' || password.length < 8 || password.length > 128) {
    res.status(400).json({
      success: false,
      error: 'Password must be between 8 and 128 characters.',
    });
    return null;
  }
  return { email: email.trim(), password };
}

async function issueSession(user, req, res) {
  const session = await authService.createSession(user.id);
  authService.setSessionCookie(res, session.token, req);
  return res.status(200).json({ success: true, user });
}

router.post('/register', authLimiter, async (req, res) => {
  const credentials = validateCredentials(req, res);
  if (!credentials) return;

  try {
    const user = await authService.register(credentials.email, credentials.password);
    return issueSession(user, req, res);
  } catch (error) {
    if (error.code === 'EMAIL_IN_USE') {
      return res.status(409).json({ success: false, error: error.message });
    }
    console.error('[Auth] Account registration failed:', error.message);
    return res.status(500).json({ success: false, error: 'Could not create your account. Please try again.' });
  }
});

router.post('/login', authLimiter, async (req, res) => {
  const credentials = validateCredentials(req, res);
  if (!credentials) return;

  try {
    const user = await authService.login(credentials.email, credentials.password);
    if (!user) {
      return res.status(401).json({ success: false, error: 'Email or password is incorrect.' });
    }
    return issueSession(user, req, res);
  } catch (error) {
    console.error('[Auth] Sign-in failed:', error.message);
    return res.status(500).json({ success: false, error: 'Could not sign in right now. Please try again.' });
  }
});

router.get('/me', async (req, res) => {
  try {
    const user = await authService.getSessionUser(authService.getCookieToken(req.headers.cookie));
    return res.status(200).json({
      success: true,
      user: user ? { id: user.id, email: user.email, displayName: user.displayName } : null,
    });
  } catch (error) {
    console.error('[Auth] Session lookup failed:', error.message);
    return res.status(500).json({ success: false, error: 'Could not verify your session.' });
  }
});

router.post('/logout', async (req, res) => {
  try {
    const token = authService.getCookieToken(req.headers.cookie);
    const userId = await authService.revokeSession(token);
    authService.clearSessionCookie(res, req);
    if (userId) req.app.get('disconnectUserSockets')?.(userId);
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('[Auth] Sign-out failed:', error.message);
    return res.status(500).json({ success: false, error: 'Could not sign out cleanly. Please try again.' });
  }
});

module.exports = router;
