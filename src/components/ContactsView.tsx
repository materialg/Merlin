import React, { useState } from 'react';
import { Search, Filter, RotateCcw, Linkedin, Github, Mail, Globe, MapPin, GraduationCap, Building2, Trash2, Plus, X, Check, Users, Briefcase, Pencil, Sparkles, RefreshCw, Star, ChevronDown } from 'lucide-react';
import { Contact, Project } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { getEduCategory } from '../lib/utils';
import { getSocialIcons } from './SocialIcons';
import SocialLinksModal from './SocialLinksModal';

interface ContactsViewProps {
  contacts: Contact[];
  projects: Project[];
  onUpdateContact: (id: string, updates: Partial<Contact>) => void;
  onDeleteContact: (id: string) => void;
  onBulkDelete?: (ids: string[]) => void;
  onAddContactFromFile: (file: File) => void;
  onAddContactFromUrl: (url: string) => void;
  onRefreshContact: (id: string) => void;
  onBulkRefresh?: (ids: string[]) => void;
  isAddingContact?: boolean;
  refreshingIds?: string[];
}

export default function ContactsView({ 
  contacts, 
  projects, 
  onUpdateContact, 
  onDeleteContact,
  onBulkDelete,
  onAddContactFromFile,
  onAddContactFromUrl,
  onRefreshContact,
  onBulkRefresh,
  isAddingContact = false,
  refreshingIds = []
}: ContactsViewProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [editingTagsId, setEditingTagsId] = useState<string | null>(null);
  const [editingProjectsId, setEditingProjectsId] = useState<string | null>(null);
  const [newTag, setNewTag] = useState('');
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [contactUrl, setContactUrl] = useState('');
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [expandedEducationId, setExpandedEducationId] = useState<string | null>(null);
  const [activeEduFilters, setActiveEduFilters] = useState<Record<string, string[]>>({});
  const [socialModal, setSocialModal] = useState<{
    isOpen: boolean;
    contact: Contact | null;
  }>({
    isOpen: false,
    contact: null
  });

  const filteredContacts = contacts.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.company?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSocialSave = (links: { platform: string; url: string }[], anchorUrl?: string) => {
    if (!socialModal.contact) return;
    
    // Extract email if it exists in the links
    const emailLink = links.find(l => l.platform.toLowerCase() === 'email');
    const otherLinks = links.filter(l => l.platform.toLowerCase() !== 'email');
    
    onUpdateContact(socialModal.contact.id, { 
      socialLinks: otherLinks,
      email: emailLink ? emailLink.url.replace('mailto:', '') : null,
      anchorProfileUrl: anchorUrl,
      // Update main url if a LinkedIn or primary link is found
      url: anchorUrl || 
           otherLinks.find(l => l.platform === 'LinkedIn')?.url || 
           otherLinks.find(l => l.platform === 'GitHub')?.url || 
           otherLinks[0]?.url || 
           socialModal.contact.url
    });
    setSocialModal({ isOpen: false, contact: null });
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredContacts.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredContacts.map(c => c.id));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleAddTag = (contactId: string) => {
    if (!newTag.trim()) return;
    const contact = contacts.find(c => c.id === contactId);
    if (!contact) return;
    
    const tags = [...(contact.tags || []), newTag.trim()];
    onUpdateContact(contactId, { tags });
    setNewTag('');
  };

  const handleRemoveTag = (contactId: string, tagToRemove: string) => {
    const contact = contacts.find(c => c.id === contactId);
    if (!contact) return;
    
    const tags = (contact.tags || []).filter(t => t !== tagToRemove);
    onUpdateContact(contactId, { tags });
  };

  const handleToggleProject = (contactId: string, projectName: string) => {
    const contact = contacts.find(c => c.id === contactId);
    if (!contact) return;
    
    const currentProjects = contact.projects || [];
    const projects = currentProjects.includes(projectName)
      ? currentProjects.filter(p => p !== projectName)
      : [...currentProjects, projectName];
    
    onUpdateContact(contactId, { projects });
  };

  const toggleEduFilter = (contactId: string, category: string) => {
    setActiveEduFilters(prev => {
      const current = prev[contactId] || ['B', 'M', 'P'];
      const next = current.includes(category)
        ? current.filter(c => c !== category)
        : [...current, category];
      return { ...prev, [contactId]: next };
    });
    if (expandedEducationId !== contactId) {
      setExpandedEducationId(contactId);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-white overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-white sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold text-gray-900">All Contacts ({contacts.length})</h1>
          <button className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all">
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setIsUploadModalOpen(true)}
            disabled={isAddingContact}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 transition-all shadow-sm active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isAddingContact ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Plus className="w-4 h-4" />
            )}
            {isAddingContact ? 'Adding...' : 'Add Contact'}
          </button>
        </div>
      </div>

      {/* Upload Modal */}
      <AnimatePresence>
        {isUploadModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
            >
              <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                <h3 className="font-bold text-gray-900">Add New Contact</h3>
                <button onClick={() => setIsUploadModalOpen(false)} className="p-1 hover:bg-gray-100 rounded-lg transition-colors">
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>
              
              <div className="p-8 space-y-6">
                <div className="space-y-3">
                  <label className="text-xs font-black text-gray-400 uppercase tracking-wider">Paste Profile URL</label>
                  <div className="flex gap-2">
                    <input 
                      type="text"
                      placeholder="LinkedIn, X, or GitHub URL..."
                      value={contactUrl}
                      onChange={(e) => setContactUrl(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && contactUrl) {
                          onAddContactFromUrl(contactUrl);
                          setContactUrl('');
                          setIsUploadModalOpen(false);
                        }
                      }}
                      className="flex-1 px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                    />
                    <button 
                      onClick={() => {
                        if (contactUrl) {
                          onAddContactFromUrl(contactUrl);
                          setContactUrl('');
                          setIsUploadModalOpen(false);
                        }
                      }}
                      disabled={!contactUrl || isAddingContact}
                      className="px-4 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Add
                    </button>
                  </div>
                </div>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-100"></div>
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-white px-2 text-gray-400 font-bold">Or upload file</span>
                  </div>
                </div>

                <div 
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.currentTarget.classList.add('border-blue-500', 'bg-blue-50');
                  }}
                  onDragLeave={(e) => {
                    e.preventDefault();
                    e.currentTarget.classList.remove('border-blue-500', 'bg-blue-50');
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.currentTarget.classList.remove('border-blue-500', 'bg-blue-50');
                    const file = e.dataTransfer.files?.[0];
                    if (file) {
                      onAddContactFromFile(file);
                      setIsUploadModalOpen(false);
                    }
                  }}
                  onPaste={(e) => {
                    const file = e.clipboardData.files?.[0];
                    if (file) {
                      onAddContactFromFile(file);
                      setIsUploadModalOpen(false);
                    }
                  }}
                  tabIndex={0}
                  className="border-2 border-dashed border-gray-200 rounded-2xl p-10 flex flex-col items-center justify-center gap-4 hover:border-blue-400 hover:bg-blue-50/50 transition-all cursor-pointer group outline-none focus:ring-2 focus:ring-blue-500/20"
                >
                  <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                    {isAddingContact ? (
                      <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Linkedin className="w-8 h-8 text-blue-600" />
                    )}
                  </div>
                  <div className="text-center">
                    <p className="font-bold text-gray-900">Upload LinkedIn Profile</p>
                    <p className="text-sm text-gray-500 mt-1">PDF or Resume file</p>
                  </div>
                  <input 
                    type="file" 
                    ref={fileInputRef}
                    className="hidden" 
                    accept=".pdf,.doc,.docx"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        onAddContactFromFile(file);
                        setIsUploadModalOpen(false);
                      }
                    }}
                  />
                </div>
                
                <div className="mt-6 flex items-start gap-3 p-4 bg-blue-50 rounded-xl border border-blue-100">
                  <Sparkles className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                  <p className="text-xs text-blue-700 leading-relaxed">
                    Merlin will automatically parse the profile and extract key details like name, title, company, and education.
                  </p>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Toolbar */}
      <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-4 bg-gray-50/30">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input 
            type="text"
            placeholder="Search by name, company, etc."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
          />
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-all shadow-sm">
          <Filter className="w-4 h-4 text-gray-400" />
          Add Filter
        </button>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full border-collapse text-left min-w-[1200px]">
          <thead className="sticky top-0 bg-gray-50/80 backdrop-blur-sm z-10 border-b border-gray-100">
            <tr>
              <th className="py-3 px-4 w-10">
                <input 
                  type="checkbox" 
                  checked={selectedIds.length === filteredContacts.length && filteredContacts.length > 0}
                  onChange={toggleSelectAll}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
              </th>
              <th className="py-3 px-4 text-[11px] font-black text-gray-400 uppercase tracking-wider">Candidate</th>
              <th className="py-3 px-4 text-[11px] font-black text-gray-400 uppercase tracking-wider">Projects</th>
              <th className="py-3 px-4 text-[11px] font-black text-gray-400 uppercase tracking-wider">Tags</th>
              <th className="py-3 px-4 text-[11px] font-black text-gray-400 uppercase tracking-wider">Organization</th>
              <th className="py-3 px-4 text-[11px] font-black text-gray-400 uppercase tracking-wider">Current Role</th>
              <th className="py-3 px-4 text-[11px] font-black text-gray-400 uppercase tracking-wider">Education</th>
              <th className="py-3 px-4 text-[11px] font-black text-gray-400 uppercase tracking-wider">Location</th>
              <th className="py-3 px-4 text-[11px] font-black text-gray-400 uppercase tracking-wider text-right">
                {selectedIds.length > 0 && (
                  <div className="flex items-center justify-end gap-1">
                    <button 
                      onClick={() => onBulkRefresh?.(selectedIds)}
                      className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                      title={`Refresh ${selectedIds.length} selected profiles`}
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                    </button>
                    <button 
                      onClick={() => {
                        if (window.confirm(`Are you sure you want to delete ${selectedIds.length} contacts?`)) {
                          onBulkDelete?.(selectedIds);
                          setSelectedIds([]);
                        }
                      }}
                      className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-all"
                      title={`Delete ${selectedIds.length} selected contacts`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {filteredContacts.map(contact => (
              <motion.tr 
                key={contact.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className={`hover:bg-blue-50/30 transition-colors group ${selectedIds.includes(contact.id) ? 'bg-blue-50/50' : ''}`}
              >
                <td className="py-4 px-4">
                  <input 
                    type="checkbox" 
                    checked={selectedIds.includes(contact.id)}
                    onChange={() => toggleSelect(contact.id)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                </td>
                <td className="py-4 px-4">
                  <div className="flex flex-col">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-bold text-gray-900">{contact.name}</span>
                    </div>
                    <div className="mt-1">
                      {getSocialIcons(contact, () => setSocialModal({ isOpen: true, contact }))}
                    </div>
                  </div>
                </td>
                <td className="py-4 px-4">
                  <div className="flex flex-wrap gap-1 max-w-[200px] relative">
                    {contact.projects?.map((p, i) => (
                      <span key={i} className="group/proj flex items-center gap-1 px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-[10px] font-medium">
                        {p}
                        <button onClick={() => handleToggleProject(contact.id, p)} className="opacity-0 group-hover/proj:opacity-100 hover:text-red-600 transition-all">
                          <X className="w-2.5 h-2.5" />
                        </button>
                      </span>
                    ))}
                    <div className="relative">
                      <button 
                        onClick={() => setEditingProjectsId(editingProjectsId === contact.id ? null : contact.id)}
                        className="px-2 py-0.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded text-[10px] font-medium transition-all flex items-center gap-1"
                      >
                        <Plus className="w-2.5 h-2.5" />
                        {contact.projects?.length ? 'Add' : 'No projects'}
                      </button>
                      
                      {editingProjectsId === contact.id && (
                        <div className="absolute top-full left-0 mt-1 w-48 bg-white border border-gray-100 rounded-xl shadow-xl z-50 p-2 max-h-48 overflow-auto">
                          <div className="text-[10px] font-black text-gray-400 uppercase tracking-wider px-2 py-1 mb-1">Select Project</div>
                          {projects.length === 0 ? (
                            <div className="px-2 py-3 text-[10px] text-gray-400 italic text-center">No projects created yet</div>
                          ) : (
                            projects.map(project => (
                              <button
                                key={project.id}
                                onClick={() => {
                                  handleToggleProject(contact.id, project.name);
                                  setEditingProjectsId(null);
                                }}
                                className={`w-full text-left px-2 py-1.5 rounded-lg text-[11px] font-medium transition-all flex items-center justify-between ${
                                  contact.projects?.includes(project.name) ? 'bg-blue-50 text-blue-700' : 'hover:bg-gray-50 text-gray-600'
                                }`}
                              >
                                {project.name}
                                {contact.projects?.includes(project.name) && <Check className="w-3 h-3" />}
                              </button>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </td>
                <td className="py-4 px-4">
                  <div className="flex flex-wrap gap-1 max-w-[200px]">
                    {contact.tags?.map((tag, i) => (
                      <span key={i} className="group/tag flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-600 rounded text-[10px] font-bold">
                        {tag}
                        <button onClick={() => handleRemoveTag(contact.id, tag)} className="opacity-0 group-hover/tag:opacity-100 hover:text-red-600 transition-all">
                          <X className="w-2.5 h-2.5" />
                        </button>
                      </span>
                    ))}
                    {editingTagsId === contact.id ? (
                      <div className="flex items-center gap-1">
                        <input 
                          autoFocus
                          type="text"
                          value={newTag}
                          onChange={(e) => setNewTag(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleAddTag(contact.id)}
                          onBlur={() => {
                            if (!newTag) setEditingTagsId(null);
                          }}
                          className="w-20 px-1.5 py-0.5 text-[10px] border border-blue-200 rounded outline-none focus:ring-1 focus:ring-blue-500"
                          placeholder="Tag name..."
                        />
                        <button onClick={() => handleAddTag(contact.id)} className="p-0.5 text-blue-600 hover:bg-blue-50 rounded">
                          <Check className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <button 
                        onClick={() => setEditingTagsId(contact.id)}
                        className="px-2 py-0.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded text-[10px] font-medium transition-all flex items-center gap-1"
                      >
                        <Plus className="w-2.5 h-2.5" />
                        Add Tags
                      </button>
                    )}
                  </div>
                </td>
                <td className="py-4 px-4">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 bg-gray-100 rounded flex items-center justify-center">
                      <Building2 className="w-3.5 h-3.5 text-gray-400" />
                    </div>
                    <span className="text-sm text-gray-600">{contact.company || 'Unknown'}</span>
                  </div>
                </td>
                <td className="py-4 px-4 text-sm text-gray-600">{contact.title}</td>
                <td className="py-4 px-4">
                  {(contact.education || (contact.educationHistory && contact.educationHistory.length > 0)) && (
                    <div className="relative">
                      <div className="flex items-center gap-1.5">
                        <button 
                          onClick={() => {
                            setExpandedEducationId(expandedEducationId === contact.id ? null : contact.id);
                            if (expandedEducationId !== contact.id) {
                              setActiveEduFilters(prev => ({ ...prev, [contact.id]: ['P', 'M', 'B'] }));
                            }
                          }}
                          className={`p-2 rounded-lg transition-all ${expandedEducationId === contact.id ? 'bg-blue-50 text-blue-600' : 'text-gray-400 hover:bg-gray-50 hover:text-blue-600'}`}
                          title="View Education"
                        >
                          <GraduationCap className="w-4 h-4" />
                        </button>

                        <div className="flex items-center gap-1">
                          {['P', 'M', 'B'].map((cat) => {
                            const hasDegree = contact.educationHistory?.some(edu => getEduCategory(edu.degree) === cat);
                            const isActive = activeEduFilters[contact.id]?.includes(cat);
                            
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
                                onClick={() => hasDegree && toggleEduFilter(contact.id, cat)}
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
                        {expandedEducationId === contact.id && (
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
                              {contact.educationHistory && contact.educationHistory.length > 0 ? (
                                ['P', 'M', 'B']
                                  .filter(cat => {
                                    const filters = activeEduFilters[contact.id] || ['P', 'M', 'B'];
                                    return filters.includes(cat);
                                  })
                                  .map(cat => {
                                    const edus = contact.educationHistory?.filter(edu => getEduCategory(edu.degree) === cat);
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
                  )}
                </td>
                <td className="py-4 px-4">
                  <div className="flex items-center justify-between group/loc">
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-gray-400" />
                      <span className="text-sm text-gray-600">{(contact.location || 'Unknown').replace(/,?\s*USA$/i, '')}</span>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover/loc:opacity-100 transition-all">
                      <button 
                        onClick={(e) => { e.stopPropagation(); onRefreshContact(contact.id); }}
                        disabled={refreshingIds.includes(contact.id)}
                        className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all disabled:opacity-50"
                        title="Refresh profile data"
                      >
                        <RotateCcw className={`w-3.5 h-3.5 ${refreshingIds.includes(contact.id) ? 'animate-spin' : ''}`} />
                      </button>
                      <button 
                        onClick={(e) => { e.stopPropagation(); onDeleteContact(contact.id); }}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                        title="Delete contact"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </td>
                <td className="py-4 px-4 text-right">
                  {/* Empty or other actions */}
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
        {filteredContacts.length === 0 && (
          <div className="py-20 text-center">
            <Users className="w-12 h-12 text-gray-200 mx-auto mb-4" />
            <p className="text-gray-400 text-sm italic">No contacts found</p>
          </div>
        )}
      </div>

      <SocialLinksModal 
        isOpen={socialModal.isOpen}
        onClose={() => setSocialModal({ isOpen: false, contact: null })}
        onSave={handleSocialSave}
        initialAnchorUrl={socialModal.contact?.anchorProfileUrl}
        initialLinks={[
          ...(socialModal.contact?.socialLinks || []),
          ...(socialModal.contact?.email ? [{ platform: 'Email', url: socialModal.contact.email }] : []),
          // Include main url if not already in socialLinks
          ...(socialModal.contact?.url && !socialModal.contact.socialLinks?.some(l => l.url === socialModal.contact?.url) 
            ? [{ platform: 'Website', url: socialModal.contact.url }] 
            : [])
        ]}
        candidateName={socialModal.contact?.name || ''}
      />
    </div>
  );
}
