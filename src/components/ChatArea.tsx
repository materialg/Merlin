import { Github, BookOpen, User, CheckCircle2, AlertCircle, Linkedin, Globe, MessageSquare, MapPin, GraduationCap, Sparkles, Bookmark, Facebook, LayoutList, LayoutGrid, ExternalLink, X, MessageSquareQuote, Building2, Pencil, ChevronDown, Plus, Link, Mail, Check, Users } from 'lucide-react';
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { SearchSession, Candidate, ViewMode, Contact } from '../types';
import { getEduCategory } from '../lib/utils';
import { getSocialIcons } from './SocialIcons';
import FeedbackModal from './FeedbackModal';
import SocialLinksModal from './SocialLinksModal';
import EducationEditModal from './EducationEditModal';

interface ChatAreaProps {
  session: SearchSession | null;
  onToggleShortlist: (candidateId: string, feedback?: string) => void;
  onRejectCandidate: (candidateId: string, feedback?: string) => void;
  onUpdateTitle: (title: string) => void;
  onUpdatePrompt: (prompt: string) => void;
  onUpdateCandidate: (candidateId: string, updates: Partial<Candidate>) => void;
  onUpdateFeedback: (candidateId: string, feedback: string) => void;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  onLockShortlist: () => void;
  onSourceLookalikes: (count: number) => void;
  activeTab: 'results' | 'shortlist' | 'sourced';
  onActiveTabChange: (tab: 'results' | 'shortlist' | 'sourced') => void;
  isSidebarCollapsed?: boolean;
  onAddContact?: (candidate: Candidate) => void;
  onRemoveContact?: (contactId: string) => void;
  contacts?: Contact[];
}

const getEduCategoryLocal = (degree: string): 'B' | 'M' | 'P' | null => {
  return getEduCategory(degree);
};

export default function ChatArea({ 
  session, 
  onToggleShortlist, 
  onRejectCandidate, 
  onUpdateTitle, 
  onUpdatePrompt,
  onUpdateCandidate, 
  onUpdateFeedback,
  viewMode, 
  onViewModeChange,
  onLockShortlist,
  onSourceLookalikes,
  activeTab,
  onActiveTabChange,
  isSidebarCollapsed,
  onAddContact,
  onRemoveContact,
  contacts = []
}: ChatAreaProps) {
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState('');
  const [isEditingPrompt, setIsEditingPrompt] = useState(false);
  const [editedPrompt, setEditedPrompt] = useState('');
  const [expandedEducationId, setExpandedEducationId] = useState<string | null>(null);
  const [editingCompanyId, setEditingCompanyId] = useState<string | null>(null);
  const [tempCompany, setTempCompany] = useState("");
  const [expandedNotesId, setExpandedNotesId] = useState<string | null>(null);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [activeEduFilters, setActiveEduFilters] = useState<Record<string, string[]>>({});
  const titleInputRef = useRef<HTMLInputElement>(null);
  const [feedbackModal, setFeedbackModal] = useState<{
    isOpen: boolean;
    candidate: Candidate | null;
  }>({
    isOpen: false,
    candidate: null
  });
  const [socialModal, setSocialModal] = useState<{
    isOpen: boolean;
    candidate: Candidate | null;
  }>({
    isOpen: false,
    candidate: null
  });
  const [educationModal, setEducationModal] = useState<{
    isOpen: boolean;
    candidate: Candidate | null;
  }>({
    isOpen: false,
    candidate: null
  });

  useEffect(() => {
    if (session) {
      setEditedTitle(session.title || '');
    }
  }, [session?.id]);

  useEffect(() => {
    if (isEditingTitle && titleInputRef.current) {
      titleInputRef.current.focus();
      titleInputRef.current.select();
    }
  }, [isEditingTitle]);

  if (!session) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
        <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mb-6 text-4xl">
          🧙‍♂️
        </div>
        <h2 className="text-2xl font-sans font-semibold tracking-tight mb-2">Ready to make Magic?</h2>
        <p className="text-gray-500 max-w-md">
          Paste a job description, drop a URL, or describe the role you're looking for.
        </p>
      </div>
    );
  }

  const shortlistedCandidates = session.candidates.filter(c => session.shortlistedIds?.includes(c.id));
  const activeCandidates = activeTab === 'results' 
    ? session.candidates.filter(c => !session.rejectedIds?.includes(c.id))
    : activeTab === 'shortlist'
      ? shortlistedCandidates
      : (session.sourcedCandidates || []).filter(c => !session.shortlistedIds?.includes(c.id));



  const handleSocialSave = (links: { platform: string; url: string }[], anchorUrl?: string) => {
    if (!socialModal.candidate) return;
    
    // Extract email if it exists in the links
    const emailLink = links.find(l => l.platform.toLowerCase() === 'email');
    const otherLinks = links.filter(l => l.platform.toLowerCase() !== 'email');
    
    onUpdateCandidate(socialModal.candidate.id, { 
      socialLinks: otherLinks,
      email: emailLink ? emailLink.url.replace('mailto:', '') : null,
      anchorProfileUrl: anchorUrl,
      // Update main url if a LinkedIn or primary link is found
      url: anchorUrl || 
           otherLinks.find(l => l.platform === 'LinkedIn')?.url || 
           otherLinks.find(l => l.platform === 'GitHub')?.url || 
           otherLinks[0]?.url || 
           socialModal.candidate.url
    });

    setSocialModal({ isOpen: false, candidate: null });
  };

  const handleEducationSave = (history: any[]) => {
    if (!educationModal.candidate) return;
    onUpdateCandidate(educationModal.candidate.id, { educationHistory: history });
    setEducationModal({ isOpen: false, candidate: null });
  };

  const handleCompanySave = (candidateId: string) => {
    onUpdateCandidate(candidateId, { company: tempCompany });
    setEditingCompanyId(null);
  };

  const handleShortlistClick = (candidate: Candidate) => {
    const isShortlisted = session?.shortlistedIds?.includes(candidate.id);
    if (isShortlisted) {
      onToggleShortlist(candidate.id);
    } else {
      onToggleShortlist(candidate.id);
      if (onAddContact && !contacts.some(c => c.id === candidate.id)) {
        onAddContact(candidate);
      }
    }
  };

  const handleRejectClick = (candidate: Candidate) => {
    // Reject immediately
    onRejectCandidate(candidate.id);
    // Then ask for optional feedback
    setFeedbackModal({ isOpen: true, candidate });
  };

  const handleFeedbackSubmit = (feedback: string) => {
    if (!feedbackModal.candidate) return;
    onRejectCandidate(feedbackModal.candidate.id, feedback);
    setFeedbackModal({ ...feedbackModal, isOpen: false });
  };

  const handleFeedbackSkip = () => {
    // We already toggled/rejected immediately, so just close the modal
    setFeedbackModal({ ...feedbackModal, isOpen: false });
  };

  const handleTitleSubmit = () => {
    if (editedTitle.trim() && editedTitle !== session?.title) {
      onUpdateTitle(editedTitle.trim());
    } else {
      setEditedTitle(session?.title || '');
    }
    setIsEditingTitle(false);
  };

  const handleEditPrompt = () => {
    setEditedPrompt(session?.prompt || '');
    setIsEditingPrompt(true);
  };

  const handleSavePrompt = () => {
    if (editedPrompt.trim() && editedPrompt !== session?.prompt) {
      onUpdatePrompt(editedPrompt.trim());
    }
    setIsEditingPrompt(false);
  };

  const toggleEduFilter = (candidateId: string, category: 'B' | 'M' | 'P') => {
    const current = activeEduFilters[candidateId] || [];
    const next = current.includes(category)
      ? current.filter(c => c !== category)
      : [...current, category];
    
    setActiveEduFilters(prev => ({ ...prev, [candidateId]: next }));
    
    if (next.length === 0) {
      setExpandedEducationId(null);
    } else {
      setExpandedEducationId(candidateId);
    }
  };

  const handleTitleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleTitleSubmit();
    } else if (e.key === 'Escape') {
      setEditedTitle(session?.title || '');
      setIsEditingTitle(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-white overflow-hidden">
      <FeedbackModal 
        isOpen={feedbackModal.isOpen}
        onClose={() => setFeedbackModal({ ...feedbackModal, isOpen: false })}
        onSubmit={handleFeedbackSubmit}
        onSkip={handleFeedbackSkip}
        candidateName={feedbackModal.candidate?.name || ''}
      />

      <SocialLinksModal
        isOpen={socialModal.isOpen}
        onClose={() => setSocialModal({ ...socialModal, isOpen: false })}
        onSave={handleSocialSave}
        initialLinks={[
          ...(socialModal.candidate?.socialLinks || []),
          ...(socialModal.candidate?.email ? [{ platform: 'Email', url: socialModal.candidate.email }] : []),
          // Include main url if not already in socialLinks
          ...(socialModal.candidate?.url && !socialModal.candidate.socialLinks?.some(l => l.url === socialModal.candidate?.url) 
            ? [{ platform: 'Website', url: socialModal.candidate.url }] 
            : [])
        ]}
        initialAnchorUrl={socialModal.candidate?.anchorProfileUrl}
        candidateName={socialModal.candidate?.name || ''}
      />

      <EducationEditModal
        isOpen={educationModal.isOpen}
        onClose={() => setEducationModal({ isOpen: false, candidate: null })}
        onSave={handleEducationSave}
        initialHistory={educationModal.candidate?.educationHistory || []}
        candidateName={educationModal.candidate?.name || ''}
      />
      
      {/* Session Title Header */}
      <div className={`px-6 py-3 border-b border-gray-100 bg-gray-50/30 flex items-center justify-between transition-all ${isSidebarCollapsed ? 'pl-16' : ''}`}>
        <div className="flex-1 max-w-2xl">
          {isEditingTitle ? (
            <input
              ref={titleInputRef}
              type="text"
              value={editedTitle}
              onChange={(e) => setEditedTitle(e.target.value)}
              onBlur={handleTitleSubmit}
              onKeyDown={handleTitleKeyDown}
              className="w-full bg-white border border-blue-300 rounded-lg px-3 py-1.5 text-lg font-bold text-gray-900 focus:ring-2 focus:ring-blue-500 outline-none shadow-sm"
              placeholder="Enter role name..."
            />
          ) : (
            <div 
              onClick={() => setIsEditingTitle(true)}
              className="group flex items-center gap-3 cursor-pointer hover:bg-gray-100/50 px-2 py-1 -ml-2 rounded-lg transition-all"
            >
              <h2 className="text-lg font-bold text-gray-900 truncate">
                {session.title || 'Untitled Search'}
              </h2>
              <Pencil className="w-4 h-4 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          )}
        </div>

        {shortlistedCandidates.length >= 10 && !session.isShortlistLocked && (
          <button
            onClick={onLockShortlist}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg font-bold text-sm shadow-lg shadow-blue-100 hover:bg-blue-700 transition-all"
          >
            <CheckCircle2 className="w-4 h-4" />
            Lock Shortlist
          </button>
        )}
        {session.isShortlistLocked && (
          <div className="flex items-center gap-2 bg-green-50 text-green-700 px-4 py-2 rounded-lg font-bold text-sm border border-green-100">
            <CheckCircle2 className="w-4 h-4" />
            Shortlist Locked
          </div>
        )}
      </div>

      {/* Top Tabs */}
      <div className={`px-6 border-b border-gray-100 flex items-center gap-8 transition-all ${isSidebarCollapsed ? 'pl-16' : ''}`}>
        <button 
          onClick={() => onActiveTabChange('results')}
          className={`py-4 text-sm font-bold border-b-2 transition-all ${activeTab === 'results' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
        >
          Results
        </button>
        <button 
          onClick={() => onActiveTabChange('shortlist')}
          className={`py-4 text-sm font-bold border-b-2 transition-all flex items-center gap-2 ${activeTab === 'shortlist' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
        >
          Shortlist
          {shortlistedCandidates.length > 0 && (
            <span className="bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded text-[10px]">{shortlistedCandidates.length}</span>
          )}
        </button>
        <button 
          onClick={() => onActiveTabChange('sourced')}
          className={`py-4 text-sm font-bold border-b-2 transition-all flex items-center gap-2 ${activeTab === 'sourced' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
        >
          Sourced
          {session.sourcedCandidates && session.sourcedCandidates.length > 0 && (
            <span className="bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded text-[10px]">{session.sourcedCandidates.length}</span>
          )}
        </button>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Main Content Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-8 transition-all">
          <AnimatePresence mode="popLayout">
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col gap-6 max-w-6xl mx-auto"
            >
              {/* User Prompt */}
              {activeTab === 'results' && (
                <div className={`flex ${isEditingPrompt ? 'w-full' : 'justify-end'}`}>
                  <div className={`bg-blue-600 text-white px-6 py-4 rounded-2xl shadow-lg group relative transition-all duration-300 ${
                    isEditingPrompt ? 'w-full' : 'max-w-[80%] rounded-tr-none'
                  }`}>
                    {isEditingPrompt ? (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-black uppercase tracking-widest opacity-70">Update Search Criteria</h4>
                          <Sparkles className="w-4 h-4 opacity-50" />
                        </div>
                        <textarea
                          value={editedPrompt}
                          onChange={(e) => setEditedPrompt(e.target.value)}
                          className="w-full bg-blue-700/50 text-white border border-blue-400/30 rounded-xl p-4 text-base focus:ring-2 focus:ring-white/20 outline-none min-h-[150px] resize-none placeholder-blue-300"
                          placeholder="Refine your search criteria..."
                          autoFocus
                        />
                        <div className="flex justify-end gap-3">
                          <button
                            onClick={() => setIsEditingPrompt(false)}
                            className="px-4 py-2 text-sm font-bold text-white hover:bg-white/10 rounded-xl transition-all"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={handleSavePrompt}
                            className="px-6 py-2 text-sm font-bold bg-white text-blue-600 rounded-xl hover:bg-blue-50 transition-all shadow-md active:scale-95"
                          >
                            Update Search
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <p className="text-sm leading-relaxed pr-6">{session.prompt}</p>
                        <button 
                          onClick={handleEditPrompt}
                          className="absolute top-2 right-2 p-1 opacity-0 group-hover:opacity-100 hover:bg-blue-500 rounded transition-all"
                          title="Edit search criteria"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* Status & Plan */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm font-medium text-gray-500">
                    {activeTab === 'results' ? (
                      session.status === 'searching' ? (
                        <>
                          <span className="text-base animate-pulse">🪄</span>
                          <span>Making magic...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4 text-purple-500" />
                          <span>Found {activeCandidates.length} candidates</span>
                          <div className="ml-4 flex items-center gap-2 bg-blue-50 px-2 py-1 rounded-full border border-blue-100">
                            <div className="w-20 bg-blue-200 h-1.5 rounded-full overflow-hidden">
                              <div 
                                className="bg-blue-600 h-full transition-all duration-500" 
                                style={{ width: `${Math.min((shortlistedCandidates.length / 10) * 100, 100)}%` }}
                              />
                            </div>
                            <span className="text-[10px] font-bold text-blue-600 uppercase tracking-tight">
                              {shortlistedCandidates.length}/10 Shortlisted
                            </span>
                          </div>
                        </>
                      )
                    ) : activeTab === 'shortlist' ? (
                      <>
                        <Bookmark className="w-4 h-4 text-blue-500 fill-current" />
                        <span>{shortlistedCandidates.length}/10 Shortlisted Candidates</span>
                      </>
                    ) : (
                      <>
                        <Globe className="w-4 h-4 text-indigo-500" />
                        <span>{session.sourcedCandidates?.length || 0} Sourced Look-alikes</span>
                      </>
                    )}
                  </div>

                  {(activeTab === 'results' ? activeCandidates.length > 0 : shortlistedCandidates.length > 0) && (
                    <div className="flex items-center bg-gray-100 p-1 rounded-lg border border-gray-200">
                      <button
                        onClick={() => onViewModeChange('classic')}
                        className={`p-1.5 rounded-md transition-all ${viewMode === 'classic' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                        title="Classic View"
                      >
                        <LayoutGrid className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => onViewModeChange('list')}
                        className={`p-1.5 rounded-md transition-all ${viewMode === 'list' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                        title="List View"
                      >
                        <LayoutList className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>

                {activeTab === 'results' && session.querySpec && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="bg-gray-50 border border-gray-200 rounded-xl p-5"
                  >
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Query spec</span>
                        {session.querySpec.title && (
                          <span className="text-xs font-semibold text-gray-700">{session.querySpec.title}</span>
                        )}
                      </div>
                      <pre className="text-[11px] text-gray-700 leading-relaxed overflow-x-auto whitespace-pre-wrap break-words font-mono bg-white border border-gray-100 rounded p-3">
{JSON.stringify(session.querySpec, null, 2)}
                      </pre>
                      {session.esQuery && (
                        <details className="text-[10px]">
                          <summary className="font-bold text-gray-400 uppercase tracking-widest cursor-pointer hover:text-gray-600">PDL ES query</summary>
                          <pre className="mt-2 text-[11px] text-gray-700 leading-relaxed overflow-x-auto whitespace-pre-wrap break-words font-mono bg-white border border-gray-100 rounded p-3">
{JSON.stringify(session.esQuery, null, 2)}
                          </pre>
                        </details>
                      )}
                      {session.debug && (
                        <details className="text-[10px]">
                          <summary className="font-bold text-gray-400 uppercase tracking-widest cursor-pointer hover:text-gray-600">PDL debug · {session.debug.pdlTotalReturned} returned → {session.debug.candidatesAfterFilter ?? session.debug.pdlWithLinkedin} kept (w/ LinkedIn), {session.debug.pdlWithoutLinkedin} dropped</summary>
                          <pre className="mt-2 text-[11px] text-gray-700 leading-relaxed overflow-x-auto whitespace-pre-wrap break-words font-mono bg-white border border-gray-100 rounded p-3">
{JSON.stringify(session.debug.sampleRawPerson, null, 2)}
                          </pre>
                        </details>
                      )}
                    </div>
                  </motion.div>
                )}
              </div>

              {/* Candidates View */}
              {viewMode === 'classic' ? (
                <div className="space-y-4">
                  {activeCandidates.map((candidate, idx) => {
                    const isShortlisted = session.shortlistedIds?.includes(candidate.id);
                    return (
                      <motion.div
                        key={candidate.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.1 }}
                        className="bg-white border-b border-gray-100 pb-8 last:border-0"
                      >
                        <div className="space-y-3">
                          {/* Top Header */}
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div>
                                <h3 className="text-base font-semibold text-gray-900 leading-none">{candidate.name}</h3>
                                <div className="flex items-center gap-2.5 mt-1.5">
                                  {getSocialIcons(candidate)}
                                  <button 
                                    onClick={() => setSocialModal({ isOpen: true, candidate })}
                                    className="p-1 text-gray-300 hover:text-blue-500 hover:bg-blue-50 rounded transition-all"
                                    title="Edit profiles"
                                  >
                                    <Pencil className="w-3 h-3" />
                                  </button>
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-1">
                              {onAddContact && (() => {
                                const saved = contacts.some(c => c.id === candidate.id);
                                return (
                                  <button
                                    onClick={() => saved ? onRemoveContact?.(candidate.id) : onAddContact(candidate)}
                                    className={`p-2 rounded-lg transition-all ${
                                      saved
                                        ? 'text-green-600 bg-green-50 hover:text-red-600 hover:bg-red-50'
                                        : 'text-gray-400 hover:text-green-600 hover:bg-green-50'
                                    }`}
                                    title={saved ? "Remove from contacts" : "Save to contacts"}
                                  >
                                    <Users className={`w-4 h-4 ${saved ? 'fill-current' : ''}`} />
                                  </button>
                                );
                              })()}

                              <button
                                onClick={() => handleShortlistClick(candidate)}
                                className={`p-2 rounded-lg transition-all ${
                                  isShortlisted
                                    ? 'text-blue-600 bg-blue-50'
                                    : 'text-gray-400 hover:text-blue-600 hover:bg-blue-50'
                                }`}
                                title={isShortlisted ? 'Remove from shortlist' : 'Shortlist (also saves to contacts)'}
                              >
                                <Bookmark className={`w-4 h-4 ${isShortlisted ? 'fill-current' : ''}`} />
                              </button>

                              {activeTab === 'results' && (
                                <button
                                  onClick={() => handleRejectClick(candidate)}
                                  className="p-2 rounded-lg transition-all text-gray-400 hover:text-red-600 hover:bg-red-50"
                                  title="Reject candidate"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </div>

                          {/* AI Summary moved under social links */}
                          <div className="pt-1">
                            <div className="flex gap-3">
                              <Sparkles className="w-4 h-4 text-purple-500 shrink-0 mt-1" />
                              <p className="text-sm text-gray-700 leading-relaxed">
                                {candidate.impactSummary}
                              </p>
                            </div>
                          </div>

                            {/* Sub-info */}
                            <div className="space-y-2">
                              <div className="flex items-center gap-2 text-sm text-gray-500">
                                <div className="w-4 h-4 bg-gray-100 rounded flex items-center justify-center shrink-0">
                                  <Building2 className="w-3 h-3 text-gray-400" />
                                </div>
                                {editingCompanyId === candidate.id ? (
                                  <div className="flex items-center gap-2 w-full">
                                    <input
                                      type="text"
                                      value={tempCompany}
                                      onChange={(e) => setTempCompany(e.target.value)}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') handleCompanySave(candidate.id);
                                        if (e.key === 'Escape') setEditingCompanyId(null);
                                      }}
                                      className="text-xs border border-blue-300 rounded px-2 py-0.5 focus:ring-2 focus:ring-blue-500 outline-none w-full max-w-[200px]"
                                      autoFocus
                                    />
                                    <button 
                                      onClick={() => handleCompanySave(candidate.id)}
                                      className="p-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition-all"
                                    >
                                      <Check className="w-3 h-3" />
                                    </button>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-2 group/company">
                                    <span className="font-medium">{candidate.company || 'Unknown'}</span>
                                    <button 
                                      onClick={() => {
                                        setEditingCompanyId(candidate.id);
                                        setTempCompany(candidate.company || "");
                                      }}
                                      className="opacity-0 group-hover/company:opacity-100 p-0.5 text-gray-400 hover:text-blue-600 transition-all"
                                      title="Edit organization"
                                    >
                                      <Pencil className="w-3 h-3" />
                                    </button>
                                  </div>
                                )}
                              </div>
                            <div className="flex items-center gap-2 text-sm text-gray-600">
                              <div className="w-4 h-4 bg-gray-100 rounded flex items-center justify-center">
                                <Globe className="w-3 h-3 text-gray-400" />
                              </div>
                              <span className="font-medium">{candidate.title}</span>
                            </div>
                            
                            {candidate.location && (
                              <div className="flex items-center gap-2 text-sm text-gray-500">
                                <MapPin className="w-4 h-4 text-gray-400" />
                                <span className="font-medium">{candidate.location}</span>
                              </div>
                            )}

                            <div className="relative">
                              <div className="flex items-center gap-3">
                                <button 
                                  onClick={() => {
                                    if (!candidate.educationHistory || candidate.educationHistory.length === 0) {
                                      setEducationModal({ isOpen: true, candidate });
                                    } else {
                                      setExpandedEducationId(expandedEducationId === candidate.id ? null : candidate.id);
                                      if (expandedEducationId !== candidate.id) {
                                        // Default to showing all if opening via main button
                                        setActiveEduFilters(prev => ({ ...prev, [candidate.id]: ['P', 'M', 'B'] }));
                                      }
                                    }
                                  }}
                                  className="flex items-center gap-2 text-sm text-gray-500 hover:text-blue-600 transition-colors group"
                                >
                                  <div className="w-4 h-4 bg-gray-100 rounded flex items-center justify-center group-hover:bg-blue-50">
                                    {(!candidate.educationHistory || candidate.educationHistory.length === 0) ? (
                                      <Plus className="w-3 h-3 text-gray-400 group-hover:text-blue-500" />
                                    ) : (
                                      <GraduationCap className="w-3 h-3 text-gray-400 group-hover:text-blue-500" />
                                    )}
                                  </div>
                                  <span className="font-medium text-gray-500 group-hover:text-blue-600">
                                    {(!candidate.educationHistory || candidate.educationHistory.length === 0) ? "Add Education" : "Education"}
                                  </span>
                                  {candidate.educationHistory && candidate.educationHistory.length > 0 && (
                                    <ChevronDown className={`w-3 h-3 transition-transform ${expandedEducationId === candidate.id ? 'rotate-180' : ''}`} />
                                  )}
                                </button>

                                {candidate.educationHistory && candidate.educationHistory.length > 0 && (
                                  <div className="flex items-center gap-1.5">
                                    {['P', 'M', 'B'].map((cat) => {
                                      const hasDegree = candidate.educationHistory?.some(edu => getEduCategory(edu.degree) === cat);
                                      const isActive = activeEduFilters[candidate.id]?.includes(cat);
                                      
                                      let badgeStyles = "";
                                      if (hasDegree) {
                                        if (isActive) {
                                          badgeStyles = cat === 'P' ? 'bg-indigo-800 text-white border-indigo-800' : 
                                                       cat === 'M' ? 'bg-blue-700 text-white border-blue-700' : 
                                                       'bg-blue-600 text-white border-blue-600';
                                        } else {
                                          badgeStyles = 'bg-blue-50 text-blue-600 border-blue-100 hover:border-blue-300 hover:bg-blue-100 cursor-pointer';
                                        }
                                      } else {
                                        badgeStyles = 'bg-gray-50 text-gray-300 border-gray-100 cursor-not-allowed opacity-50';
                                      }

                                      return (
                                        <button
                                          key={cat}
                                          onClick={() => hasDegree && toggleEduFilter(candidate.id, cat as any)}
                                          disabled={!hasDegree}
                                          className={`w-6 h-6 rounded-full border text-[10px] font-black flex items-center justify-center transition-all shadow-sm ${badgeStyles}`}
                                          title={hasDegree ? `${cat === 'B' ? "Bachelor's" : cat === 'M' ? "Master's" : "PhD"} Degree` : "No data available"}
                                        >
                                          {cat}
                                        </button>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                              
                              <AnimatePresence>
                                {expandedEducationId === candidate.id && candidate.educationHistory && candidate.educationHistory.length > 0 && (
                                  <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    className="overflow-hidden pl-6 space-y-2 border-l-2 border-gray-100 ml-2"
                                  >
                                    <div className="flex items-center gap-2 py-1">
                                      <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">History</span>
                                      <button 
                                        onClick={(e) => { 
                                          e.stopPropagation(); 
                                          setEducationModal({ isOpen: true, candidate });
                                        }} 
                                        className="p-1 hover:bg-blue-50 text-blue-600 rounded transition-colors"
                                        title="Edit Education"
                                      >
                                        <Pencil className="w-3 h-3" />
                                      </button>
                                    </div>
                                    {['P', 'M', 'B']
                                      .filter(cat => {
                                        const filters = activeEduFilters[candidate.id] || ['B', 'M', 'P'];
                                        return filters.includes(cat);
                                      })
                                      .map(cat => {
                                        const edus = candidate.educationHistory?.filter(edu => getEduCategory(edu.degree) === cat);
                                        return edus?.map((edu, i) => (
                                          <div key={`${cat}-${i}`} className="text-xs text-gray-500 py-1.5 flex flex-wrap gap-1 items-center">
                                            {edu.year && <span className="font-bold text-gray-700">{edu.year}</span>}
                                            {edu.year && <span className="text-gray-300">•</span>}
                                            <span className="font-bold text-gray-700">{edu.school}</span>
                                            <span className="text-gray-300">•</span>
                                            <span className="text-blue-600 font-medium">{edu.degree}</span>
                                            {edu.field && <span className="text-gray-300">•</span>}
                                            {edu.field && <span className="italic">{edu.field}</span>}
                                          </div>
                                        ));
                                      })}
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>

                            {activeTab === 'shortlist' && (
                              <div className="space-y-2">
                                <button 
                                  onClick={() => setExpandedNotesId(expandedNotesId === candidate.id ? null : candidate.id)}
                                  className="flex items-center gap-2 text-sm text-gray-500 hover:text-blue-600 transition-colors group"
                                >
                                  <div className="w-4 h-4 bg-gray-100 rounded flex items-center justify-center group-hover:bg-blue-50">
                                    <MessageSquareQuote className="w-3 h-3 text-gray-400 group-hover:text-blue-500" />
                                  </div>
                                  <span className="font-medium text-gray-500 group-hover:text-blue-600">Notes</span>
                                  <ChevronDown className={`w-3 h-3 transition-transform ${expandedNotesId === candidate.id ? 'rotate-180' : ''}`} />
                                </button>
                                
                                <AnimatePresence>
                                  {expandedNotesId === candidate.id && (
                                    <motion.div
                                      initial={{ height: 0, opacity: 0 }}
                                      animate={{ height: 'auto', opacity: 1 }}
                                      exit={{ height: 0, opacity: 0 }}
                                      className="overflow-hidden pl-6 space-y-2 border-l-2 border-gray-100 ml-2"
                                    >
                                      <div className="relative">
                                        <textarea
                                          value={session.feedbackMap?.[candidate.id] || ''}
                                          onChange={(e) => onUpdateFeedback(candidate.id, e.target.value)}
                                          placeholder="Add a note about this candidate..."
                                          className="w-full bg-gray-50 border border-gray-200 rounded-lg p-3 text-xs text-gray-700 focus:ring-2 focus:ring-blue-500 outline-none min-h-[80px] resize-none"
                                          autoFocus
                                        />
                                        <button 
                                          onClick={() => setExpandedNotesId(null)}
                                          className="absolute bottom-2 right-2 p-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 shadow-sm transition-all"
                                          title="Finish editing"
                                        >
                                          <Check className="w-3 h-3" />
                                        </button>
                                      </div>
                                    </motion.div>
                                  )}
                                </AnimatePresence>
                              </div>
                            )}
                          </div>

                          {/* Bottom Match Bar */}
                          <div className="pt-4 flex items-center gap-6">
                            <div className="flex items-center gap-2">
                              <div className="text-xs font-bold text-blue-600 uppercase tracking-wider">Match Score</div>
                              <div className="flex items-center gap-1.5 bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-sm font-bold">
                                {candidate.score}%
                              </div>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              ) : (
                <div className="overflow-x-auto -mx-6 px-6">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-gray-100">
                        <th className="py-4 px-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">Match</th>
                        <th className="py-4 px-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Name</th>
                        <th className="py-4 px-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Title</th>
                        <th className="py-4 px-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Education</th>
                        {activeTab === 'shortlist' && (
                          <th className="py-4 px-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Notes</th>
                        )}
                        <th className="py-4 px-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Save</th>
                        <th className="py-4 px-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activeCandidates.map((candidate, idx) => {
                        const isShortlisted = session.shortlistedIds?.includes(candidate.id);
                        return (
                          <motion.tr
                            key={candidate.id}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: idx * 0.05 }}
                            className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors group"
                          >
                            <td className="py-4 px-4">
                              <div className="flex justify-center">
                                <div className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded text-xs font-bold">
                                  {candidate.score}%
                                </div>
                              </div>
                            </td>
                            <td className="py-4 px-4">
                              <div className="flex flex-col">
                                <span className="text-sm font-bold text-gray-900">{candidate.name}</span>
                                <div className="flex items-center gap-2 mt-1">
                                  {getSocialIcons(candidate, () => setSocialModal({ isOpen: true, candidate }))}
                                </div>
                              </div>
                            </td>
                            <td className="py-4 px-4">
                              <div className="flex flex-col">
                                {editingCompanyId === candidate.id ? (
                                  <div className="flex items-center gap-2 mb-1">
                                    <input
                                      type="text"
                                      value={tempCompany}
                                      onChange={(e) => setTempCompany(e.target.value)}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') handleCompanySave(candidate.id);
                                        if (e.key === 'Escape') setEditingCompanyId(null);
                                      }}
                                      className="text-[10px] border border-blue-300 rounded px-1.5 py-0.5 focus:ring-2 focus:ring-blue-500 outline-none w-full max-w-[150px]"
                                      autoFocus
                                    />
                                    <button 
                                      onClick={() => handleCompanySave(candidate.id)}
                                      className="p-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition-all"
                                    >
                                      <Check className="w-2.5 h-2.5" />
                                    </button>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-2 group/company">
                                    <span className="text-xs text-gray-400 font-medium truncate max-w-[200px]">{candidate.company || 'Unknown'}</span>
                                    <button 
                                      onClick={() => {
                                        setEditingCompanyId(candidate.id);
                                        setTempCompany(candidate.company || "");
                                      }}
                                      className="opacity-0 group-hover/company:opacity-100 p-0.5 text-gray-400 hover:text-blue-600 transition-all"
                                      title="Edit organization"
                                    >
                                      <Pencil className="w-2.5 h-2.5" />
                                    </button>
                                  </div>
                                )}
                                <span className="text-sm text-gray-700 font-medium truncate max-w-[200px]">{candidate.title}</span>
                              </div>
                            </td>
                            <td className="py-4 px-4">
                                <div className="relative">
                                  <div className="flex items-center gap-1.5">
                                    <button 
                                      onClick={() => {
                                        if (!candidate.educationHistory || candidate.educationHistory.length === 0) {
                                          setEducationModal({ isOpen: true, candidate });
                                        } else {
                                          const isClosing = expandedEducationId === candidate.id;
                                          setExpandedEducationId(isClosing ? null : candidate.id);
                                          if (!isClosing) {
                                            setActiveEduFilters(prev => ({ ...prev, [candidate.id]: ['P', 'M', 'B'] }));
                                          } else {
                                            setActiveEduFilters(prev => {
                                              const next = { ...prev };
                                              delete next[candidate.id];
                                              return next;
                                            });
                                          }
                                        }
                                      }}
                                      className={`p-2 rounded-lg transition-all ${expandedEducationId === candidate.id ? 'bg-blue-50 text-blue-600' : 'text-gray-400 hover:bg-gray-50 hover:text-blue-600'}`}
                                      title={(!candidate.educationHistory || candidate.educationHistory.length === 0) ? "Add Education" : "View Education"}
                                    >
                                      {(!candidate.educationHistory || candidate.educationHistory.length === 0) ? (
                                        <Plus className="w-4 h-4" />
                                      ) : (
                                        <GraduationCap className="w-4 h-4" />
                                      )}
                                    </button>

                                    {candidate.educationHistory && candidate.educationHistory.length > 0 && (
                                      <div className="flex items-center gap-1">
                                        {['P', 'M', 'B'].map((cat) => {
                                          const hasDegree = candidate.educationHistory?.some(edu => getEduCategory(edu.degree) === cat);
                                          const isActive = activeEduFilters[candidate.id]?.includes(cat);
                                          
                                          let badgeStyles = "";
                                          if (hasDegree) {
                                            if (isActive) {
                                              badgeStyles = cat === 'P' ? 'bg-indigo-800 text-white border-indigo-800' : 
                                                           cat === 'M' ? 'bg-blue-700 text-white border-blue-700' : 
                                                           'bg-blue-600 text-white border-blue-600';
                                            } else {
                                              badgeStyles = 'bg-blue-50 text-blue-600 border-blue-100 hover:border-blue-300 hover:bg-blue-100 cursor-pointer';
                                            }
                                          } else {
                                            badgeStyles = 'bg-gray-50 text-gray-300 border-gray-100 cursor-not-allowed opacity-50';
                                          }

                                          return (
                                            <button
                                              key={cat}
                                              onClick={() => hasDegree && toggleEduFilter(candidate.id, cat as any)}
                                              disabled={!hasDegree}
                                              className={`w-5 h-5 rounded-full border text-[8px] font-black flex items-center justify-center transition-all shadow-sm z-10 ${badgeStyles}`}
                                              title={hasDegree ? `${cat === 'B' ? "Bachelor's" : cat === 'M' ? "Master's" : "PhD"} Degree` : "No data available"}
                                            >
                                              {cat}
                                            </button>
                                          );
                                        })}
                                      </div>
                                    )}
                                  </div>
                                  
                                  <AnimatePresence>
                                    {expandedEducationId === candidate.id && (
                                      <motion.div
                                        initial={{ opacity: 0, scale: 0.95, y: 10 }}
                                        animate={{ opacity: 1, scale: 1, y: 0 }}
                                        exit={{ opacity: 0, scale: 0.95, y: 10 }}
                                        className="absolute z-50 top-full left-0 mt-2 w-80 bg-white border border-gray-100 rounded-xl shadow-xl p-4 space-y-3"
                                      >
                                        <div className="flex items-center justify-between mb-1">
                                          <div className="flex items-center gap-2">
                                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Education History</span>
                                            <button 
                                              onClick={(e) => { 
                                                e.stopPropagation(); 
                                                setEducationModal({ isOpen: true, candidate });
                                              }} 
                                              className="p-1 hover:bg-blue-50 text-blue-600 rounded transition-colors"
                                              title="Edit Education"
                                            >
                                              <Pencil className="w-3 h-3" />
                                            </button>
                                          </div>
                                          <div className="flex items-center gap-1">
                                            <button 
                                              onClick={(e) => { 
                                                e.stopPropagation(); 
                                                setExpandedEducationId(null);
                                                setActiveEduFilters(prev => {
                                                  const next = { ...prev };
                                                  delete next[candidate.id];
                                                  return next;
                                                });
                                              }} 
                                              className="p-1 hover:bg-gray-100 rounded"
                                            >
                                              <X className="w-3 h-3 text-gray-400" />
                                            </button>
                                          </div>
                                        </div>
                                        <div className="max-h-64 overflow-y-auto pr-1 space-y-3">
                                          {candidate.educationHistory && candidate.educationHistory.length > 0 ? (
                                            ['P', 'M', 'B']
                                              .filter(cat => {
                                                const filters = activeEduFilters[candidate.id] || ['P', 'M', 'B'];
                                                return filters.includes(cat);
                                              })
                                              .map(cat => {
                                                const edus = candidate.educationHistory?.filter(edu => getEduCategory(edu.degree) === cat);
                                                return edus?.map((edu, i) => (
                                                  <div key={`${cat}-${i}`} className="text-xs text-gray-600 border-b border-gray-50 last:border-0 pb-3 last:pb-0">
                                                    <div className="flex flex-wrap gap-1 items-center">
                                                      {edu.year && <span className="font-bold text-gray-900">{edu.year}</span>}
                                                      {edu.year && <span className="text-gray-300">•</span>}
                                                      <span className="font-bold text-gray-900">{edu.school}</span>
                                                    </div>
                                                    <div className="mt-1 flex flex-wrap gap-1 items-center">
                                                      <span className="text-blue-600 font-semibold">{edu.degree}</span>
                                                      {edu.field && <span className="text-gray-300">•</span>}
                                                      {edu.field && <span className="italic text-gray-500">{edu.field}</span>}
                                                    </div>
                                                  </div>
                                                ));
                                              })
                                          ) : (
                                            <p className="text-xs text-gray-400 italic py-2">No detailed history available.</p>
                                          )}
                                        </div>
                                      </motion.div>
                                    )}
                                  </AnimatePresence>
                                </div>
                            </td>
                            {activeTab === 'shortlist' && (
                              <td className="py-4 px-4 min-w-[240px]">
                                <div className="relative group/note">
                                  {editingNoteId === candidate.id ? (
                                    <div className="relative">
                                      <textarea
                                        value={session.feedbackMap?.[candidate.id] || ''}
                                        onChange={(e) => onUpdateFeedback(candidate.id, e.target.value)}
                                        placeholder="Add a note..."
                                        className="w-full bg-white border border-blue-200 rounded-lg p-2 text-[11px] text-gray-700 focus:ring-2 focus:ring-blue-500 outline-none min-h-[80px] resize-none shadow-sm"
                                        autoFocus
                                      />
                                      <button 
                                        onClick={() => setEditingNoteId(null)}
                                        className="absolute bottom-2 right-2 p-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 shadow-sm transition-all flex items-center gap-1"
                                        title="Finish editing"
                                      >
                                        <Check className="w-3 h-3" />
                                      </button>
                                    </div>
                                  ) : (
                                    <div 
                                      onClick={() => setEditingNoteId(candidate.id)}
                                      className="w-full bg-gray-50/50 border border-gray-100 rounded-lg p-2 text-[11px] text-gray-700 min-h-[60px] cursor-pointer transition-all hover:bg-white hover:border-blue-100 relative group"
                                    >
                                      {session.feedbackMap?.[candidate.id] ? (
                                        <p className="whitespace-pre-wrap pr-6">{session.feedbackMap[candidate.id]}</p>
                                      ) : (
                                        <span className="text-gray-400 italic">Add a note...</span>
                                      )}
                                      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Pencil className="w-3 h-3 text-gray-400" />
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </td>
                            )}
                            <td className="py-4 px-4 text-right">
                              <div className="flex items-center justify-end gap-1">
                                {onAddContact && (() => {
                                  const saved = contacts.some(c => c.id === candidate.id);
                                  return (
                                    <button
                                      onClick={() => saved ? onRemoveContact?.(candidate.id) : onAddContact(candidate)}
                                      className={`p-2 rounded-lg transition-all ${
                                        saved
                                          ? 'text-green-600 bg-green-50 hover:text-red-600 hover:bg-red-50'
                                          : 'text-gray-400 hover:text-green-600 hover:bg-green-50'
                                      }`}
                                      title={saved ? "Remove from contacts" : "Save to contacts"}
                                    >
                                      <Users className={`w-4 h-4 ${saved ? 'fill-current' : ''}`} />
                                    </button>
                                  );
                                })()}
                              </div>
                            </td>
                            <td className="py-4 px-4 text-right">
                              <div className="flex items-center justify-end gap-1">
                                <button
                                  onClick={() => handleShortlistClick(candidate)}
                                  className={`p-2 rounded-lg transition-all ${
                                    isShortlisted
                                      ? 'text-blue-600 bg-blue-50'
                                      : 'text-gray-400 hover:text-blue-600 hover:bg-blue-50'
                                  }`}
                                  title={isShortlisted ? "Remove from shortlist" : "Shortlist (also saves to contacts)"}
                                >
                                  <Bookmark className={`w-4 h-4 ${isShortlisted ? 'fill-current' : ''}`} />
                                </button>

                                {activeTab === 'results' && (
                                  <button
                                    onClick={() => handleRejectClick(candidate)}
                                    className="p-2 rounded-lg transition-all text-gray-400 hover:text-red-600 hover:bg-red-50"
                                    title="Reject candidate"
                                  >
                                    <X className="w-4 h-4" />
                                  </button>
                                )}
                              </div>
                            </td>
                          </motion.tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {activeTab === 'results' && session.status === 'completed' && activeCandidates.length === 0 && (
                <div className="text-center py-12">
                  <p className="text-gray-400 text-sm">No candidates found. Try a broader search.</p>
                </div>
              )}

              {activeTab === 'shortlist' && shortlistedCandidates.length === 0 && (
                <div className="text-center py-20 flex flex-col items-center gap-4 opacity-40">
                  <Bookmark className="w-12 h-12 text-gray-300" />
                  <p className="text-sm italic text-gray-400">No candidates shortlisted yet. Start shortlisting from the Results tab!</p>
                </div>
              )}

              {activeTab === 'sourced' && (!session.sourcedCandidates || session.sourcedCandidates.length === 0) && (
                <div className="text-center py-12 flex flex-col items-center gap-6">
                  {!session.isShortlistLocked ? (
                    <div className="bg-amber-50 border border-amber-100 p-8 rounded-2xl max-w-md">
                      <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Bookmark className="w-6 h-6 text-amber-600" />
                      </div>
                      <h3 className="text-lg font-bold text-amber-900 mb-2">Shortlist Not Locked</h3>
                      <p className="text-sm text-amber-700 leading-relaxed text-center">
                        Add 10 candidates to your shortlist to begin sourcing
                      </p>
                    </div>
                  ) : (
                    <div className="bg-blue-50 border border-blue-100 p-10 rounded-2xl max-w-xl w-full">
                      <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6">
                        <Globe className="w-8 h-8 text-blue-600" />
                      </div>
                      <h3 className="text-xl font-bold text-blue-900 mb-3">Source Look-alikes</h3>
                      <p className="text-sm text-blue-700 mb-8 leading-relaxed">
                        Your shortlist is calibrated! Merlin can now search for candidates that match the technical profile of your top 10. How many would you like to source?
                      </p>
                      
                      <div className="grid grid-cols-5 gap-3 mb-8">
                        {[20, 40, 60, 80, 100, 120, 140, 160, 180, 200].map(count => (
                          <button
                            key={count}
                            onClick={() => onSourceLookalikes(count)}
                            disabled={session.sourcingStatus === 'sourcing'}
                            className="py-3 px-2 rounded-xl border border-blue-200 bg-white text-blue-600 font-bold text-sm hover:bg-blue-600 hover:text-white hover:border-blue-600 transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {count}
                          </button>
                        ))}
                      </div>

                      {session.sourcingStatus === 'sourcing' && (
                        <div className="flex flex-col items-center gap-3">
                          <div className="w-full bg-blue-100 h-2 rounded-full overflow-hidden">
                            <motion.div 
                              className="bg-blue-600 h-full"
                              initial={{ width: "0%" }}
                              animate={{ width: "100%" }}
                              transition={{ duration: 10, repeat: Infinity }}
                            />
                          </div>
                          <p className="text-xs font-bold text-blue-600 uppercase tracking-widest animate-pulse">Sourcing Look-alikes...</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {session.status === 'error' && (
                <div className="flex flex-col gap-2 bg-red-50 p-4 rounded-xl border border-red-100">
                  <div className="flex items-center gap-2 text-red-600">
                    <AlertCircle className="w-5 h-5" />
                    <p className="text-sm font-medium">Something went wrong with the search. Please try again.</p>
                  </div>
                  {session.error && (
                    <p className="text-xs text-red-500 font-mono mt-1 bg-white/50 p-2 rounded border border-red-100 overflow-auto max-h-[100px]">
                      {session.error}
                    </p>
                  )}
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
