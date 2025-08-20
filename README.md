# Resume Maker

Modern, ATS-friendly resume builder for B.Tech students and freshers with AI-powered text enhancement (Gemini), live preview, theme toggle, local saving, and single-page PDF export.

## Running locally

1. Create `.env.local` and add:

```
GEMINI_API_KEY=your_key_here
```

2. Install and run:

```
npm install
npm run dev
```

Open http://localhost:3000

## Deploying on Vercel

- Set `GEMINI_API_KEY` in Vercel Project Settings → Environment Variables.
- Deploy. No keys are exposed to the client; the AI call uses an API route.

## Features

- System/light/dark theme toggle (Tailwind `dark` class)
- Live preview that hides empty sections
- LocalStorage autosave and Reset
- PDF generation via html2canvas + jsPDF
- AI Enhance using Google Gemini
