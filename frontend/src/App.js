import React, { useState } from 'react';
import Login from './components/Login/Login';
import MainLayout from './components/App/MainLayout';

const App = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState(null);

  const handleLogin = (userData) => {
    setUser(userData);
    setIsLoggedIn(true);
  };

  const handleLogout = () => {
    setUser(null);
    setIsLoggedIn(false);
  };

  if (!isLoggedIn) {
    return <Login onLogin={handleLogin} />;
  }

  return <MainLayout user={user} onLogout={handleLogout} />;
};

export default App;