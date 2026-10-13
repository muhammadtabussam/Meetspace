import React, { useMemo, useState } from 'react';
import { FiMessageSquare, FiChevronRight, FiSend, FiX } from 'react-icons/fi';

const quickHelp = [
  'How do I create a meeting?',
  'How do I join a room?',
  'My camera or microphone is not working',
  'How do I record a meeting?',
  'How do I share my screen?',
  'Check my setup',
];

const getOfflineHelpReply = (question) => {
  const value = question.toLowerCase();

  if (value.includes('hear') || value.includes('sound') || value.includes('speaker') || value.includes('audio')) {
    return 'If you cannot hear someone, check your computer’s selected output device and make sure the browser tab is not muted. Ask the other person to check their microphone button. Your own mic button only controls the sound you send.';
  }

  if (value.includes('camera') || value.includes('mic') || value.includes('microphone') || value.includes('permission')) {
    return 'In the meeting lobby, use the camera and microphone buttons to choose what to turn on before joining. If a device is unavailable, select the site-permissions icon beside your browser address bar, allow camera and microphone access, and close other apps using those devices. Reload the lobby and try again.';
  }

  if (value.includes('record') || value.includes('save video') || value.includes('download')) {
    return 'During a meeting, select the recording button to start and select it again to stop. The recording downloads as a .webm file. MeetSpace currently records your own camera and microphone only; it does not include remote participants.';
  }

  if (value.includes('screen') || value.includes('share')) {
    return 'During a meeting, select the screen-share button, choose a screen, window, or browser tab in the browser picker, and confirm. To stop, select the screen-share button again or use the browser’s sharing controls.';
  }

  if (value.includes('chat') || value.includes('message') || value.includes('send')) {
    return 'Open In-call Messages from the meeting controls. Type your message in the box at the bottom and press Enter or select the send button. Messages are shared with participants in the current room.';
  }

  if (value.includes('join') || value.includes('code') || value.includes('link') || value.includes('invite')) {
    return 'On the MeetSpace home page, enter your display name and the meeting code or invite link, then select Join. If the room cannot be found, check that the link is complete and ask the host for a fresh one; rooms may no longer be available after everyone leaves.';
  }

  if (value.includes('create') || value.includes('new meeting') || value.includes('start meeting')) {
    return 'On the MeetSpace home page, enter your display name and select New Meeting. Allow camera or microphone access in the lobby if you want to use them, then select Join Meeting to enter the room.';
  }

  if (value.includes('connect') || value.includes('loading') || value.includes('stuck') || value.includes('server') || value.includes('not working') || value.includes('error')) {
    return 'First reload the MeetSpace page and try joining with a fresh meeting link. For camera or microphone problems, check site permissions beside the browser address bar. If the page still cannot connect, the MeetSpace server may be unavailable; ask the person hosting the app to check it.';
  }

  return 'I can help with creating or joining meetings, camera and microphone access, sound, screen sharing, and in-call messages. Tell me what you are trying to do or what you see on the screen, and I’ll suggest the next step. The full AI provider is not connected, so this reply comes from the built-in local guide.';
};

const createRequestTimeout = (milliseconds) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), milliseconds);
  return {
    signal: controller.signal,
    clear: () => clearTimeout(timeout),
  };
};

const getPermissionState = async (name) => {
  if (!navigator.permissions?.query) return 'not supported by this browser';
  try {
    const permission = await navigator.permissions.query({ name });
    return permission.state;
  } catch {
    return 'not available in this browser';
  }
};

const checkSetup = async () => {
  const checks = [
    `Secure page: ${window.isSecureContext ? 'yes' : 'no — open MeetSpace on localhost or HTTPS'}`,
    `Media access support: ${
      navigator.mediaDevices?.getUserMedia ? 'available' : 'unavailable in this browser/context'
    }`,
  ];

  const [cameraPermission, microphonePermission] = await Promise.all([
    getPermissionState('camera'),
    getPermissionState('microphone'),
  ]);
  checks.push(`Camera permission: ${cameraPermission}`);
  checks.push(`Microphone permission: ${microphonePermission}`);

  const backendUrl = (import.meta.env.VITE_SERVER_URL || '').replace(/\/$/, '');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch(`${backendUrl}/health`, {
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`server returned HTTP ${response.status}`);
    }
    const health = await response.json();
    checks.push(`MeetSpace server: ${health.status === 'ok' ? 'reachable' : 'responded, but reported an unexpected status'}`);
  } catch (error) {
    const reason = error.name === 'AbortError' ? 'request timed out' : error.message;
    checks.push(`MeetSpace server: unreachable (${reason}). Ask the MeetSpace administrator to check the server.`);
  } finally {
    clearTimeout(timeout);
  }

  return `Setup check:\n${checks.join('\n')}\n\nPermission status is read-only; this check will not turn on your camera or microphone.`;
};

const AIAssistant = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [isBusy, setIsBusy] = useState(false);
  const [isOfflineMode, setIsOfflineMode] = useState(false);
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      text: 'Hi! I am MeetSpace Help. Ask me a question in your own words, or choose “Check my setup” to check your browser and server connection.',
    },
  ]);

  const suggestions = useMemo(() => quickHelp, []);

  const sendMessage = async (question) => {
    const trimmed = (question || '').trim();
    if (!trimmed || isBusy) return;

    const shouldCheckSetup = trimmed.toLowerCase() === 'check my setup';
    const history = messages
      .filter((item) => !item.local && (item.role === 'user' || item.role === 'assistant'))
      .slice(-10)
      .map(({ role, text }) => ({ role, content: text.slice(0, 2000) }));
    const fallbackId = `fallback-${Date.now()}`;
    const fallbackReply = `AI provider is unavailable; here is the built-in MeetSpace help:\n\n${getOfflineHelpReply(trimmed)}`;
    setMessages((prev) => [
      ...prev,
      { role: 'user', text: trimmed },
      { id: fallbackId, role: 'assistant', text: fallbackReply, local: true },
    ]);
    setInput('');
    setIsBusy(true);
    setIsOfflineMode(true);

    if (shouldCheckSetup) {
      setMessages((prev) => [...prev, { role: 'assistant', text: 'Checking your setup…', local: true }]);
      try {
        const result = await checkSetup();
        setMessages((prev) => [
          ...prev.slice(0, -1),
          { role: 'assistant', text: result, local: true },
        ]);
      } catch (error) {
        setMessages((prev) => [
          ...prev.slice(0, -1),
          { role: 'assistant', text: `Setup check failed: ${error.message}`, local: true },
        ]);
      } finally {
        setIsBusy(false);
      }
      return;
    }

    const requestTimeout = createRequestTimeout(8000);
    try {
      const response = await fetch('/api/assistant/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: trimmed, history }),
        signal: requestTimeout.signal,
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const error = new Error(data.error || 'The assistant could not answer. Please try again.');
        error.status = response.status;
        throw error;
      }
      setIsOfflineMode(false);
      setMessages((prev) => prev.map((item) =>
        item.id === fallbackId
          ? { ...item, text: data.reply, local: false }
          : item
      ));
    } catch (error) {
      if (error.status) {
        setMessages((prev) => prev.map((item) => item.id === fallbackId
          ? {
              ...item,
              text: `${error.message}\n\nBuilt-in MeetSpace help:\n${getOfflineHelpReply(trimmed)}`,
            }
          : item
        ));
      }
    } finally {
      requestTimeout.clear();
      setIsBusy(false);
    }
  };

  return (
    <div className="ai-assistant-wrap">
      <button
        type="button"
        className="ai-assistant-fab"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label="Open MeetSpace Help"
      >
        <FiMessageSquare />
        <span>MeetSpace Help</span>
      </button>

      {isOpen && (
        <div className="ai-assistant-panel">
          <div className="ai-assistant-header">
            <div className="ai-assistant-title">
              <FiMessageSquare />
                <span>{isOfflineMode ? 'MeetSpace Help · Offline' : 'MeetSpace AI Help'}</span>
            </div>
            <button type="button" aria-label="Close assistant" onClick={() => setIsOpen(false)}>
              <FiX />
            </button>
          </div>

          <p className="ai-assistant-disclaimer">
            AI replies use the configured provider. If it is unavailable, the built-in guide replies locally. Do not share passwords or private meeting content.
          </p>

          <div className="ai-assistant-messages">
            {messages.map((message, index) => (
              <div key={message.id || `${message.role}-${index}`} className={`ai-message ${message.role}`}>
                {message.text}
              </div>
            ))}
          </div>

          <div className="ai-assistant-suggestions">
            {suggestions.map((item) => (
              <button key={item} type="button" onClick={() => sendMessage(item)} disabled={isBusy}>
                {item}
                <FiChevronRight />
              </button>
            ))}
          </div>

          <form
            className="ai-assistant-form"
            onSubmit={(event) => {
              event.preventDefault();
              sendMessage(input);
            }}
          >
            <input
              type="text"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Ask for help..."
              aria-label="Ask MeetSpace Help"
              maxLength={2000}
              disabled={isBusy}
            />
            <button type="submit" aria-label="Send message" disabled={isBusy}>
              {isBusy ? <span className="ai-assistant-loading">…</span> : <FiSend />}
            </button>
          </form>
        </div>
      )}
    </div>
  );
};

export default AIAssistant;
