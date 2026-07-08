# QCU Robotics Website

Official website for **QCU Robotics** — the robotics team of Quezon City University. Built to showcase the team's competitions, achievements, members, and sponsors.

## Key Features

- **Hero Section with Image Carousel** — Dynamic banner with auto-rotating team photos and live stats (competitions, awards, team members)
- **Competitions** — Displays upcoming and past robotics competitions fetched from Supabase
- **Matches** — Dedicated page for match results and video playback (HLS streaming)
- **Achievements** — Showcases the team's national and international awards
- **Team Members & Coaches** — Profiles with social links (Facebook, Instagram, LinkedIn, GitHub, etc.)
- **Sponsors Section** — Highlights team sponsors and partners
- **Join Team CTA** — Links to a Google Form for recruitment
- **Responsive Design** — Mobile-first layout with hamburger navigation and smooth scroll
- **Dark Theme** — Slate/red gradient aesthetic with ambient background effects

## Tech Stack

- **Framework:** Next.js 16 (App Router, React 19)
- **Styling:** Tailwind CSS 4
- **Backend:** Supabase (database & auth)
- **Video:** HLS.js for match video streaming
- **Icons:** Lucide React
- **Language:** TypeScript
- **Fonts:** Geist (via next/font)

## Getting Started

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.local.example .env.local
# Add your NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY

# Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the site.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |
