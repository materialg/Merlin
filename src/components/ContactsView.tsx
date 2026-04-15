import React, { useState } from 'react';
import { Search, Filter, RotateCcw, Linkedin, Github, Mail, Globe, MapPin, GraduationCap, Building2, Trash2, Plus, X, Check, Users, Briefcase, Pencil, Sparkles } from 'lucide-react';
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
  onAddContactFromFile: (file: File) => void;
  onAddContactFromUrl: (url: string) => void;
  isAddingContact?: boolean;
}

export default function ContactsView({ 
  contacts, 
  projects, 
  onUpdateContact, 
  onDeleteContact,
  onAddContactFromFile,
  onAddContactFromUrl,
  isAddingContact = false
}: ContactsViewProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [editingTagsId, setEditingTagsId] = useState<string | null>(null);
  const [editingProjectsId, setEditingProjectsId] = useState<string | null>(null);
  const [newTag, setNewTag] = useState('');
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [contactUrl, setContactUrl] = useState('');
  const fileInputRef = React.useRef<HTMLInputElement>(null);
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

  const handleSocialSave = (links: { platform: string; url: string }[]) => {
    if (!socialModal.contact) return;
    
    // Extract email if it exists in the links
    const emailLink = links.find(l => l.platform.toLowerCase() === 'email');
    const otherLinks = links.filter(l => l.platform.toLowerCase() !== 'email');
    
    onUpdateContact(socialModal.contact.id, { 
      socialLinks: otherLinks,
      email: emailLink ? emailLink.url.replace('mailto:', '') : null,
      // Update main url if a LinkedIn or primary link is found
      url: otherLinks.find(l => l.platform === 'LinkedIn')?.url || 
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
              <th className="py-3 px-4 text-[11px] font-black text-gray-400 uppercase tracking-wider w-10"></th>
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
                    <span className="text-sm font-bold text-gray-900">{contact.name}</span>
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
                  <div className="flex items-center gap-2">
                    <GraduationCap className="w-4 h-4 text-gray-400" />
                    <div className="flex items-center gap-1">
                      {['B', 'M', 'P'].map((cat) => {
                        const hasDegree = contact.educationHistory?.some(edu => getEduCategory(edu.degree) === cat);
                        
                        let badgeStyles = "";
                        if (hasDegree) {
                          badgeStyles = 'bg-blue-50 text-blue-600 border-blue-100';
                        } else {
                          badgeStyles = 'bg-gray-50 text-gray-300 border-gray-100 opacity-50';
                        }

                        return (
                          <div
                            key={cat}
                            className={`w-5 h-5 rounded-full border text-[8px] font-black flex items-center justify-center transition-all shadow-sm ${badgeStyles}`}
                            title={hasDegree ? `${cat === 'B' ? "Bachelor's" : cat === 'M' ? "Master's" : "PhD"} Degree` : "No data available"}
                          >
                            {cat}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </td>
                <td className="py-4 px-4">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-gray-400" />
                    <span className="text-sm text-gray-600">{(contact.location || 'Unknown').replace(/,?\s*USA$/i, '')}</span>
                  </div>
                </td>
                <td className="py-4 px-4 text-right">
                  <button 
                    onClick={() => onDeleteContact(contact.id)}
                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
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
