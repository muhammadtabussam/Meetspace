import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FiVideo,
  FiShield,
  FiSmile,
  FiPlus,
  FiArrowRight,
  FiMonitor,
  FiMessageSquare,
  FiUsers,
  FiClock,
  FiLock,
  FiLogOut,
  FiZap,
} from 'react-icons/fi';
import { useAuth } from '../context/AuthContext';

const Home = () => {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const [userName, setUserName] = useState(
    () => localStorage.getItem('meetspace_user_name') || user?.displayName || ''
  );
  const [meetingCode, setMeetingCode] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState('');
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isSigningOut, setIsSigningOut] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const handleNameChange = (e) => {
    setUserName(e.target.value);
    localStorage.setItem('meetspace_user_name', e.target.value);
    if (error) setError('');
  };

  const handleSignOut = async () => {
    setIsSigningOut(true);
    try {
      await signOut();
      navigate('/login', { replace: true });
    } catch (err) {
      setError(err.message || 'Could not sign out. Please try again.');
      setIsSigningOut(false);
    }
  };

  const handleCreateMeeting = async () => {
    const trimmedName = userName.trim();
    if (!trimmedName) {
      setError('Please enter your display name to start a meeting.');
      return;
    }

    setIsCreating(true);
    setError('');

    try {
      const response = await fetch('/api/meetings/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ hostName: trimmedName }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || data.message || 'Failed to create meeting.');
      }

      const data = await response.json();
      const meetingId = data.meetingId || data.id;

      navigate(`/join/${meetingId}`, {
        state: { userName: trimmedName },
      });
    } catch (err) {
      console.error('Create meeting error:', err);
      setError(err.message || 'Could not connect to server. Please ensure the backend is running.');
    } finally {
      setIsCreating(false);
    }
  };

  const handleJoinMeeting = (e) => {
    e.preventDefault();
    const trimmedName = userName.trim();
    if (!trimmedName) {
      setError('Please enter your display name first.');
      return;
    }

    const trimmedCode = meetingCode.trim().replace(/\s+/g, '');
    if (!trimmedCode) {
      setError('Please enter a valid meeting code or link.');
      return;
    }

    // Extract code if user pasted a full URL
    let extractedCode = trimmedCode;
    try {
      if (trimmedCode.startsWith('http://') || trimmedCode.startsWith('https://')) {
        const url = new URL(trimmedCode);
        const parts = url.pathname.split('/').filter(Boolean);
        extractedCode = parts[parts.length - 1];
      }
    } catch {
      // Raw code fallback
    }

    navigate(`/join/${extractedCode}`, {
      state: { userName: trimmedName },
    });
  };

  const formattedDate = currentTime.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
  const formattedTime = currentTime.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className="home-page-wrapper">
      {/* Top Navigation */}
      <header className="home-navbar">
        <div className="brand-logo">
          <div className="logo-icon-glow">
            <FiVideo />
          </div>
          <span className="brand-title">
            Meet<span className="brand-accent">Space</span>
          </span>
        </div>

        <div className="nav-right">
          <div className="nav-time-pill">
            <FiClock />
            <span>{formattedTime} • {formattedDate}</span>
          </div>
          <div className="nav-secure-badge">
            <FiLock />
            <span>P2P Encrypted</span>
          </div>
          <div className="nav-account">
            <span className="nav-account-email">{user?.email}</span>
            <button type="button" onClick={handleSignOut} disabled={isSigningOut}>
              <FiLogOut />
              <span>{isSigningOut ? 'Signing out…' : 'Sign out'}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="home-hero-container">
        <div className="hero-grid">
          {/* Left Column: Actions */}
          <div className="hero-content">
            <div className="hero-badge">
              <FiZap className="badge-icon" />
              <span>Next-Gen WebRTC Video Calling</span>
            </div>

            <h1 className="hero-headline">
              Premium video meetings. <br />
              <span className="gradient-text">Free & instant for everyone.</span>
            </h1>

            <p className="hero-subtext">
              Collaborate and communicate in real-time with crystal-clear audio,
              low-latency HD video, instant screen sharing, and interactive group chat.
            </p>

            {error && (
              <div className="hero-error-banner">
                <span>⚠️ {error}</span>
              </div>
            )}

            <div className="hero-actions-card">
              <div className="input-group">
                <label className="input-label" htmlFor="user-name-input">
                  Your Display Name
                </label>
                <input
                  id="user-name-input"
                  type="text"
                  className="modern-input"
                  placeholder="e.g. Alex Johnson"
                  value={userName}
                  onChange={handleNameChange}
                  maxLength={40}
                  autoFocus
                />
              </div>

              <div className="actions-row">
                <button
                  className="btn-create-meeting"
                  onClick={handleCreateMeeting}
                  disabled={isCreating}
                >
                  {isCreating ? (
                    <>
                      <div className="btn-spinner" />
                      <span>Creating...</span>
                    </>
                  ) : (
                    <>
                      <FiPlus />
                      <span>New Meeting</span>
                    </>
                  )}
                </button>

                <div className="join-divider">
                  <span>or</span>
                </div>

                <form onSubmit={handleJoinMeeting} className="join-form">
                  <div className="join-input-wrapper">
                    <FiVideo className="join-field-icon" />
                    <input
                      type="text"
                      className="modern-input join-field"
                      placeholder="Enter a code or link"
                      value={meetingCode}
                      onChange={(e) => {
                        setMeetingCode(e.target.value);
                        if (error) setError('');
                      }}
                    />
                  </div>
                  <button type="submit" className="btn-join-meeting">
                    <span>Join</span>
                    <FiArrowRight />
                  </button>
                </form>
              </div>
            </div>

            <p className="hero-footer-note">
              🔒 Signed in securely • Direct peer-to-peer WebRTC • High resolution
            </p>
          </div>

          {/* Right Column: Visual Mockup */}
          <div className="hero-visual">
            <div className="visual-card-glass">
              <div className="mockup-header">
                <div className="mockup-dots">
                  <span className="dot red" />
                  <span className="dot yellow" />
                  <span className="dot green" />
                </div>
                <div className="mockup-room-pill">
                  <span className="live-dot" />
                  <span>room-alpha-92</span>
                </div>
              </div>

              <div className="mockup-grid">
                <div className="mockup-tile active-user">
                  <div className="mockup-avatar gradient-1">A</div>
                  <span className="mockup-name">Alex (Host)</span>
                  <div className="mockup-audio-wave">
                    <span /><span /><span />
                  </div>
                </div>

                <div className="mockup-tile">
                  <div className="mockup-avatar gradient-2">S</div>
                  <span className="mockup-name">Sarah</span>
                </div>

                <div className="mockup-tile">
                  <div className="mockup-avatar gradient-3">D</div>
                  <span className="mockup-name">David</span>
                </div>

                <div className="mockup-tile screen-tile">
                  <FiMonitor className="screen-icon" />
                  <span className="mockup-name">Screen Share (1080p)</span>
                </div>
              </div>

              <div className="mockup-floating-pill reaction-pill">
                <span>👏 Great presentation!</span>
              </div>
              <div className="mockup-floating-pill hand-pill">
                <span>✋ Sarah raised hand</span>
              </div>
            </div>
          </div>
        </div>

        {/* Feature Grid */}
        <section className="home-feature-cards">
          <div className="feature-item">
            <div className="feature-icon-box gradient-indigo">
              <FiVideo />
            </div>
            <h3>Crystal Clear HD</h3>
            <p>Adaptive bitrate WebRTC streaming ensures crisp audio and high-definition video even on fluctuating networks.</p>
          </div>

          <div className="feature-item">
            <div className="feature-icon-box gradient-rose">
              <FiMonitor />
            </div>
            <h3>One-Click Screen Sharing</h3>
            <p>Seamlessly share your entire screen, a browser tab, or application window with fellow participants in 60fps.</p>
          </div>

          <div className="feature-item">
            <div className="feature-icon-box gradient-amber">
              <FiMessageSquare />
            </div>
            <h3>In-Call Chat & Reactions</h3>
            <p>Exchange messages, send live floating emojis, and raise your hand to ask questions without interrupting.</p>
          </div>

          <div className="feature-item">
            <div className="feature-icon-box gradient-emerald">
              <FiShield />
            </div>
            <h3>Direct Peer Security</h3>
            <p>Direct peer-to-peer encryption means your audio and video streams flow directly between users.</p>
          </div>
        </section>
      </main>
    </div>
  );
};

export default Home;
