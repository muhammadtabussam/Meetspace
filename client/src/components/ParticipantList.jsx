import React from 'react';
import { FiX, FiUserX } from 'react-icons/fi';

const ParticipantList = ({
  participants = [],
  hostId,
  currentUserId,
  isHost,
  onRemoveParticipant,
  isOpen,
  onClose,
}) => {
  return (
    <aside className={`side-panel ${isOpen ? 'open' : 'closed'}`}>
      <div className="panel-header">
        <h3 className="panel-title">Participants ({participants.length})</h3>
        <button className="panel-close-btn" onClick={onClose} aria-label="Close participants">
          <FiX />
        </button>
      </div>

      <div className="participant-list-content">
        {participants.map((participant) => {
          const participantId = participant.socketId || participant.id;
          const isParticipantHost = participantId === hostId || participant.isHost;
          const isSelf = participantId === currentUserId;
          const firstLetter = (participant.userName || participant.name || 'G').trim().charAt(0).toUpperCase();

          return (
            <div key={participantId} className="participant-item">
              <div className="participant-info">
                <div className="participant-avatar-sm">{firstLetter}</div>
                <div>
                  <span className="participant-name-text">
                    {participant.userName || participant.name || 'Participant'}
                    {isSelf && ' (You)'}
                  </span>
                  {isParticipantHost && <span className="host-badge" style={{ marginLeft: '0.5rem' }}>Host</span>}
                </div>
              </div>

              {/* Host can remove other participants */}
              {isHost && !isParticipantHost && !isSelf && (
                <button
                  className="btn-remove-user"
                  onClick={() => onRemoveParticipant(participantId)}
                  title="Remove participant"
                  aria-label={`Remove ${participant.userName || participant.name}`}
                >
                  <FiUserX />
                </button>
              )}
            </div>
          );
        })}
      </div>
    </aside>
  );
};

export default ParticipantList;
