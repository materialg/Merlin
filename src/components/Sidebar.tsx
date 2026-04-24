import { useState } from 'react';
import { Plus, Clock, LogOut, LogIn, Trash2, Check, X, PanelLeftClose, Search, Users, Briefcase, Sun, Moon } from 'lucide-react';
import { SearchSession, NavTab } from '../types';
import { User } from 'firebase/auth';
import { useTheme } from '../lib/theme';

interface SidebarProps {
  sessions: SearchSession[];
  activeSessionId: string | null;
  onSelectSession: (id: string) => void;
  onNewSearch: () => void;
  onDeleteSession: (id: string) => void;
  user: User | null;
  onLogin: () => void;
  onLogout: () => void;
  width: number;
  onCollapse: () => void;
  activeNav: NavTab;
  onNavChange: (nav: NavTab) => void;
}

export default function Sidebar({ 
  sessions, 
  activeSessionId, 
  onSelectSession, 
  onNewSearch, 
  onDeleteSession, 
  user, 
  onLogin, 
  onLogout, 
  width, 
  onCollapse,
  activeNav,
  onNavChange
}: SidebarProps) {
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [theme, , toggleTheme] = useTheme();

  const filteredSessions = sessions.filter(session => {
    const title = (session.title || '').toLowerCase();
    const prompt = (session.prompt || '').toLowerCase();
    const search = searchTerm.toLowerCase();
    return title.includes(search) || prompt.includes(search);
  });

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
    <div 
      className="h-screen bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 flex flex-col shrink-0 transition-[width] duration-300 ease-in-out overflow-hidden"
      style={{ width: `${width}px` }}
    >
      <div className="p-4 border-b border-gray-100 dark:border-gray-800 min-w-[260px]">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-50 dark:bg-blue-950/40 rounded-lg flex items-center justify-center text-xl shadow-sm border border-blue-100 dark:border-blue-900/60">
              🧙‍♂️
            </div>
            <h1 className="font-sans font-bold text-lg tracking-tight text-gray-900 dark:text-gray-100">Merlin</h1>
          </div>
          <button
            onClick={onCollapse}
            className="p-2 text-gray-400 dark:text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded-lg transition-colors"
            title="Collapse sidebar"
          >
            <PanelLeftClose className="w-5 h-5" />
          </button>
        </div>
        
        {user ? (
          <div className="space-y-3">
            <button 
              onClick={onNewSearch}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold transition-all shadow-lg shadow-blue-100 active:scale-95"
            >
              <Plus className="w-4 h-4" />
              New search
            </button>
          </div>
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

      <div className="flex-1 overflow-y-auto p-3 space-y-2 min-w-[260px]">
        {user && (
          <>
            <div className="px-2 py-1 mb-2 flex items-center justify-between">
              <span className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em]">
                {searchTerm ? 'Search Results' : 'Recent Activity'}
              </span>
              {searchTerm && (
                <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 px-1.5 py-0.5 rounded">
                  {filteredSessions.length}
                </span>
              )}
            </div>

            <div className="px-2 mb-4">
              <div className="relative group">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500 group-focus-within:text-blue-500 transition-colors" />
                <input
                  type="text"
                  placeholder="Search history..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full transition-colors"
                  >
                    <X className="w-3 h-3 text-gray-400 dark:text-gray-500" />
                  </button>
                )}
              </div>
            </div>
            
            {filteredSessions.map(session => (
              <div key={session.id} className="group relative">
                <button
                  onClick={() => onSelectSession(session.id)}
                  className={`w-full text-left p-3.5 rounded-xl transition-all border pr-10 ${
                    activeSessionId === session.id 
                      ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800/60 text-blue-700 dark:text-blue-300 shadow-sm' 
                      : 'bg-transparent border-transparent hover:bg-gray-50 dark:hover:bg-gray-900 text-gray-600 dark:text-gray-300 hover:border-gray-100 dark:hover:border-gray-800'
                  }`}
                >
                  <div className={`text-sm font-bold truncate mb-1.5 ${activeSessionId === session.id ? 'text-blue-900 dark:text-blue-200' : 'text-gray-700 dark:text-gray-200'}`}>
                    {getSessionTitle(session)}
                  </div>
                  <div className={`flex items-center gap-1.5 text-[10px] font-medium ${activeSessionId === session.id ? 'text-blue-600/70' : 'text-gray-400 dark:text-gray-500'}`}>
                    <Clock className="w-3 h-3" />
                    {new Date(session.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                  {activeSessionId === session.id && (
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-blue-600 rounded-r-full" />
                  )}
                </button>
                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                  {confirmDeleteId === session.id ? (
                    <>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setConfirmDeleteId(null);
                        }}
                        className="p-1.5 text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md transition-all"
                        title="Cancel"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteSession(session.id);
                          setConfirmDeleteId(null);
                        }}
                        className="p-1.5 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-md transition-all"
                        title="Confirm delete"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setConfirmDeleteId(session.id);
                      }}
                      className="p-2 text-gray-400 dark:text-gray-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                      title="Delete search"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}

            {filteredSessions.length === 0 && (
              <div className="px-3 py-8 text-center">
                <p className="text-xs text-gray-400 dark:text-gray-500 italic">
                  {searchTerm ? 'No matches found' : 'No recent searches'}
                </p>
              </div>
            )}

            <div className="pt-4 mt-4 border-t border-gray-100 dark:border-gray-800 space-y-1">
              <button
                onClick={() => onNavChange('projects')}
                className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-sm font-bold transition-all border ${
                  activeNav === 'projects' 
                    ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800/60 text-blue-700 dark:text-blue-300 shadow-sm' 
                    : 'bg-transparent border-transparent hover:bg-gray-50 dark:hover:bg-gray-900 text-gray-600 dark:text-gray-300 hover:border-gray-100 dark:hover:border-gray-800'
                }`}
              >
                <Briefcase className="w-4 h-4" />
                Projects
              </button>
              <button
                onClick={() => onNavChange('contacts')}
                className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-sm font-bold transition-all border ${
                  activeNav === 'contacts' 
                    ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800/60 text-blue-700 dark:text-blue-300 shadow-sm' 
                    : 'bg-transparent border-transparent hover:bg-gray-50 dark:hover:bg-gray-900 text-gray-600 dark:text-gray-300 hover:border-gray-100 dark:hover:border-gray-800'
                }`}
              >
                <Users className="w-4 h-4" />
                Contacts
              </button>
            </div>
          </>
        )}
        
        {!user && (
          <div className="px-3 py-8 text-center">
            <p className="text-xs text-gray-400 dark:text-gray-500 italic">Login to see your history</p>
          </div>
        )}
      </div>

      {user && (
        <div className="p-4 border-t border-gray-100 dark:border-gray-800 min-w-[260px]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 overflow-hidden">
              {user.photoURL ? (
                <img src={user.photoURL} alt={user.displayName || ''} className="w-8 h-8 rounded-full border border-gray-200 dark:border-gray-700" referrerPolicy="no-referrer" />
              ) : (
                <div className="w-8 h-8 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center text-xs font-bold text-gray-500 dark:text-gray-400">
                  {user.displayName?.[0] || user.email?.[0] || 'U'}
                </div>
              )}
              <div className="flex flex-col overflow-hidden">
                <span className="text-xs font-bold text-gray-900 dark:text-gray-100 truncate">{user.displayName || 'User'}</span>
                <span className="text-[10px] text-gray-500 dark:text-gray-400 truncate">{user.email}</span>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={toggleTheme}
                className="p-2 text-gray-400 dark:text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded-lg transition-colors"
                title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              >
                {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </button>
              <button
                onClick={onLogout}
                className="p-2 text-gray-400 dark:text-gray-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg transition-colors"
                title="Logout"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
