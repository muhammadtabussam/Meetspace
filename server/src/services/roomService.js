const crypto = require('crypto');

/**
 * In-memory storage for active video rooms.
 * Key: roomId (string) -> Value: Room object
 */
const rooms = new Map();

const DEFAULT_MAX_PARTICIPANTS = parseInt(process.env.MAX_PARTICIPANTS || '10', 10);

/**
 * Generate meeting ID in xxx-xxxx-xxx format
 * @returns {string} e.g. "abc-defg-hij"
 */
function generateMeetingId() {
  const chars = 'abcdefghijklmnopqrstuvwxyz';
  const getRandomChars = (len) => {
    let result = '';
    const bytes = crypto.randomBytes(len);
    for (let i = 0; i < len; i++) {
      result += chars[bytes[i] % chars.length];
    }
    return result;
  };

  return `${getRandomChars(3)}-${getRandomChars(4)}-${getRandomChars(3)}`;
}

/**
 * Create a new room
 * @param {string} hostName
 * @param {string|null} socketId
 * @param {number} [maxParticipants]
 * @returns {object} room info
 */
function createRoom(hostName, socketId = null, maxParticipants = DEFAULT_MAX_PARTICIPANTS) {
  let roomId = generateMeetingId();

  // Ensure unique ID
  while (rooms.has(roomId)) {
    roomId = generateMeetingId();
  }

  const room = {
    id: roomId,
    hostId: socketId,
    hostName: hostName.trim(),
    participants: new Map(),
    createdAt: new Date(),
    maxParticipants: maxParticipants || DEFAULT_MAX_PARTICIPANTS,
  };

  // If host already has a socket ID when creating, register them
  if (socketId) {
    room.participants.set(socketId, {
      id: socketId,
      name: hostName.trim(),
      joinedAt: new Date(),
      isHost: true,
    });
  }

  rooms.set(roomId, room);

  return {
    id: room.id,
    hostId: room.hostId,
    hostName: room.hostName,
    createdAt: room.createdAt,
    maxParticipants: room.maxParticipants,
    participantCount: room.participants.size,
  };
}

/**
 * Get room by ID
 * @param {string} roomId
 * @returns {object|null}
 */
function getRoom(roomId) {
  return rooms.get(roomId) || null;
}

/**
 * Get list of participants in a room
 * @param {string} roomId
 * @returns {Array<object>}
 */
function getRoomParticipants(roomId) {
  const room = rooms.get(roomId);
  if (!room) return [];

  return Array.from(room.participants.values()).map((p) => ({
    id: p.id,
    name: p.name,
    joinedAt: p.joinedAt,
    isHost: p.id === room.hostId,
  }));
}

/**
 * Join an existing room
 * @param {string} roomId
 * @param {string} participantName
 * @param {string} socketId
 * @returns {object} { room, participants, isHost }
 */
function joinRoom(roomId, participantName, socketId) {
  const room = rooms.get(roomId);

  if (!room) {
    const error = new Error('Room not found');
    error.code = 'ROOM_NOT_FOUND';
    throw error;
  }

  if (room.participants.size >= room.maxParticipants && !room.participants.has(socketId)) {
    const error = new Error('Room is full. Maximum participant limit reached.');
    error.code = 'ROOM_FULL';
    throw error;
  }

  // If room hostId is not assigned yet (e.g. created via REST API prior to socket join)
  let isHostUser = false;
  if (!room.hostId || (room.participants.size === 0 && room.hostName === participantName.trim())) {
    room.hostId = socketId;
    isHostUser = true;
  } else if (room.hostId === socketId) {
    isHostUser = true;
  }

  const participantData = {
    id: socketId,
    name: participantName.trim(),
    joinedAt: new Date(),
    isHost: isHostUser,
  };

  room.participants.set(socketId, participantData);

  return {
    room: {
      id: room.id,
      hostId: room.hostId,
      hostName: room.hostName,
      createdAt: room.createdAt,
      maxParticipants: room.maxParticipants,
    },
    participant: participantData,
    participants: getRoomParticipants(roomId),
  };
}

/**
 * Check if a socket ID is the host of the room
 * @param {string} roomId
 * @param {string} socketId
 * @returns {boolean}
 */
function isHost(roomId, socketId) {
  const room = rooms.get(roomId);
  if (!room) return false;
  return room.hostId === socketId;
}

/**
 * Leave a room
 * @param {string} roomId
 * @param {string} socketId
 * @returns {object} { leftParticipant, newHostId, roomDeleted, remainingParticipants }
 */
function leaveRoom(roomId, socketId) {
  const room = rooms.get(roomId);
  if (!room) {
    return { roomDeleted: true, leftParticipant: null, remainingParticipants: [] };
  }

  const leftParticipant = room.participants.get(socketId) || null;
  room.participants.delete(socketId);

  let newHostId = room.hostId;
  let roomDeleted = false;

  if (room.participants.size === 0) {
    // Delete room if empty
    rooms.delete(roomId);
    roomDeleted = true;
  } else if (room.hostId === socketId) {
    // Assign new host to the first remaining participant
    const nextParticipant = room.participants.values().next().value;
    if (nextParticipant) {
      room.hostId = nextParticipant.id;
      room.hostName = nextParticipant.name;
      nextParticipant.isHost = true;
      newHostId = nextParticipant.id;
    }
  }

  return {
    roomDeleted,
    newHostId,
    leftParticipant,
    remainingParticipants: getRoomParticipants(roomId),
    roomId,
  };
}

/**
 * Remove participant by host
 * @param {string} roomId
 * @param {string} targetSocketId
 * @param {string} requesterId
 * @returns {object}
 */
function removeParticipant(roomId, targetSocketId, requesterId) {
  const room = rooms.get(roomId);
  if (!room) {
    const error = new Error('Room not found');
    error.code = 'ROOM_NOT_FOUND';
    throw error;
  }

  if (room.hostId !== requesterId) {
    const error = new Error('Only the room host can remove participants');
    error.code = 'UNAUTHORIZED';
    throw error;
  }

  if (!room.participants.has(targetSocketId)) {
    const error = new Error('Target participant is not in the room');
    error.code = 'PARTICIPANT_NOT_FOUND';
    throw error;
  }

  const removedParticipant = room.participants.get(targetSocketId);
  room.participants.delete(targetSocketId);

  return {
    removedParticipant,
    remainingParticipants: getRoomParticipants(roomId),
  };
}

/**
 * Find which room a socket belongs to
 * @param {string} socketId
 * @returns {string|null} roomId
 */
function findRoomBySocketId(socketId) {
  for (const [roomId, room] of rooms.entries()) {
    if (room.participants.has(socketId)) {
      return roomId;
    }
  }
  return null;
}

/**
 * Periodic cleanup of empty rooms older than 5 minutes
 */
const cleanupInterval = setInterval(() => {
  const now = Date.now();
  const maxIdleTime = 5 * 60 * 1000; // 5 minutes

  for (const [roomId, room] of rooms.entries()) {
    if (room.participants.size === 0 && now - new Date(room.createdAt).getTime() > maxIdleTime) {
      console.log(`[RoomService] Cleaning up inactive empty room: ${roomId}`);
      rooms.delete(roomId);
    }
  }
}, 5 * 60 * 1000);

if (cleanupInterval.unref) {
  cleanupInterval.unref();
}

module.exports = {
  rooms,
  createRoom,
  joinRoom,
  leaveRoom,
  getRoom,
  getRoomParticipants,
  isHost,
  removeParticipant,
  findRoomBySocketId,
};
