import React, { useState, useRef, useEffect } from 'react';
import { FiX, FiSend } from 'react-icons/fi';

const Chat = ({ messages = [], onSendMessage, isOpen, onClose, currentUserId }) => {
  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen]);

  const handleSubmit = (e) => {
    e.preventDefault();
    const trimmed = inputText.trim();
    if (!trimmed) return;
    if (trimmed.length > 1000) return;

    onSendMessage(trimmed);
    setInputText('');
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    try {
      const date = new Date(timestamp);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  return (
    <aside className={`side-panel ${isOpen ? 'open' : 'closed'}`}>
      <div className="panel-header">
        <h3 className="panel-title">In-call Messages</h3>
        <button className="panel-close-btn" onClick={onClose} aria-label="Close chat">
          <FiX />
        </button>
      </div>

      <div className="chat-messages">
        {messages.length === 0 ? (
          <div className="chat-empty">
            <p>No messages yet.</p>
            <p style={{ fontSize: '0.8rem', marginTop: '0.25rem' }}>Send a message to everyone in the room.</p>
          </div>
        ) : (
          messages.map((msg, index) => {
            const isSelf = msg.senderId === currentUserId;
            return (
              <div key={msg.id || index} className={`chat-message ${isSelf ? 'self' : ''}`}>
                <div className="chat-meta">
                  <span className="sender">{isSelf ? 'You' : msg.senderName || 'Participant'}</span>
                  <span className="time">{formatTime(msg.timestamp || msg.time)}</span>
                </div>
                <div className="text">{msg.text || msg.message}</div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      <form className="chat-input-area" onSubmit={handleSubmit}>
        <input
          type="text"
          className="chat-message-input"
          placeholder="Message everyone..."
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          maxLength={1000}
          aria-label="Write a message to everyone in the meeting"
        />
        <button
          type="submit"
          className="chat-send-btn"
          disabled={!inputText.trim()}
          aria-label="Send message"
        >
          <FiSend />
        </button>
        <span className="chat-input-hint">Enter to send</span>
      </form>
    </aside>
  );
};

export default Chat;
