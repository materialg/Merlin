import React from 'react';
import { Linkedin, Github, BookOpen, GraduationCap, Link, Mail, Pencil, Star } from 'lucide-react';
import { Candidate } from '../types';
import { cleanUrl } from '../lib/utils';

export const getSocialIcons = (candidate: Candidate, onEdit?: () => void) => {
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
    { key: 'website', icon: <Link className="w-3.5 h-3.5" />, label: 'Personal Website' },
    { key: 'email', icon: <Mail className="w-3.5 h-3.5" />, label: 'Email' }
  ];

  const socialIcons = platforms.filter(p => p.key !== 'email').map(platform => {
    let link = candidate.socialLinks?.find(l => {
      const p = l.platform.toLowerCase();
      if (platform.key === 'x') return p.includes('twitter') || p.includes('x');
      if (platform.key === 'huggingface') return p.includes('huggingface') || p.includes('hugging face');
      if (platform.key === 'scholar') return p.includes('scholar') || p.includes('google scholar');
      if (platform.key === 'website') return p.includes('website') || p.includes('portfolio') || p.includes('blog') || p.includes('personal');
      return p.includes(platform.key);
    });

    // Fallback to candidate.url if it matches the platform and no link was found in socialLinks
    if (!link && candidate.url) {
      const u = candidate.url.toLowerCase();
      if (platform.key === 'linkedin' && u.includes('linkedin.com')) link = { platform: 'LinkedIn', url: candidate.url };
      if (platform.key === 'github' && u.includes('github.com')) link = { platform: 'GitHub', url: candidate.url };
      if (platform.key === 'x' && (u.includes('twitter.com') || u.includes('x.com'))) link = { platform: 'X', url: candidate.url };
      if (platform.key === 'huggingface' && u.includes('huggingface.co')) link = { platform: 'HuggingFace', url: candidate.url };
      if (platform.key === 'arxiv' && u.includes('arxiv.org')) link = { platform: 'Arxiv', url: candidate.url };
      if (platform.key === 'scholar' && u.includes('scholar.google.com')) link = { platform: 'Google Scholar', url: candidate.url };
    }

    const cleaned = link ? cleanUrl(link.url) : null;
    const isMissing = !cleaned;
    const finalUrl = cleaned || '#';

    return (
      <a 
        key={platform.key} 
        href={finalUrl} 
        target="_blank" 
        rel="noopener noreferrer"
        referrerPolicy="no-referrer"
        onClick={(e) => isMissing && e.preventDefault()}
        className={`p-1 rounded transition-all ${
          isMissing 
            ? 'text-gray-100 cursor-default pointer-events-none' 
            : 'text-gray-400 hover:text-blue-600 hover:bg-blue-50'
        }`}
        title={isMissing ? `No ${platform.label} profile` : `View ${platform.label}`}
      >
        {platform.icon}
      </a>
    );
  });

  const emailLink = candidate.email ? (
    <a 
      href={`mailto:${candidate.email}`}
      className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-all"
      title="Send Email"
    >
      <Mail className="w-3.5 h-3.5" />
    </a>
  ) : (
    <div className="p-1 text-gray-100 cursor-default" title="No email available">
      <Mail className="w-3.5 h-3.5" />
    </div>
  );

  return (
    <div className="flex items-center gap-1">
      {candidate.anchorProfileUrl && cleanUrl(candidate.anchorProfileUrl) && (
        <a 
          href={cleanUrl(candidate.anchorProfileUrl)!}
          target="_blank"
          rel="noopener noreferrer"
          referrerPolicy="no-referrer"
          className="p-1 text-yellow-500 hover:text-yellow-600 hover:bg-yellow-50 rounded transition-all"
          title="Source of Truth (Anchored Profile)"
        >
          <Star className="w-3.5 h-3.5 fill-current" />
        </a>
      )}
      {socialIcons}
      {emailLink}
      {onEdit && (
        <button 
          onClick={(e) => {
            e.stopPropagation();
            onEdit();
          }}
          className="p-1 text-gray-300 hover:text-blue-500 hover:bg-blue-50 rounded transition-all"
          title="Edit profiles"
        >
          <Pencil className="w-3 h-3" />
        </button>
      )}
    </div>
  );
};
