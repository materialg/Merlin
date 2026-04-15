export const getEduCategory = (degree: string): 'B' | 'M' | 'P' | null => {
  const d = degree.toLowerCase();
  if (d.includes('phd') || d.includes('ph.d') || d.includes('doctor') || d.includes('dphil')) return 'P';
  if (d.includes('master') || d.includes('ms') || d.includes('ma') || d.includes('mba') || d.includes('m.s') || d.includes('m.a')) return 'M';
  if (d.includes('bachelor') || d.includes('bs') || d.includes('ba') || d.includes('b.s') || d.includes('b.a') || d.includes('undergrad')) return 'B';
  return null;
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
