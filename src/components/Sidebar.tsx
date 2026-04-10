import { Plus, Clock, LogOut, LogIn } from 'lucide-react';
import { SearchSession } from '../types';
import { User } from 'firebase/auth';

interface SidebarProps {
  sessions: SearchSession[];
  activeSessionId: string | null;
  onSelectSession: (id: string) => void;
  onNewSearch: () => void;
  user: User | null;
  onLogin: () => void;
  onLogout: () => void;
}

export default function Sidebar({ sessions, activeSessionId, onSelectSession, onNewSearch, user, onLogin, onLogout }: SidebarProps) {
  const getSessionTitle = (session: SearchSession) => {
    if (session.title && session.title !== 'New Search' && session.title.trim() !== '') {
      return session.title;
    }
    
    if (session.status === 'searching') {
      return 'Analyzing position...';
    }
    
    // Fallback to prompt if title is missing
    if (session.prompt && session.prompt.trim() !== '') {
      const words = session.prompt.trim().split(/\s+/);
      if (words.length > 5) {
        return words.slice(0, 5).join(' ') + '...';
      }
      return session.prompt;
    }

    // Ultimate fallback
    if (session.attachments && session.attachments.length > 0) {
      return `Search (${session.attachments.length} files)`;
    }
    if (session.urls && session.urls.length > 0) {
      return `Search (${session.urls.length} URLs)`;
    }
    
    return 'Untitled Search';
  };

  return (
    <div className="w-64 h-screen bg-white border-r border-gray-200 flex flex-col shrink-0">
      <div className="p-4 border-b border-gray-100">
        <div className="flex items-center gap-2 mb-6">
          <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center text-xl shadow-sm border border-blue-100">
            🧙‍♂️
          </div>
          <h1 className="font-sans font-bold text-lg tracking-tight text-gray-900">Merlin</h1>
        </div>
        
        {user ? (
          <button 
            onClick={onNewSearch}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold transition-all shadow-lg shadow-blue-100 active:scale-95"
          >
            <Plus className="w-4 h-4" />
            New search
          </button>
        ) : (
          <button 
            onClick={onLogin}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold transition-all shadow-lg shadow-blue-100 active:scale-95"
          >
            <LogIn className="w-4 h-4" />
            Login to start
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {user && (
          <>
            <div className="px-2 py-1 mb-2">
              <span className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Recent Activity</span>
            </div>
            
            {sessions.map(session => (
              <button
                key={session.id}
                onClick={() => onSelectSession(session.id)}
                className={`w-full text-left p-3.5 rounded-xl transition-all group relative border ${
                  activeSessionId === session.id 
                    ? 'bg-blue-50 border-blue-200 text-blue-700 shadow-sm' 
                    : 'bg-transparent border-transparent hover:bg-gray-50 text-gray-600 hover:border-gray-100'
                }`}
              >
                <div className={`text-sm font-bold truncate mb-1.5 ${activeSessionId === session.id ? 'text-blue-900' : 'text-gray-700'}`}>
                  {getSessionTitle(session)}
                </div>
                <div className={`flex items-center gap-1.5 text-[10px] font-medium ${activeSessionId === session.id ? 'text-blue-600/70' : 'text-gray-400'}`}>
                  <Clock className="w-3 h-3" />
                  {new Date(session.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
                {activeSessionId === session.id && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-blue-600 rounded-r-full" />
                )}
              </button>
            ))}

            {sessions.length === 0 && (
              <div className="px-3 py-8 text-center">
                <p className="text-xs text-gray-400 italic">No recent searches</p>
              </div>
            )}
          </>
        )}
        
        {!user && (
          <div className="px-3 py-8 text-center">
            <p className="text-xs text-gray-400 italic">Login to see your history</p>
          </div>
        )}
      </div>

      {user && (
        <div className="p-4 border-t border-gray-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 overflow-hidden">
              {user.photoURL ? (
                <img src={user.photoURL} alt={user.displayName || ''} className="w-8 h-8 rounded-full border border-gray-200" referrerPolicy="no-referrer" />
              ) : (
                <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-xs font-bold text-gray-500">
                  {user.displayName?.[0] || user.email?.[0] || 'U'}
                </div>
              )}
              <div className="flex flex-col overflow-hidden">
                <span className="text-xs font-bold text-gray-900 truncate">{user.displayName || 'User'}</span>
                <span className="text-[10px] text-gray-500 truncate">{user.email}</span>
              </div>
            </div>
            <button 
              onClick={onLogout}
              className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              title="Logout"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
