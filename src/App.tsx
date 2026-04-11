import { useState, useEffect, useRef } from 'react';
import { PanelLeft } from 'lucide-react';
import Sidebar from './components/Sidebar';
import ChatArea from './components/ChatArea';
import SearchInput from './components/SearchInput';
import { SearchSession, Candidate, ViewMode } from './types';
import { extractTechnicalFingerprint, searchCandidates, enrichCandidateProfile, rescoreCandidate, sourceLookalikes } from './services/gemini';
import { auth, db, loginWithGoogle, logout, handleFirestoreError, OperationType } from './lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { collection, doc, setDoc, onSnapshot, query, orderBy, getDocFromServer, deleteDoc } from 'firebase/firestore';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [sessions, setSessions] = useState<SearchSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('classic');
  const [activeTab, setActiveTab] = useState<'results' | 'shortlist' | 'sourced'>('results');
  const [sidebarWidth, setSidebarWidth] = useState(260);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const isResizing = useRef(false);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing.current) return;
      const newWidth = Math.min(Math.max(200, e.clientX), 480);
      setSidebarWidth(newWidth);
    };

    const handleMouseUp = () => {
      isResizing.current = false;
      document.body.style.cursor = 'default';
      document.body.style.userSelect = 'auto';
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  const startResizing = () => {
    if (isSidebarCollapsed) return;
    isResizing.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setIsAuthReady(true);
      if (u) {
        // Sync user profile
        const userRef = doc(db, 'users', u.uid);
        setDoc(userRef, {
          uid: u.uid,
          email: u.email,
          displayName: u.displayName,
          photoURL: u.photoURL,
          createdAt: new Date().toISOString()
        }, { merge: true }).catch(err => handleFirestoreError(err, OperationType.WRITE, `users/${u.uid}`));
      } else {
        setSessions([]);
        setActiveSessionId(null);
      }
    });

    // Test connection
    const testConnection = async () => {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error) {
        if(error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Please check your Firebase configuration. ");
        }
      }
    };
    testConnection();

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;

    const sessionsRef = collection(db, 'users', user.uid, 'sessions');
    const q = query(sessionsRef, orderBy('timestamp', 'desc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const newSessions = snapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id
      } as SearchSession));
      setSessions(newSessions);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `users/${user.uid}/sessions`);
    });

    return () => unsubscribe();
  }, [user]);

  const handleSearch = async (prompt: string, files: File[], urls: string[], companyLink?: string) => {
    if (!user) {
      await loginWithGoogle();
      return;
    }

    const sessionId = Date.now().toString();
    const newSession: SearchSession = {
      id: sessionId,
      title: 'New Search',
      prompt: prompt || (files.length > 0 ? `Search with ${files.length} files` : urls.length > 0 ? `Search with ${urls.length} URLs` : 'New Search'),
      timestamp: new Date().toISOString(),
      plan: '',
      sources: [],
      candidates: [],
      status: 'searching',
      attachments: files.map(f => ({ name: f.name, type: f.type })),
      urls,
      companyLink
    };

    const sessionRef = doc(db, 'users', user.uid, 'sessions', sessionId);
    await setDoc(sessionRef, newSession).catch(err => handleFirestoreError(err, OperationType.WRITE, sessionRef.path));
    setActiveSessionId(sessionId);

    try {
      // 1. Read files as base64
      const fileContents = await Promise.all(files.map(async (file) => {
        return new Promise<{ name: string; data: string; mimeType: string }>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => {
            const base64 = (reader.result as string).split(',')[1];
            resolve({ name: file.name, data: base64, mimeType: file.type });
          };
          reader.readAsDataURL(file);
        });
      }));

      // 2. Extract Fingerprint
      const fingerprint = await extractTechnicalFingerprint(prompt, fileContents, urls, companyLink);
      
      await setDoc(sessionRef, {
        title: (fingerprint.title && fingerprint.title.trim()) ? fingerprint.title.trim() : newSession.title,
        plan: fingerprint.plan,
        sources: fingerprint.sources,
        fingerprint
      }, { merge: true }).catch(err => handleFirestoreError(err, OperationType.UPDATE, sessionRef.path));

      // 3. Search Candidates
      const results = await searchCandidates(fingerprint);
      
      // Handle potential array wrapping or direct array
      const candidatesArray = Array.isArray(results) ? results : (results.candidates || []);

      let candidates: Candidate[] = candidatesArray.map((r: any, i: number) => ({
        id: `${sessionId}-${i}`,
        ...r
      }));

      // Sort by score descending
      candidates.sort((a, b) => b.score - a.score);

      await setDoc(sessionRef, { candidates }, { merge: true }).catch(err => handleFirestoreError(err, OperationType.UPDATE, sessionRef.path));

      // 3. Enrich each candidate
      for (const candidate of candidates) {
        try {
          const enrichment = await enrichCandidateProfile(candidate);
          
          // We need to get the latest session data to update candidates correctly
          setSessions(prev => {
            const currentSession = prev.find(s => s.id === sessionId);
            if (!currentSession) return prev;
            
            const updatedCandidates = currentSession.candidates.map(c => 
              c.id === candidate.id ? {
                ...c,
                socialLinks: enrichment.socialLinks,
                recentActivity: enrichment.recentActivity
              } : c
            );

            setDoc(sessionRef, { candidates: updatedCandidates }, { merge: true }).catch(err => handleFirestoreError(err, OperationType.UPDATE, sessionRef.path));
            return prev;
          });
        } catch (enrichError) {
          console.error(`Enrichment failed for ${candidate.name}:`, enrichError);
        }
      }

      await setDoc(sessionRef, { status: 'completed' }, { merge: true }).catch(err => handleFirestoreError(err, OperationType.UPDATE, sessionRef.path));

    } catch (error) {
      console.error('Search failed:', error);
      await setDoc(sessionRef, { status: 'error' }, { merge: true }).catch(err => handleFirestoreError(err, OperationType.UPDATE, sessionRef.path));
    }
  };

  const handleUpdateTitle = async (sessionId: string, newTitle: string) => {
    if (!user) return;
    const sessionRef = doc(db, 'users', user.uid, 'sessions', sessionId);
    await setDoc(sessionRef, { title: newTitle }, { merge: true })
      .catch(err => handleFirestoreError(err, OperationType.UPDATE, sessionRef.path));
  };

  const handleUpdateCandidate = async (sessionId: string, candidateId: string, updates: Partial<Candidate>) => {
    if (!user) return;
    
    const session = sessions.find(s => s.id === sessionId);
    if (!session) return;

    let updatedCandidates = session.candidates.map(c => 
      c.id === candidateId ? { ...c, ...updates } : c
    );

    const sessionRef = doc(db, 'users', user.uid, 'sessions', sessionId);
    
    // If social links were updated, trigger a re-score
    if (updates.socialLinks) {
      const candidate = updatedCandidates.find(c => c.id === candidateId);
      if (candidate && session.fingerprint) {
        try {
          const rescore = await rescoreCandidate(candidate, session.fingerprint);
          updatedCandidates = updatedCandidates.map(c => 
            c.id === candidateId ? { 
              ...c, 
              score: rescore.score,
              scoringBreakdown: rescore.scoringBreakdown,
              reasoning: rescore.reasoning,
              impactSummary: rescore.impactSummary
            } : c
          );
        } catch (error) {
          console.error('Failed to rescore candidate:', error);
        }
      }
    }

    await setDoc(sessionRef, { candidates: updatedCandidates }, { merge: true })
      .catch(err => handleFirestoreError(err, OperationType.UPDATE, sessionRef.path));
  };

  const handleToggleShortlist = async (sessionId: string, candidateId: string, feedback?: string) => {
    if (!user) return;
    
    const session = sessions.find(s => s.id === sessionId);
    if (!session) return;

    const currentShortlisted = session.shortlistedIds || [];
    const isShortlisted = currentShortlisted.includes(candidateId);
    
    const newShortlisted = isShortlisted 
      ? currentShortlisted.filter(id => id !== candidateId)
      : [...currentShortlisted, candidateId];

    const sessionRef = doc(db, 'users', user.uid, 'sessions', sessionId);
    const updateData: any = { shortlistedIds: newShortlisted };
    
    if (feedback) {
      updateData.feedbackMap = {
        ...(session.feedbackMap || {}),
        [candidateId]: feedback
      };
    }

    await setDoc(sessionRef, updateData, { merge: true })
      .catch(err => handleFirestoreError(err, OperationType.UPDATE, sessionRef.path));
  };

  const handleRejectCandidate = async (sessionId: string, candidateId: string, feedback?: string) => {
    if (!user) return;
    
    const session = sessions.find(s => s.id === sessionId);
    if (!session) return;

    const currentRejected = session.rejectedIds || [];
    if (currentRejected.includes(candidateId)) return;

    const newRejected = [...currentRejected, candidateId];
    const sessionRef = doc(db, 'users', user.uid, 'sessions', sessionId);
    
    const updateData: any = { rejectedIds: newRejected };
    if (feedback) {
      updateData.feedbackMap = {
        ...(session.feedbackMap || {}),
        [candidateId]: feedback
      };
    }

    // Optimistically update and trigger re-search
    await setDoc(sessionRef, updateData, { merge: true })
      .catch(err => handleFirestoreError(err, OperationType.UPDATE, sessionRef.path));

    // Trigger re-search with feedback
    // In a real app, we'd pass the rejected IDs to the search function to calibrate
    // For this demo, we'll just simulate sourcing one more candidate
    try {
      const fingerprint = await extractTechnicalFingerprint(session.prompt, [], session.urls);
      const results = await searchCandidates({ 
        ...fingerprint, 
        rejectedIds: newRejected,
        feedbackMap: updateData.feedbackMap || session.feedbackMap 
      });
      const candidatesArray = Array.isArray(results) ? results : (results.candidates || []);
      
      // Find a candidate not already in the list
      const newCandidateData = candidatesArray.find((c: any) => !session.candidates.some(existing => existing.name === c.name));
      
      if (newCandidateData) {
        const newCandidate: Candidate = {
          id: `${sessionId}-${Date.now()}`,
          ...newCandidateData
        };
        
        const updatedCandidates = [...session.candidates, newCandidate];
        await setDoc(sessionRef, { candidates: updatedCandidates }, { merge: true })
          .catch(err => handleFirestoreError(err, OperationType.UPDATE, sessionRef.path));
          
        // Enrich the new candidate
        const enrichment = await enrichCandidateProfile(newCandidate);
        const finalCandidates = updatedCandidates.map(c => 
          c.id === newCandidate.id ? { ...c, ...enrichment } : c
        );
        await setDoc(sessionRef, { candidates: finalCandidates }, { merge: true })
          .catch(err => handleFirestoreError(err, OperationType.UPDATE, sessionRef.path));
      }
    } catch (error) {
      console.error('Failed to source replacement candidate:', error);
    }
  };

  const handleLockShortlist = async (sessionId: string) => {
    if (!user) return;
    const sessionRef = doc(db, 'users', user.uid, 'sessions', sessionId);
    await setDoc(sessionRef, { isShortlistLocked: true }, { merge: true })
      .catch(err => handleFirestoreError(err, OperationType.UPDATE, sessionRef.path));
  };

  const handleSourceLookalikes = async (sessionId: string, count: number) => {
    if (!user) return;
    const session = sessions.find(s => s.id === sessionId);
    if (!session) return;

    const sessionRef = doc(db, 'users', user.uid, 'sessions', sessionId);
    await setDoc(sessionRef, { sourcingStatus: 'sourcing' }, { merge: true })
      .catch(err => handleFirestoreError(err, OperationType.UPDATE, sessionRef.path));

    try {
      const shortlistedCandidates = session.candidates.filter(c => session.shortlistedIds?.includes(c.id));
      const sourced = await sourceLookalikes(shortlistedCandidates, count, session.fingerprint);
      
      await setDoc(sessionRef, { 
        sourcedCandidates: sourced,
        sourcingStatus: 'completed' 
      }, { merge: true })
        .catch(err => handleFirestoreError(err, OperationType.UPDATE, sessionRef.path));
    } catch (error) {
      console.error('Failed to source look-alikes:', error);
      await setDoc(sessionRef, { sourcingStatus: 'error' }, { merge: true })
        .catch(err => handleFirestoreError(err, OperationType.UPDATE, sessionRef.path));
    }
  };

  const handleDeleteSession = async (sessionId: string) => {
    if (!user) return;
    
    const sessionRef = doc(db, 'users', user.uid, 'sessions', sessionId);
    await deleteDoc(sessionRef)
      .then(() => {
        if (activeSessionId === sessionId) {
          setActiveSessionId(null);
        }
      })
      .catch(err => handleFirestoreError(err, OperationType.DELETE, sessionRef.path));
  };

  const activeSession = sessions.find(s => s.id === activeSessionId) || null;

  if (!isAuthReady) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-gray-50 font-sans p-4">
        <div className="w-24 h-24 bg-white rounded-3xl flex items-center justify-center text-5xl shadow-xl shadow-blue-900/5 border border-blue-100 mb-8">
          🧙‍♂️
        </div>
        <h1 className="text-4xl font-bold tracking-tight text-gray-900 mb-4 text-center">Talent Wizard</h1>
        <p className="text-gray-500 mb-8 text-center max-w-md text-lg">
          AI-powered candidate sourcing and technical fingerprinting. Log in to start finding the perfect candidates.
        </p>
        <button 
          onClick={loginWithGoogle}
          className="flex items-center justify-center gap-3 py-3.5 px-6 bg-white hover:bg-gray-50 text-gray-900 border border-gray-200 rounded-xl text-base font-bold transition-all shadow-sm active:scale-95"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
          </svg>
          Continue with Google
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-50 font-sans overflow-hidden">
      <Sidebar 
        sessions={sessions} 
        activeSessionId={activeSessionId}
        onSelectSession={setActiveSessionId}
        onNewSearch={() => setActiveSessionId(null)}
        onDeleteSession={handleDeleteSession}
        user={user}
        onLogin={loginWithGoogle}
        onLogout={logout}
        width={isSidebarCollapsed ? 0 : sidebarWidth}
        onCollapse={() => setIsSidebarCollapsed(true)}
      />
      
      {!isSidebarCollapsed && (
        <div 
          className="w-1 hover:w-1.5 bg-transparent hover:bg-blue-400/30 cursor-col-resize transition-all active:bg-blue-500/50 z-50"
          onMouseDown={startResizing}
        />
      )}
      
      <main className="flex-1 flex flex-col h-screen overflow-hidden bg-white relative">
        {isSidebarCollapsed && (
          <button
            onClick={() => setIsSidebarCollapsed(false)}
            className="absolute top-4 left-4 z-50 p-2 bg-white border border-gray-200 rounded-lg shadow-sm text-gray-500 hover:text-blue-600 hover:border-blue-200 transition-all"
            title="Expand sidebar"
          >
            <PanelLeft className="w-5 h-5" />
          </button>
        )}
        
        <ChatArea 
          session={activeSession} 
          onToggleShortlist={(candidateId, feedback) => activeSessionId && handleToggleShortlist(activeSessionId, candidateId, feedback)}
          onRejectCandidate={(candidateId, feedback) => activeSessionId && handleRejectCandidate(activeSessionId, candidateId, feedback)}
          onUpdateTitle={(title) => activeSessionId && handleUpdateTitle(activeSessionId, title)}
          onUpdateCandidate={(candidateId, updates) => activeSessionId && handleUpdateCandidate(activeSessionId, candidateId, updates)}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          onLockShortlist={() => activeSessionId && handleLockShortlist(activeSessionId)}
          onSourceLookalikes={(count) => activeSessionId && handleSourceLookalikes(activeSessionId, count)}
          activeTab={activeTab}
          onActiveTabChange={setActiveTab}
          isSidebarCollapsed={isSidebarCollapsed}
        />
        {viewMode === 'classic' && activeTab === 'results' && (
          <SearchInput 
            onSearch={handleSearch} 
            isLoading={activeSession?.status === 'searching'} 
          />
        )}
      </main>
    </div>
  );
}


