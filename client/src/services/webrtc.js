// ICE server configuration fetcher
export const getICEServers = async (meetingId) => {
  try {
    const response = await fetch(`/api/meetings/${meetingId}/ice-servers`);
    const data = await response.json();
    return data.iceServers;
  } catch (error) {
    console.warn('Failed to fetch ICE servers, using defaults');
    return [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
    ];
  }
};

// Create a new RTCPeerConnection with given ICE servers
export const createPeerConnection = (iceServers, onIceCandidate, onTrack, onConnectionStateChange) => {
  const pc = new RTCPeerConnection({ iceServers });
  
  pc.onicecandidate = (event) => {
    if (event.candidate) {
      onIceCandidate(event.candidate);
    }
  };
  
  pc.ontrack = (event) => {
    onTrack(event.streams[0]);
  };
  
  pc.onconnectionstatechange = () => {
    onConnectionStateChange(pc.connectionState);
  };
  
  pc.oniceconnectionstatechange = () => {
    console.log('ICE connection state:', pc.iceConnectionState);
    if (pc.iceConnectionState === 'failed') {
      pc.restartIce();
    }
  };
  
  return pc;
};

// Create and set local offer
export const createOffer = async (pc) => {
  const offer = await pc.createOffer({
    offerToReceiveAudio: true,
    offerToReceiveVideo: true,
  });
  await pc.setLocalDescription(offer);
  return offer;
};

// Create and set local answer
export const createAnswer = async (pc, offer) => {
  await pc.setRemoteDescription(new RTCSessionDescription(offer));
  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);
  return answer;
};

// Set remote answer
export const setRemoteAnswer = async (pc, answer) => {
  await pc.setRemoteDescription(new RTCSessionDescription(answer));
};

// Add ICE candidate
export const addIceCandidate = async (pc, candidate) => {
  try {
    await pc.addIceCandidate(new RTCIceCandidate(candidate));
  } catch (error) {
    console.error('Error adding ICE candidate:', error);
  }
};
