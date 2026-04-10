import { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import ChatArea from './components/ChatArea';
import SearchInput from './components/SearchInput';
import { SearchSession, Candidate } from './types';
import { extractTechnicalFingerprint, searchCandidates, enrichCandidateProfile } from './services/gemini';
import { auth, db, loginWithGoogle, logout, handleFirestoreError, OperationType } from './lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { collection, doc, setDoc, onSnapshot, query, orderBy, getDocFromServer } from 'firebase/firestore';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [sessions, setSessions] = useState<SearchSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);

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
      const newSessions = snapshot.docs.map(doc => doc.data() as SearchSession);
      setSessions(newSessions);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `users/${user.uid}/sessions`);
    });

    return () => unsubscribe();
  }, [user]);

  const handleSearch = async (prompt: string, files: File[], urls: string[]) => {
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
      urls
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
      const fingerprint = await extractTechnicalFingerprint(prompt, fileContents, urls);
      
      await setDoc(sessionRef, {
        title: (fingerprint.title && fingerprint.title.trim()) ? fingerprint.title.trim() : newSession.title,
        plan: fingerprint.plan,
        sources: fingerprint.sources
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
          // or use a more granular update if candidates were a subcollection.
          // For now, we update the whole array (simple but less efficient).
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

  const activeSession = sessions.find(s => s.id === activeSessionId) || null;

  if (!isAuthReady) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-50 font-sans">
      <Sidebar 
        sessions={sessions} 
        activeSessionId={activeSessionId}
        onSelectSession={setActiveSessionId}
        onNewSearch={() => setActiveSessionId(null)}
        user={user}
        onLogin={loginWithGoogle}
        onLogout={logout}
      />
      
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        <ChatArea session={activeSession} />
        <SearchInput 
          onSearch={handleSearch} 
          isLoading={activeSession?.status === 'searching'} 
        />
      </main>
    </div>
  );
}


