/**
 * NEXORA CV — a one-page CV for summer jobs, part-time work, internships, training programs and
 * volunteering (not a full career résumé). Plain data, safe on client and server.
 */

export type CVGoal = 'summer_job' | 'part_time' | 'internship' | 'training' | 'volunteer';
export type CVTemplate = 'classic' | 'modern';
export interface CVExperience { id: string; kind: 'work' | 'volunteer' | 'project' | 'training'; role: string; org: string; place: string; start: string; end: string; bullets: string[] }
export interface CVCert { id: string; name: string; issuer: string; date: string }
export interface CVLanguage { id: string; name: string; level: 'native' | 'fluent' | 'conversational' | 'basic' }
export interface CVReference { id: string; name: string; title: string; contact: string }

export interface CV {
  version: 1;
  template: CVTemplate;
  accent: string;
  goal: CVGoal;
  target: string;                 // e.g. "Summer camp counselor" (optional)
  name: string;
  headline: string;               // e.g. "Grade 11 · Architecture & Construction pathway"
  email: string;
  phone: string;
  city: string;
  link: string;                   // NEXORA portfolio, LinkedIn, personal site
  statement: string;
  education: { school: string; program: string; grade: string; grad: string; gpa: string; courses: string[]; honors: string };
  skills: { technical: string[]; soft: string[] };
  certs: CVCert[];
  experience: CVExperience[];
  activities: string[];
  languages: CVLanguage[];
  availability: { start: string; end: string; hours: string; days: string; transport: boolean; note: string };
  references: { mode: 'on_request' | 'list' | 'none'; list: CVReference[] };
  show: { statement: boolean; education: boolean; skills: boolean; certs: boolean; experience: boolean; activities: boolean; languages: boolean; availability: boolean; references: boolean };
}

export const ACCENTS = ['#1F4E79', '#0F766E', '#7C3AED', '#B45309', '#BE123C', '#334155'];
export const uid = () => Math.random().toString(36).slice(2, 10);

export function emptyCV(seed: Partial<CV> = {}): CV {
  return {
    version: 1, template: 'classic', accent: ACCENTS[0], goal: 'summer_job', target: '',
    name: '', headline: '', email: '', phone: '', city: '', link: '', statement: '',
    education: { school: '', program: '', grade: '', grad: '', gpa: '', courses: [], honors: '' },
    skills: { technical: [], soft: [] }, certs: [], experience: [], activities: [], languages: [],
    availability: { start: '', end: '', hours: '', days: '', transport: false, note: '' },
    references: { mode: 'on_request', list: [] },
    show: { statement: true, education: true, skills: true, certs: true, experience: true, activities: true, languages: true, availability: true, references: true },
    ...seed,
  };
}

/** Fill any fields an older saved CV doesn't have. */
export function normalizeCV(raw: unknown, seed: Partial<CV> = {}): CV {
  const base = emptyCV(seed);
  if (!raw || typeof raw !== 'object') return base;
  const r = raw as Partial<CV>;
  return {
    ...base, ...r,
    education: { ...base.education, ...(r.education ?? {}) },
    skills: { ...base.skills, ...(r.skills ?? {}) },
    availability: { ...base.availability, ...(r.availability ?? {}) },
    references: { ...base.references, ...(r.references ?? {}) },
    show: { ...base.show, ...(r.show ?? {}) },
    certs: r.certs ?? [], experience: r.experience ?? [], activities: r.activities ?? [], languages: r.languages ?? [],
  };
}

// ------------------------------------------------------------------ Suggestions (dropdowns)
export const SKILL_SUGGESTIONS: { group: string; items: string[] }[] = [
  { group: 'Design & CAD', items: ['AutoCAD', 'Revit', 'SketchUp', 'Tinkercad', 'Fusion 360', 'Onshape', '2D drafting', '3D modeling', 'Blueprint reading', 'Floor plan layout', 'Hand sketching', 'Model building', '3D printing', 'Laser cutting'] },
  { group: 'Construction & shop', items: ['Measuring and layout', 'Hand tools', 'Power tool safety', 'Basic carpentry', 'Jobsite safety (OSHA)', 'Reading a tape measure', 'Material estimating', 'Framing basics'] },
  { group: 'Engineering & STEM', items: ['Engineering design process', 'Problem solving with math', 'Data collection', 'Spreadsheets for calculations', 'Basic circuits', 'Coding (Scratch / Python)', 'Robotics'] },
  { group: 'Computers & office', items: ['Microsoft Word', 'Microsoft Excel', 'Microsoft PowerPoint', 'Google Docs', 'Google Sheets', 'Google Slides', 'Canva', 'Typing (40+ wpm)', 'Email etiquette', 'Video editing', 'Social media content'] },
  { group: 'Customer & retail', items: ['Customer service', 'Cash handling', 'POS systems', 'Stocking and inventory', 'Food safety', 'Phone etiquette', 'Opening and closing procedures'] },
  { group: 'Care & community', items: ['Childcare', 'Tutoring', 'Coaching younger students', 'Event setup', 'First aid basics', 'Pet care', 'Lawn and garden care'] },
];
export const SOFT_SUGGESTIONS = ['Teamwork', 'Communication', 'Reliability', 'Punctuality', 'Time management', 'Problem solving', 'Attention to detail', 'Leadership', 'Adaptability', 'Following directions', 'Work ethic', 'Creativity', 'Organization', 'Positive attitude', 'Taking feedback', 'Bilingual (English / Spanish)', 'Public speaking', 'Conflict resolution'];
export const CERT_SUGGESTIONS = ['OSHA 10 — Construction', 'Autodesk Certified User — AutoCAD', 'Autodesk Certified User — Revit', 'NCCER Core', 'HBI Pre-Apprenticeship Certificate (PACT)', 'CPR / First Aid / AED (American Red Cross)', 'Food Handler Certificate', 'ServSafe Food Handler', 'Microsoft Office Specialist — Word', 'Microsoft Office Specialist — Excel', 'Red Cross Lifeguard', 'Babysitting & Child Care (Red Cross)', 'Google IT Support', 'Adobe Certified Professional'];
export const ACTIVITY_SUGGESTIONS = ['SkillsUSA', 'ACE Mentor Program', 'National Honor Society', 'Student Council', 'Robotics club', 'FIRST Robotics', 'Habitat for Humanity volunteer', 'Varsity sports', 'JV sports', 'Band / Orchestra', 'Theater tech crew', 'Yearbook', 'Church / community volunteer', 'Honor roll'];
export const ACTION_VERBS = ['Assisted', 'Built', 'Created', 'Designed', 'Drafted', 'Helped', 'Led', 'Managed', 'Measured', 'Organized', 'Prepared', 'Served', 'Supported', 'Taught', 'Trained', 'Volunteered', 'Welcomed', 'Completed', 'Improved', 'Presented'];

export const GOAL_STATEMENT: Record<CVGoal, string> = {
  summer_job: 'Motivated high school student seeking a summer position where I can contribute reliable, hands-on work and learn from an experienced team.',
  part_time: 'Dependable high school student looking for a part-time role that fits a school schedule, with a strong record of punctuality and teamwork.',
  internship: 'Curious, detail-oriented student seeking an internship to apply classroom skills in a real workplace and learn industry practices.',
  training: 'Eager learner applying to a training program to build industry-recognized skills and prepare for a career pathway.',
  volunteer: 'Community-minded student looking to volunteer, bring a positive attitude, and help with whatever the team needs.',
};
