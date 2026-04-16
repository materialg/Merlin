import { useState, useEffect, useRef, useMemo } from 'react';
import { PanelLeft } from 'lucide-react';
import Sidebar from './components/Sidebar';
import ChatArea from './components/ChatArea';
import SearchInput from './components/SearchInput';
import ContactsView from './components/ContactsView';
import ProjectsView from './components/ProjectsView';
import { SearchSession, Candidate, ViewMode, NavTab, Contact, Project } from './types';
import { extractTechnicalFingerprint, searchCandidates, enrichCandidateProfile, rescoreCandidate, sourceLookalikes, parseLinkedInProfile, parseCandidateFromUrl } from './services/gemini';
import { auth, db, loginWithGoogle, logout, handleFirestoreError, OperationType } from './lib/firebase';
import { cleanObject } from './lib/utils';
import { onAuthStateChanged, User } from 'firebase/auth';
import { collection, doc, setDoc, onSnapshot, query, orderBy, getDocFromServer, deleteDoc } from 'firebase/firestore';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [sessions, setSessions] = useState<SearchSession[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [activeNav, setActiveNav] = useState<NavTab>('search');
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('classic');
  const [activeTab, setActiveTab] = useState<'results' | 'shortlist' | 'sourced'>('results');
  const [sidebarWidth, setSidebarWidth] = useState(260);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isAddingContact, setIsAddingContact] = useState(false);
  const [refreshingIds, setRefreshingIds] = useState<string[]>([]);
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

  useEffect(() => {
    if (!user) return;

    const contactsRef = collection(db, 'users', user.uid, 'contacts');
    const q = query(contactsRef, orderBy('addedAt', 'desc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const newContacts = snapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id
      } as Contact));
      setContacts(newContacts);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `users/${user.uid}/contacts`);
    });

    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    if (!user) return;

    const projectsRef = collection(db, 'users', user.uid, 'projects');
    const q = query(projectsRef, orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const newProjects = snapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id
      } as Project));
      setProjects(newProjects);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `users/${user.uid}/projects`);
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

      let candidates: Candidate[] = candidatesArray.map((r: any, i: number) => {
        const url = r.url || '';
        let platform = (r.platform || 'other').toLowerCase() as any;
        if (platform === 'other' && url) {
          if (url.includes('linkedin.com')) platform = 'linkedin';
          else if (url.includes('github.com')) platform = 'github';
          else if (url.includes('twitter.com') || url.includes('x.com')) platform = 'x';
          else if (url.includes('huggingface.co')) platform = 'huggingface';
          else if (url.includes('arxiv.org')) platform = 'arxiv';
        }
        return {
          id: `${sessionId}-${i}`,
          ...r,
          platform,
          socialLinks: url ? [{ platform, url }] : []
        };
      });

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
                socialLinks: [...(c.socialLinks || []), ...(enrichment.socialLinks || [])].filter((link, index, self) => 
                  index === self.findIndex((t) => t.url === link.url || t.platform === link.platform)
                ),
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

    } catch (error: any) {
      console.error('Search failed:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      await setDoc(sessionRef, { 
        status: 'error',
        error: errorMessage 
      }, { merge: true }).catch(err => handleFirestoreError(err, OperationType.UPDATE, sessionRef.path));
    }
  };

  const handleRestartSearch = async () => {
    if (!activeSession || !user) return;
    
    const sessionId = activeSession.id;
    const sessionRef = doc(db, 'users', user.uid, 'sessions', sessionId);
    
    await setDoc(sessionRef, { 
      status: 'searching',
      candidates: [],
      sourcedCandidates: [],
      sourcingStatus: 'idle',
      isShortlistLocked: false,
      shortlistedIds: [],
      rejectedIds: [],
      feedbackMap: {}
    }, { merge: true }).catch(err => handleFirestoreError(err, OperationType.UPDATE, sessionRef.path));

    try {
      let fingerprint = activeSession.fingerprint;
      
      if (!fingerprint) {
        fingerprint = await extractTechnicalFingerprint(activeSession.prompt, [], activeSession.urls, activeSession.companyLink);
      }

      const results = await searchCandidates(fingerprint);
      const candidatesArray = Array.isArray(results) ? results : (results.candidates || []);

      let candidates: Candidate[] = candidatesArray.map((r: any, i: number) => {
        const url = r.url || '';
        let platform = (r.platform || 'other').toLowerCase() as any;
        if (platform === 'other' && url) {
          if (url.includes('linkedin.com')) platform = 'linkedin';
          else if (url.includes('github.com')) platform = 'github';
          else if (url.includes('twitter.com') || url.includes('x.com')) platform = 'x';
          else if (url.includes('huggingface.co')) platform = 'huggingface';
          else if (url.includes('arxiv.org')) platform = 'arxiv';
        }
        return {
          id: `${sessionId}-${i}-${Date.now()}`,
          ...r,
          platform,
          socialLinks: url ? [{ platform, url }] : []
        };
      });

      candidates.sort((a, b) => b.score - a.score);

      await setDoc(sessionRef, { candidates, status: 'completed' }, { merge: true })
        .catch(err => handleFirestoreError(err, OperationType.UPDATE, sessionRef.path));

      // Enrich each candidate
      for (const candidate of candidates) {
        try {
          const enrichment = await enrichCandidateProfile(candidate);
          setSessions(prev => {
            const currentSession = prev.find(s => s.id === sessionId);
            if (!currentSession) return prev;
            
            const updatedCandidates = currentSession.candidates.map(c => 
              c.id === candidate.id ? {
                ...c,
                socialLinks: [...(c.socialLinks || []), ...(enrichment.socialLinks || [])].filter((link, index, self) => 
                  index === self.findIndex((t) => t.url === link.url || t.platform === link.platform)
                ),
                recentActivity: enrichment.recentActivity
              } : c
            );

            setDoc(sessionRef, { candidates: updatedCandidates }, { merge: true })
              .catch(err => handleFirestoreError(err, OperationType.UPDATE, sessionRef.path));
            return prev;
          });
        } catch (enrichError) {
          console.error(`Enrichment failed for ${candidate.name}:`, enrichError);
        }
      }
    } catch (error) {
      console.error('Restart failed:', error);
      await setDoc(sessionRef, { status: 'error' }, { merge: true })
        .catch(err => handleFirestoreError(err, OperationType.UPDATE, sessionRef.path));
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
    
    // 1. Get the latest session data from state to perform the update
    const currentSession = sessions.find(s => s.id === sessionId);
    if (!currentSession) return;

    const updatedCandidates = currentSession.candidates.map(c => 
      c.id === candidateId ? { ...c, ...updates } : c
    );

    const updatedSourced = (currentSession.sourcedCandidates || []).map(c =>
      c.id === candidateId ? { ...c, ...updates } : c
    );

    const sessionRef = doc(db, 'users', user.uid, 'sessions', sessionId);
    
    // 2. Save the immediate updates first to ensure they are persisted
    await setDoc(sessionRef, cleanObject({ 
      candidates: updatedCandidates,
      sourcedCandidates: updatedSourced
    }), { merge: true })
      .catch(err => handleFirestoreError(err, OperationType.UPDATE, sessionRef.path));

    // 2.5 Update matching contact if it exists
    const originalCandidate = currentSession.candidates.find(c => c.id === candidateId) || 
                             currentSession.sourcedCandidates?.find(c => c.id === candidateId);
    
    if (originalCandidate) {
      const contact = contacts.find(ct => (ct.url && ct.url === originalCandidate.url) || ct.id === originalCandidate.id);
      if (contact) {
        const contactRef = doc(db, 'users', user.uid, 'contacts', contact.id);
        // Only sync profile fields, not session-specific ones
        const profileUpdates = { ...updates };
        delete (profileUpdates as any).score;
        delete (profileUpdates as any).reasoning;
        delete (profileUpdates as any).impactSummary;
        delete (profileUpdates as any).scoringBreakdown;
        
        if (Object.keys(profileUpdates).length > 0) {
          await setDoc(contactRef, cleanObject(profileUpdates), { merge: true })
            .catch(err => handleFirestoreError(err, OperationType.UPDATE, contactRef.path));
        }
      }
    }

    // 3. If social links were updated, trigger a re-score in the background
    if (updates.socialLinks) {
      const candidate = updatedCandidates.find(c => c.id === candidateId) || updatedSourced.find(c => c.id === candidateId);
      if (candidate && currentSession.fingerprint) {
        try {
          const rescore = await rescoreCandidate(candidate, currentSession.fingerprint);
          
          // Fetch the latest state AGAIN before applying rescore results to avoid overwriting other concurrent updates
          setSessions(prev => {
            const latestSession = prev.find(s => s.id === sessionId);
            if (!latestSession) return prev;

            const finalCandidates = latestSession.candidates.map(c => 
              c.id === candidateId ? { 
                ...c, 
                score: rescore.score,
                scoringBreakdown: rescore.scoringBreakdown,
                reasoning: rescore.reasoning,
                impactSummary: rescore.impactSummary
              } : c
            );

            const finalSourced = (latestSession.sourcedCandidates || []).map(c => 
              c.id === candidateId ? { 
                ...c, 
                score: rescore.score,
                scoringBreakdown: rescore.scoringBreakdown,
                reasoning: rescore.reasoning,
                impactSummary: rescore.impactSummary
              } : c
            );

            setDoc(sessionRef, cleanObject({ 
              candidates: finalCandidates,
              sourcedCandidates: finalSourced
            }), { merge: true })
              .catch(err => handleFirestoreError(err, OperationType.UPDATE, sessionRef.path));

            return prev;
          });
        } catch (error) {
          console.error('Failed to rescore candidate:', error);
        }
      }
    }
  };

  const handleUpdatePrompt = async (sessionId: string, newPrompt: string) => {
    if (!user) return;
    const session = sessions.find(s => s.id === sessionId);
    if (!session) return;

    const sessionRef = doc(db, 'users', user.uid, 'sessions', sessionId);
    
    // 1. Reset session state for new search with new prompt
    await setDoc(sessionRef, { 
      prompt: newPrompt,
      status: 'searching',
      candidates: [],
      sourcedCandidates: [],
      sourcingStatus: 'idle',
      isShortlistLocked: false,
      shortlistedIds: [],
      rejectedIds: [],
      feedbackMap: {}
    }, { merge: true }).catch(err => handleFirestoreError(err, OperationType.UPDATE, sessionRef.path));

    try {
      // 2. Re-extract Fingerprint with new prompt
      const fingerprint = await extractTechnicalFingerprint(newPrompt, [], session.urls, session.companyLink);
      
      await setDoc(sessionRef, {
        title: (fingerprint.title && fingerprint.title.trim()) ? fingerprint.title.trim() : session.title,
        plan: fingerprint.plan,
        sources: fingerprint.sources,
        fingerprint
      }, { merge: true }).catch(err => handleFirestoreError(err, OperationType.UPDATE, sessionRef.path));

      // 3. Search Candidates
      const results = await searchCandidates(fingerprint);
      const candidatesArray = Array.isArray(results) ? results : (results.candidates || []);

      const candidates: Candidate[] = candidatesArray.map((r: any, i: number) => {
        const url = r.url || '';
        let platform = (r.platform || 'other').toLowerCase() as any;
        if (platform === 'other' && url) {
          if (url.includes('linkedin.com')) platform = 'linkedin';
          else if (url.includes('github.com')) platform = 'github';
          else if (url.includes('twitter.com') || url.includes('x.com')) platform = 'x';
          else if (url.includes('huggingface.co')) platform = 'huggingface';
          else if (url.includes('arxiv.org')) platform = 'arxiv';
        }
        return {
          id: `${sessionId}-${i}-${Date.now()}`,
          ...r,
          platform,
          socialLinks: url ? [{ platform, url }] : []
        };
      });

      candidates.sort((a, b) => b.score - a.score);

      await setDoc(sessionRef, { candidates, status: 'completed' }, { merge: true })
        .catch(err => handleFirestoreError(err, OperationType.UPDATE, sessionRef.path));

      // 4. Enrich each candidate
      for (const candidate of candidates) {
        try {
          const enrichment = await enrichCandidateProfile(candidate);
          setSessions(prev => {
            const currentSession = prev.find(s => s.id === sessionId);
            if (!currentSession) return prev;
            
            const updatedCandidates = currentSession.candidates.map(c => 
              c.id === candidate.id ? {
                ...c,
                socialLinks: [...(c.socialLinks || []), ...(enrichment.socialLinks || [])].filter((link, index, self) => 
                  index === self.findIndex((t) => t.url === link.url || t.platform === link.platform)
                ),
                recentActivity: enrichment.recentActivity
              } : c
            );

            setDoc(sessionRef, { candidates: updatedCandidates }, { merge: true })
              .catch(err => handleFirestoreError(err, OperationType.UPDATE, sessionRef.path));
            return prev;
          });
        } catch (enrichError) {
          console.error(`Enrichment failed for ${candidate.name}:`, enrichError);
        }
      }
    } catch (error) {
      console.error('Update search failed:', error);
      await setDoc(sessionRef, { status: 'error' }, { merge: true }).catch(err => handleFirestoreError(err, OperationType.UPDATE, sessionRef.path));
    }
  };

  const handleUpdateFeedback = async (sessionId: string, candidateId: string, feedback: string) => {
    if (!user) return;
    
    const session = sessions.find(s => s.id === sessionId);
    if (!session) return;

    const sessionRef = doc(db, 'users', user.uid, 'sessions', sessionId);
    await setDoc(sessionRef, cleanObject({
      feedbackMap: {
        ...(session.feedbackMap || {}),
        [candidateId]: feedback
      }
    }), { merge: true }).catch(err => handleFirestoreError(err, OperationType.UPDATE, sessionRef.path));
  };

  const handleToggleShortlist = async (sessionId: string, candidateId: string, feedback?: string) => {
    if (!user) return;
    
    const session = sessions.find(s => s.id === sessionId);
    if (!session) return;

    const currentShortlisted = session.shortlistedIds || [];
    const isShortlisted = currentShortlisted.includes(candidateId);
    
    let newShortlisted = currentShortlisted;
    
    if (!feedback || !isShortlisted) {
      newShortlisted = isShortlisted 
        ? currentShortlisted.filter(id => id !== candidateId)
        : [...currentShortlisted, candidateId];
    }

    const sessionRef = doc(db, 'users', user.uid, 'sessions', sessionId);
    const updateData: any = { shortlistedIds: newShortlisted };
    
    if (feedback) {
      updateData.feedbackMap = {
        ...(session.feedbackMap || {}),
        [candidateId]: feedback
      };
    }

    await setDoc(sessionRef, cleanObject(updateData), { merge: true })
      .catch(err => handleFirestoreError(err, OperationType.UPDATE, sessionRef.path));
  };

  const handleRejectCandidate = async (sessionId: string, candidateId: string, feedback?: string) => {
    if (!user) return;
    
    const session = sessions.find(s => s.id === sessionId);
    if (!session) return;

    const currentRejected = session.rejectedIds || [];
    const isAlreadyRejected = currentRejected.includes(candidateId);
    
    if (isAlreadyRejected && !feedback) return;

    const newRejected = isAlreadyRejected ? currentRejected : [...currentRejected, candidateId];
    const sessionRef = doc(db, 'users', user.uid, 'sessions', sessionId);
    
    const updateData: any = { rejectedIds: newRejected };
    if (feedback) {
      updateData.feedbackMap = {
        ...(session.feedbackMap || {}),
        [candidateId]: feedback
      };
    }

    // Optimistically update
    await setDoc(sessionRef, cleanObject(updateData), { merge: true })
      .catch(err => handleFirestoreError(err, OperationType.UPDATE, sessionRef.path));

    // Only trigger re-search if it's a NEW rejection
    if (!isAlreadyRejected) {
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
      const sourced = await sourceLookalikes(shortlistedCandidates, count, {
        ...session.fingerprint,
        feedbackMap: session.feedbackMap || {}
      });
      
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

  const handleAddContact = async (candidate: Candidate) => {
    if (!user) return;
    
    // Check if already exists by URL to avoid duplicates
    const existing = contacts.find(c => c.url === candidate.url);
    const contactId = existing ? existing.id : candidate.id;

    const contactRef = doc(db, 'users', user.uid, 'contacts', contactId);
    const newContact: Contact = {
      ...candidate,
      id: contactId,
      addedAt: existing ? existing.addedAt : new Date().toISOString(),
      tags: existing ? existing.tags || [] : [],
      projects: existing ? existing.projects || [] : []
    };

    await setDoc(contactRef, cleanObject(newContact), { merge: true })
      .catch(err => handleFirestoreError(err, OperationType.WRITE, contactRef.path));
  };

  const handleAddContactFromFile = async (file: File) => {
    if (!user) return;
    setIsAddingContact(true);

    try {
      // 1. Read file as base64
      const fileData = await new Promise<{ name: string; data: string; mimeType: string }>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => {
          const base64 = (reader.result as string).split(',')[1];
          resolve({ name: file.name, data: base64, mimeType: file.type });
        };
        reader.readAsDataURL(file);
      });

      // 2. Parse LinkedIn Profile
      const parsedCandidate = await parseLinkedInProfile(fileData);
      
      const candidate: Candidate = {
        id: `manual-${Date.now()}`,
        ...parsedCandidate,
        socialLinks: parsedCandidate.url ? [{ platform: parsedCandidate.platform, url: parsedCandidate.url }] : [],
        anchorProfileUrl: parsedCandidate.url,
        recentActivity: [],
        email: parsedCandidate.email,
        score: 100,
        scoringBreakdown: {
          techMatch: 100,
          contributionMatch: 100,
          seniorityMatch: 100,
          educationMatch: 100
        },
        reasoning: "Manually added profile."
      };

      await handleAddContact(candidate);
    } catch (error) {
      console.error('Failed to add contact from file:', error);
    } finally {
      setIsAddingContact(false);
    }
  };

  const handleAddContactFromUrl = async (url: string) => {
    if (!user) return;
    setIsAddingContact(true);

    try {
      // 1. Parse Candidate from URL
      const parsedCandidate = await parseCandidateFromUrl(url);
      
      const candidate: Candidate = {
        id: `manual-${Date.now()}`,
        ...parsedCandidate,
        socialLinks: parsedCandidate.url ? [{ platform: parsedCandidate.platform, url: parsedCandidate.url }] : [],
        anchorProfileUrl: parsedCandidate.url,
        recentActivity: [],
        email: parsedCandidate.email,
        score: 100,
        scoringBreakdown: {
          techMatch: 100,
          contributionMatch: 100,
          seniorityMatch: 100,
          educationMatch: 100
        },
        reasoning: "Manually added from URL."
      };

      await handleAddContact(candidate);
    } catch (error) {
      console.error('Failed to add contact from URL:', error);
    } finally {
      setIsAddingContact(false);
    }
  };

  const handleUpdateContact = async (contactId: string, updates: Partial<Contact>) => {
    if (!user) return;
    
    const contactRef = doc(db, 'users', user.uid, 'contacts', contactId);
    await setDoc(contactRef, cleanObject(updates), { merge: true })
      .catch(err => handleFirestoreError(err, OperationType.UPDATE, contactRef.path));

    // Propagate updates to all sessions containing this candidate
    const contact = contacts.find(c => c.id === contactId);
    if (contact) {
      // Profile fields to sync
      const profileUpdates = { ...updates };
      delete (profileUpdates as any).addedAt;
      delete (profileUpdates as any).tags;
      delete (profileUpdates as any).projects;

      if (Object.keys(profileUpdates).length === 0) return;

      for (const session of sessions) {
        const hasCandidate = session.candidates.some(c => c.url === contact.url || c.id === contact.id) ||
                           session.sourcedCandidates?.some(c => c.url === contact.url || c.id === contact.id);
        
        if (hasCandidate) {
          const sessionRef = doc(db, 'users', user.uid, 'sessions', session.id);
          const updatedCandidates = session.candidates.map(c => 
            (c.url === contact.url || c.id === contact.id) ? { ...c, ...profileUpdates } : c
          );
          const updatedSourced = (session.sourcedCandidates || []).map(c =>
            (c.url === contact.url || c.id === contact.id) ? { ...c, ...profileUpdates } : c
          );

          await setDoc(sessionRef, cleanObject({
            candidates: updatedCandidates,
            sourcedCandidates: updatedSourced
          }), { merge: true }).catch(err => handleFirestoreError(err, OperationType.UPDATE, sessionRef.path));
        }
      }
    }
  };

  const handleRefreshContact = async (contactId: string) => {
    if (!user) return;
    
    const contact = contacts.find(c => c.id === contactId);
    if (!contact || !contact.url) return;

    const sourceUrl = contact.anchorProfileUrl || contact.url;
    setRefreshingIds(prev => [...prev, contactId]);

    try {
      // 1. Re-parse from URL to get latest title/company
      const parsedCandidate = await parseCandidateFromUrl(sourceUrl);
      
      // 2. Enrich for social links and activity
      const enrichment = await enrichCandidateProfile({ name: parsedCandidate.name, url: sourceUrl });
      
      const updates: Partial<Contact> = {
        ...parsedCandidate,
        socialLinks: [...(parsedCandidate.url ? [{ platform: parsedCandidate.platform, url: parsedCandidate.url }] : []), ...(enrichment.socialLinks || [])].filter((link, index, self) => 
          index === self.findIndex((t) => t.url === link.url || t.platform === link.platform)
        ),
        recentActivity: enrichment.recentActivity,
        email: enrichment.email || parsedCandidate.email || contact.email
      };

      await handleUpdateContact(contactId, updates);
    } catch (error) {
      console.error('Failed to refresh contact:', error);
    } finally {
      setRefreshingIds(prev => prev.filter(id => id !== contactId));
    }
  };

  const handleBulkRefresh = async (ids: string[]) => {
    // Refresh in sequence to avoid rate limits and too many concurrent requests
    for (const id of ids) {
      await handleRefreshContact(id);
    }
  };

  const handleDeleteContact = async (contactId: string) => {
    if (!user) return;
    
    const contactRef = doc(db, 'users', user.uid, 'contacts', contactId);
    await deleteDoc(contactRef)
      .catch(err => handleFirestoreError(err, OperationType.DELETE, contactRef.path));
  };

  const handleBulkDelete = async (ids: string[]) => {
    if (!user) return;
    // Delete in parallel since these are simple firestore deletes
    await Promise.all(ids.map(id => handleDeleteContact(id)));
  };

  const handleAddProject = async (name: string, description?: string) => {
    if (!user) return;
    
    const projectId = Date.now().toString();
    const projectRef = doc(db, 'users', user.uid, 'projects', projectId);
    const newProject: Project = {
      id: projectId,
      name,
      description,
      createdAt: new Date().toISOString(),
      candidateIds: []
    };

    await setDoc(projectRef, newProject)
      .catch(err => handleFirestoreError(err, OperationType.WRITE, projectRef.path));
  };

  const handleUpdateProject = async (projectId: string, updates: Partial<Project>) => {
    if (!user) return;
    
    const projectRef = doc(db, 'users', user.uid, 'projects', projectId);
    await setDoc(projectRef, cleanObject(updates), { merge: true })
      .catch(err => handleFirestoreError(err, OperationType.UPDATE, projectRef.path));
  };

  const handleDeleteProject = async (projectId: string) => {
    if (!user) return;
    
    const projectRef = doc(db, 'users', user.uid, 'projects', projectId);
    await deleteDoc(projectRef)
      .catch(err => handleFirestoreError(err, OperationType.DELETE, projectRef.path));
  };

  const activeSession = sessions.find(s => s.id === activeSessionId) || null;

  // Sync candidate data with contacts for the active session
  const syncedSession = useMemo(() => {
    if (!activeSession) return null;
    
    const syncCandidate = (c: Candidate) => {
      // Find matching contact by URL or ID
      const contact = contacts.find(ct => (ct.url && ct.url === c.url) || ct.id === c.id);
      if (contact) {
        // Merge contact data, but keep session-specific fields from candidate
        return {
          ...c,
          ...contact,
          id: c.id, // Keep session-specific ID for UI stability
          score: c.score,
          reasoning: c.reasoning,
          impactSummary: c.impactSummary,
          scoringBreakdown: c.scoringBreakdown
        };
      }
      return c;
    };

    return {
      ...activeSession,
      candidates: activeSession.candidates.map(syncCandidate),
      sourcedCandidates: activeSession.sourcedCandidates?.map(syncCandidate)
    };
  }, [activeSession, contacts]);

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
        onSelectSession={(id) => {
          setActiveSessionId(id);
          setActiveNav('search');
        }}
        onNewSearch={() => {
          setActiveSessionId(null);
          setActiveNav('search');
        }}
        onDeleteSession={handleDeleteSession}
        user={user}
        onLogin={loginWithGoogle}
        onLogout={logout}
        width={isSidebarCollapsed ? 0 : sidebarWidth}
        onCollapse={() => setIsSidebarCollapsed(true)}
        activeNav={activeNav}
        onNavChange={setActiveNav}
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
        
        {activeNav === 'search' ? (
          <>
            <ChatArea 
              session={syncedSession} 
              onToggleShortlist={(candidateId, feedback) => activeSessionId && handleToggleShortlist(activeSessionId, candidateId, feedback)}
              onRejectCandidate={(candidateId, feedback) => activeSessionId && handleRejectCandidate(activeSessionId, candidateId, feedback)}
              onUpdateTitle={(title) => activeSessionId && handleUpdateTitle(activeSessionId, title)}
              onUpdatePrompt={(prompt) => activeSessionId && handleUpdatePrompt(activeSessionId, prompt)}
              onUpdateCandidate={(candidateId, updates) => activeSessionId && handleUpdateCandidate(activeSessionId, candidateId, updates)}
              onUpdateFeedback={(candidateId, feedback) => activeSessionId && handleUpdateFeedback(activeSessionId, candidateId, feedback)}
              viewMode={viewMode}
              onViewModeChange={setViewMode}
              onLockShortlist={() => activeSessionId && handleLockShortlist(activeSessionId)}
              onSourceLookalikes={(count) => activeSessionId && handleSourceLookalikes(activeSessionId, count)}
              activeTab={activeTab}
              onActiveTabChange={setActiveTab}
              isSidebarCollapsed={isSidebarCollapsed}
              onAddContact={handleAddContact}
              contacts={contacts}
            />
            {viewMode === 'classic' && activeTab === 'results' && (
              <SearchInput 
                onSearch={handleSearch} 
                onRestart={activeSession ? handleRestartSearch : undefined}
                isLoading={activeSession?.status === 'searching'} 
              />
            )}
          </>
        ) : activeNav === 'contacts' ? (
          <ContactsView 
            contacts={contacts}
            projects={projects}
            onUpdateContact={handleUpdateContact}
            onDeleteContact={handleDeleteContact}
            onBulkDelete={handleBulkDelete}
            onAddContactFromFile={handleAddContactFromFile}
            onAddContactFromUrl={handleAddContactFromUrl}
            onRefreshContact={handleRefreshContact}
            onBulkRefresh={handleBulkRefresh}
            isAddingContact={isAddingContact}
            refreshingIds={refreshingIds}
          />
        ) : (
          <ProjectsView 
            projects={projects}
            contacts={contacts}
            onAddProject={handleAddProject}
            onUpdateProject={handleUpdateProject}
            onDeleteProject={handleDeleteProject}
          />
        )}
      </main>
    </div>
  );
}


