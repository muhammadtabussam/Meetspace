import React, { useRef, useEffect, useState } from 'react';
import { FiMicOff, FiVideoOff, FiMaximize2, FiMinimize2 } from 'react-icons/fi';

const VideoTile = ({
  stream,
  userName = 'Guest',
  isLocal = false,
  isMuted = false,
  isCameraOff = false,
  isScreenShare = false,
  isHandRaised = false,
  isPinned = false,
  onTogglePin,
}) => {
  const videoRef = useRef(null);
  const [objectFit, setObjectFit] = useState(isScreenShare ? 'contain' : 'cover');

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  useEffect(() => {
    if (isScreenShare) {
      setObjectFit('contain');
    }
  }, [isScreenShare]);

  const firstLetter = (userName || 'G').trim().charAt(0).toUpperCase();

  const toggleFitMode = (e) => {
    e.stopPropagation();
    setObjectFit((prev) => (prev === 'cover' ? 'contain' : 'cover'));
  };

  const tileClasses = [
    'video-tile',
    isLocal ? 'local' : '',
    isScreenShare ? 'screen-share-tile' : '',
    isPinned ? 'pinned-tile' : '',
    isHandRaised ? 'hand-raised' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const showVideo = stream && !isCameraOff;

  return (
    <div className={tileClasses}>
      {showVideo ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isLocal}
          style={{ objectFit }}
        />
      ) : (
        <div className="no-video-placeholder">
          <div className="avatar-circle">{firstLetter}</div>
          <p className="avatar-name">{userName}</p>
        </div>
      )}

      {/* Hand Raised Notice */}
      {isHandRaised && (
        <div className="hand-raised-badge" title={`${userName} raised their hand`}>
          ✋ <span className="hand-text">Hand Raised</span>
        </div>
      )}

      {/* Hover Actions: Pin & Fit Toggle */}
      <div className="tile-hover-actions">
        {onTogglePin && (
          <button
            className={`tile-action-btn ${isPinned ? 'active' : ''}`}
            onClick={(e) => {
              e.stopPropagation();
              onTogglePin();
            }}
            title={isPinned ? 'Unpin tile' : 'Pin tile to spotlight'}
          >
            {isPinned ? <FiMinimize2 /> : <FiMaximize2 />}
          </button>
        )}
        {showVideo && (
          <button
            className="tile-action-btn"
            onClick={toggleFitMode}
            title={objectFit === 'cover' ? 'Switch to Fit (No Crop)' : 'Switch to Fill'}
          >
            {objectFit === 'cover' ? 'Fit' : 'Fill'}
          </button>
        )}
      </div>

      {/* Participant Name Badge */}
      <div className="participant-name">
        <span className="name-text">{userName}</span>
        {isLocal && <span className="you-pill">You</span>}
        {isScreenShare && <span className="screen-pill">Screen</span>}
      </div>

      {/* Mic/Cam Status Badges */}
      <div className="participant-status">
        {isMuted && (
          <div className="status-badge muted" title="Microphone muted">
            <FiMicOff />
          </div>
        )}
        {isCameraOff && !isScreenShare && (
          <div className="status-badge camera-off" title="Camera turned off">
            <FiVideoOff />
          </div>
        )}
      </div>
    </div>
  );
};

export default VideoTile;
