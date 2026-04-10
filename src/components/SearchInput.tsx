import { Paperclip, Link as LinkIcon, ArrowRight, X } from 'lucide-react';
import React, { useState, useRef } from 'react';

interface SearchInputProps {
  onSearch: (prompt: string, attachments: File[], urls: string[]) => void;
  isLoading: boolean;
}

export default function SearchInput({ onSearch, isLoading }: SearchInputProps) {
  const [input, setInput] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [urls, setUrls] = useState<string[]>([]);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const totalAttachments = files.length + urls.length;
  const MAX_ATTACHMENTS = 6;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if ((input.trim() || files.length > 0 || urls.length > 0) && !isLoading) {
      onSearch(input, files, urls);
      setInput('');
      setFiles([]);
      setUrls([]);
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
    }
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const removeUrl = (index: number) => {
    setUrls(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="p-8 bg-white">
      <div className="max-w-5xl mx-auto">
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
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={totalAttachments >= MAX_ATTACHMENTS}
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                >
                  <Paperclip className="w-4 h-4 text-gray-400" />
                  Attach
                </button>
                
                <div className="relative">
                  <button
                    type="button"
                    disabled={totalAttachments >= MAX_ATTACHMENTS}
                    onClick={() => setShowUrlInput(!showUrlInput)}
                    className={`flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm ${showUrlInput ? 'ring-2 ring-blue-100 border-blue-300' : ''}`}
                  >
                    <LinkIcon className="w-4 h-4 text-gray-400" />
                    URL
                  </button>
                  
                  {showUrlInput && (
                    <div className="absolute bottom-full left-0 mb-3 w-80 bg-white border border-gray-200 rounded-2xl shadow-xl p-4 z-50">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Add URL</h4>
                        <button onClick={() => setShowUrlInput(false)} className="text-gray-400 hover:text-gray-600">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                      <input
                        autoFocus
                        type="url"
                        value={urlInput}
                        onChange={(e) => setUrlInput(e.target.value)}
                        placeholder="Paste a URL (e.g. Job Description)"
                        className="w-full text-sm p-3 border border-gray-100 bg-gray-50 rounded-xl mb-3 focus:border-blue-400 focus:ring-2 focus:ring-blue-50 outline-none transition-all"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddUrl();
                          }
                        }}
                      />
                      <button
                        type="button"
                        onClick={handleAddUrl}
                        className="w-full py-2.5 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 shadow-lg shadow-blue-100 transition-all"
                      >
                        Add URL
                      </button>
                    </div>
                  )}
                </div>

                {totalAttachments > 0 && (
                  <span className="text-xs font-medium text-gray-400 ml-2">
                    {totalAttachments}/{MAX_ATTACHMENTS}
                  </span>
                )}
              </div>

              <button
                type="submit"
                disabled={isLoading || (!input.trim() && files.length === 0 && urls.length === 0)}
                className="flex items-center gap-2 px-6 py-2.5 bg-[#5850EC] text-white rounded-xl text-sm font-bold hover:bg-[#4F46E5] disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md shadow-indigo-100"
              >
                {isLoading ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    Search
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
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
            Enter to search · Shift+Enter for new line · Attach multiple files or URLs
          </p>
        </div>
      </div>
    </div>
  );
}

