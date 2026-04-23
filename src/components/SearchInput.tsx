import { Paperclip, Link as LinkIcon, ArrowRight, X, PlusCircle, FileText } from 'lucide-react';
import React, { useState, useRef, useEffect } from 'react';

interface SearchInputProps {
  onSearch: (prompt: string, attachments: File[], urls: string[]) => void;
  isLoading: boolean;
}

export default function SearchInput({ onSearch, isLoading }: SearchInputProps) {
  const [input, setInput] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [urls, setUrls] = useState<string[]>([]);
  const [showPlusMenu, setShowPlusMenu] = useState(false);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const totalAttachments = files.length + urls.length;
  const MAX_ATTACHMENTS = 6;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowPlusMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if ((input.trim() || files.length > 0 || urls.length > 0) && !isLoading) {
      onSearch(input, files, urls);
      setInput('');
      setFiles([]);
      setUrls([]);
      setShowPlusMenu(false);
      setShowUrlInput(false);
    }
  };

  const handleAddUrl = () => {
    if (urlInput.trim()) {
      if (totalAttachments >= MAX_ATTACHMENTS) {
        alert(`You can only add up to ${MAX_ATTACHMENTS} attachments.`);
        return;
      }
      setUrls(prev => [...prev, urlInput.trim()]);
      setUrlInput('');
      setShowUrlInput(false);
      setShowPlusMenu(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      if (totalAttachments + newFiles.length > MAX_ATTACHMENTS) {
        alert(`You can only add up to ${MAX_ATTACHMENTS} attachments.`);
        return;
      }
      setFiles(prev => [...prev, ...newFiles]);
      setShowPlusMenu(false);
    }
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const removeUrl = (index: number) => {
    setUrls(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="p-8 bg-white w-full">
      <div className="max-w-7xl mx-auto">
        <form onSubmit={handleSubmit} className="relative">
          <div className="bg-[#FBFBF9] border border-gray-200 rounded-[28px] p-6 shadow-sm transition-all focus-within:border-gray-300 focus-within:shadow-md">
            {/* Attachment chips */}
            {(files.length > 0 || urls.length > 0) && (
              <div className="flex flex-wrap gap-2 mb-4">
                {files.map((file, i) => (
                  <div key={`file-${i}`} className="flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-200 rounded-full text-xs font-medium text-gray-600 shadow-sm">
                    <Paperclip className="w-3 h-3 text-gray-400" />
                    <span className="truncate max-w-[150px]">{file.name}</span>
                    <button type="button" onClick={() => removeFile(i)} className="hover:text-red-500">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
                {urls.map((url, i) => (
                  <div key={`url-${i}`} className="flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-200 rounded-full text-xs font-medium text-gray-600 shadow-sm">
                    <LinkIcon className="w-3 h-3 text-gray-400" />
                    <span className="truncate max-w-[150px]">{url.replace(/^https?:\/\//, '').split('/')[0]}</span>
                    <button type="button" onClick={() => removeUrl(i)} className="hover:text-red-500">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Describe the role, paste a JD, or drop in a URL..."
              className="w-full bg-transparent border-none focus:ring-0 text-lg font-normal text-gray-800 resize-none min-h-[80px] placeholder-gray-400 outline-none"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit(e);
                }
              }}
            />
            
            <div className="flex items-center justify-between mt-4">
              <div className="flex items-center gap-3">
                <div className="relative" ref={menuRef}>
                  <button
                    type="button"
                    disabled={totalAttachments >= MAX_ATTACHMENTS}
                    onClick={() => setShowPlusMenu(!showPlusMenu)}
                    className="flex items-center justify-center w-10 h-10 bg-white border border-gray-200 rounded-full text-gray-400 hover:text-gray-600 hover:border-gray-300 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                  >
                    <PlusCircle className="w-6 h-6" />
                  </button>
                  
                  {showPlusMenu && (
                    <div className="absolute bottom-full left-0 mb-3 w-48 bg-white border border-gray-200 rounded-2xl shadow-xl py-2 z-50 overflow-hidden">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                      >
                        <FileText className="w-4 h-4 text-gray-400" />
                        Attach PDF
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowUrlInput(true);
                          setShowPlusMenu(false);
                        }}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                      >
                        <LinkIcon className="w-4 h-4 text-gray-400" />
                        Add URL
                      </button>
                    </div>
                  )}
                </div>

                {showUrlInput && (
                  <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
                    <div className="bg-white border border-gray-200 rounded-2xl shadow-2xl p-6 w-full max-w-md animate-in fade-in zoom-in duration-200">
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="text-sm font-bold text-gray-900 uppercase tracking-widest">Add Job URL</h4>
                        <button onClick={() => setShowUrlInput(false)} className="text-gray-400 hover:text-gray-600">
                          <X className="w-5 h-5" />
                        </button>
                      </div>
                      <input
                        autoFocus
                        type="url"
                        value={urlInput}
                        onChange={(e) => setUrlInput(e.target.value)}
                        placeholder="Paste a URL (e.g. Job Description)"
                        className="w-full text-sm p-4 border border-gray-100 bg-gray-50 rounded-xl mb-4 focus:border-blue-400 focus:ring-2 focus:ring-blue-50 outline-none transition-all"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddUrl();
                          }
                        }}
                      />
                      <div className="flex gap-3">
                        <button
                          type="button"
                          onClick={() => setShowUrlInput(false)}
                          className="flex-1 py-3 bg-gray-100 text-gray-600 rounded-xl text-sm font-bold hover:bg-gray-200 transition-all"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={handleAddUrl}
                          className="flex-1 py-3 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 shadow-lg shadow-blue-100 transition-all"
                        >
                          Add URL
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {totalAttachments > 0 && (
                  <span className="text-xs font-medium text-gray-400">
                    {totalAttachments}/{MAX_ATTACHMENTS}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="submit"
                  disabled={isLoading || files.length === 0}
                  className="flex items-center justify-center w-10 h-10 bg-[#5850EC] text-white rounded-full hover:bg-[#4F46E5] disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md shadow-indigo-100"
                >
                  {isLoading ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <ArrowRight className="w-5 h-5" />
                  )}
                </button>
              </div>
            </div>
          </div>
          
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileChange} 
            className="hidden" 
            multiple 
            accept=".pdf"
          />
        </form>

        <div className="mt-4 text-center">
          <p className="text-[12px] font-medium text-gray-400 tracking-tight">
            Attach a JD (PDF) to start · Shift+Enter for new line
          </p>
        </div>
      </div>
    </div>
  );
}


