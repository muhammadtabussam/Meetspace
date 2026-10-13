const roomService = require('../services/roomService');

/**
 * Initialize all MeetSpace Socket.IO event listeners
 * @param {import('socket.io').Server} io
 */
function initializeSocket(io) {
  io.on('connection', (socket) => {
    console.log(`[Socket] New connection: ${socket.id}`);
    socket.join(`user:${socket.data.user.id}`);
    const sessionExpiryTimer = setTimeout(() => {
      if (socket.connected) socket.disconnect(true);
    }, Math.max(0, socket.data.user.expiresAt - Date.now()));

    /**
     * Helper to verify if the socket is currently part of the specified room
     * @param {string} roomId
     * @returns {boolean}
     */
    const isSocketInRoom = (roomId) => {
      const currentRoomId = roomService.findRoomBySocketId(socket.id);
      return currentRoomId === roomId;
    };

    /**
     * 1. Join Room
     * Event payload: { roomId, userName }
     */
    socket.on('join-room', ({ roomId, userName }) => {
      try {
        if (!roomId || !userName) {
          return socket.emit('error', { message: 'roomId and userName are required.' });
        }

        const trimmedName = String(userName).trim();
        if (!trimmedName || trimmedName.length > 50) {
          return socket.emit('error', { message: 'Invalid participant name.' });
        }

        // Prevent duplicate join if already in the same room
        const existingRoomId = roomService.findRoomBySocketId(socket.id);
        if (existingRoomId === roomId) {
          console.warn(`[Socket] Duplicate join attempt ignored for ${socket.id} in ${roomId}`);
          return;
        }

        // If currently in another room, leave it first
        if (existingRoomId && existingRoomId !== roomId) {
          const leaveResult = roomService.leaveRoom(existingRoomId, socket.id);
          socket.leave(existingRoomId);
          if (leaveResult.leftParticipant) {
            socket.to(existingRoomId).emit('user-left', {
              socketId: socket.id,
              userName: leaveResult.leftParticipant.name,
              newHostId: leaveResult.newHostId,
            });
          }
        }

        const joinResult = roomService.joinRoom(roomId, trimmedName, socket.id);
        socket.join(roomId);

        console.log(`[Socket] User ${trimmedName} (${socket.id}) joined room ${roomId}`);

        // Notify existing participants in the room
        socket.to(roomId).emit('user-joined', {
          socketId: socket.id,
          userName: trimmedName,
          joinedAt: joinResult.participant.joinedAt,
          isHost: joinResult.participant.isHost,
        });

        // Send existing participants list to joining user
        socket.emit('room-participants', {
          participants: joinResult.participants,
          selfId: socket.id,
        });

        // Send room information
        socket.emit('room-info', {
          room: joinResult.room,
          isHost: joinResult.participant.isHost,
        });
      } catch (err) {
        console.error(`[Socket] Error joining room:`, err);
        socket.emit('error', {
          message: err.message || 'Failed to join room.',
          code: err.code || 'JOIN_ROOM_FAILED',
        });
      }
    });

    /**
     * 2. Leave Room
     * Event payload: { roomId }
     */
    socket.on('leave-room', ({ roomId }) => {
      try {
        if (!roomId) return;

        if (!isSocketInRoom(roomId)) {
          return socket.emit('error', { message: 'You are not a member of this room.' });
        }

        const result = roomService.leaveRoom(roomId, socket.id);
        socket.leave(roomId);

        console.log(`[Socket] User ${socket.id} manually left room ${roomId}`);

        if (result.leftParticipant) {
          socket.to(roomId).emit('user-left', {
            socketId: socket.id,
            userName: result.leftParticipant.name,
            newHostId: result.newHostId,
            remainingParticipants: result.remainingParticipants,
          });
        }
      } catch (err) {
        console.error(`[Socket] Error in leave-room:`, err);
        socket.emit('error', { message: 'Failed to leave room cleanly.' });
      }
    });

    /**
     * 3. WebRTC Signaling - Offer
     * Payload: { to, offer }
     */
    socket.on('offer', ({ to, offer }) => {
      try {
        const senderRoomId = roomService.findRoomBySocketId(socket.id);
        const targetRoomId = roomService.findRoomBySocketId(to);

        if (!senderRoomId || senderRoomId !== targetRoomId) {
          return socket.emit('error', { message: 'Cannot signal peers outside your room.' });
        }

        io.to(to).emit('offer', {
          from: socket.id,
          offer,
        });
      } catch (err) {
        console.error(`[Socket] Error in offer relay:`, err);
        socket.emit('error', { message: 'Failed to relay offer.' });
      }
    });

    /**
     * WebRTC Signaling - Answer
     * Payload: { to, answer }
     */
    socket.on('answer', ({ to, answer }) => {
      try {
        const senderRoomId = roomService.findRoomBySocketId(socket.id);
        const targetRoomId = roomService.findRoomBySocketId(to);

        if (!senderRoomId || senderRoomId !== targetRoomId) {
          return socket.emit('error', { message: 'Cannot signal peers outside your room.' });
        }

        io.to(to).emit('answer', {
          from: socket.id,
          answer,
        });
      } catch (err) {
        console.error(`[Socket] Error in answer relay:`, err);
        socket.emit('error', { message: 'Failed to relay answer.' });
      }
    });

    /**
     * WebRTC Signaling - ICE Candidate
     * Payload: { to, candidate }
     */
    socket.on('ice-candidate', ({ to, candidate }) => {
      try {
        const senderRoomId = roomService.findRoomBySocketId(socket.id);
        const targetRoomId = roomService.findRoomBySocketId(to);

        if (!senderRoomId || senderRoomId !== targetRoomId) {
          return socket.emit('error', { message: 'Cannot signal peers outside your room.' });
        }

        io.to(to).emit('ice-candidate', {
          from: socket.id,
          candidate,
        });
      } catch (err) {
        console.error(`[Socket] Error in ice-candidate relay:`, err);
        socket.emit('error', { message: 'Failed to relay ICE candidate.' });
      }
    });

    /**
     * 5. Chat Message
     * Payload: { roomId, message }
     */
    socket.on('chat-message', ({ roomId, message }) => {
      try {
        if (!roomId || !isSocketInRoom(roomId)) {
          return socket.emit('error', { message: 'You must be in the room to send messages.' });
        }

        if (typeof message !== 'string') {
          return socket.emit('error', { message: 'Message content must be text.' });
        }

        const trimmed = message.trim();
        if (trimmed.length === 0) {
          return socket.emit('error', { message: 'Message cannot be empty.' });
        }

        if (trimmed.length > 1000) {
          return socket.emit('error', { message: 'Message exceeds 1000 character limit.' });
        }

        const room = roomService.getRoom(roomId);
        const participant = room?.participants?.get(socket.id);
        const senderName = participant ? participant.name : 'Unknown';

        io.to(roomId).emit('chat-message', {
          senderId: socket.id,
          senderName,
          message: trimmed,
          timestamp: new Date().toISOString(),
        });
      } catch (err) {
        console.error(`[Socket] Error broadcasting chat message:`, err);
        socket.emit('error', { message: 'Failed to send chat message.' });
      }
    });

    /**
     * 6. Screen Sharing
     */
    socket.on('screen-share-started', ({ roomId }) => {
      try {
        if (!roomId || !isSocketInRoom(roomId)) {
          return socket.emit('error', { message: 'You must be in the room to share screen.' });
        }

        socket.to(roomId).emit('screen-share-started', {
          socketId: socket.id,
        });
      } catch (err) {
        console.error(`[Socket] Error in screen-share-started:`, err);
      }
    });

    socket.on('screen-share-stopped', ({ roomId }) => {
      try {
        if (!roomId || !isSocketInRoom(roomId)) {
          return;
        }

        socket.to(roomId).emit('screen-share-stopped', {
          socketId: socket.id,
        });
      } catch (err) {
        console.error(`[Socket] Error in screen-share-stopped:`, err);
      }
    });

    /**
     * 7. Host Actions - Remove Participant
     * Payload: { roomId, targetSocketId }
     */
    socket.on('remove-participant', ({ roomId, targetSocketId }) => {
      try {
        if (!roomId || !targetSocketId) {
          return socket.emit('error', { message: 'roomId and targetSocketId are required.' });
        }

        if (!isSocketInRoom(roomId)) {
          return socket.emit('error', { message: 'You are not in this room.' });
        }

        if (!roomService.isHost(roomId, socket.id)) {
          return socket.emit('error', { message: 'Only the meeting host can remove participants.' });
        }

        const removeResult = roomService.removeParticipant(roomId, targetSocketId, socket.id);

        // Notify target participant and force them to leave room channel
        const targetSocket = io.sockets.sockets.get(targetSocketId);
        if (targetSocket) {
          targetSocket.emit('you-were-removed', {
            roomId,
            message: 'You have been removed from the meeting by the host.',
          });
          targetSocket.leave(roomId);
        }

        // Notify rest of the room
        io.to(roomId).emit('user-left', {
          socketId: targetSocketId,
          userName: removeResult.removedParticipant?.name || 'Participant',
          wasRemoved: true,
          remainingParticipants: removeResult.remainingParticipants,
        });
      } catch (err) {
        console.error(`[Socket] Error removing participant:`, err);
        socket.emit('error', {
          message: err.message || 'Failed to remove participant.',
          code: err.code || 'REMOVE_FAILED',
        });
      }
    });

    /**
     * 8. Reactions
     * Payload: { roomId, emoji, senderName }
     */
    socket.on('send-reaction', ({ roomId, emoji, senderName }) => {
      try {
        if (!roomId || !emoji) return;
        io.to(roomId).emit('reaction-received', {
          id: `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          emoji,
          senderId: socket.id,
          senderName: senderName || 'Someone',
        });
      } catch (err) {
        console.error('[Socket] Error broadcasting reaction:', err);
      }
    });

    /**
     * 9. Hand Raise
     * Payload: { roomId, isHandRaised }
     */
    socket.on('toggle-hand', ({ roomId, isHandRaised }) => {
      try {
        if (!roomId) return;
        io.to(roomId).emit('hand-toggled', {
          socketId: socket.id,
          isHandRaised,
        });
      } catch (err) {
        console.error('[Socket] Error broadcasting hand toggle:', err);
      }
    });

    /**
     * Disconnect Handling
     */
    socket.on('disconnect', (reason) => {
      clearTimeout(sessionExpiryTimer);
      try {
        console.log(`[Socket] Disconnected: ${socket.id} (reason: ${reason})`);

        const roomId = roomService.findRoomBySocketId(socket.id);
        if (roomId) {
          const result = roomService.leaveRoom(roomId, socket.id);
          if (result.leftParticipant) {
            socket.to(roomId).emit('user-left', {
              socketId: socket.id,
              userName: result.leftParticipant.name,
              newHostId: result.newHostId,
              remainingParticipants: result.remainingParticipants,
            });
          }
        }
      } catch (err) {
        console.error(`[Socket] Error handling disconnect for ${socket.id}:`, err);
      }
    });
  });
}

module.exports = { initializeSocket };
