"use client";

import { useEffect, useMemo, useRef, useState } from 'react';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

type ContactInfo = {
  fullName: string;
  email?: string;
  phone?: string;
  linkedin?: string;
  github?: string;
  website?: string;
};

type ExperienceItem = {
  role: string;
  company?: string;
  location?: string;
  start?: string;
  end?: string;
  description?: string;
};

type ProjectItem = {
  name: string;
  link?: string;
  repo?: string;
  description?: string;
  tech?: string;
};

type EducationItem = {
  degree: string;
  school?: string;
  start?: string;
  end?: string;
  score?: string;
};

type CertificationItem = {
  title: string;
  issuer?: string;
  year?: string;
  link?: string;
};

type ResumeData = {
  contact: ContactInfo;
  about?: string;
  experience: ExperienceItem[];
  projects: ProjectItem[];
  certifications: CertificationItem[];
  skills?: { techTools: string[]; softSkills: string[] } | string;
  education: EducationItem[];
  profileImageDataUrl?: string;
  certificatesLink?: string;
};

const STORAGE_KEY = 'resume_builder_data_v1';
const THEME_KEY = 'resume_builder_theme_v1';

function useLocalStorage<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => {
    if (typeof window === 'undefined') return initial;
    try {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : initial;
    } catch {
      return initial;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {}
  }, [key, value]);
  return [value, setValue] as const;
}

function classNames(...list: Array<string | false | null | undefined>) {
  return list.filter(Boolean).join(' ');
}

function normalizeUrl(raw?: string) {
  if (!raw) return undefined;
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function mailto(email?: string) {
  return email ? `mailto:${email}` : undefined;
}

function tel(phone?: string) {
  return phone ? `tel:${phone}` : undefined;
}

export default function HomePage() {
  const [theme, setTheme] = useLocalStorage<string>(THEME_KEY, 'system');
  const [data, setData] = useLocalStorage<ResumeData>(STORAGE_KEY, {
    contact: { fullName: '' },
    about: '',
    experience: [],
    projects: [],
    certifications: [],
    skills: { techTools: [], softSkills: [] },
    education: [],
    profileImageDataUrl: '',
    certificatesLink: '',
  });

  const previewRef = useRef<HTMLDivElement | null>(null);

  // Hydrate theme
  useEffect(() => {
    const root = document.documentElement;
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    const isDark = theme === 'dark' || (theme === 'system' && prefersDark);
    root.classList.toggle('dark', isDark);
  }, [theme]);

  function update<K extends keyof ResumeData>(key: K, value: ResumeData[K]) {
    setData({ ...data, [key]: value });
  }

  function updateContact<K extends keyof ContactInfo>(key: K, value: ContactInfo[K]) {
    update('contact', { ...data.contact, [key]: value });
  }

  function handleImageUpload(file: File) {
    const reader = new FileReader();
    reader.onload = () => update('profileImageDataUrl', String(reader.result));
    reader.readAsDataURL(file);
  }

  async function handleEnhance(field: string, text: string) {
    if (!text || !text.trim()) return;
    try {
      const res = await fetch('/api/enhance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ field, text }),
      });
      const json = await res.json();
      if (json?.enhanced) {
        if (field === 'about') update('about', json.enhanced);
      }
    } catch (e) {
      console.error(e);
    }
  }

  async function handleEnhanceArray<T extends { description?: string }>(
    key: 'experience' | 'projects',
    index: number,
    text: string
  ) {
    if (!text?.trim()) return;
    try {
      const res = await fetch('/api/enhance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ field: String(key), text }),
      });
      const json = await res.json();
      if (json?.enhanced) {
        const arr = [...((data[key] as unknown) as T[])];
        const item = { ...(arr[index] as T), description: json.enhanced };
        arr[index] = item;
        update(key, arr as any);
      }
    } catch (e) {
      console.error(e);
    }
  }

  async function downloadPdf() {
    if (!previewRef.current) return;
    const element = previewRef.current;
    const canvas = await html2canvas(element, { scale: 2, backgroundColor: null });
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const wRatio = pageWidth / canvas.width;
    const hRatio = pageHeight / canvas.height;
    const ratio = Math.min(wRatio, hRatio);
    const imgW = canvas.width * ratio;
    const imgH = canvas.height * ratio;
    const x = (pageWidth - imgW) / 2;
    const y = (pageHeight - imgH) / 2;
    pdf.addImage(imgData, 'PNG', x, y, imgW, imgH);

    // Add clickable link overlays mapped from anchors
    const containerRect = element.getBoundingClientRect();
    const anchors = Array.from(element.querySelectorAll('a[href]')) as HTMLAnchorElement[];
    const mmPerPx = imgW / canvas.width;
    anchors.forEach((a) => {
      const href = a.getAttribute('href');
      if (!href) return;
      const r = a.getBoundingClientRect();
      const relX = r.left - containerRect.left;
      const relY = r.top - containerRect.top;
      const linkXmm = x + relX * mmPerPx;
      const linkYmm = y + relY * mmPerPx;
      const linkWmm = r.width * mmPerPx;
      const linkHmm = r.height * mmPerPx;
      try {
        // @ts-ignore jsPDF typing
        pdf.link(linkXmm, linkYmm, linkWmm, linkHmm, { url: href });
      } catch {}
    });

    pdf.save('resume.pdf');
  }

  function resetAll() {
    setData({
      contact: { fullName: '' },
      about: '',
      experience: [],
      projects: [],
      certifications: [],
      skills: { techTools: [], softSkills: [] },
      education: [],
      profileImageDataUrl: '',
      certificatesLink: '',
    });
  }

  const has = useMemo(() => ({
    contact: data.contact?.fullName?.trim(),
    about: data.about?.trim(),
    exp: data.experience?.length,
    proj: data.projects?.length,
    cert: data.certifications?.length,
    skills: Array.isArray((data.skills as any)?.techTools) || typeof data.skills === 'string',
    edu: data.education?.length,
    img: data.profileImageDataUrl,
  }), [data]);

  return (
    <main className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
      <div className="mb-6 rounded-lg border border-cyan-400/40 bg-cyan-50/40 dark:bg-cyan-900/10 p-4 text-cyan-800 dark:text-cyan-200">
        <p className="text-sm sm:text-base">Welcome! Hakkan built this Resume Builder tool for you 🚀</p>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        <section className="lg:w-[48%] space-y-6">
          <header className="flex items-center justify-between">
            <h1 className="text-xl sm:text-2xl font-semibold">Resume Builder</h1>
            <div className="flex items-center gap-2">
              <select
                value={theme}
                onChange={(e) => setTheme(e.target.value)}
                className="rounded-md border border-slate-300 dark:border-slate-700 bg-white/70 dark:bg-slate-900/70 px-2 py-1 text-sm"
              >
                <option value="system">System</option>
                <option value="light">Light</option>
                <option value="dark">Dark</option>
              </select>
              <SaveButton data={data} />
              <button onClick={downloadPdf} className="glow rounded-md bg-brand-600 hover:bg-brand-700 text-white px-3 py-1.5 text-sm">Download PDF</button>
              <button onClick={resetAll} className="rounded-md border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-sm">Reset</button>
            </div>
          </header>

          {/* Contact */}
          <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-4 bg-white/60 dark:bg-slate-900/60">
            <h2 className="font-semibold text-slate-700 dark:text-slate-200 mb-3">Name & Contact</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input className="input" placeholder="Full Name*" value={data.contact.fullName} onChange={(e) => updateContact('fullName', e.target.value)} />
              <input className="input" placeholder="Email" type="email" value={data.contact.email || ''} onChange={(e) => updateContact('email', e.target.value)} />
              <input className="input" placeholder="Indian Phone Number" pattern="^[+]?[0-9]{10,13}$" value={data.contact.phone || ''} onChange={(e) => updateContact('phone', e.target.value)} />
              <input className="input" placeholder="LinkedIn URL" value={data.contact.linkedin || ''} onChange={(e) => updateContact('linkedin', e.target.value)} />
              <input className="input" placeholder="GitHub URL" value={data.contact.github || ''} onChange={(e) => updateContact('github', e.target.value)} />
              <input className="input" placeholder="Portfolio / Website" value={data.contact.website || ''} onChange={(e) => updateContact('website', e.target.value)} />
              <div className="sm:col-span-2">
                <label className="text-xs text-slate-500">Profile Image</label>
                <input className="mt-1 block w-full text-sm" type="file" accept="image/*" onChange={(e) => e.target.files && handleImageUpload(e.target.files[0])} />
              </div>
            </div>
          </div>

          {/* About */}
          <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-4 bg-white/60 dark:bg-slate-900/60">
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-semibold text-slate-700 dark:text-slate-200">About Me</h2>
              <button onClick={() => handleEnhance('about', data.about || '')} className="text-xs rounded-md border px-2 py-1 hover:bg-slate-50 dark:hover:bg-slate-800">✨ Enhance with AI</button>
            </div>
            <textarea className="textarea" rows={4} placeholder="Brief summary" value={data.about || ''} onChange={(e) => update('about', e.target.value)} />
          </div>

          {/* Experience */}
          <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-4 bg-white/60 dark:bg-slate-900/60">
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-semibold text-slate-700 dark:text-slate-200">Work Experience</h2>
            </div>
            <div className="space-y-4">
              {data.experience.map((exp, i) => (
                <div key={i} className="rounded-md border border-slate-200 dark:border-slate-800 p-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <input className="input" placeholder="Role*" value={exp.role} onChange={(e) => {
                      const copy = [...data.experience];
                      copy[i] = { ...copy[i], role: e.target.value };
                      update('experience', copy);
                    }} />
                    <input className="input" placeholder="Company" value={exp.company || ''} onChange={(e) => {
                      const copy = [...data.experience];
                      copy[i] = { ...copy[i], company: e.target.value };
                      update('experience', copy);
                    }} />
                    <input className="input" placeholder="Location" value={exp.location || ''} onChange={(e) => {
                      const copy = [...data.experience];
                      copy[i] = { ...copy[i], location: e.target.value };
                      update('experience', copy);
                    }} />
                    <div className="grid grid-cols-2 gap-2">
                      <input className="input" placeholder="Start" value={exp.start || ''} onChange={(e) => {
                        const copy = [...data.experience];
                        copy[i] = { ...copy[i], start: e.target.value };
                        update('experience', copy);
                      }} />
                      <input className="input" placeholder="End" value={exp.end || ''} onChange={(e) => {
                        const copy = [...data.experience];
                        copy[i] = { ...copy[i], end: e.target.value };
                        update('experience', copy);
                      }} />
                    </div>
                  </div>
                  <div className="mt-2">
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs text-slate-500">Description</label>
                      <button onClick={() => handleEnhanceArray<ExperienceItem>('experience', i, exp.description || '')} className="text-xs rounded-md border px-2 py-0.5">✨ Enhance</button>
                    </div>
                    <textarea className="textarea" rows={3} placeholder="Key contributions / impact" value={exp.description || ''} onChange={(e) => {
                      const copy = [...data.experience];
                      copy[i] = { ...copy[i], description: e.target.value };
                      update('experience', copy);
                    }} />
                  </div>
                  <div className="mt-2 text-right">
                    <button onClick={() => update('experience', data.experience.filter((_, idx) => idx !== i))} className="text-xs text-red-500">Remove</button>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-3">
              <button onClick={() => update('experience', [...data.experience, { role: '' }])} className="text-xs rounded-md border px-3 py-1">+ Add</button>
            </div>
          </div>

          {/* Projects */}
          <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-4 bg-white/60 dark:bg-slate-900/60">
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-semibold text-slate-700 dark:text-slate-200">Projects</h2>
            </div>
            <div className="space-y-4">
              {data.projects.map((p, i) => (
                <div key={i} className="rounded-md border border-slate-200 dark:border-slate-800 p-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <input className="input" placeholder="Project Name*" value={p.name} onChange={(e) => {
                      const copy = [...data.projects];
                      copy[i] = { ...copy[i], name: e.target.value };
                      update('projects', copy);
                    }} />
                    <input className="input sm:col-span-2" placeholder="Tech Stack (comma-separated)" value={p.tech || ''} onChange={(e) => {
                      const copy = [...data.projects];
                      copy[i] = { ...copy[i], tech: e.target.value };
                      update('projects', copy);
                    }} />
                    <input className="input" placeholder="Project Link" value={p.link || ''} onChange={(e) => {
                      const copy = [...data.projects];
                      copy[i] = { ...copy[i], link: e.target.value };
                      update('projects', copy);
                    }} />
                    <input className="input" placeholder="Repo Link" value={p.repo || ''} onChange={(e) => {
                      const copy = [...data.projects];
                      copy[i] = { ...copy[i], repo: e.target.value };
                      update('projects', copy);
                    }} />
                  </div>
                  <div className="mt-2">
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs text-slate-500">Description</label>
                      <button onClick={() => handleEnhanceArray<ProjectItem>('projects', i, p.description || '')} className="text-xs rounded-md border px-2 py-0.5">✨ Enhance</button>
                    </div>
                    <textarea className="textarea" rows={3} placeholder="Problem, approach, impact" value={p.description || ''} onChange={(e) => {
                      const copy = [...data.projects];
                      copy[i] = { ...copy[i], description: e.target.value };
                      update('projects', copy);
                    }} />
                  </div>
                  <div className="mt-2 text-right">
                    <button onClick={() => update('projects', data.projects.filter((_, idx) => idx !== i))} className="text-xs text-red-500">Remove</button>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-3">
              <button onClick={() => update('projects', [...data.projects, { name: '' }])} className="text-xs rounded-md border px-3 py-1">+ Add</button>
            </div>
          </div>

          {/* Certifications */}
          <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-4 bg-white/60 dark:bg-slate-900/60">
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-semibold text-slate-700 dark:text-slate-200">Certifications</h2>
            </div>
            <div className="mb-3">
              <input className="input" placeholder="All Certificates Link (Google Drive/Portfolio)" value={data.certificatesLink || ''} onChange={(e) => update('certificatesLink', e.target.value)} />
            </div>
            <div className="space-y-4">
              {data.certifications.map((c, i) => (
                <div key={i} className="rounded-md border border-slate-200 dark:border-slate-800 p-3 grid grid-cols-1 sm:grid-cols-4 gap-2">
                  <input className="input" placeholder="Title*" value={c.title} onChange={(e) => {
                    const copy = [...data.certifications];
                    copy[i] = { ...copy[i], title: e.target.value };
                    update('certifications', copy);
                  }} />
                  <input className="input" placeholder="Issuer" value={c.issuer || ''} onChange={(e) => {
                    const copy = [...data.certifications];
                    copy[i] = { ...copy[i], issuer: e.target.value };
                    update('certifications', copy);
                  }} />
                  <input className="input" placeholder="Year" value={c.year || ''} onChange={(e) => {
                    const copy = [...data.certifications];
                    copy[i] = { ...copy[i], year: e.target.value };
                    update('certifications', copy);
                  }} />
                  <div className="flex items-center gap-2">
                    <input className="input w-full" placeholder="Certificate Link" value={c.link || ''} onChange={(e) => {
                      const copy = [...data.certifications];
                      copy[i] = { ...copy[i], link: e.target.value };
                      update('certifications', copy);
                    }} />
                    <button onClick={() => update('certifications', data.certifications.filter((_, idx) => idx !== i))} className="text-xs text-red-500">Remove</button>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-3">
              <button onClick={() => update('certifications', [...data.certifications, { title: '' }])} className="text-xs rounded-md border px-3 py-1">+ Add</button>
            </div>
          </div>

          {/* Skills */}
          <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-4 bg-white/60 dark:bg-slate-900/60">
            <h2 className="font-semibold text-slate-700 dark:text-slate-200 mb-2">Skills</h2>
            <div className="grid grid-cols-1 gap-3">
              <div>
                <label className="text-xs text-slate-500">Tech & Tools</label>
                <TagsInput
                  tags={(typeof data.skills === 'string' ? (data.skills || '').split(',').map(s=>s.trim()).filter(Boolean) : (data.skills?.techTools || []))}
                  onChange={(tags) => {
                    const current = typeof data.skills === 'string' ? { techTools: [], softSkills: [] } : (data.skills || { techTools: [], softSkills: [] });
                    update('skills', { ...current, techTools: tags });
                  }}
                  placeholder="e.g., React, Node.js, Tailwind, C++"
                />
              </div>
              <div>
                <label className="text-xs text-slate-500">Soft Skills</label>
                <TagsInput
                  tags={(typeof data.skills === 'string' ? [] : (data.skills?.softSkills || []))}
                  onChange={(tags) => {
                    const current = typeof data.skills === 'string' ? { techTools: [], softSkills: [] } : (data.skills || { techTools: [], softSkills: [] });
                    update('skills', { ...current, softSkills: tags });
                  }}
                  placeholder="e.g., Communication, Leadership, Teamwork"
                />
              </div>
            </div>
          </div>

          {/* Education */}
          <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-4 bg-white/60 dark:bg-slate-900/60">
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-semibold text-slate-700 dark:text-slate-200">Education</h2>
              <button onClick={() => update('education', [...data.education, { degree: '' }])} className="text-xs rounded-md border px-2 py-1">+ Add</button>
            </div>
            <div className="space-y-4">
              {data.education.map((e, i) => (
                <div key={i} className="rounded-md border border-slate-200 dark:border-slate-800 p-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <input className="input" placeholder="Degree* (e.g., B.Tech in CSE)" value={e.degree} onChange={(ev) => {
                      const copy = [...data.education];
                      copy[i] = { ...copy[i], degree: ev.target.value };
                      update('education', copy);
                    }} />
                    <input className="input" placeholder="Institute" value={e.school || ''} onChange={(ev) => {
                      const copy = [...data.education];
                      copy[i] = { ...copy[i], school: ev.target.value };
                      update('education', copy);
                    }} />
                    <div className="grid grid-cols-2 gap-2">
                      <input className="input" placeholder="Start" value={e.start || ''} onChange={(ev) => {
                        const copy = [...data.education];
                        copy[i] = { ...copy[i], start: ev.target.value };
                        update('education', copy);
                      }} />
                      <input className="input" placeholder="End" value={e.end || ''} onChange={(ev) => {
                        const copy = [...data.education];
                        copy[i] = { ...copy[i], end: ev.target.value };
                        update('education', copy);
                      }} />
                    </div>
                    <input className="input sm:col-span-2" placeholder="Score (CGPA/%)" value={e.score || ''} onChange={(ev) => {
                      const copy = [...data.education];
                      copy[i] = { ...copy[i], score: ev.target.value };
                      update('education', copy);
                    }} />
                  </div>
                  <div className="mt-2 text-right">
                    <button onClick={() => update('education', data.education.filter((_, idx) => idx !== i))} className="text-xs text-red-500">Remove</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Preview */}
        <section className="lg:w-[52%]">
          <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-4 bg-white/80 dark:bg-slate-900/90">
            <h2 className="font-semibold text-slate-700 dark:text-slate-200 mb-3">Live Preview</h2>
            <div ref={previewRef} className="bg-white text-slate-900 p-6 rounded-md shadow-md max-w-[794px] w-full mx-auto">
              {/* ATS-friendly single column content */}
              <div className="flex items-start gap-4">
                {has.img && (
                  <img src={data.profileImageDataUrl} alt="Profile" className="w-20 h-20 rounded-md object-cover border" />
                )}
                <div className="flex-1">
                  {has.contact && (
                    <h1 className="text-2xl font-semibold">{data.contact.fullName}</h1>
                  )}
                  <div className="text-xs mt-1 space-x-3 text-slate-700">
                    {data.contact.email && <a className="preview-link" href={mailto(data.contact.email)}>{data.contact.email}</a>}
                    {data.contact.phone && <a className="preview-link" href={tel(data.contact.phone)}>{data.contact.phone}</a>}
                    {data.contact.linkedin && <a className="preview-link" href={normalizeUrl(data.contact.linkedin)} target="_blank" rel="noreferrer noopener">LinkedIn</a>}
                    {data.contact.github && <a className="preview-link" href={normalizeUrl(data.contact.github)} target="_blank" rel="noreferrer noopener">GitHub</a>}
                    {data.contact.website && <a className="preview-link" href={normalizeUrl(data.contact.website)} target="_blank" rel="noreferrer noopener">Portfolio</a>}
                  </div>
                </div>
              </div>

              {has.about && (
                <section className="mt-4">
                  <h3 className="section-title">About Me</h3>
                  <p className="section-body">{data.about}</p>
                </section>
              )}

              {has.skills && (
                <section className="mt-3">
                  <h3 className="section-title">Skills</h3>
                  <div className="mt-1">
                    {(typeof data.skills === 'string' ? (data.skills || '').split(',').map(s=>s.trim()).filter(Boolean) : data.skills?.techTools || []).length > 0 && (
                      <div className="mb-1">
                        <div className="text-[11px] uppercase tracking-wide text-slate-500">Tech & Tools</div>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {(typeof data.skills === 'string' ? (data.skills || '').split(',').map(s=>s.trim()).filter(Boolean) : data.skills?.techTools || []).map((t, i) => (
                            <span key={i} className="badge">{t}</span>
                          ))}
                        </div>
                      </div>
                    )}
                    {(typeof data.skills === 'string' ? [] : data.skills?.softSkills || []).length > 0 && (
                      <div>
                        <div className="text-[11px] uppercase tracking-wide text-slate-500">Soft Skills</div>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {(typeof data.skills === 'string' ? [] : data.skills?.softSkills || []).map((t, i) => (
                            <span key={i} className="badge">{t}</span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </section>
              )}

              {has.exp ? (
                <section className="mt-3">
                  <h3 className="section-title">Work Experience</h3>
                  <div className="space-y-2">
                    {data.experience.filter((e) => e.role?.trim()).map((e, i) => (
                      <div key={i}>
                        <div className="flex justify-between text-sm font-medium">
                          <span>
                            {e.role}
                            {e.company ? ` | ${e.company}` : ''}
                            {e.location ? `, ${e.location}` : ''}
                          </span>
                          <span className="text-slate-500">{[e.start, e.end].filter(Boolean).join(' - ')}</span>
                        </div>
                        {e.description && <p className="section-body">{e.description}</p>}
                      </div>
                    ))}
                  </div>
                </section>
              ) : null}

              {has.proj ? (
                <section className="mt-3">
                  <h3 className="section-title">Projects</h3>
                  <div className="space-y-2">
                    {data.projects.filter((p) => p.name?.trim()).map((p, i) => (
                      <div key={i}>
                        <div className="flex justify-between text-sm font-medium">
                          <span>
                            {p.name}
                          </span>
                          {p.tech && <span className="text-slate-500">{p.tech}</span>}
                        </div>
                        <div className="text-xs space-x-3 mt-0.5">
                          {p.link && (
                            <a className="preview-link" href={normalizeUrl(p.link)} target="_blank" rel="noreferrer noopener">🔗 View Project / Live Link</a>
                          )}
                          {p.repo && (
                            <a className="preview-link" href={normalizeUrl(p.repo)} target="_blank" rel="noreferrer noopener">📂 GitHub Repo</a>
                          )}
                        </div>
                        {p.description && <p className="section-body">{p.description}</p>}
                      </div>
                    ))}
                  </div>
                </section>
              ) : null}

              {has.cert ? (
                <section className="mt-3">
                  <h3 className="section-title">Certifications</h3>
                  {data.certificatesLink && (
                    <div className="text-xs mb-1">
                      <a className="preview-link" href={normalizeUrl(data.certificatesLink)} target="_blank" rel="noreferrer noopener">📜 View All Certificates</a>
                    </div>
                  )}
                  <ul className="list-disc pl-5 text-sm">
                    {data.certifications.filter((c) => c.title?.trim()).map((c, i) => (
                      <li key={i}>
                        {c.title}
                        {c.issuer ? `, ${c.issuer}` : ''}
                        {c.year ? ` (${c.year})` : ''}
                        {c.link && (
                          <>
                            {' '}
                            <a className="preview-link" href={normalizeUrl(c.link)} target="_blank" rel="noreferrer noopener">🔗 Certificate</a>
                          </>
                        )}
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}

              {has.edu ? (
                <section className="mt-3">
                  <h3 className="section-title">Education</h3>
                  <div className="space-y-2">
                    {data.education.filter((e) => e.degree?.trim()).map((e, i) => (
                      <div key={i}>
                        <div className="flex justify-between text-sm font-medium">
                          <span>
                            {e.degree}
                            {e.school ? ` | ${e.school}` : ''}
                          </span>
                          <span className="text-slate-500">{[e.start, e.end].filter(Boolean).join(' - ')}</span>
                        </div>
                        {e.score && <p className="section-body">Score: {e.score}</p>}
                      </div>
                    ))}
                  </div>
                </section>
              ) : null}
            </div>
          </div>
        </section>
      </div>

      {/* Tailwind component styles */}
      <style jsx global>{`
        .input { @apply w-full rounded-md border border-slate-300 dark:border-slate-700 bg-white/80 dark:bg-slate-800/80 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-400 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-500; }
        .textarea { @apply w-full rounded-md border border-slate-300 dark:border-slate-700 bg-white/80 dark:bg-slate-800/80 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-400 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-500; }
        .section-title { @apply text-sm font-semibold tracking-wide uppercase text-slate-700; }
        .section-body { @apply text-sm text-slate-700 leading-relaxed; }
        .preview-link { @apply text-blue-600 underline; }
        .badge { @apply text-[11px] px-2 py-0.5 rounded-md border border-slate-300 bg-slate-50; }
      `}</style>
    </main>
  );
}

function SaveButton({ data }: { data: any }) {
  const [saved, setSaved] = useState(false);
  return (
    <button
      onClick={() => {
        try {
          localStorage.setItem('resume_builder_data_v1', JSON.stringify(data));
          setSaved(true);
          setTimeout(() => setSaved(false), 1200);
        } catch {}
      }}
      className="rounded-md border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-sm"
    >
      {saved ? 'Saved ✔' : 'Save Progress'}
    </button>
  );
}

function TagsInput({ tags, onChange, placeholder }: { tags: string[]; onChange: (tags: string[]) => void; placeholder?: string }) {
  const [input, setInput] = useState('');
  function addTagFromInput() {
    const parts = input.split(',').map((t) => t.trim()).filter(Boolean);
    if (parts.length === 0) return;
    const next = Array.from(new Set([...(tags || []), ...parts]));
    onChange(next);
    setInput('');
  }
  return (
    <div className="rounded-md border border-slate-300 dark:border-slate-700 bg-white/80 dark:bg-slate-800/80 p-2">
      <div className="flex flex-wrap gap-1">
        {(tags || []).map((t, i) => (
          <button key={i} onClick={() => onChange(tags.filter((_, idx) => idx !== i))} className="badge hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer">
            {t} ×
          </button>
        ))}
        <input
          className="bg-transparent flex-1 min-w-[140px] outline-none text-sm px-1 py-0.5 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-400"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ',') {
              e.preventDefault();
              addTagFromInput();
            }
          }}
          onBlur={() => addTagFromInput()}
          placeholder={placeholder}
        />
      </div>
    </div>
  );
}
