import React, { useState, useEffect, useRef } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import {
  FiMic,
  FiMicOff,
  FiVideo,
  FiVideoOff,
  FiArrowLeft,
  FiCopy,
  FiCheck,
  FiUsers,
  FiShield,
} from 'react-icons/fi';
import { useMedia } from '../hooks/useMedia';

const JoinMeeting = () => {
  const { meetingId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  const [userName, setUserName] = useState(
    () => location.state?.userName || localStorage.getItem('meetspace_user_name') || ''
  );
  const [isValidating, setIsValidating] = useState(true);
  const [validationError, setValidationError] = useState('');
  const [meetingDetails, setMeetingDetails] = useState(null);
  const [copiedLink, setCopiedLink] = useState(false);

  const {
    localStream,
    isMicOn,
    isCameraOn,
    mediaError,
    startMedia,
    toggleMic,
    toggleCamera,
    stopMedia,
  } = useMedia();

  const videoRef = useRef(null);

  // Validate meeting code with backend
  useEffect(() => {
    let isSubscribed = true;

    const validateMeeting = async () => {
      try {
        setIsValidating(true);
        setValidationError('');
        const res = await fetch(`/api/meetings/${meetingId}/validate`);
        if (!res.ok) {
          throw new Error('This meeting code does not exist or has already ended.');
        }
        const data = await res.json();
        if (isSubscribed) {
          setMeetingDetails(data);
        }
      } catch (err) {
        if (isSubscribed) {
          setValidationError(err.message || 'Invalid meeting code.');
        }
      } finally {
        if (isSubscribed) {
          setIsValidating(false);
        }
      }
    };

    validateMeeting();

    return () => {
      isSubscribed = false;
    };
  }, [meetingId]);

  // Request media preview once validation succeeds
  useEffect(() => {
    if (!validationError && !isValidating) {
      startMedia();
    }
  }, [isValidating, validationError, startMedia]);

  // Attach stream to video tag
  useEffect(() => {
    if (videoRef.current && localStream) {
      videoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  const handleJoin = () => {
    const trimmed = userName.trim();
    if (!trimmed) {
      setValidationError('Please enter your display name to join.');
      return;
    }

    localStorage.setItem('meetspace_user_name', trimmed);

    // Stop the local preview stream so the meeting room can cleanly take control
    stopMedia();

    navigate(`/meeting/${meetingId}`, {
      state: {
        userName: trimmed,
        initialMicOn: isMicOn,
        initialCameraOn: isCameraOn,
      },
    });
  };

  const handleCopyLink = () => {
    const link = `${window.location.origin}/join/${meetingId}`;
    navigator.clipboard.writeText(link).then(() => {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    });
  };

  const firstLetter = (userName || 'G').trim().charAt(0).toUpperCase();

  if (isValidating) {
    return (
      <div className="join-lobby-wrapper center-state">
        <div className="lobby-spinner" />
        <h3 style={{ marginTop: '1.25rem', color: '#e2e8f0', fontWeight: 600 }}>
          Connecting to MeetSpace...
        </h3>
        <p style={{ color: '#94a3b8', fontSize: '0.9rem', marginTop: '0.25rem' }}>
          Verifying meeting room {meetingId}
        </p>
      </div>
    );
  }

  return (
    <div className="join-lobby-wrapper">
      {/* Top Navbar */}
      <header className="lobby-navbar">
        <button
          onClick={() => {
            stopMedia();
            navigate('/');
          }}
          className="btn-back-nav"
        >
          <FiArrowLeft />
          <span>Exit to Home</span>
        </button>

        <div className="lobby-room-code-badge" onClick={handleCopyLink} title="Click to copy link">
          <span>{meetingId}</span>
          {copiedLink ? <FiCheck className="check-icon" /> : <FiCopy />}
        </div>
      </header>

      {/* Main Greenroom Split Layout */}
      <main className="lobby-main-container">
        <div className="lobby-split-grid">
          {/* Left Column: Camera Preview */}
          <div className="lobby-camera-panel">
            <div className="camera-preview-box">
              {localStream && isCameraOn ? (
                <video ref={videoRef} autoPlay playsInline muted className="preview-video" />
              ) : (
                <div className="preview-avatar-placeholder">
                  <div className="preview-avatar-circle">{firstLetter}</div>
                  <p className="preview-avatar-label">Camera is turned off</p>
                </div>
              )}

              {/* Floating Mic/Cam Toggles */}
              <div className="camera-floating-controls">
                <button
                  className={`camera-toggle-btn ${!isMicOn ? 'off' : ''}`}
                  onClick={toggleMic}
                  title={isMicOn ? 'Mute Microphone' : 'Unmute Microphone'}
                >
                  {isMicOn ? <FiMic /> : <FiMicOff />}
                </button>

                <button
                  className={`camera-toggle-btn ${!isCameraOn ? 'off' : ''}`}
                  onClick={toggleCamera}
                  title={isCameraOn ? 'Turn Off Camera' : 'Turn On Camera'}
                >
                  {isCameraOn ? <FiVideo /> : <FiVideoOff />}
                </button>
              </div>

              {/* Live Status Tag */}
              <div className="preview-status-pill">
                <span className={`status-dot ${isMicOn ? 'live' : 'muted'}`} />
                <span>{isMicOn ? 'Mic Active' : 'Mic Muted'}</span>
              </div>
            </div>

            {mediaError && (
              <div className="lobby-error-notice">
                <span>⚠️ {mediaError}</span>
              </div>
            )}
          </div>

          {/* Right Column: Join Form & Info */}
          <div className="lobby-info-panel">
            <div className="lobby-info-card">
              <h1 className="lobby-title">Ready to join?</h1>

              <div className="lobby-participant-summary">
                <FiUsers className="summary-icon" />
                {meetingDetails?.participantCount !== undefined && meetingDetails.participantCount > 0 ? (
                  <span>
                    <strong>{meetingDetails.participantCount}</strong> participant(s) already in this call
                  </span>
                ) : (
                  <span>No one else is here yet. You'll be first!</span>
                )}
              </div>

              {validationError && (
                <div className="lobby-error-banner">
                  <span>{validationError}</span>
                </div>
              )}

              <div className="lobby-form-group">
                <label className="lobby-label" htmlFor="lobby-name-input">
                  What's your name?
                </label>
                <input
                  id="lobby-name-input"
                  type="text"
                  className="modern-input"
                  placeholder="Enter your name"
                  value={userName}
                  onChange={(e) => {
                    setUserName(e.target.value);
                    if (validationError) setValidationError('');
                  }}
                  maxLength={40}
                />
              </div>

              <div className="lobby-button-group">
                <button
                  className="btn-join-room-primary"
                  onClick={handleJoin}
                  disabled={!userName.trim() || Boolean(validationError)}
                >
                  <span>Join Meeting</span>
                </button>
              </div>

              <div className="lobby-security-note">
                <FiShield />
                <span>Encrypted peer-to-peer WebRTC connection</span>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default JoinMeeting;
