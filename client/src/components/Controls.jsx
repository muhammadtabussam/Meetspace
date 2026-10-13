import React, { useState, useEffect, useRef } from 'react';
import {
  FiMic,
  FiMicOff,
  FiVideo,
  FiVideoOff,
  FiMonitor,
  FiMessageSquare,
  FiCopy,
  FiPhoneOff,
  FiUsers,
  FiSmile,
  FiMaximize,
  FiMinimize,
  FiRadio,
  FiSquare,
} from 'react-icons/fi';

const EMOJI_LIST = ['👍', '❤️', '👏', '😂', '🎉', '🔥'];

const Controls = ({
  isMicOn,
  isCameraOn,
  isScreenSharing,
  isChatOpen,
  isParticipantsOpen,
  isHandRaised,
  isRecording,
  onToggleMic,
  onToggleCamera,
  onToggleScreenShare,
  onToggleChat,
  onToggleParticipants,
  onToggleHand,
  onToggleRecording,
  onSendReaction,
  onCopyLink,
  onLeave,
  participantsCount = 1,
  hasUnreadMessages = false,
}) => {
  const [showConfirmLeave, setShowConfirmLeave] = useState(false);
  const [showReactions, setShowReactions] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const reactionsRef = useRef(null);

  // Close reaction popup on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (reactionsRef.current && !reactionsRef.current.contains(e.target)) {
        setShowReactions(false);
      }
    };
    if (showReactions) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showReactions]);

  // Fullscreen toggle handler
  const handleToggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    const onFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, []);

  const handleSelectReaction = (emoji) => {
    if (onSendReaction) onSendReaction(emoji);
    setShowReactions(false);
  };

  return (
    <>
      <div className="controls-bar">
        {/* Mic Toggle */}
        <button
          className={`control-btn ${isMicOn ? 'active' : 'inactive'}`}
          onClick={onToggleMic}
          data-tooltip={isMicOn ? 'Mute Mic' : 'Unmute Mic'}
          aria-label={isMicOn ? 'Mute Mic' : 'Unmute Mic'}
        >
          {isMicOn ? <FiMic /> : <FiMicOff />}
        </button>

        {/* Camera Toggle */}
        <button
          className={`control-btn ${isCameraOn ? 'active' : 'inactive'}`}
          onClick={onToggleCamera}
          data-tooltip={isCameraOn ? 'Turn Off Camera' : 'Turn On Camera'}
          aria-label={isCameraOn ? 'Turn Off Camera' : 'Turn On Camera'}
        >
          {isCameraOn ? <FiVideo /> : <FiVideoOff />}
        </button>

        {/* Screen Share Toggle */}
        <button
          className={`control-btn ${isScreenSharing ? 'active' : ''}`}
          onClick={onToggleScreenShare}
          data-tooltip={isScreenSharing ? 'Stop Screen Share' : 'Share Screen'}
          aria-label={isScreenSharing ? 'Stop Screen Share' : 'Share Screen'}
        >
          <FiMonitor />
        </button>

        {/* Raise Hand Toggle */}
        {onToggleHand && (
          <button
            className={`control-btn hand-btn ${isHandRaised ? 'active-hand' : ''}`}
            onClick={onToggleHand}
            data-tooltip={isHandRaised ? 'Lower Hand' : 'Raise Hand'}
            aria-label={isHandRaised ? 'Lower Hand' : 'Raise Hand'}
          >
            <span style={{ fontSize: '1.25rem' }}>✋</span>
          </button>
        )}

        {/* Recording Toggle */}
        {onToggleRecording && (
          <button
            className={`control-btn ${isRecording ? 'recording' : ''}`}
            onClick={onToggleRecording}
            data-tooltip={isRecording ? 'Stop Recording' : 'Start Recording'}
            aria-label={isRecording ? 'Stop Recording' : 'Start Recording'}
          >
            {isRecording ? <FiSquare /> : <FiRadio />}
          </button>
        )}

        {/* Emoji Reactions Menu */}
        <div className="reactions-wrapper" ref={reactionsRef}>
          <button
            className={`control-btn ${showReactions ? 'active' : ''}`}
            onClick={() => setShowReactions((prev) => !prev)}
            data-tooltip="Reactions"
            aria-label="Reactions"
          >
            <FiSmile />
          </button>

          {showReactions && (
            <div className="reactions-popover">
              {EMOJI_LIST.map((emoji) => (
                <button
                  key={emoji}
                  className="reaction-emoji-btn"
                  onClick={() => handleSelectReaction(emoji)}
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Fullscreen Toggle */}
        <button
          className="control-btn"
          onClick={handleToggleFullscreen}
          data-tooltip={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
          aria-label={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
        >
          {isFullscreen ? <FiMinimize /> : <FiMaximize />}
        </button>

        {/* Chat Toggle */}
        <button
          className={`control-btn ${isChatOpen ? 'active' : ''}`}
          onClick={onToggleChat}
          data-tooltip="Chat"
          aria-label="Chat"
          style={{ position: 'relative' }}
        >
          <FiMessageSquare />
          {hasUnreadMessages && !isChatOpen && <span className="unread-dot" />}
        </button>

        {/* Participants Toggle */}
        {onToggleParticipants && (
          <button
            className={`control-btn ${isParticipantsOpen ? 'active' : ''}`}
            onClick={onToggleParticipants}
            data-tooltip={`Participants (${participantsCount})`}
            aria-label={`Participants (${participantsCount})`}
          >
            <FiUsers />
            <span className="control-count-badge">{participantsCount}</span>
          </button>
        )}

        {/* Copy Link */}
        <button
          className="control-btn"
          onClick={onCopyLink}
          data-tooltip="Copy Meeting Link"
          aria-label="Copy Meeting Link"
        >
          <FiCopy />
        </button>

        {/* Leave Meeting Button */}
        <button
          className="control-btn btn-leave"
          onClick={() => setShowConfirmLeave(true)}
          data-tooltip="Leave Meeting"
          aria-label="Leave Meeting"
        >
          <FiPhoneOff />
        </button>
      </div>

      {/* Confirmation Modal for Leaving */}
      {showConfirmLeave && (
        <div className="modal-backdrop" onClick={() => setShowConfirmLeave(false)}>
          <div className="confirm-modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">Leave this meeting?</h3>
            <p className="modal-text">
              You will disconnect and be returned to the home screen.
            </p>
            <div className="modal-actions">
              <button
                className="btn-secondary"
                onClick={() => setShowConfirmLeave(false)}
              >
                Stay in call
              </button>
              <button
                className="btn-danger"
                onClick={() => {
                  setShowConfirmLeave(false);
                  onLeave();
                }}
              >
                Leave meeting
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Controls;
