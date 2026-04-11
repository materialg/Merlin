import { Github, BookOpen, User, CheckCircle2, AlertCircle, Linkedin, Globe, MessageSquare, MapPin, GraduationCap, Sparkles, Bookmark, Facebook, LayoutList, LayoutGrid, ExternalLink, X, MessageSquareQuote, Building2, Pencil, ChevronDown, Plus, Link } from 'lucide-react';
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { SearchSession, Candidate, ViewMode } from '../types';
import FeedbackModal from './FeedbackModal';
import SocialLinksModal from './SocialLinksModal';

interface ChatAreaProps {
  session: SearchSession | null;
  onToggleShortlist: (candidateId: string, feedback?: string) => void;
  onRejectCandidate: (candidateId: string, feedback?: string) => void;
  onUpdateTitle: (title: string) => void;
  onUpdateCandidate: (candidateId: string, updates: Partial<Candidate>) => void;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  onLockShortlist: () => void;
  onSourceLookalikes: (count: number) => void;
  activeTab: 'results' | 'shortlist' | 'sourced';
  onActiveTabChange: (tab: 'results' | 'shortlist' | 'sourced') => void;
  isSidebarCollapsed?: boolean;
}

const getEduCategory = (degree: string): 'B' | 'M' | 'P' | null => {
  const d = degree.toLowerCase();
  if (d.includes('phd') || d.includes('ph.d') || d.includes('doctor') || d.includes('dphil')) return 'P';
  if (d.includes('master') || d.includes('ms') || d.includes('ma') || d.includes('mba') || d.includes('m.s') || d.includes('m.a')) return 'M';
  if (d.includes('bachelor') || d.includes('bs') || d.includes('ba') || d.includes('b.s') || d.includes('b.a') || d.includes('undergrad')) return 'B';
  return null;
};

export default function ChatArea({ 
  session, 
  onToggleShortlist, 
  onRejectCandidate, 
  onUpdateTitle, 
  onUpdateCandidate, 
  viewMode, 
  onViewModeChange,
  onLockShortlist,
  onSourceLookalikes,
  activeTab,
  onActiveTabChange,
  isSidebarCollapsed
}: ChatAreaProps) {
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState('');
  const [expandedEducationId, setExpandedEducationId] = useState<string | null>(null);
  const [activeEduFilters, setActiveEduFilters] = useState<Record<string, string[]>>({});
  const titleInputRef = useRef<HTMLInputElement>(null);
  const [feedbackModal, setFeedbackModal] = useState<{
    isOpen: boolean;
    candidate: Candidate | null;
    type: 'shortlist' | 'reject';
  }>({
    isOpen: false,
    candidate: null,
    type: 'shortlist'
  });
  const [socialModal, setSocialModal] = useState<{
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
      : session.sourcedCandidates || [];

  const getSocialIcons = (candidate: Candidate) => {
    const platforms = [
      { key: 'linkedin', icon: <Linkedin className="w-3.5 h-3.5" />, label: 'LinkedIn' },
      { key: 'github', icon: <Github className="w-3.5 h-3.5" />, label: 'GitHub' },
      { 
        key: 'x', 
        icon: (
          <svg viewBox="0 0 24 24" aria-hidden="true" className="w-3 h-3 fill-current">
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"></path>
          </svg>
        ), 
        label: 'X' 
      },
      { key: 'huggingface', icon: <span className="text-[10px] font-bold leading-none border rounded px-1 py-0.5 border-current">HF</span>, label: 'HuggingFace' },
      { key: 'arxiv', icon: <BookOpen className="w-3.5 h-3.5" />, label: 'Arxiv' },
      { key: 'scholar', icon: <GraduationCap className="w-3.5 h-3.5" />, label: 'Google Scholar' },
      { key: 'website', icon: <Link className="w-3.5 h-3.5" />, label: 'Personal Website' }
    ];

    return platforms.map(platform => {
      const link = candidate.socialLinks?.find(l => {
        const p = l.platform.toLowerCase();
        if (platform.key === 'x') return p.includes('twitter') || p.includes('x');
        if (platform.key === 'huggingface') return p.includes('huggingface') || p.includes('hugging face');
        if (platform.key === 'scholar') return p.includes('scholar') || p.includes('google scholar');
        if (platform.key === 'website') return p.includes('website') || p.includes('portfolio') || p.includes('blog') || p.includes('personal');
        return p.includes(platform.key);
      });

      const isMissing = !link;

      return (
        <a 
          key={platform.key} 
          href={link?.url || '#'} 
          target={link ? "_blank" : undefined}
          rel={link ? "noopener noreferrer" : undefined}
          onClick={!link ? (e) => e.preventDefault() : undefined}
          className={`relative transition-colors ${
            isMissing ? 'text-gray-200 cursor-default' : 'text-gray-400 hover:text-blue-600'
          }`}
          title={isMissing ? `No ${platform.label} profile found` : platform.label}
        >
          {platform.icon}
        </a>
      );
    });
  };

  const handleSocialSave = (links: { platform: string; url: string }[]) => {
    if (!socialModal.candidate) return;
    onUpdateCandidate(socialModal.candidate.id, { socialLinks: links });
  };

  const handleShortlistClick = (candidate: Candidate) => {
    const isShortlisted = session?.shortlistedIds?.includes(candidate.id);
    if (isShortlisted) {
      onToggleShortlist(candidate.id);
    } else {
      setFeedbackModal({ isOpen: true, candidate, type: 'shortlist' });
    }
  };

  const handleRejectClick = (candidate: Candidate) => {
    setFeedbackModal({ isOpen: true, candidate, type: 'reject' });
  };

  const handleFeedbackSubmit = (feedback: string) => {
    if (!feedbackModal.candidate) return;
    
    if (feedbackModal.type === 'shortlist') {
      onToggleShortlist(feedbackModal.candidate.id, feedback);
    } else {
      onRejectCandidate(feedbackModal.candidate.id, feedback);
    }
    
    setFeedbackModal({ ...feedbackModal, isOpen: false });
  };

  const handleFeedbackSkip = () => {
    if (!feedbackModal.candidate) return;
    
    if (feedbackModal.type === 'shortlist') {
      onToggleShortlist(feedbackModal.candidate.id);
    } else {
      onRejectCandidate(feedbackModal.candidate.id);
    }
    
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
        type={feedbackModal.type}
      />

      <SocialLinksModal
        isOpen={socialModal.isOpen}
        onClose={() => setSocialModal({ ...socialModal, isOpen: false })}
        onSave={handleSocialSave}
        initialLinks={socialModal.candidate?.socialLinks || []}
        candidateName={socialModal.candidate?.name || ''}
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
              <div className="flex justify-end">
                <div className="bg-blue-600 text-white px-4 py-2 rounded-2xl rounded-tr-none max-w-[80%] shadow-sm">
                  <p className="text-sm">{session.prompt}</p>
                </div>
              </div>

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

                {activeTab === 'results' && session.status === 'searching' && session.plan && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="bg-gray-50 border border-gray-200 rounded-xl p-5"
                  >
                    <div className="space-y-3">
                      <p className="text-sm text-gray-700 leading-relaxed">
                        <span className="font-bold">Plan:</span> {session.plan}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Sources:</span>
                        {session.sources.map(source => (
                          <span key={source} className="text-[10px] bg-white border border-gray-200 px-2 py-0.5 rounded text-gray-600 font-medium">
                            {source}
                          </span>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                )}
              </div>

              {/* Candidates View */}
              {viewMode === 'classic' ? (
                <div className="space-y-4">
                  {(activeTab === 'results' ? activeCandidates : shortlistedCandidates).map((candidate, idx) => {
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
                                    title="Edit social profiles"
                                  >
                                    <Pencil className="w-3 h-3" />
                                  </button>
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              <button 
                                onClick={() => handleShortlistClick(candidate)}
                                className={`p-2 rounded-lg transition-all border ${
                                  isShortlisted 
                                    ? 'bg-blue-600 border-blue-600 text-white shadow-md shadow-blue-100' 
                                    : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                                }`}
                                title={isShortlisted ? 'Remove from shortlist' : 'Add to shortlist'}
                              >
                                <Bookmark className={`w-4 h-4 ${isShortlisted ? 'fill-current' : ''}`} />
                              </button>
                              
                              {activeTab === 'results' && (
                                <button 
                                  onClick={() => handleRejectClick(candidate)}
                                  className="p-2 rounded-lg transition-all border bg-white border-gray-200 text-gray-400 hover:text-red-600 hover:bg-red-50 hover:border-red-100"
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

                          {/* Feedback display if exists */}
                          {session.feedbackMap?.[candidate.id] && (
                            <div className="bg-blue-50/50 border border-blue-100 rounded-lg p-3 flex gap-3">
                              <MessageSquareQuote className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                              <p className="text-xs text-blue-700 italic">"{session.feedbackMap[candidate.id]}"</p>
                            </div>
                          )}

                          {/* Sub-info */}
                          <div className="space-y-2">
                            {candidate.company && (
                              <div className="flex items-center gap-2 text-sm text-gray-500">
                                <div className="w-4 h-4 bg-gray-100 rounded flex items-center justify-center">
                                  <Building2 className="w-3 h-3 text-gray-400" />
                                </div>
                                <span className="font-medium">{candidate.company}</span>
                              </div>
                            )}
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

                            {(candidate.education || (candidate.educationHistory && candidate.educationHistory.length > 0)) && (
                              <div className="space-y-2">
                                <div className="flex items-center gap-3">
                                  <button 
                                    onClick={() => {
                                      setExpandedEducationId(expandedEducationId === candidate.id ? null : candidate.id);
                                      if (expandedEducationId !== candidate.id) {
                                        // Default to showing all if opening via main button
                                        setActiveEduFilters(prev => ({ ...prev, [candidate.id]: ['B', 'M', 'P'] }));
                                      }
                                    }}
                                    className="flex items-center gap-2 text-sm text-gray-500 hover:text-blue-600 transition-colors group"
                                  >
                                    <div className="w-4 h-4 bg-gray-100 rounded flex items-center justify-center group-hover:bg-blue-50">
                                      <GraduationCap className="w-3 h-3 text-gray-400 group-hover:text-blue-500" />
                                    </div>
                                    <span className="font-medium text-gray-500 group-hover:text-blue-600">Education</span>
                                    <ChevronDown className={`w-3 h-3 transition-transform ${expandedEducationId === candidate.id ? 'rotate-180' : ''}`} />
                                  </button>

                                  <div className="flex items-center gap-1.5">
                                    {['B', 'M', 'P'].map((cat) => {
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
                                </div>
                                
                                <AnimatePresence>
                                  {expandedEducationId === candidate.id && candidate.educationHistory && candidate.educationHistory.length > 0 && (
                                    <motion.div
                                      initial={{ height: 0, opacity: 0 }}
                                      animate={{ height: 'auto', opacity: 1 }}
                                      exit={{ height: 0, opacity: 0 }}
                                      className="overflow-hidden pl-6 space-y-2 border-l-2 border-gray-100 ml-2"
                                    >
                                      {candidate.educationHistory
                                        .filter(edu => {
                                          const filters = activeEduFilters[candidate.id] || ['B', 'M', 'P'];
                                          const cat = getEduCategory(edu.degree);
                                          return !cat || filters.includes(cat);
                                        })
                                        .map((edu, i) => (
                                          <div key={i} className="text-xs text-gray-500 py-1.5 flex flex-wrap gap-1 items-center">
                                            {edu.year && <span className="font-bold text-gray-700">{edu.year}</span>}
                                            {edu.year && <span className="text-gray-300">•</span>}
                                            <span className="font-bold text-gray-700">{edu.school}</span>
                                            <span className="text-gray-300">•</span>
                                            <span className="text-blue-600 font-medium">{edu.degree}</span>
                                            {edu.field && <span className="text-gray-300">•</span>}
                                            {edu.field && <span className="italic">{edu.field}</span>}
                                          </div>
                                        ))}
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
                        <th className="py-4 px-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Name</th>
                        <th className="py-4 px-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Title</th>
                        <th className="py-4 px-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Education</th>
                        <th className="py-4 px-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">Match</th>
                        <th className="py-4 px-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(activeTab === 'results' ? activeCandidates : shortlistedCandidates).map((candidate, idx) => {
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
                              <div className="flex flex-col">
                                <span className="text-sm font-bold text-gray-900">{candidate.name}</span>
                                <div className="flex items-center gap-2 mt-1">
                                  {getSocialIcons(candidate)}
                                  <button 
                                    onClick={() => setSocialModal({ isOpen: true, candidate })}
                                    className="p-1 text-gray-300 hover:text-blue-500 hover:bg-blue-50 rounded transition-all"
                                    title="Edit social profiles"
                                  >
                                    <Pencil className="w-3 h-3" />
                                  </button>
                                </div>
                              </div>
                            </td>
                            <td className="py-4 px-4">
                              <div className="flex flex-col">
                                <span className="text-xs text-gray-400 font-medium truncate max-w-[200px]">{candidate.company}</span>
                                <span className="text-sm text-gray-700 font-medium truncate max-w-[200px]">{candidate.title}</span>
                              </div>
                            </td>
                            <td className="py-4 px-4">
                              {(candidate.education || (candidate.educationHistory && candidate.educationHistory.length > 0)) && (
                                <div className="relative">
                                  <div className="flex items-center gap-1.5">
                                    <button 
                                      onClick={() => {
                                        setExpandedEducationId(expandedEducationId === candidate.id ? null : candidate.id);
                                        if (expandedEducationId !== candidate.id) {
                                          setActiveEduFilters(prev => ({ ...prev, [candidate.id]: ['B', 'M', 'P'] }));
                                        }
                                      }}
                                      className={`p-2 rounded-lg transition-all ${expandedEducationId === candidate.id ? 'bg-blue-50 text-blue-600' : 'text-gray-400 hover:bg-gray-50 hover:text-blue-600'}`}
                                      title="View Education"
                                    >
                                      <GraduationCap className="w-4 h-4" />
                                    </button>

                                    <div className="flex items-center gap-1">
                                      {['B', 'M', 'P'].map((cat) => {
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
                                          <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Education History</span>
                                          <button onClick={(e) => { e.stopPropagation(); setExpandedEducationId(null); }} className="p-1 hover:bg-gray-100 rounded">
                                            <X className="w-3 h-3 text-gray-400" />
                                          </button>
                                        </div>
                                        <div className="max-h-64 overflow-y-auto pr-1 space-y-3">
                                          {candidate.educationHistory && candidate.educationHistory.length > 0 ? (
                                            candidate.educationHistory
                                              .filter(edu => {
                                                const filters = activeEduFilters[candidate.id] || ['B', 'M', 'P'];
                                                const cat = getEduCategory(edu.degree);
                                                return !cat || filters.includes(cat);
                                              })
                                              .map((edu, i) => (
                                                <div key={i} className="text-xs text-gray-600 border-b border-gray-50 last:border-0 pb-3 last:pb-0">
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
                                              ))
                                          ) : (
                                            <p className="text-xs text-gray-400 italic py-2">No detailed history available.</p>
                                          )}
                                        </div>
                                      </motion.div>
                                    )}
                                  </AnimatePresence>
                                </div>
                              )}
                            </td>
                            <td className="py-4 px-4">
                              <div className="flex justify-center">
                                <div className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded text-xs font-bold">
                                  {candidate.score}%
                                </div>
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
                                  title={isShortlisted ? "Remove from shortlist" : "Add to shortlist"}
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
                      <p className="text-sm text-amber-700 leading-relaxed">
                        To source candidates, you first need to refine your search and **lock in at least 10 candidates** in your shortlist.
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
                <div className="flex items-center gap-2 text-red-600 bg-red-50 p-4 rounded-xl border border-red-100">
                  <AlertCircle className="w-5 h-5" />
                  <p className="text-sm font-medium">Something went wrong with the search. Please try again.</p>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
