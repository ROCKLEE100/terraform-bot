import { ChatInterface } from './components/ChatInterface';
import { SignIn } from './components/SignIn';
import { Terminal, LogOut, User as UserIcon } from 'lucide-react';
import { useState, useEffect } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

function App() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const res = await axios.get(`${API_URL}/user/me`, { withCredentials: true });
      if (res.data.authenticated) {
        setUser(res.data.user);
        localStorage.setItem('lastUser', JSON.stringify(res.data.user));
      } else {
        setUser(null);
      }
    } catch (err) {
      console.error("Auth check failed:", err);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = () => {
    window.location.href = `${API_URL}/login`;
  };

  const handleLogout = () => {
    window.location.href = `${API_URL}/logout`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0f172a] flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-cyan-500/20 border-t-cyan-500 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!user) {
    return <SignIn onLogin={handleLogin} />;
  }

  return (
    <div className="min-h-screen flex flex-col overflow-hidden relative">
      {/* Background Ambience */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-cyan-500/10 blur-[120px]" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-magenta-500/10 blur-[120px]" />
      </div>

      <header className="sticky top-0 z-50 backdrop-blur-xl bg-[#0f172a]/80 border-b border-white/5">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="relative group">
              <div className="absolute -inset-1 bg-gradient-to-r from-cyan-500 to-magenta-500 rounded-xl blur opacity-25 group-hover:opacity-75 transition duration-1000 group-hover:duration-200"></div>
              <div className="relative p-2.5 rounded-xl bg-[#0f172a] border border-white/10 ring-1 ring-white/5">
                <Terminal size={22} className="text-cyan-400" />
              </div>
            </div>
            <div>
              <h1 className="text-xl font-bold bg-gradient-to-r from-white via-cyan-100 to-cyan-200 bg-clip-text text-transparent tracking-tight">
                Terraform Bot
              </h1>
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-pulse"></span>
                <p className="text-[10px] text-cyan-400/80 font-medium tracking-widest uppercase">Aurora System Online</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <div className="flex items-center gap-4 pl-6 border-l border-white/5">
              <div className="flex items-center gap-3 px-4 py-2 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 transition-colors cursor-default">
                {user.picture ? (
                  <img src={user.picture} alt={user.name} className="w-6 h-6 rounded-full ring-2 ring-white/10" />
                ) : (
                  <UserIcon size={18} className="text-cyan-400" />
                )}
                <span className="text-sm font-medium text-gray-200">{user.name}</span>
              </div>
              <button
                onClick={handleLogout}
                className="p-2.5 rounded-xl bg-white/5 border border-white/10 text-gray-400 hover:text-white hover:bg-red-500/10 hover:border-red-500/20 transition-all duration-300"
                title="Logout"
              >
                <LogOut size={18} />
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full p-6 relative z-10">
        <AnimatePresence mode="wait">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
            className="h-full"
          >
            <ChatInterface user={user} />
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}

export default App;
