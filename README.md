# MeetSpace — Real-Time Video Calling Web Application

MeetSpace is a full-featured, Google Meet-inspired real-time video conferencing web application built with **React (Vite)**, **Node.js/Express**, **Socket.IO**, and **WebRTC (Mesh Architecture)**.

---

## 1. Architecture Overview

```
 ┌──────────────────────┐         HTTP / REST          ┌──────────────────────┐
 │                      │ ───────────────────────────> │                      │
 │    React + Vite      │ <─────────────────────────── │   Express Server     │
 │     (Port 5173)      │       Meeting APIs / ICE     │     (Port 3001)      │
 │                      │                              │                      │
 │                      │      Socket.IO Signaling     │  Socket.IO Handler   │
 │                      │ <══════════════════════════> │  (Rooms & Signaling) │
 └──────────┬───────────┘                              └──────────────────────┘
            │
            │ WebRTC Peer-to-Peer Mesh (Audio, Video, Screen)
            ▼
 ┌──────────────────────┐
 │     Remote Peer      │
 │    Browser Client    │
 └──────────────────────┘
```

### Components
1. **Frontend (Client)**:
   - **Vite + React 18**: Fast HMR dev server and optimized production bundling.
   - **Custom Hooks**:
     - `useMedia`: Manages user media streams (camera, microphone), screen-share capture, device mute/unmute toggles, and track tear-down.
     - `useWebRTC`: Manages peer connections (`RTCPeerConnection`), SDP offer/answer negotiation, ICE candidate exchange, candidate buffering, and track replacements.
   - **Components**:
     - `VideoTile`: Renders local and remote streams, fallback avatars with initials, badges for mic/cam status, and screen share expansion.
     - `Controls`: Audio, video, screen share, chat toggle, participant list toggle, link copy with feedback, and leave call modal.
     - `Chat`: Slide-in sidebar for real-time room messaging with timestamps and sender differentiation.
     - `ParticipantList`: Slide-in sidebar showing connected participants, host badge, and host kick action.
   - **Pages**:
     - `Home`: Create meetings or enter codes with custom display names.
     - `JoinMeeting`: Pre-meeting lobby/greenroom with camera & microphone preview test before entering.
     - `Meeting`: The core conference room orchestrator.

2. **Backend (Server)**:
   - **Express REST API**:
     - `POST /api/auth/register` and `POST /api/auth/login`: Validate email/password credentials, hash passwords with scrypt, and issue HTTP-only sessions.
     - `GET /api/auth/me` and `POST /api/auth/logout`: Restore or revoke the current session.
     - `POST /api/meetings/create`: Generates unique, human-friendly meeting IDs (`xxx-xxxx-xxx`) and initializes room state. Rate-limited to 10 requests/minute.
     - `GET /api/meetings/:meetingId/validate`: Checks room validity and participant limits before admission. Rate-limited to 30 requests/minute.
     - `GET /api/meetings/:meetingId/ice-servers`: Supplies STUN and optional TURN configuration to clients.
   - **Socket.IO Signaling Server**:
     - Room joining, leaving, and graceful disconnect handlers.
     - WebRTC signaling routing (`offer`, `answer`, `ice-candidate`).
     - Screen share notifications and status syncing.
     - In-call chat broadcasting.
     - Host moderation permissions (kick participant).
   - **Room Service (`roomService.js`)**:
     - In-memory data store with automatic cleanup of empty or inactive rooms after timeouts.
     - Host role tracking and dynamic host reassignment on departure.

---

## 2. Project Folder Structure

```
MeetSpace/
├── client/                              # Frontend React application
│   ├── index.html                       # HTML entry point
│   ├── package.json                     # Client dependencies & scripts
│   ├── vite.config.js                   # Vite configuration & backend proxy
│   └── src/
│       ├── main.jsx                     # React root bootstrap with BrowserRouter
│       ├── App.jsx                      # Route definitions
│       ├── index.css                    # Complete dark-theme design system (600+ lines)
│       ├── context/
│       │   └── AuthContext.jsx          # Session state and sign-in/sign-up actions
│       ├── components/
│       │   ├── VideoTile.jsx            # Video stream tile & avatar fallback
│       │   ├── Controls.jsx             # Conference room control bar
│       │   ├── Chat.jsx                 # Side panel chat drawer
│       │   └── ParticipantList.jsx      # Side panel roster with moderation
│       ├── hooks/
│       │   ├── useMedia.js              # Media stream & device state hook
│       │   └── useWebRTC.js             # WebRTC mesh & signaling hook
│       ├── pages/
│       │   ├── Login.jsx                # Responsive sign-in and account creation
│       │   ├── Home.jsx                 # Landing page
│       │   ├── JoinMeeting.jsx          # Lobby / hardware check
│       │   └── Meeting.jsx              # Conference room
│       └── services/
│           ├── socket.js                # Socket.IO client singleton
│           └── webrtc.js                # WebRTC helper functions
│
├── server/                              # Backend Node.js / Express application
│   ├── package.json                     # Server dependencies & scripts
│   ├── server.js                        # Express app & Socket.IO server entry
│   ├── .env                             # Active environment configuration
│   ├── .env.example                     # Environment template
│   └── src/
│       ├── config/
│       │   └── database.js              # Optional MongoDB connection (with fallback)
│       ├── routes/
│       │   ├── authRoutes.js            # Registration, login, session, and logout
│       │   └── meetingRoutes.js         # REST endpoints for room lifecycle & ICE
│       │   └── assistantRoutes.js       # Rate-limited, server-side AI help proxy
│       ├── middleware/
│       │   └── requireAuthentication.js # Protects meeting and assistant APIs
│       ├── services/
│       │   ├── authService.js           # Password hashing and persistent sessions
│       │   └── roomService.js           # Room state, participant, and host management
│       └── sockets/
│           └── meetingSocket.js         # Socket.IO signaling & event routing
└── README.md                            # Complete documentation
```

---

## 3. Installation & Setup

### Prerequisites
- [Node.js](https://nodejs.org/) v18.0.0 or higher
- npm v9 or higher

### Server Installation
```bash
cd "MeetSpace/server"
npm install
```

### Client Installation
```bash
cd "MeetSpace/client"
npm install
```

*(Note for Windows PowerShell: If script execution policy errors occur, use `npm.cmd install` instead of `npm install`)*

---

## 4. Environment Configuration

The server configuration resides in `MeetSpace/server/.env`:

```ini
# Server Port
PORT=3001

# Allowed Client Origin (for CORS)
CLIENT_URL=http://localhost:5173

# Optional MongoDB Database (runs in in-memory mode if omitted or unreachable)
MONGODB_URI=mongodb://localhost:27017/meetspace

# TURN / STUN Server Configuration (Optional for local test; recommended for production NAT traversal)
TURN_SERVER_URL=
TURN_USERNAME=
TURN_CREDENTIAL=

# Maximum participants allowed per room
MAX_PARTICIPANTS=10

# OpenAI-compatible AI assistant (OpenAI defaults)
# The URL and model default to OpenAI and gpt-4o-mini if omitted.
AI_API_KEY=
AI_API_URL=https://api.openai.com/v1/chat/completions
AI_MODEL=gpt-4o-mini
```

Create `server/.env` from `.env.example`, add your OpenAI API key as `AI_API_KEY`, and restart the backend. The URL and model shown above are defaults and can be changed for another OpenAI-compatible provider. Keep the key only in `server/.env` or your hosting provider's secret settings; never put it in the client environment, paste it into chat, or commit it. The endpoint must use HTTPS (HTTP is allowed only for a local development endpoint). When the provider is unconfigured or unavailable, the client uses a built-in MeetSpace help guide instead of leaving the user without a response. “Check my setup” runs locally in the browser and does not send those diagnostic results to the AI provider.

---

## 5. Running Locally

On Windows, run `start-all.bat` from the project folder. It starts the backend, waits until its health endpoint responds, then starts Vite and opens the actual client port in your browser. If a default port is already in use, the backend and Vite may select another port automatically. Keep both application windows open while using MeetSpace.

For manual startup, start `node server.js` from `server` first, then run `npm.cmd run dev` from `client`. The backend records its active port in the ignored `.server-port` file so Vite can proxy API and Socket.IO traffic to it. The client records its actual port in `.client-port`.

MeetSpace now opens with an account sign-in page. Choose **Create an account** the first time, then sign in with the same email and password on later visits. Passwords are hashed with scrypt; browser sessions use an HTTP-only cookie and expire after seven days. User records and sessions are kept in `server/data/auth-store.json`, which is excluded from Git. Back up this file if you need to preserve locally created accounts. This single-file store is intended for a single local server; production or multi-instance hosting should use a shared, durable user database.

To enable live AI replies, copy `server/.env.example` to `server/.env`, set `AI_API_KEY` privately, and restart the backend. Without a valid provider key, the assistant still answers common MeetSpace questions with its built-in local guide; it cannot generate OpenAI responses.

### Local Testing Checklist
1. Open MeetSpace and create an account or sign in.
2. Enter your name (e.g., **"Alice"**) and click **"Create Meeting"**.
3. You will enter the **Join Meeting Lobby**. Grant camera and microphone permissions when prompted.
4. Verify your camera preview works, then click **"Join Meeting"**.
5. Once in the call, click the **Copy Link** button in the bottom control bar.
6. Open an **Incognito / Private Window** (or a second browser like Firefox or Edge), create a second account there, and sign in.
7. Paste the copied link into Browser 2 (or navigate to MeetSpace and input the meeting code).
8. Enter a second name (e.g., **"Bob"**) and click **"Join Meeting"**.
9. **Verify Real-Time Communication**:
   - Both browser windows should render each other's video stream and audio.
   - Toggle microphone and camera; observe visual mute/camera badges update in real-time.
   - Open the **Chat** panel, send messages, and confirm instant delivery in both windows.
   - Click the **Screen Share** icon; select a window or screen and verify it replaces the camera track seamlessly.
   - In the host window, open **Participants** and verify the "Remove" button functions to kick a participant.
10. Click **Leave Call** and verify local media devices turn off.

### Open MeetSpace on a phone
- `localhost` refers to the device you are using. A link such as `http://localhost:5173` pasted on a phone points back to the phone, not your computer.
- For a phone on the same Wi-Fi, open the computer's LAN address and the Vite port shown in its terminal (for example `http://192.168.100.10:5173`). Local HTTP access may not allow camera/microphone permissions on the phone.
- For a phone on another network, start MeetSpace, then run `share-with-friend.bat`. Open the generated HTTPS address on the host computer, create the meeting from that address, and copy the meeting invite link from the meeting. Do not send a `localhost` invite link. Keep both app windows and the tunnel window open.
- Each participant needs their own MeetSpace account before joining a shared meeting.

---

## 6. Deploying Publicly on Render

The repository includes a `render.yaml` Blueprint for one public Node web service. It builds the React app and serves it from Express on the same HTTPS origin, so sign-in cookies, API calls, and Socket.IO work from phones and computers outside your Wi-Fi network.

1. Push this project to a GitHub repository and sign in to [Render](https://render.com).
2. In the Render dashboard, choose **New → Blueprint**, connect the repository, and deploy `render.yaml`.
3. The Blueprint attaches a 1 GB persistent disk at `/var/data`. Render persistent disks require a paid web-service plan. Keep this disk attached: the MeetSpace account and session store is written there, and the default service filesystem is temporary.
4. After deploy completes, open the HTTPS `onrender.com` URL shown by Render. Create your account there and share meeting links from that public URL—not from `localhost` or a private Wi-Fi address.
5. In the service's Environment settings, set `AI_API_KEY` if live AI responses are needed. Built-in MeetSpace help works without it. Configure `TURN_SERVER_URL`, `TURN_USERNAME`, and `TURN_CREDENTIAL` with a TURN provider for more reliable audio/video across restrictive mobile networks and firewalls. Save the values as Render secrets; do not commit them.

This Blueprint intentionally runs one service instance: meeting rooms and signaling state are currently held in server memory, so multiple instances would not share a meeting. The persistent disk preserves accounts between restarts and deploys, but is not a substitute for a shared database or backups. Render's free web-service plan cannot use the persistent disk needed to preserve accounts.

## 7. Production Deployment & TURN Configuration

### Why STUN / TURN is Necessary
- **STUN (Session Traversal Utilities for NAT)** discovers public IP addresses. It works well when peers are on non-symmetric NATs. Default Google public STUN servers are bundled.
- **TURN (Traversal Using Relays around NAT)** is necessary when users are behind strict corporate firewalls, mobile carrier NATs (CGNAT), or symmetric NATs where P2P direct hole punching fails.
- In production, configure TURN by signing up for a provider like [Metered.ca](https://www.metered.ca/) or [Xirsys](https://xirsys.com/), or deploy an open-source [Coturn](https://github.com/coturn/coturn) instance.
- Add your credentials to `server/.env`:
  ```ini
  TURN_SERVER_URL=turn:turn.example.com:3478
  TURN_USERNAME=myuser
  TURN_CREDENTIAL=mypassword
  ```

### HTTPS Requirement
Browsers require a **Secure Context (HTTPS or localhost)** to access media devices via `navigator.mediaDevices.getUserMedia` and `navigator.mediaDevices.getDisplayMedia`. Render provides HTTPS for the public service URL. For other hosting providers, serve the frontend and backend behind HTTPS and set `CLIENT_URL` to the public frontend URL.

---

## 8. Troubleshooting Guide

| Issue | Cause | Solution |
| :--- | :--- | :--- |
| **"Could not access camera/microphone"** | Browser permissions blocked or another app is using the webcam | Click lock icon in browser URL bar, ensure camera/mic permissions are set to "Allow", and close other software (Zoom, Teams). |
| **"Cannot GET /api/meetings/..."** | Backend server is not running or proxy issue | Ensure `node server.js` is running on port 3001. In `vite.config.js`, proxy forwards `/api` requests to `http://localhost:3001`. |
| **Remote video black / spinner** | Firewall blocking UDP or symmetric NAT | Verify ICE connection state. Configure TURN servers in `.env` for cross-network relay. |
| **"Meeting code does not exist or has ended"** | Room timed out after all users left | Create a new room from the home page. Rooms persist while users are connected. |
| **PowerShell script execution error (`npm.ps1`)** | Windows ExecutionPolicy restriction | Run `npm.cmd <command>` or `node <script>` in PowerShell. |
