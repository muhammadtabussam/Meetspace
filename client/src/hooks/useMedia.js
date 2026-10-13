import { useState, useCallback, useRef, useEffect } from 'react';

export const useMedia = () => {
  const [localStream, setLocalStream] = useState(null);
  const [isMicOn, setIsMicOn] = useState(true);
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [mediaError, setMediaError] = useState(null);
  const localStreamRef = useRef(null);
  const screenStreamRef = useRef(null);
  const originalVideoTrackRef = useRef(null);

  const syncTrackState = useCallback((stream) => {
    if (!stream) {
      setIsMicOn(false);
      setIsCameraOn(false);
      return;
    }

    const audioTrack = stream.getAudioTracks()[0];
    const videoTrack = stream.getVideoTracks()[0];

    setIsMicOn(audioTrack ? audioTrack.enabled : false);
    setIsCameraOn(videoTrack ? videoTrack.enabled : false);
  }, []);

  const startMedia = useCallback(async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      const msg = 'Camera and microphone require a secure context. Please access via https:// or localhost.';
      console.warn(msg);
      setMediaError(msg);
      return null;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      localStreamRef.current = stream;
      setLocalStream(stream);
      syncTrackState(stream);
      setMediaError(null);
      return stream;
    } catch (error) {
      console.error('Media access error:', error);
      let errorMsg = 'Could not access camera/microphone.';
      if (error.name === 'NotAllowedError') {
        errorMsg = 'Camera/microphone permission denied. Please allow access in your browser settings.';
      } else if (error.name === 'NotFoundError') {
        errorMsg = 'No camera or microphone found.';
      } else if (error.name === 'NotReadableError') {
        errorMsg = 'Camera or microphone is already in use by another application.';
      }
      setMediaError(errorMsg);
      try {
        const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        localStreamRef.current = audioStream;
        setLocalStream(audioStream);
        syncTrackState(audioStream);
        setIsCameraOn(false);
        setMediaError(`${errorMsg} Continuing with microphone only.`);
        return audioStream;
      } catch (audioError) {
        console.error('Microphone access error:', audioError);
        setMediaError(`${errorMsg} Microphone access also failed; check browser permissions.`);
        return null;
      }
    }
  }, [syncTrackState]);

  const toggleMic = useCallback(() => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMicOn(audioTrack.enabled);
      }
    }
  }, [localStream]);

  const toggleCamera = useCallback(() => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsCameraOn(videoTrack.enabled);
      }
    }
  }, [localStream]);

  const startScreenShare = useCallback(async () => {
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: { cursor: 'always' },
        audio: false,
      });
      screenStreamRef.current = screenStream;
      
      // Save original video track
      if (localStream) {
        originalVideoTrackRef.current = localStream.getVideoTracks()[0];
      }
      
      setIsScreenSharing(true);
      
      // Handle user stopping share via browser UI
      screenStream.getVideoTracks()[0].onended = () => {
        stopScreenShare();
      };
      
      return screenStream;
    } catch (error) {
      console.error('Screen share error:', error);
      if (error.name !== 'NotAllowedError') {
        setMediaError('Failed to start screen sharing.');
      }
      return null;
    }
  }, [localStream]);

  const stopScreenShare = useCallback(() => {
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(track => track.stop());
      screenStreamRef.current = null;
    }
    setIsScreenSharing(false);
    return originalVideoTrackRef.current;
  }, []);

  const stopMedia = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
      setLocalStream(null);
      setIsMicOn(false);
      setIsCameraOn(false);
    }
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(track => track.stop());
      screenStreamRef.current = null;
    }
    originalVideoTrackRef.current = null;
    setIsScreenSharing(false);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopMedia();
    };
  }, [stopMedia]);

  return {
    localStream,
    isMicOn,
    isCameraOn,
    isScreenSharing,
    mediaError,
    startMedia,
    toggleMic,
    toggleCamera,
    startScreenShare,
    stopScreenShare,
    stopMedia,
    screenStreamRef,
  };
};
