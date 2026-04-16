export const getEduCategory = (degree: string): 'B' | 'M' | 'P' | null => {
  const d = degree.toLowerCase();
  if (d.includes('phd') || d.includes('ph.d') || d.includes('doctor') || d.includes('dphil')) return 'P';
  if (d.includes('master') || d.includes('ms') || d.includes('ma') || d.includes('mba') || d.includes('m.s') || d.includes('m.a')) return 'M';
  if (d.includes('bachelor') || d.includes('bs') || d.includes('ba') || d.includes('b.s') || d.includes('b.a') || d.includes('undergrad')) return 'B';
  return null;
};

export const cleanUrl = (url: string): string | null => {
  if (!url) return null;
  try {
    const u = new URL(url);
    // Handle Google search redirects
    if (u.hostname.includes('google.com') && u.pathname === '/url') {
      const q = u.searchParams.get('q');
      if (q) return cleanUrl(q);
      const urlParam = u.searchParams.get('url');
      if (urlParam) return cleanUrl(urlParam);
    }
    
    // Discard URLs that are obviously search results or generic
    const uStr = url.toLowerCase();
    if (uStr.includes('google.com/search') || 
        uStr.includes('bing.com/search') || 
        uStr.includes('linkedin.com/search') ||
        uStr.includes('github.com/search') ||
        uStr.includes('twitter.com/search') ||
        uStr.includes('x.com/search') ||
        uStr.includes('linkedin.com/pub/dir') || // LinkedIn directory search
        uStr.includes('linkedin.com/company/') || // Company page instead of person
        uStr.endsWith('linkedin.com/in/') || // Empty profile path
        uStr.endsWith('github.com/') // Empty github path
    ) {
      return null;
    }

    return url;
  } catch (e) {
    // If it's not a valid URL but looks like a path, it might be a relative URL or something else
    // For now, just return it if it doesn't look like a search query
    if (url.includes('google.com/search')) return null;
    return url;
  }
};

export const cleanObject = (obj: any): any => {
  if (Array.isArray(obj)) {
    return obj.map(cleanObject);
  }
  if (obj !== null && typeof obj === 'object' && !(obj instanceof Date)) {
    return Object.fromEntries(
      Object.entries(obj)
        .filter(([_, v]) => v !== undefined)
        .map(([k, v]) => [k, cleanObject(v)])
    );
  }
  return obj;
};
