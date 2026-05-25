"use client";

import React, { useState, useEffect } from 'react';
import { 
  Bot, 
  Cpu, 
  Rocket, 
  ChevronRight, 
  Menu, 
  X, 
  Mail,
  Activity,
  Shield,
  Zap,
  ArrowUpRight
} from 'lucide-react';

// Mock data for our robotics projects
const projects = [
  {
    id: 1,
    title: "Project A.E.G.I.S.",
    category: "Autonomous Defense",
    description: "Next-generation bipedal sentinels designed for hazardous environment navigation and search & rescue operations.",
    icon: <Shield className="w-8 h-8 text-cyan-400" />
  },
  {
    id: 2,
    title: "Valkyrie Drone Swarm",
    category: "Aerial Mapping",
    description: "Synchronized UAVs utilizing advanced spatial AI for real-time topographical rendering and agricultural analysis.",
    icon: <Rocket className="w-8 h-8 text-blue-400" />
  },
  {
    id: 3,
    title: "Neuro-Link Interface",
    category: "Human-Machine Interaction",
    description: "Low-latency neural pathways bridging human cognitive intents with precision robotic prosthetics.",
    icon: <Activity className="w-8 h-8 text-purple-400" />
  },
  {
    id: 4,
    title: "Quantum Core Processor",
    category: "Hardware",
    description: "Proprietary edge-computing modules allowing our bots to process complex ML algorithms locally.",
    icon: <Cpu className="w-8 h-8 text-emerald-400" />
  }
];

// A futuristic background with floating glowing orbs to enhance the glassmorphic effect
const AmbientBackground = () => (
  <div className="fixed inset-0 z-[-1] bg-slate-950 overflow-hidden">
    <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-cyan-900/20 blur-[120px] mix-blend-screen" />
    <div className="absolute bottom-[-10%] right-[-5%] w-[40%] h-[60%] rounded-full bg-blue-900/20 blur-[100px] mix-blend-screen" />
    <div className="absolute top-[40%] left-[60%] w-[30%] h-[30%] rounded-full bg-purple-900/10 blur-[90px] mix-blend-screen" />
    {/* Grid overlay for a tech feel */}
    <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAwIDEwIEwgNDAgMTAgTSAxMCAwIEwgMTAgNDAiIGZpbGw9Im5vbmUiIHN0cm9rZT0icmdiYSgyNTUsMjU1LDI1NSwwLjAyKSIgc3Ryb2tlLXdpZHRoPSIxIi8+PC9wYXR0ZXJuPjwvZGVmcz48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJ1cmwoI2dyaWQpIi8+PC9zdmc+')] opacity-50" />
  </div>
);

const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  // Handle scroll effect for glass navbar
  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <nav className={`fixed w-full z-50 transition-all duration-300 ${scrolled ? 'py-3' : 'py-5'}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className={`
          flex items-center justify-between px-6 py-3 rounded-2xl transition-all duration-300
          ${scrolled 
            ? 'bg-slate-900/60 backdrop-blur-md border border-slate-700/50 shadow-lg shadow-slate-900/20' 
            : 'bg-transparent'}
        `}>
          {/* Logo */}
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
              <Bot className="w-6 h-6 text-white" />
            </div>
            <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">
              Nexus Robotics
            </span>
          </div>

          {/* Desktop Menu */}
          <div className="hidden md:flex items-center gap-8">
            {['Initiatives', 'Technology', 'About Us', 'Careers'].map((item) => (
              <a key={item} href={`#${item.toLowerCase()}`} className="text-sm font-medium text-slate-300 hover:text-cyan-400 transition-colors">
                {item}
              </a>
            ))}
            <button className="px-5 py-2 rounded-lg bg-slate-800/80 backdrop-blur-sm border border-slate-600/50 text-white text-sm font-medium hover:bg-slate-700/80 hover:border-cyan-500/50 transition-all shadow-[0_0_15px_rgba(34,211,238,0.1)] hover:shadow-[0_0_20px_rgba(34,211,238,0.3)] flex items-center gap-2">
              Partner With Us
            </button>
          </div>

          {/* Mobile Menu Button */}
          <div className="md:hidden">
            <button 
              onClick={() => setIsOpen(!isOpen)}
              className="text-slate-300 hover:text-white p-2"
            >
              {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Menu Dropdown */}
        {isOpen && (
          <div className="md:hidden mt-2 p-4 rounded-2xl bg-slate-900/90 backdrop-blur-lg border border-slate-700/50 shadow-xl">
            <div className="flex flex-col space-y-4">
              {['Initiatives', 'Technology', 'About Us', 'Careers'].map((item) => (
                <a 
                  key={item} 
                  href={`#${item.toLowerCase()}`} 
                  className="text-slate-300 hover:text-cyan-400 font-medium px-2 py-1"
                  onClick={() => setIsOpen(false)}
                >
                  {item}
                </a>
              ))}
              <button className="w-full mt-2 px-5 py-3 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-medium">
                Partner With Us
              </button>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
};

const Hero = () => {
  const [currentImage, setCurrentImage] = useState(0);

  const carouselImages = [
    "https://images.unsplash.com/photo-1485827404703-89b55fcc595e?auto=format&fit=crop&w=1600&q=80",
    "https://images.unsplash.com/photo-1535378273068-9bb67d5beacd?auto=format&fit=crop&w=1600&q=80",
    "https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?auto=format&fit=crop&w=1600&q=80",
    "https://images.unsplash.com/photo-1589254065878-42c9da997008?auto=format&fit=crop&w=1600&q=80"
  ];

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentImage((prev) => (prev + 1) % carouselImages.length);
    }, 4000); // Auto-advance every 4 seconds
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="relative overflow-hidden">
      {/* Background section - only extends to buttons */}
      <div 
        className="relative pt-32 pb-12 sm:pt-40 sm:pb-8 overflow-hidden"
        style={{
          backgroundImage: `
            url("https://images.unsplash.com/photo-1517694712202-14dd9538aa97?auto=format&fit=crop&w=1600&q=80"),
            linear-gradient(135deg, rgba(15,23,42,0.85) 0%, rgba(30,58,138,0.8) 50%, rgba(15,23,42,0.85) 100%)
          `,
          backgroundSize: 'cover, cover',
          backgroundPosition: 'center, center',
          backgroundBlendMode: 'overlay'
        }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 w-full text-center">
          
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-slate-800/50 backdrop-blur-md border border-slate-700/50 mb-8">
            <span className="flex h-2 w-2 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.8)] animate-pulse" />
            <span className="text-xs font-medium text-slate-300 tracking-wider uppercase">Next-Gen Autonomous Systems</span>
          </div>

          {/* Main Headline */}
          <h1 className="text-5xl sm:text-6xl md:text-7xl font-extrabold text-white tracking-tight mb-6">
            Engineering the <br className="hidden sm:block" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-500">
               Future of Automation
            </span>
          </h1>
          
          {/* Subtitle */}
          <p className="mt-4 text-lg sm:text-xl text-slate-400 max-w-2xl mx-auto mb-10 font-light leading-relaxed">
            Nexus Robotics develops advanced AI-driven mechanized solutions to tackle humanity's most complex physical challenges across defense, industry, and exploration.
          </p>
          
          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <button className="px-8 py-4 rounded-xl bg-white text-slate-950 font-semibold hover:bg-slate-200 transition-colors flex items-center justify-center gap-2 shadow-[0_0_30px_rgba(255,255,255,0.2)]">
              Explore Technologies
              <ChevronRight className="w-5 h-5" />
            </button>
            <button className="px-8 py-4 rounded-xl bg-slate-800/40 backdrop-blur-md border border-slate-600/50 text-white font-medium hover:bg-slate-800/60 transition-all flex items-center justify-center gap-2">
              View Case Studies
            </button>
          </div>
        </div>
      </div>

      {/* Carousel and Stats - no background */}
      <div className="relative pt-12 pb-12 sm:pb-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 w-full">
          {/* Auto-scrolling Image Carousel */}
          <div className="relative w-full max-w-5xl mx-auto h-64 sm:h-80 md:h-[450px] rounded-3xl overflow-hidden border border-slate-700/50 shadow-[0_0_40px_rgba(34,211,238,0.15)] group">
            <div 
              className="flex transition-transform duration-1000 ease-[cubic-bezier(0.4,0,0.2,1)] h-full"
              style={{ transform: `translateX(-${currentImage * 100}%)` }}
            >
              {carouselImages.map((src, idx) => (
                <div key={idx} className="w-full h-full shrink-0 relative">
                  <img
                    src={src}
                    className="w-full h-full object-cover"
                    alt={`Robotics showcase ${idx + 1}`}
                  />
                  {/* Glassy overlay for thematic blending and stats legibility underneath */}
                  <div className="absolute inset-0 bg-slate-900/20 mix-blend-multiply" />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/20 to-transparent" />
                </div>
              ))}
            </div>
            
            {/* Navigation Indicators */}
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-3 z-20">
              {carouselImages.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setCurrentImage(idx)}
                  className={`h-1.5 rounded-full transition-all duration-500 ${
                    idx === currentImage ? "w-10 bg-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.8)]" : "w-3 bg-slate-500/50 hover:bg-slate-400/80"
                  }`}
                  aria-label={`Go to slide ${idx + 1}`}
                />
              ))}
            </div>
          </div>

          {/* Stats Glass Panel */}
          <div className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto">
            {[
              { label: 'Active Patents', value: '142+' },
              { label: 'Deployed Units', value: '10k+' },
              { label: 'Global Partners', value: '85' },
              { label: 'Uptime Reliability', value: '99.9%' }
            ].map((stat, idx) => (
              <div key={idx} className="p-6 rounded-2xl bg-slate-900/40 backdrop-blur-sm border border-slate-700/30 flex flex-col items-center justify-center">
                <span className="text-3xl font-bold text-white mb-1">{stat.value}</span>
                <span className="text-xs text-slate-400 uppercase tracking-wider">{stat.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

const ProjectsSection = () => {
  return (
    <section id="initiatives" className="py-24 relative z-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-12">
          <div className="max-w-2xl">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">Core Initiatives</h2>
            <p className="text-slate-400">Pioneering solutions across diverse operational domains. Our robotic platforms are built on proprietary cognitive architectures.</p>
          </div>
          <a href="#" className="hidden md:inline-flex items-center gap-2 text-cyan-400 hover:text-cyan-300 font-medium transition-colors">
            View All Projects <ArrowUpRight className="w-4 h-4" />
          </a>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {projects.map((project) => (
            <div 
              key={project.id}
              className="group p-8 rounded-3xl bg-slate-900/30 backdrop-blur-md border border-slate-700/40 hover:bg-slate-800/40 hover:border-slate-600/50 transition-all duration-500 relative overflow-hidden"
            >
              {/* Subtle hover gradient background */}
              <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/0 via-transparent to-blue-600/0 group-hover:from-cyan-500/5 group-hover:to-blue-600/5 transition-all duration-500" />
              
              <div className="relative z-10">
                <div className="w-16 h-16 rounded-2xl bg-slate-800/80 border border-slate-600/50 flex items-center justify-center mb-6 shadow-lg">
                  {project.icon}
                </div>
                
                <span className="text-xs font-semibold text-cyan-400 tracking-wider uppercase mb-2 block">
                  {project.category}
                </span>
                
                <h3 className="text-2xl font-bold text-white mb-3 group-hover:text-cyan-100 transition-colors">
                  {project.title}
                </h3>
                
                <p className="text-slate-400 leading-relaxed mb-6">
                  {project.description}
                </p>
                
                <button className="flex items-center gap-2 text-sm font-medium text-white group-hover:text-cyan-400 transition-colors">
                  Technical Specs <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

const TechnologySection = () => {
  return (
    <section id="technology" className="py-24 relative z-10 bg-slate-950/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">Proprietary Technology Stack</h2>
          <p className="text-slate-400">Our hardware and software systems are developed entirely in-house to ensure seamless integration, maximum efficiency, and uncompromised security.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Feature 1 */}
          <div className="p-8 rounded-3xl bg-gradient-to-b from-slate-800/40 to-slate-900/40 backdrop-blur-sm border border-slate-700/50 relative overflow-hidden">
             <div className="absolute top-0 right-0 p-6 opacity-10">
               <Cpu className="w-32 h-32 text-white" />
             </div>
             <div className="relative z-10">
               <div className="w-12 h-12 rounded-full bg-cyan-900/50 flex items-center justify-center mb-6 border border-cyan-500/30">
                 <Zap className="w-6 h-6 text-cyan-400" />
               </div>
               <h3 className="text-xl font-bold text-white mb-3">Neural Processing Units</h3>
               <p className="text-slate-400 text-sm leading-relaxed">
                 Custom silicon designed specifically for executing deep learning models at the edge, requiring minimal power while delivering teraflops of compute.
               </p>
             </div>
          </div>

          {/* Feature 2 */}
          <div className="p-8 rounded-3xl bg-gradient-to-b from-slate-800/40 to-slate-900/40 backdrop-blur-sm border border-slate-700/50 relative overflow-hidden">
             <div className="absolute top-0 right-0 p-6 opacity-10">
               <Activity className="w-32 h-32 text-white" />
             </div>
             <div className="relative z-10">
               <div className="w-12 h-12 rounded-full bg-blue-900/50 flex items-center justify-center mb-6 border border-blue-500/30">
                 <Bot className="w-6 h-6 text-blue-400" />
               </div>
               <h3 className="text-xl font-bold text-white mb-3">Swarm Intelligence OS</h3>
               <p className="text-slate-400 text-sm leading-relaxed">
                 A decentralized operating system allowing thousands of individual units to communicate, share sensory data, and make collective decisions in milliseconds.
               </p>
             </div>
          </div>

          {/* Feature 3 */}
          <div className="p-8 rounded-3xl bg-gradient-to-b from-slate-800/40 to-slate-900/40 backdrop-blur-sm border border-slate-700/50 relative overflow-hidden">
             <div className="absolute top-0 right-0 p-6 opacity-10">
               <Shield className="w-32 h-32 text-white" />
             </div>
             <div className="relative z-10">
               <div className="w-12 h-12 rounded-full bg-purple-900/50 flex items-center justify-center mb-6 border border-purple-500/30">
                 <Shield className="w-6 h-6 text-purple-400" />
               </div>
               <h3 className="text-xl font-bold text-white mb-3">Quantum Encryption</h3>
               <p className="text-slate-400 text-sm leading-relaxed">
                 Military-grade telemetry protection utilizing quantum key distribution to ensure remote operation links cannot be intercepted or hijacked.
               </p>
             </div>
          </div>
        </div>
      </div>
    </section>
  );
};

const Footer = () => {
  return (
    <footer className="relative z-10 border-t border-slate-800 bg-slate-950/80 backdrop-blur-lg pt-16 pb-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-12">
          
          {/* Brand Col */}
          <div className="md:col-span-1">
            <div className="flex items-center gap-2 mb-6">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center">
                <Bot className="w-5 h-5 text-white" />
              </div>
              <span className="text-lg font-bold text-white">Nexus Robotics</span>
            </div>
            <p className="text-slate-400 text-sm leading-relaxed mb-6">
              Building the physical interface for artificial intelligence. Headquartered in Neo-Tokyo.
            </p>
            <div className="flex items-center gap-4">
              <a href="#" className="text-slate-400 hover:text-white transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 4s-.7 2.1-2 3.4c1.6 10-9.4 17.3-18 11.6 2.2.1 4.4-.6 6-2C3 15.5.5 9.6 3 5c2.2 2.6 5.6 4.1 9 4-.9-4.2 4-6.6 7-3.8 1.1 0 3-1.2 3-1.2z"/></svg>
              </a>
              <a href="#" className="text-slate-400 hover:text-white transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4"/><path d="M9 18c-4.51 2-5-2-7-2"/></svg>
              </a>
              <a href="#" className="text-slate-400 hover:text-white transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/><rect width="4" height="12" x="2" y="9"/><circle cx="4" cy="4" r="2"/></svg>
              </a>
            </div>
          </div>

          {/* Links Cols */}
          <div>
            <h4 className="text-white font-semibold mb-4">Platforms</h4>
            <ul className="space-y-2">
              {['A.E.G.I.S. Sentinel', 'Valkyrie Drones', 'Titan Industrial', 'Medical Prosthetics'].map(link => (
                <li key={link}><a href="#" className="text-slate-400 hover:text-cyan-400 text-sm transition-colors">{link}</a></li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="text-white font-semibold mb-4">Company</h4>
            <ul className="space-y-2">
              {['About Us', 'Leadership', 'Careers', 'Press Kit', 'Investor Relations'].map(link => (
                <li key={link}><a href="#" className="text-slate-400 hover:text-cyan-400 text-sm transition-colors">{link}</a></li>
              ))}
            </ul>
          </div>

          {/* Contact Col */}
          <div>
            <h4 className="text-white font-semibold mb-4">Stay Updated</h4>
            <p className="text-slate-400 text-sm mb-4">Subscribe to our newsletter for the latest breakthroughs.</p>
            <div className="flex gap-2">
              <input 
                type="email" 
                placeholder="Enter email" 
                className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500 w-full"
              />
              <button className="bg-slate-800 hover:bg-slate-700 text-white px-3 py-2 rounded-lg border border-slate-600 transition-colors">
                <Mail className="w-4 h-4" />
              </button>
            </div>
          </div>

        </div>
        
        <div className="pt-8 border-t border-slate-800 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-slate-500 text-sm">© 2026 Nexus Robotics Inc. All rights reserved.</p>
          <div className="flex gap-6">
            <a href="#" className="text-slate-500 hover:text-white text-sm transition-colors">Privacy Policy</a>
            <a href="#" className="text-slate-500 hover:text-white text-sm transition-colors">Terms of Service</a>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default function NextJsRoboticsSite() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 font-sans selection:bg-cyan-500/30">
      <AmbientBackground />
      <Navbar />
      
      <main>
        <Hero />
        <ProjectsSection />
        <TechnologySection />
      </main>

      <Footer />
    </div>
  );
}