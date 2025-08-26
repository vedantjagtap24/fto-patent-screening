import React, { useState, useEffect } from 'react';
import { supabase } from './lib/supabase';
import Login from './components/Login/Login';
import MainLayout from './components/App/MainLayout';

function App() {
  const [session, setSession] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleLogin = (authData) => {
    console.log('handleLogin called with:', authData);
    
    // Validate the auth data before setting state
    if (authData && authData.user && authData.session) {
      setSession(authData.session);
      setUser(authData.user);
      console.log('Login successful, user set:', authData.user.email);
    } else {
      console.error('Invalid auth data received:', authData);
      // Don't set session/user if data is invalid
    }
  };

  const handleLogout = () => {
    setSession(null);
    setUser(null);
  };

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        background: 'linear-gradient(135deg, #2563eb 0%, #1e40af 100%)',
        color: 'white'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ 
            width: '40px', 
            height: '40px', 
            border: '3px solid rgba(255, 255, 255, 0.3)',
            borderTop: '3px solid white',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 1rem'
          }} />
          <div>Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="App">
      {!session ? (
        <Login onLogin={handleLogin} />
      ) : (
        <MainLayout 
          user={user} 
          session={session}
          onLogout={handleLogout} 
        />
      )}
    </div>
  );
}

export default App;