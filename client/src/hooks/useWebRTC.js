import { useState, useRef, useCallback, useEffect } from 'react';
import { getSocket } from '../services/socket';
import { getICEServers, createPeerConnection, createOffer, createAnswer, setRemoteAnswer, addIceCandidate } from '../services/webrtc';

export const useWebRTC = (localStream, roomId) => {
  const [remoteStreams, setRemoteStreams] = useState(new Map());
  const [connectionStatus, setConnectionStatus] = useState('new');
  const peerConnections = useRef(new Map());
  const iceServersRef = useRef(null);
  const pendingCandidates = useRef(new Map());

  const getOrFetchICEServers = useCallback(async () => {
    if (!iceServersRef.current) {
      iceServersRef.current = await getICEServers(roomId);
    }
    return iceServersRef.current;
  }, [roomId]);

  const createPeerForUser = useCallback(async (targetSocketId) => {
    if (peerConnections.current.has(targetSocketId)) {
      peerConnections.current.get(targetSocketId).close();
    }
    
    const iceServers = await getOrFetchICEServers();
    const socket = getSocket();
    
    const pc = createPeerConnection(
      iceServers,
      // onIceCandidate
      (candidate) => {
        socket.emit('ice-candidate', { to: targetSocketId, candidate });
      },
      // onTrack
      (stream) => {
        setRemoteStreams(prev => {
          const next = new Map(prev);
          next.set(targetSocketId, stream);
          return next;
        });
      },
      // onConnectionStateChange
      (state) => {
        setConnectionStatus(state);
        if (state === 'disconnected' || state === 'failed') {
          console.warn(`Connection to ${targetSocketId}: ${state}`);
        }
      }
    );
    
    // Add local tracks to peer connection
    if (localStream) {
      localStream.getTracks().forEach(track => {
        pc.addTrack(track, localStream);
      });
    }
    
    peerConnections.current.set(targetSocketId, pc);
    
    // Add any pending ICE candidates
    if (pendingCandidates.current.has(targetSocketId)) {
      const candidates = pendingCandidates.current.get(targetSocketId);
      for (const candidate of candidates) {
        await addIceCandidate(pc, candidate);
      }
      pendingCandidates.current.delete(targetSocketId);
    }
    
    return pc;
  }, [localStream, getOrFetchICEServers]);

  // Handle new user joining — we create offer
  const handleUserJoined = useCallback(async ({ socketId }) => {
    console.log('User joined, creating offer for:', socketId);
    const pc = await createPeerForUser(socketId);
    const offer = await createOffer(pc);
    const socket = getSocket();
    socket.emit('offer', { to: socketId, offer });
  }, [createPeerForUser]);

  // Handle receiving an offer — we create answer
  const handleOffer = useCallback(async ({ from, offer }) => {
    console.log('Received offer from:', from);
    const pc = await createPeerForUser(from);
    const answer = await createAnswer(pc, offer);
    const socket = getSocket();
    socket.emit('answer', { to: from, answer });
  }, [createPeerForUser]);

  // Handle receiving an answer
  const handleAnswer = useCallback(async ({ from, answer }) => {
    console.log('Received answer from:', from);
    const pc = peerConnections.current.get(from);
    if (pc) {
      await setRemoteAnswer(pc, answer);
    }
  }, []);

  // Handle ICE candidate
  const handleIceCandidate = useCallback(async ({ from, candidate }) => {
    const pc = peerConnections.current.get(from);
    if (pc) {
      await addIceCandidate(pc, candidate);
    } else {
      // Queue candidate if PC not yet created
      if (!pendingCandidates.current.has(from)) {
        pendingCandidates.current.set(from, []);
      }
      pendingCandidates.current.get(from).push(candidate);
    }
  }, []);

  // Handle user leaving
  const handleUserLeft = useCallback(({ socketId }) => {
    console.log('User left:', socketId);
    const pc = peerConnections.current.get(socketId);
    if (pc) {
      pc.close();
      peerConnections.current.delete(socketId);
    }
    setRemoteStreams(prev => {
      const next = new Map(prev);
      next.delete(socketId);
      return next;
    });
  }, []);

  // Replace video track on all peer connections (for screen sharing)
  const replaceVideoTrack = useCallback(async (newTrack) => {
    for (const [, pc] of peerConnections.current) {
      const sender = pc.getSenders().find(s => s.track && s.track.kind === 'video');
      if (sender) {
        await sender.replaceTrack(newTrack);
      }
    }
  }, []);

  // Close all peer connections
  const closeAllConnections = useCallback(() => {
    for (const [, pc] of peerConnections.current) {
      pc.close();
    }
    peerConnections.current.clear();
    pendingCandidates.current.clear();
    setRemoteStreams(new Map());
  }, []);

  // Set up socket listeners
  useEffect(() => {
    const socket = getSocket();
    
    socket.on('user-joined', handleUserJoined);
    socket.on('offer', handleOffer);
    socket.on('answer', handleAnswer);
    socket.on('ice-candidate', handleIceCandidate);
    socket.on('user-left', handleUserLeft);
    socket.on('you-were-removed', () => {
      closeAllConnections();
    });
    
    return () => {
      socket.off('user-joined', handleUserJoined);
      socket.off('offer', handleOffer);
      socket.off('answer', handleAnswer);
      socket.off('ice-candidate', handleIceCandidate);
      socket.off('user-left', handleUserLeft);
      socket.off('you-were-removed');
      closeAllConnections();
    };
  }, [handleUserJoined, handleOffer, handleAnswer, handleIceCandidate, handleUserLeft, closeAllConnections]);

  return {
    remoteStreams,
    connectionStatus,
    replaceVideoTrack,
    closeAllConnections,
    peerConnections,
  };
};
