import React from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import Home from './pages/Home';
import JoinMeeting from './pages/JoinMeeting';
import Meeting from './pages/Meeting';
import Login from './pages/Login';
import AIAssistant from './components/AIAssistant';
import { AuthProvider, useAuth } from './context/AuthContext';

function ProtectedApp() {
  const location = useLocation();
  const { user, status } = useAuth();

  if (status === 'loading') {
    return (
      <main className="auth-loading">
        <span className="auth-loading-spinner" />
        <p>Securing your MeetSpace session…</p>
      </main>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return (
    <>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/join/:meetingId" element={<JoinMeeting />} />
        <Route path="/meeting/:meetingId" element={<Meeting />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <AIAssistant />
    </>
  );
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Login />} />
      <Route path="*" element={<ProtectedApp />} />
    </Routes>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}

export default App;
