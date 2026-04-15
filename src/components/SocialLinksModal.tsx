import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Plus, Trash2, Globe, Github, Linkedin, BookOpen } from 'lucide-react';

interface SocialLinksModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (links: { platform: string; url: string }[]) => void;
  initialLinks: { platform: string; url: string }[];
  candidateName: string;
}

const PLATFORMS = ['LinkedIn', 'GitHub', 'X', 'HuggingFace', 'Arxiv', 'Google Scholar', 'Personal Website', 'Email'];

const detectPlatform = (url: string): string => {
  const u = url.toLowerCase();
  if (u.includes('@') || u.startsWith('mailto:')) return 'Email';
  if (u.includes('linkedin.com')) return 'LinkedIn';
  if (u.includes('github.com')) return 'GitHub';
  if (u.includes('twitter.com') || u.includes('x.com')) return 'X';
  if (u.includes('huggingface.co')) return 'HuggingFace';
  if (u.includes('arxiv.org')) return 'Arxiv';
  if (u.includes('scholar.google.com')) return 'Google Scholar';
  return 'Personal Website';
};

const normalizePlatform = (platform: string, url: string): string => {
  const p = platform.toLowerCase();
  if (p === 'email' || url.includes('@') || url.startsWith('mailto:')) return 'Email';
  if (p.includes('linkedin')) return 'LinkedIn';
  if (p.includes('github')) return 'GitHub';
  if (p.includes('twitter') || p === 'x') return 'X';
  if (p.includes('huggingface')) return 'HuggingFace';
  if (p.includes('arxiv')) return 'Arxiv';
  if (p.includes('scholar') || p.includes('google scholar')) return 'Google Scholar';
  if (p.includes('website') || p.includes('portfolio') || p.includes('blog') || p.includes('personal')) return 'Personal Website';
  
  // Fallback to detection if platform name is generic
  return detectPlatform(url);
};

export default function SocialLinksModal({ isOpen, onClose, onSave, initialLinks, candidateName }: SocialLinksModalProps) {
  const [links, setLinks] = useState<{ platform: string; url: string }[]>([]);

  useEffect(() => {
    if (isOpen) {
      const normalized = initialLinks.map(l => ({
        platform: normalizePlatform(l.platform, l.url),
        url: l.url
      }));
      setLinks(normalized.length > 0 ? normalized : [{ platform: 'LinkedIn', url: '' }]);
    }
    // Only run when the modal opens to prevent resetting user edits on parent re-renders
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const handleAddLink = () => {
    setLinks([...links, { platform: 'LinkedIn', url: '' }]);
  };

  const handleRemoveLink = (index: number) => {
    setLinks(links.filter((_, i) => i !== index));
  };

  const handleUpdateLink = (index: number, field: 'platform' | 'url', value: string) => {
    const newLinks = [...links];
    newLinks[index][field] = value;
    
    // Auto-detect platform if URL is being updated and platform is currently default or generic
    if (field === 'url' && value.trim() !== '') {
      const detected = detectPlatform(value);
      if (detected !== 'Personal Website') {
        newLinks[index].platform = detected;
      }
    }
    
    setLinks(newLinks);
  };

  const handleSave = () => {
    const validLinks = links.filter(l => l.url.trim() !== '');
    onSave(validLinks);
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden"
          >
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
              <div>
                <h3 className="text-lg font-bold text-gray-900">Edit Profiles</h3>
                <p className="text-xs text-gray-500 mt-0.5">Updating links for {candidateName}</p>
              </div>
              <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="p-6 max-h-[60vh] overflow-y-auto space-y-4">
              {links.map((link, index) => (
                <div key={index} className="flex gap-3 items-start group">
                  <div className="flex-1 space-y-2">
                    <div className="grid grid-cols-12 gap-3">
                      <select
                        value={link.platform}
                        onChange={(e) => handleUpdateLink(index, 'platform', e.target.value)}
                        className="col-span-5 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 text-sm font-medium text-gray-700 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                      >
                        {PLATFORMS.map(p => (
                          <option key={p} value={p}>{p}</option>
                        ))}
                      </select>
                      <input
                        type="url"
                        value={link.url}
                        onChange={(e) => handleUpdateLink(index, 'url', e.target.value)}
                        placeholder="https://..."
                        className="col-span-7 bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                      />
                    </div>
                  </div>
                  <button
                    onClick={() => handleRemoveLink(index)}
                    className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}

              <button
                onClick={handleAddLink}
                className="w-full py-3 border-2 border-dashed border-gray-200 rounded-xl text-gray-400 hover:text-blue-600 hover:border-blue-200 hover:bg-blue-50 transition-all flex items-center justify-center gap-2 text-sm font-medium"
              >
                <Plus className="w-4 h-4" />
                Add Another Profile
              </button>
            </div>

            <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-3">
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm font-bold text-gray-600 hover:text-gray-900 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="px-6 py-2 bg-blue-600 text-white text-sm font-bold rounded-xl shadow-lg shadow-blue-200 hover:bg-blue-700 transition-all"
              >
                Save Changes
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
