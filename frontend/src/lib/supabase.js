import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ykyjebqoknnkesrpawkd.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlreWplYnFva25ua2VzcnBhd2tkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYxOTYyNjksImV4cCI6MjA3MTc3MjI2OX0.GTDbIoRyQomSeffMIPq5K1lJSYuwBe-kyMZKCsKisr8';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Auth helpers
export const signUp = async (email, password) => {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  });
  return { data, error };
};

export const signIn = async (email, password) => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  return { data, error };
};

export const signOut = async () => {
  const { error } = await supabase.auth.signOut();
  return { error };
};

export const getCurrentUser = async () => {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
};

export const getSession = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  return session;
};