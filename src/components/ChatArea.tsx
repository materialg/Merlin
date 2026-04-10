import { Github, BookOpen, User, CheckCircle2, AlertCircle, Linkedin, Globe, MessageSquare, MapPin, GraduationCap, Sparkles, Bookmark, Facebook } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { SearchSession, Candidate } from '../types';

interface ChatAreaProps {
  session: SearchSession | null;
}

export default function ChatArea({ session }: ChatAreaProps) {
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

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-8 bg-white">
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
            <div className="flex items-center gap-2 text-sm font-medium text-gray-500">
              {session.status === 'searching' ? (
                <>
                  <span className="text-base animate-pulse">🪄</span>
                  <span>Making magic...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-purple-500" />
                  <span>Found {session.candidates.length} candidates</span>
                </>
              )}
            </div>

            {session.plan && (
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
                  {session.urls && session.urls.length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-1">
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">URLs:</span>
                      {session.urls.map(url => (
                        <a key={url} href={url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-blue-600 hover:underline truncate max-w-[200px]">
                          {url}
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </div>

          {/* Candidates List */}
          <div className="space-y-4">
            {session.candidates.map((candidate, idx) => (
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
                          {candidate.socialLinks?.reduce((acc, link) => {
                            const platform = link.platform.toLowerCase();
                            const isX = platform.includes('twitter') || platform.includes('x');
                            const isLinkedIn = platform.includes('linkedin');
                            const isGithub = platform.includes('github');
                            const isArxiv = platform.includes('arxiv');
                            const isHF = platform.includes('huggingface') || platform.includes('hugging face');
                            const isFacebook = platform.includes('facebook');
                            
                            let key = platform;
                            if (isX) key = 'x';
                            else if (isLinkedIn) key = 'linkedin';
                            else if (isGithub) key = 'github';
                            else if (isArxiv) key = 'arxiv';
                            else if (isHF) key = 'huggingface';
                            else if (isFacebook) key = 'facebook';
                            
                            if (!acc.find(l => l.key === key)) {
                              acc.push({ ...link, key });
                            }
                            return acc;
                          }, [] as any[]).map(link => (
                            <a key={link.url} href={link.url} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-blue-600 transition-colors">
                              {link.key === 'linkedin' && <Linkedin className="w-3.5 h-3.5" />}
                              {link.key === 'github' && <Github className="w-3.5 h-3.5" />}
                              {link.key === 'facebook' && <Facebook className="w-3.5 h-3.5" />}
                              {link.key === 'arxiv' && <BookOpen className="w-3.5 h-3.5" />}
                              {link.key === 'huggingface' && (
                                <span className="text-[10px] font-bold leading-none border border-gray-200 rounded px-1 py-0.5 hover:border-blue-200 hover:bg-blue-50">HF</span>
                              )}
                              {link.key === 'x' && (
                                <svg viewBox="0 0 24 24" aria-hidden="true" className="w-3 h-3 fill-current">
                                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"></path>
                                </svg>
                              )}
                            </a>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-medium text-gray-600 hover:bg-gray-50">
                        <Bookmark className="w-3.5 h-3.5" />
                        Shortlist
                      </button>
                    </div>
                  </div>

                  {/* Sub-info */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <div className="w-4 h-4 bg-gray-100 rounded flex items-center justify-center">
                        <Globe className="w-3 h-3 text-gray-400" />
                      </div>
                      <span className="font-medium">{candidate.title}</span>
                    </div>
                    
                    {candidate.location && (
                      <div className="flex items-center gap-2 text-sm text-gray-500">
                        <MapPin className="w-4 h-4 text-gray-400" />
                        <span>{candidate.location}</span>
                      </div>
                    )}

                    {candidate.education && (
                      <div className="flex items-center gap-2 text-sm text-gray-500">
                        <GraduationCap className="w-4 h-4 text-gray-400" />
                        <span>{candidate.education}</span>
                      </div>
                    )}
                  </div>

                  {/* AI Summary */}
                  <div className="pt-2">
                    <div className="flex gap-3">
                      <Sparkles className="w-4 h-4 text-purple-500 shrink-0 mt-1" />
                      <p className="text-sm text-gray-700 leading-relaxed">
                        {candidate.impactSummary}
                      </p>
                    </div>
                  </div>

                  {/* Bottom Match Bar */}
                  <div className="pt-4 flex items-center gap-6">
                    <div className="flex items-center gap-2">
                      <div className="text-xs font-bold text-blue-600 uppercase tracking-wider">Match Score</div>
                      <div className="flex items-center gap-1.5 bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-sm font-bold">
                        {candidate.score}%
                      </div>
                    </div>
                    
                    {candidate.scoringBreakdown && (
                      <div className="flex gap-4">
                        {[
                          { label: 'Tech', value: candidate.scoringBreakdown.techMatch, max: 40 },
                          { label: 'Contrib', value: candidate.scoringBreakdown.contributionMatch, max: 30 },
                          { label: 'Seniority', value: candidate.scoringBreakdown.seniorityMatch, max: 20 },
                        ].map(item => (
                          <div key={item.label} className="flex flex-col gap-1">
                            <div className="flex justify-between text-[9px] font-bold text-gray-400 uppercase tracking-tighter">
                              <span>{item.label}</span>
                              <span>{item.value}/{item.max}</span>
                            </div>
                            <div className="w-16 h-1 bg-gray-100 rounded-full overflow-hidden">
                              <motion.div 
                                initial={{ width: 0 }}
                                animate={{ width: `${(item.value / item.max) * 100}%` }}
                                className="h-full bg-blue-500"
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          {session.status === 'completed' && session.candidates.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-400 text-sm">No candidates found. Try a broader search.</p>
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
  );
}
