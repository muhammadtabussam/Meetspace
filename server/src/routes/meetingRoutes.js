const express = require('express');
const rateLimit = require('express-rate-limit');
const roomService = require('../services/roomService');

const router = express.Router();

// Rate limiter: 10 creates per minute per IP
const createMeetingLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: {
    success: false,
    error: 'Too many meetings created from this IP, please try again after a minute.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiter: 30 validates per minute per IP
const validateMeetingLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: {
    success: false,
    error: 'Too many validation requests, please try again after a minute.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Sanitize and validate input string
 * @param {any} input
 * @returns {string}
 */
function sanitizeString(input) {
  if (typeof input !== 'string') return '';
  return input
    .trim()
    .replace(/[<>]/g, ''); // strip out basic HTML characters
}

/**
 * POST /api/meetings/create
 * Body: { hostName }
 * Returns: { meetingId, meetingLink, hostName, createdAt }
 */
router.post('/create', createMeetingLimiter, (req, res) => {
  try {
    const rawHostName = req.body?.hostName;

    if (!rawHostName || typeof rawHostName !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Host name is required and must be a string.',
      });
    }

    const hostName = sanitizeString(rawHostName);

    if (hostName.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Host name cannot be empty or only whitespace.',
      });
    }

    if (hostName.length > 50) {
      return res.status(400).json({
        success: false,
        error: 'Host name cannot exceed 50 characters.',
      });
    }

    const room = roomService.createRoom(hostName);
    const clientUrl =
      process.env.CLIENT_URL || process.env.RENDER_EXTERNAL_URL || 'http://localhost:5173';
    const meetingLink = `${clientUrl}/join/${room.id}`;

    return res.status(201).json({
      success: true,
      meetingId: room.id,
      meetingLink,
      hostName: room.hostName,
      maxParticipants: room.maxParticipants,
      createdAt: room.createdAt,
    });
  } catch (error) {
    console.error('[MeetingRoutes] Error creating meeting:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to create meeting room.',
    });
  }
});

/**
 * GET /api/meetings/:meetingId/validate
 * Validates meeting existence and current capacity
 */
router.get('/:meetingId/validate', validateMeetingLimiter, (req, res) => {
  try {
    const { meetingId } = req.params;

    if (!meetingId) {
      return res.status(400).json({
        valid: false,
        error: 'Meeting ID is required.',
      });
    }

    const room = roomService.getRoom(meetingId);

    if (!room) {
      return res.status(404).json({
        valid: false,
        error: 'Meeting not found.',
        participantCount: 0,
        maxParticipants: 0,
      });
    }

    const participantCount = room.participants.size;
    const isFull = participantCount >= room.maxParticipants;

    return res.status(200).json({
      valid: true,
      isFull,
      participantCount,
      maxParticipants: room.maxParticipants,
      hostName: room.hostName,
      createdAt: room.createdAt,
    });
  } catch (error) {
    console.error('[MeetingRoutes] Error validating meeting:', error);
    return res.status(500).json({
      valid: false,
      error: 'Error validating meeting.',
    });
  }
});

/**
 * GET /api/meetings/:meetingId/ice-servers
 * Returns ICE server configuration (STUN + optional TURN)
 */
router.get('/:meetingId/ice-servers', (req, res) => {
  try {
    const iceServers = [
      {
        urls: [
          'stun:stun.l.google.com:19302',
          'stun:stun1.l.google.com:19302',
          'stun:stun2.l.google.com:19302',
          'stun:stun3.l.google.com:19302',
          'stun:stun4.l.google.com:19302',
        ],
      },
    ];

    const turnServerUrl = process.env.TURN_SERVER_URL;
    const turnUsername = process.env.TURN_USERNAME;
    const turnCredential = process.env.TURN_CREDENTIAL;

    if (turnServerUrl) {
      const turnConfig = {
        urls: turnServerUrl.split(',').map((url) => url.trim()),
      };

      if (turnUsername) {
        turnConfig.username = turnUsername;
      }
      if (turnCredential) {
        turnConfig.credential = turnCredential;
      }

      iceServers.push(turnConfig);
    }

    return res.status(200).json({
      success: true,
      iceServers,
    });
  } catch (error) {
    console.error('[MeetingRoutes] Error generating ICE servers:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve ICE server configuration.',
    });
  }
});

module.exports = router;
