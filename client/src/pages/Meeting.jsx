import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { FiVideo, FiClock, FiCopy, FiCheck } from 'react-icons/fi';
import { getSocket, connectSocket, disconnectSocket } from '../services/socket';
import { useMedia } from '../hooks/useMedia';
import { useWebRTC } from '../hooks/useWebRTC';
import VideoTile from '../components/VideoTile';
import Controls from '../components/Controls';
import Chat from '../components/Chat';
import ParticipantList from '../components/ParticipantList';

const Meeting = () => {
  const { meetingId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  const userName = useMemo(() => {
    return (
      location.state?.userName ||
      localStorage.getItem('meetspace_user_name') ||
      'Guest User'
    );
  }, [location.state?.userName]);

  const initialMicOn = location.state?.initialMicOn ?? true;
  const initialCameraOn = location.state?.initialCameraOn ?? true;

  // UI state
  const [participants, setParticipants] = useState([]);
  const [hostId, setHostId] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isParticipantsOpen, setIsParticipantsOpen] = useState(false);
  const [hasUnreadChat, setHasUnreadChat] = useState(false);
  const [screenSharerId, setScreenSharerId] = useState(null);
  const [pinnedId, setPinnedId] = useState(null);
  const [isHandRaised, setIsHandRaised] = useState(false);
  const [raisedHands, setRaisedHands] = useState(new Set());
  const [floatingReactions, setFloatingReactions] = useState([]);
  const [callDuration, setCallDuration] = useState(0);
  const [copiedCode, setCopiedCode] = useState(false);
  const [toast, setToast] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef(null);
  const recordedChunksRef = useRef([]);

  // Hook 1: Media
  const {
    localStream,
    isMicOn,
    isCameraOn,
    isScreenSharing,
    startMedia,
    toggleMic,
    toggleCamera,
    startScreenShare,
    stopScreenShare,
    stopMedia,
  } = useMedia();

  // Hook 2: WebRTC
  const {
    remoteStreams,
    connectionStatus,
    replaceVideoTrack,
    closeAllConnections,
  } = useWebRTC(localStream, meetingId);

  // Call duration timer
  useEffect(() => {
    const timer = setInterval(() => {
      setCallDuration((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  // Show a toast message
  const showToast = useCallback((message, type = 'info') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 4000);
  }, []);

  // 1. Start media and connect socket on mount
  useEffect(() => {
    let active = true;

    const initMeeting = async () => {
      const stream = await startMedia();
      if (!active) return;

      // Honor initial mic/camera choices
      if (stream) {
        if (!initialMicOn) {
          const audioTrack = stream.getAudioTracks()[0];
          if (audioTrack) audioTrack.enabled = false;
        }
        if (!initialCameraOn) {
          const videoTrack = stream.getVideoTracks()[0];
          if (videoTrack) videoTrack.enabled = false;
        }
      }

      const socket = connectSocket();
      socket.emit('join-room', {
        roomId: meetingId,
        userName,
      });
    };

    initMeeting();

    return () => {
      active = false;
    };
  }, [meetingId, userName, startMedia, initialMicOn, initialCameraOn]);

  // 2. Setup socket listeners
  useEffect(() => {
    const socket = getSocket();

    const handleRoomParticipants = ({ participants: pList, selfId }) => {
      const normalized = (pList || []).map((p) => ({
        socketId: p.id || p.socketId,
        userName: p.name || p.userName,
        isHost: p.isHost || false,
      }));
      setParticipants(normalized);
    };

    const handleRoomInfo = ({ room }) => {
      setHostId(room?.hostId || null);
    };

    const handleUserJoinedEvent = ({ socketId, userName: newUserName }) => {
      showToast(`${newUserName || 'A participant'} joined the meeting.`, 'info');
      setParticipants((prev) => {
        if (prev.some((p) => p.socketId === socketId)) return prev;
        return [...prev, { socketId, userName: newUserName, isHost: false }];
      });
    };

    const handleUserLeftEvent = ({ socketId, userName: leftUserName, newHostId: updatedHostId }) => {
      if (leftUserName) {
        showToast(`${leftUserName} left the meeting.`, 'info');
      }
      setParticipants((prev) => prev.filter((p) => p.socketId !== socketId));
      if (updatedHostId) {
        setHostId(updatedHostId);
      }
      if (screenSharerId === socketId) {
        setScreenSharerId(null);
      }
      if (pinnedId === socketId) {
        setPinnedId(null);
      }
      setRaisedHands((prev) => {
        const next = new Set(prev);
        next.delete(socketId);
        return next;
      });
    };

    const handleChatMessage = (messageData) => {
      setChatMessages((prev) => [...prev, messageData]);
      if (!isChatOpen) {
        setHasUnreadChat(true);
      }
    };

    const handleScreenShareStarted = ({ socketId }) => {
      setScreenSharerId(socketId);
      const sharer = participants.find((p) => (p.socketId || p.id) === socketId);
      showToast(`${sharer?.userName || 'A participant'} started sharing their screen.`, 'info');
    };

    const handleScreenShareStopped = () => {
      setScreenSharerId(null);
    };

    const handleHandToggled = ({ socketId, isHandRaised: raised }) => {
      setRaisedHands((prev) => {
        const next = new Set(prev);
        if (raised) {
          next.add(socketId);
        } else {
          next.delete(socketId);
        }
        return next;
      });
    };

    const handleReactionReceived = (reaction) => {
      setFloatingReactions((prev) => [...prev, reaction]);
      setTimeout(() => {
        setFloatingReactions((prev) => prev.filter((r) => r.id !== reaction.id));
      }, 3500);
    };

    const handleYouWereRemoved = ({ message: msg }) => {
      showToast(msg || 'You were removed from the room.', 'error');
      setTimeout(() => {
        stopMedia();
        closeAllConnections();
        disconnectSocket();
        navigate('/', { state: { message: msg } });
      }, 1500);
    };

    const handleError = (err) => {
      showToast(err.message || 'An error occurred.', 'error');
    };

    socket.on('room-participants', handleRoomParticipants);
    socket.on('room-info', handleRoomInfo);
    socket.on('user-joined', handleUserJoinedEvent);
    socket.on('user-left', handleUserLeftEvent);
    socket.on('chat-message', handleChatMessage);
    socket.on('screen-share-started', handleScreenShareStarted);
    socket.on('screen-share-stopped', handleScreenShareStopped);
    socket.on('hand-toggled', handleHandToggled);
    socket.on('reaction-received', handleReactionReceived);
    socket.on('you-were-removed', handleYouWereRemoved);
    socket.on('error', handleError);

    return () => {
      socket.off('room-participants', handleRoomParticipants);
      socket.off('room-info', handleRoomInfo);
      socket.off('user-joined', handleUserJoinedEvent);
      socket.off('user-left', handleUserLeftEvent);
      socket.off('chat-message', handleChatMessage);
      socket.off('screen-share-started', handleScreenShareStarted);
      socket.off('screen-share-stopped', handleScreenShareStopped);
      socket.off('hand-toggled', handleHandToggled);
      socket.off('reaction-received', handleReactionReceived);
      socket.off('you-were-removed', handleYouWereRemoved);
      socket.off('error', handleError);
    };
  }, [
    showToast,
    screenSharerId,
    pinnedId,
    participants,
    stopMedia,
    closeAllConnections,
    navigate,
    isChatOpen,
  ]);

  // Clean up all resources on unmount
  useEffect(() => {
    return () => {
      const socket = getSocket();
      socket.emit('leave-room', { roomId: meetingId });
      stopMedia();
      closeAllConnections();
      disconnectSocket();
    };
  }, [meetingId, stopMedia, closeAllConnections]);

  // Mic toggle
  const handleToggleMic = () => {
    toggleMic();
  };

  // Camera toggle
  const handleToggleCamera = () => {
    toggleCamera();
  };

  // Screen share toggle
  const handleScreenShare = async () => {
    const socket = getSocket();
    if (!isScreenSharing) {
      try {
        const screenStream = await startScreenShare();
        if (screenStream) {
          const screenVideoTrack = screenStream.getVideoTracks()[0];
          replaceVideoTrack(screenVideoTrack);
          socket.emit('screen-share-started', { roomId: meetingId });

          screenVideoTrack.onended = () => {
            stopScreenShare();
            if (localStream) {
              const originalTrack = localStream.getVideoTracks()[0];
              if (originalTrack) replaceVideoTrack(originalTrack);
            }
            socket.emit('screen-share-stopped', { roomId: meetingId });
          };
        }
      } catch (err) {
        showToast('Screen sharing was cancelled or denied.', 'error');
      }
    } else {
      stopScreenShare();
      if (localStream) {
        const originalTrack = localStream.getVideoTracks()[0];
        if (originalTrack) replaceVideoTrack(originalTrack);
      }
      socket.emit('screen-share-stopped', { roomId: meetingId });
    }
  };

  // Hand raise toggle
  const handleToggleHand = () => {
    const socket = getSocket();
    const nextState = !isHandRaised;
    setIsHandRaised(nextState);
    socket.emit('toggle-hand', { roomId: meetingId, isHandRaised: nextState });
  };

  const handleToggleRecording = async () => {
    if (!localStream || typeof MediaRecorder === 'undefined') {
      showToast('Recording is not supported in this browser.', 'error');
      return;
    }

    if (!isRecording) {
      const streamToRecord = localStream;
      recordedChunksRef.current = [];
      const recorder = new MediaRecorder(streamToRecord, {
        mimeType: MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
          ? 'video/webm;codecs=vp9'
          : MediaRecorder.isTypeSupported('video/webm;codecs=vp8')
          ? 'video/webm;codecs=vp8'
          : 'video/webm',
      });

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `meetspace-recording-${Date.now()}.webm`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 10000);
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
      showToast('Recording started.', 'success');
      return;
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      showToast('Recording saved to your downloads.', 'success');
    }
  };

  // Emoji reactions
  const handleSendReaction = (emoji) => {
    const socket = getSocket();
    socket.emit('send-reaction', {
      roomId: meetingId,
      emoji,
      senderName: userName,
    });
  };

  // Chat message send
  const handleSendMessage = (text) => {
    const socket = getSocket();
    socket.emit('chat-message', {
      roomId: meetingId,
      message: text,
    });
  };

  // Copy link
  const handleCopyLink = () => {
    const link = `${window.location.origin}/join/${meetingId}`;
    navigator.clipboard
      .writeText(link)
      .then(() => {
        setCopiedCode(true);
        setTimeout(() => setCopiedCode(false), 2500);
        showToast('Meeting link copied to clipboard!', 'success');
      })
      .catch(() => {
        showToast(`Could not auto-copy. Room: ${meetingId}`, 'info');
      });
  };

  // Leave meeting
  const handleLeave = () => {
    const socket = getSocket();
    socket.emit('leave-room', { roomId: meetingId });
    stopMedia();
    closeAllConnections();
    disconnectSocket();
    navigate('/');
  };

  // Host removes participant
  const handleRemoveParticipant = (targetSocketId) => {
    const socket = getSocket();
    socket.emit('remove-participant', {
      roomId: meetingId,
      targetSocketId,
    });
  };

  const currentSocketId = getSocket().id;
  const isHost = currentSocketId && currentSocketId === hostId;

  // Remote streams array
  const remoteEntries = Array.from(remoteStreams.entries());
  const totalVideoCount = 1 + remoteEntries.length;

  // Determine grid count class
  const gridCountClass =
    totalVideoCount === 1
      ? 'count-1'
      : totalVideoCount === 2
      ? 'count-2'
      : totalVideoCount <= 4
      ? 'count-4'
      : totalVideoCount <= 6
      ? 'count-6'
      : 'count-many';

  // Check spotlight/pinned state
  const activeSpotlightId = screenSharerId || pinnedId;

  return (
    <div className="meeting-container">
      {/* Meeting Header */}
      <header className="meeting-header">
        <div className="meeting-header-left">
          <div className="meeting-brand">
            <FiVideo />
            <span>MeetSpace</span>
          </div>

          <div
            className="meeting-code-pill"
            onClick={handleCopyLink}
            title="Click to copy meeting link"
          >
            <span>{meetingId}</span>
            {copiedCode ? <FiCheck className="copied-icon" /> : <FiCopy />}
          </div>
        </div>

        <div className="meeting-header-right">
          <div className="meeting-timer-badge">
            <FiClock />
            <span>{formatDuration(callDuration)}</span>
          </div>

          <div
            className={`connection-dot ${
              connectionStatus === 'connected'
                ? 'connected'
                : connectionStatus === 'connecting'
                ? 'connecting'
                : 'disconnected'
            }`}
            title={`WebRTC: ${connectionStatus}`}
          />
        </div>
      </header>

      {/* Main Area */}
      <main className="meeting-main">
        {/* Floating Reactions Overlay */}
        <div className="floating-reactions-container">
          {floatingReactions.map((r) => (
            <div key={r.id} className="floating-reaction-item">
              <span className="reaction-emoji">{r.emoji}</span>
              <span className="reaction-sender">{r.senderName}</span>
            </div>
          ))}
        </div>

        <div className="video-grid-wrapper">
          {/* If there is a spotlight/pinned user */}
          {activeSpotlightId ? (
            <div className="spotlight-layout">
              <div className="spotlight-stage">
                {activeSpotlightId === 'local' || activeSpotlightId === currentSocketId ? (
                  <VideoTile
                    stream={localStream}
                    userName={userName}
                    isLocal={true}
                    isMuted={!isMicOn}
                    isCameraOff={!isCameraOn}
                    isScreenShare={isScreenSharing}
                    isHandRaised={isHandRaised}
                    isPinned={pinnedId === 'local'}
                    onTogglePin={() => setPinnedId(null)}
                  />
                ) : (
                  (() => {
                    const peerStream = remoteStreams.get(activeSpotlightId);
                    const pInfo = participants.find(
                      (p) => (p.socketId || p.id) === activeSpotlightId
                    );
                    const peerName = pInfo?.userName || pInfo?.name || 'Participant';
                    return (
                      <VideoTile
                        stream={peerStream}
                        userName={peerName}
                        isLocal={false}
                        isMuted={false}
                        isCameraOff={false}
                        isScreenShare={screenSharerId === activeSpotlightId}
                        isHandRaised={raisedHands.has(activeSpotlightId)}
                        isPinned={pinnedId === activeSpotlightId}
                        onTogglePin={() => setPinnedId(null)}
                      />
                    );
                  })()
                )}
              </div>

              {/* Filmstrip for other participants */}
              <div className="spotlight-filmstrip">
                {activeSpotlightId !== 'local' && activeSpotlightId !== currentSocketId && (
                  <div className="filmstrip-item">
                    <VideoTile
                      stream={localStream}
                      userName={userName}
                      isLocal={true}
                      isMuted={!isMicOn}
                      isCameraOff={!isCameraOn}
                      isScreenShare={isScreenSharing}
                      isHandRaised={isHandRaised}
                      isPinned={false}
                      onTogglePin={() => setPinnedId('local')}
                    />
                  </div>
                )}
                {remoteEntries
                  .filter(([id]) => id !== activeSpotlightId)
                  .map(([peerSocketId, stream]) => {
                    const pInfo = participants.find(
                      (p) => (p.socketId || p.id) === peerSocketId
                    );
                    const peerName = pInfo?.userName || pInfo?.name || 'Participant';
                    return (
                      <div key={peerSocketId} className="filmstrip-item">
                        <VideoTile
                          stream={stream}
                          userName={peerName}
                          isLocal={false}
                          isMuted={false}
                          isCameraOff={false}
                          isScreenShare={screenSharerId === peerSocketId}
                          isHandRaised={raisedHands.has(peerSocketId)}
                          isPinned={false}
                          onTogglePin={() => setPinnedId(peerSocketId)}
                        />
                      </div>
                    );
                  })}
              </div>
            </div>
          ) : (
            /* Regular Responsive Grid (All tiles fit cleanly inside viewport) */
            <div className={`video-grid ${gridCountClass}`}>
              {/* Local Video Tile */}
              <VideoTile
                stream={localStream}
                userName={userName}
                isLocal={true}
                isMuted={!isMicOn}
                isCameraOff={!isCameraOn}
                isScreenShare={isScreenSharing}
                isHandRaised={isHandRaised}
                isPinned={false}
                onTogglePin={() => setPinnedId('local')}
              />

              {/* Remote Video Tiles */}
              {remoteEntries.map(([peerSocketId, stream]) => {
                const participantInfo = participants.find(
                  (p) => (p.socketId || p.id) === peerSocketId
                );
                const peerName = participantInfo?.userName || participantInfo?.name || 'Participant';
                const isPeerScreenShare = screenSharerId === peerSocketId;

                return (
                  <VideoTile
                    key={peerSocketId}
                    stream={stream}
                    userName={peerName}
                    isLocal={false}
                    isMuted={false}
                    isCameraOff={false}
                    isScreenShare={isPeerScreenShare}
                    isHandRaised={raisedHands.has(peerSocketId)}
                    isPinned={false}
                    onTogglePin={() => setPinnedId(peerSocketId)}
                  />
                );
              })}
            </div>
          )}
        </div>

        {/* Chat Side Panel */}
        <Chat
          messages={chatMessages}
          onSendMessage={handleSendMessage}
          isOpen={isChatOpen}
          onClose={() => setIsChatOpen(false)}
          currentUserId={currentSocketId}
        />

        {/* Participant List Side Panel */}
        <ParticipantList
          participants={participants}
          hostId={hostId}
          currentUserId={currentSocketId}
          isHost={isHost}
          onRemoveParticipant={handleRemoveParticipant}
          isOpen={isParticipantsOpen}
          onClose={() => setIsParticipantsOpen(false)}
        />
      </main>

      {/* Controls Bar */}
      <Controls
        isMicOn={isMicOn}
        isCameraOn={isCameraOn}
        isScreenSharing={isScreenSharing}
        isChatOpen={isChatOpen}
        isParticipantsOpen={isParticipantsOpen}
        isHandRaised={isHandRaised}
        isRecording={isRecording}
        hasUnreadMessages={hasUnreadChat}
        participantsCount={Math.max(1, participants.length)}
        onToggleMic={handleToggleMic}
        onToggleCamera={handleToggleCamera}
        onToggleScreenShare={handleScreenShare}
        onToggleHand={handleToggleHand}
        onToggleRecording={handleToggleRecording}
        onSendReaction={handleSendReaction}
        onToggleChat={() => {
          setIsChatOpen((prev) => {
            if (!prev) setHasUnreadChat(false);
            return !prev;
          });
          if (!isChatOpen) setIsParticipantsOpen(false);
        }}
        onToggleParticipants={() => {
          setIsParticipantsOpen((prev) => !prev);
          if (!isParticipantsOpen) setIsChatOpen(false);
        }}
        onCopyLink={handleCopyLink}
        onLeave={handleLeave}
      />

      {/* Toast Notification */}
      {toast && (
        <div className={`toast-notification ${toast.type}`}>
          <span>{toast.message}</span>
        </div>
      )}
    </div>
  );
};

export default Meeting;
