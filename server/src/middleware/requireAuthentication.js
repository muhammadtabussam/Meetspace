const authService = require('../services/authService');

async function requireAuthentication(req, res, next) {
  try {
    const user = await authService.getSessionUser(authService.getCookieToken(req.headers.cookie));
    if (!user) {
      return res.status(401).json({ success: false, error: 'Please sign in to continue.' });
    }
    req.user = { id: user.id, email: user.email, displayName: user.displayName };
    return next();
  } catch (error) {
    console.error('[Auth] Request authentication failed:', error.message);
    return res.status(500).json({ success: false, error: 'Could not verify your session.' });
  }
}

module.exports = requireAuthentication;
