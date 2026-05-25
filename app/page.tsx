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
  ArrowUpRight,
  Trophy
} from 'lucide-react';

// Mock data for competitions
const competitions = [
  {
    id: 1,
    title: "FIRST Robotics Championship",
    status: "Active",
    date: "April 2024",
    location: "Detroit, Michigan",
    description: "Our flagship competition where Team 1 competes in the FIRST Robotics Competition (FRC).",
    icon: <Trophy className="w-8 h-8 text-red-400" />
  },
  {
    id: 2,
    title: "VEX Robotics World Championship",
    status: "Active",
    date: "May 2024",
    location: "Dallas, Texas",
    description: "Team 2 showcasing advanced engineering at the VEX Robotics Competition.",
    icon: <Rocket className="w-8 h-8 text-yellow-400" />
  },
  {
    id: 3,
    title: "International Robotics Olympiad",
    status: "Recent",
    date: "March 2024",
    location: "Bangkok, Thailand",
    description: "Participated in autonomous systems challenges and robotic sports competitions.",
    icon: <Activity className="w-8 h-8 text-red-300" />
  },
  {
    id: 4,
    title: "Robotic Sumo Competition",
    status: "Recent",
    date: "February 2024",
    location: "Singapore",
    description: "Our compact sumo robots competed in precision and agility challenges.",
    icon: <Zap className="w-8 h-8 text-yellow-500" />
  }
];

// Team members data
const team1Members = [
  {
    id: 1,
    name: "Alex Chen",
    role: "Team Lead",
    specialty: "Systems Integration"
  },
  {
    id: 2,
    name: "Sarah Williams",
    role: "Lead Engineer",
    specialty: "Mechanical Design"
  },
  {
    id: 3,
    name: "Marcus Johnson",
    role: "Programmer",
    specialty: "Autonomous Systems"
  },
  {
    id: 4,
    name: "Emily Davis",
    role: "Electrical Engineer",
    specialty: "Circuit Design"
  }
];

const team2Members = [
  {
    id: 5,
    name: "David Kumar",
    role: "Team Lead",
    specialty: "Strategy & Competition"
  },
  {
    id: 6,
    name: "Jessica Lee",
    role: "Lead Programmer",
    specialty: "Control Systems"
  },
  {
    id: 7,
    name: "Thomas Brown",
    role: "Mechanical Designer",
    specialty: "Robot Mechanics"
  },
  {
    id: 8,
    name: "Maria Garcia",
    role: "Business Manager",
    specialty: "Sponsorships & Logistics"
  }
];

// A futuristic background with floating glowing orbs to enhance the glassmorphic effect
const AmbientBackground = () => (
  <div className="fixed inset-0 z-[-1] bg-slate-950 overflow-hidden">
    <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-red-900/20 blur-[120px] mix-blend-screen" />
    <div className="absolute bottom-[-10%] right-[-5%] w-[40%] h-[60%] rounded-full bg-yellow-900/20 blur-[100px] mix-blend-screen" />
    <div className="absolute top-[40%] left-[60%] w-[30%] h-[30%] rounded-full bg-red-800/10 blur-[90px] mix-blend-screen" />
    {/* Grid overlay for a tech feel */}
    <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAwIDEwIEwgNDAgMTAgTSAxMCAwIEwgMTAgNDAiIGZpbGw9Im5vbmUiIHN0cm9rZT0icmdiYSgyNTUsMjU1LDI1NSwwLjAyKSIgc3Ryb2tlLXdpZHRoPSIxIi8+PC9wYXR0ZXJuPjwvZGVmcz48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJ1cmwoI2dyaWQpIi8+PC9zdmc+')] opacity-50" />
  </div>
);

const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [activeLink, setActiveLink] = useState('');

  // Handle scroll effect for glass navbar
  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navItems = ['Competitions', 'About Us', 'Teams', 'Technology'];

  return (
    <nav className={`fixed w-full z-50 transition-all duration-300 ${scrolled ? 'py-2' : 'py-4'}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className={`
          flex items-center justify-between px-6 py-3 rounded-xl transition-all duration-300
          ${scrolled 
            ? 'bg-slate-950/70 backdrop-blur-xl border border-slate-700/40 shadow-2xl shadow-slate-900/30' 
            : 'bg-slate-950/40 backdrop-blur-lg border border-slate-700/30'}
        `}>
          {/* Logo */}
          <div className="flex items-center gap-3 group cursor-pointer">
            <div className="relative">
              <img 
                src="/Images/logo1.jpg" 
                alt="QCU Robotics Logo" 
                className="w-11 h-11 rounded-lg object-cover shadow-lg group-hover:shadow-red-500/50 transition-shadow duration-300" 
              />
              <div className="absolute inset-0 rounded-lg bg-gradient-to-br from-red-500/20 to-yellow-500/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-bold text-white">QCU</span>
              <span className="text-xs font-bold bg-clip-text text-transparent bg-gradient-to-r from-red-400 to-yellow-400 leading-tight">
                ROBOTICS
              </span>
            </div>
          </div>

          {/* Desktop Menu */}
          <div className="hidden md:flex items-center gap-1">
            {navItems.map((item) => (
              <a 
                key={item} 
                href={`#${item.toLowerCase()}`}
                onMouseEnter={() => setActiveLink(item)}
                onMouseLeave={() => setActiveLink('')}
                className="relative px-3 py-2 text-sm font-medium text-slate-300 hover:text-white transition-colors group"
              >
                {item}
                <span className={`absolute bottom-0 left-3 right-3 h-0.5 bg-gradient-to-r from-red-500 to-yellow-500 rounded-full transition-all duration-300 ${
                  activeLink === item ? 'opacity-100 scale-x-100' : 'opacity-0 scale-x-0'
                }`} />
              </a>
            ))}
          </div>

          {/* CTA Button */}
          <div className="hidden md:flex items-center gap-4">
            <button className="group relative px-6 py-2.5 rounded-lg font-medium text-white text-sm overflow-hidden">
              {/* Animated background */}
              <div className="absolute inset-0 bg-gradient-to-r from-red-600 to-red-700 rounded-lg transition-all duration-300 group-hover:shadow-lg group-hover:shadow-red-500/50" />
              <div className="absolute inset-0 bg-gradient-to-r from-red-500 to-yellow-500 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <span className="relative flex items-center gap-2 justify-center">
                Join Team
                <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform duration-300" />
              </span>
            </button>
          </div>

          {/* Mobile Menu Button */}
          <div className="md:hidden">
            <button 
              onClick={() => setIsOpen(!isOpen)}
              className="text-slate-300 hover:text-red-400 p-2 rounded-lg hover:bg-slate-800/50 transition-all duration-300"
            >
              {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Menu Dropdown */}
        {isOpen && (
          <div className="md:hidden mt-3 p-5 rounded-xl bg-slate-950/80 backdrop-blur-xl border border-slate-700/50 shadow-2xl shadow-slate-900/30 animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="flex flex-col space-y-3">
              {navItems.map((item) => (
                <a 
                  key={item} 
                  href={`#${item.toLowerCase()}`} 
                  className="text-slate-300 hover:text-red-400 font-medium px-3 py-2 rounded-lg hover:bg-slate-800/50 transition-all duration-300"
                  onClick={() => setIsOpen(false)}
                >
                  {item}
                </a>
              ))}
              <button className="w-full mt-2 px-5 py-3 rounded-lg bg-gradient-to-r from-red-600 to-red-700 text-white font-semibold hover:shadow-lg hover:shadow-red-500/50 transition-all duration-300 flex items-center justify-center gap-2 group">
                Join Team
                <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform duration-300" />
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
    "/Images/678235897_1485046506604187_4125957943912417164_n.jpg",
    "/Images/678299297_1459872215195693_2358093542589606207_n (1).jpg",
    "/Images/678314792_1746064756186419_4411744446890772271_n.jpg",
    "/Images/682477686_1365069988975435_6372022281528030398_n.jpg",
    "/Images/685920531_944634058361196_8201555872037207606_n.jpg"
  ];

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentImage((prev) => (prev + 1) % carouselImages.length);
    }, 4000); // Auto-advance every 4 seconds
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="relative overflow-hidden">
      {/* Hero with Carousel Background */}
      <div className="relative pt-32 pb-12 sm:pt-40 sm:pb-16 overflow-hidden">
        {/* Auto-scrolling Image Carousel Background */}
        <div className="absolute inset-0 h-full w-full">
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
                {/* Glassy overlay for better text readability */}
                <div className="absolute inset-0 bg-slate-900/60 mix-blend-multiply" />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/30 to-transparent" />
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
                  idx === currentImage ? "w-10 bg-red-500 shadow-[0_0_10px_rgba(220,20,60,0.8)]" : "w-3 bg-slate-500/50 hover:bg-slate-400/80"
                }`}
                aria-label={`Go to slide ${idx + 1}`}
              />
            ))}
          </div>
        </div>

        {/* Hero Content - Centered Text */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 w-full text-center">
          
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-slate-800/50 backdrop-blur-md border border-slate-700/50 mb-8">
            <span className="flex h-2 w-2 rounded-full bg-red-500 shadow-[0_0_8px_rgba(220,20,60,0.8)] animate-pulse" />
            <span className="text-xs font-medium text-slate-300 tracking-wider uppercase">Competing at the Highest Level</span>
          </div>

          {/* Main Headline */}
          <h1 className="text-5xl sm:text-6xl md:text-7xl font-extrabold text-white tracking-tight mb-6">
            QCU Robotics <br className="hidden sm:block" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-400 via-yellow-500 to-red-500">
               Alpha & Beta
            </span>
          </h1>
          
          {/* Subtitle */}
          <p className="mt-4 text-lg sm:text-xl text-slate-400 max-w-2xl mx-auto mb-10 font-light leading-relaxed">
            Building excellence through innovation and teamwork. QCU Robotics brings cutting-edge engineering to international robotics competitions with two competitive teams.
          </p>
          
          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <button className="px-8 py-4 rounded-xl bg-white text-slate-950 font-semibold hover:bg-slate-200 transition-colors flex items-center justify-center gap-2 shadow-[0_0_30px_rgba(255,255,255,0.2)]">
              View Competitions
              <ChevronRight className="w-5 h-5" />
            </button>
            <button className="px-8 py-4 rounded-xl bg-slate-800/40 backdrop-blur-md border border-slate-600/50 text-white font-medium hover:bg-slate-800/60 transition-all flex items-center justify-center gap-2">
              Meet Our Teams
            </button>
          </div>
        </div>
      </div>

      {/* Stats Glass Panel */}
      <div className="relative pt-0 pb-16 sm:pb-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 w-full">
          <div className="mt-0 grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto">
            {[
              { label: 'Competitions', value: '12+' },
              { label: 'International Awards', value: '8' },
              { label: 'Team Members', value: '45+' },
              { label: 'Championships', value: '3' }
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

const CompetitionsSection = () => {
  return (
    <section id="competitions" className="py-24 relative z-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-12">
          <div className="max-w-2xl">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">Competitions & Achievements</h2>
            <p className="text-slate-400">QCU Robotics competes at the highest level, showcasing innovation and engineering excellence across multiple prestigious competitions worldwide.</p>
          </div>
          <a href="#" className="hidden md:inline-flex items-center gap-2 text-red-400 hover:text-red-300 font-medium transition-colors">
            View All Events <ArrowUpRight className="w-4 h-4" />
          </a>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {competitions.map((comp) => (
            <div 
              key={comp.id}
              className="group p-8 rounded-3xl bg-slate-900/30 backdrop-blur-md border border-slate-700/40 hover:bg-slate-800/40 hover:border-slate-600/50 transition-all duration-500 relative overflow-hidden"
            >
              {/* Subtle hover gradient background */}
              <div className="absolute inset-0 bg-gradient-to-br from-red-500/0 via-transparent to-yellow-600/0 group-hover:from-red-500/5 group-hover:to-yellow-600/5 transition-all duration-500" />
              
              <div className="relative z-10">
                <div className="w-16 h-16 rounded-2xl bg-slate-800/80 border border-slate-600/50 flex items-center justify-center mb-6 shadow-lg">
                  {comp.icon}
                </div>
                
                <div className="flex items-center gap-2 mb-3">
                  <span className={`text-xs font-semibold px-3 py-1 rounded-full ${
                    comp.status === 'Active' 
                      ? 'bg-green-500/20 text-green-400 border border-green-500/30' 
                      : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                  }`}>
                    {comp.status}
                  </span>
                  <span className="text-xs text-slate-400">{comp.date}</span>
                </div>
                
                <h3 className="text-2xl font-bold text-white mb-2 group-hover:text-red-100 transition-colors">
                  {comp.title}
                </h3>

                <p className="text-slate-400 text-sm mb-3">{comp.location}</p>
                
                <p className="text-slate-400 leading-relaxed mb-6">
                  {comp.description}
                </p>
                
                <button className="flex items-center gap-2 text-sm font-medium text-white group-hover:text-red-400 transition-colors">
                  Learn More <ChevronRight className="w-4 h-4" />
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
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">Our Technical Capabilities</h2>
          <p className="text-slate-400">Cutting-edge engineering combining mechanical design, advanced programming, and innovative systems to create competitive advantage.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Feature 1 */}
          <div className="p-8 rounded-3xl bg-gradient-to-b from-slate-800/40 to-slate-900/40 backdrop-blur-sm border border-slate-700/50 relative overflow-hidden">
             <div className="absolute top-0 right-0 p-6 opacity-10">
               <Cpu className="w-32 h-32 text-white" />
             </div>
             <div className="relative z-10">
               <div className="w-12 h-12 rounded-full bg-red-900/50 flex items-center justify-center mb-6 border border-red-500/30">
                 <Zap className="w-6 h-6 text-red-400" />
               </div>
               <h3 className="text-xl font-bold text-white mb-3">Advanced Programming</h3>
               <p className="text-slate-400 text-sm leading-relaxed">
                 Custom algorithms and autonomous systems enabling intelligent decision-making and real-time adaptation during competitions.
               </p>
             </div>
          </div>

          {/* Feature 2 */}
          <div className="p-8 rounded-3xl bg-gradient-to-b from-slate-800/40 to-slate-900/40 backdrop-blur-sm border border-slate-700/50 relative overflow-hidden">
             <div className="absolute top-0 right-0 p-6 opacity-10">
               <Activity className="w-32 h-32 text-white" />
             </div>
             <div className="relative z-10">
               <div className="w-12 h-12 rounded-full bg-yellow-900/50 flex items-center justify-center mb-6 border border-yellow-500/30">
                 <Bot className="w-6 h-6 text-yellow-400" />
               </div>
               <h3 className="text-xl font-bold text-white mb-3">Mechanical Design</h3>
               <p className="text-slate-400 text-sm leading-relaxed">
                 Precision engineering and innovative mechanical systems designed to withstand intense competition while maximizing performance.
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
               <h3 className="text-xl font-bold text-white mb-3">Systems Integration</h3>
               <p className="text-slate-400 text-sm leading-relaxed">
                 Seamless integration of electrical, mechanical, and software components ensuring reliable performance under competition conditions.
               </p>
             </div>
          </div>
        </div>
      </div>
    </section>
  );
};

const AboutSection = () => {
  return (
    <section id="about us" className="py-24 relative z-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          {/* Left - Image/Content */}
          <div className="rounded-3xl overflow-hidden border border-slate-700/50 shadow-[0_0_40px_rgba(220,20,60,0.15)]">
            <img 
              src="/Images/678235897_1485046506604187_4125957943912417164_n.jpg" 
              alt="QCU Robotics Team"
              className="w-full h-96 object-cover"
            />
          </div>

          {/* Right - Text Content */}
          <div>
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">About QCU Robotics</h2>
            
            <div className="space-y-4 mb-8">
              <p className="text-slate-400 leading-relaxed">
                QCU Robotics is a premier competitive robotics organization dedicated to fostering innovation, teamwork, and technical excellence. Our organization brings together talented engineers, programmers, and designers who share a passion for robotics.
              </p>
              
              <p className="text-slate-400 leading-relaxed">
                With two competitive teams, we participate in international robotics competitions including FIRST Robotics, VEX Robotics, and specialized robotic sports events. Our mission is to inspire the next generation of engineers while pushing the boundaries of what's possible in robotics technology.
              </p>

              <p className="text-slate-400 leading-relaxed">
                Built on a foundation of collaboration and continuous improvement, QCU Robotics has established itself as a powerhouse in the competitive robotics community.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-6 mb-8">
              <div className="p-6 rounded-2xl bg-slate-900/40 backdrop-blur-sm border border-slate-700/30">
                <span className="text-2xl font-bold text-red-400">2</span>
                <p className="text-slate-400 text-sm mt-2">Competitive Teams</p>
              </div>
              <div className="p-6 rounded-2xl bg-slate-900/40 backdrop-blur-sm border border-slate-700/30">
                <span className="text-2xl font-bold text-red-400">45+</span>
                <p className="text-slate-400 text-sm mt-2">Active Members</p>
              </div>
            </div>

            <button className="px-8 py-3 rounded-xl bg-red-600/80 backdrop-blur-sm border border-red-500/50 text-white font-medium hover:bg-red-700/80 transition-all shadow-[0_0_15px_rgba(220,20,60,0.2)] hover:shadow-[0_0_20px_rgba(220,20,60,0.4)]">
              Join Our Community
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};

const TeamMembersSection = () => {
  return (
    <section id="teams" className="py-24 relative z-10 bg-slate-950/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">Meet Our Teams</h2>
          <p className="text-slate-400">Dedicated engineers and innovators working together to achieve excellence in competitive robotics.</p>
        </div>

        {/* Team 1 */}
        <div className="mb-16">
          <h3 className="text-2xl font-bold text-white mb-8 flex items-center gap-3">
            <span className="inline-block w-3 h-3 rounded-full bg-red-500"></span>
            Team 1 - FIRST Robotics Division
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {team1Members.map((member) => (
              <div 
                key={member.id}
                className="p-6 rounded-2xl bg-slate-900/30 backdrop-blur-md border border-slate-700/40 hover:bg-slate-800/40 hover:border-slate-600/50 transition-all duration-300"
              >
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-red-500/20 to-yellow-500/20 border border-red-500/30 flex items-center justify-center mb-4 mx-auto">
                  <span className="text-2xl font-bold text-red-400">{member.name.charAt(0)}</span>
                </div>
                <h4 className="text-lg font-bold text-white text-center mb-1">{member.name}</h4>
                <p className="text-sm text-red-400 text-center mb-2 font-medium">{member.role}</p>
                <p className="text-xs text-slate-400 text-center">{member.specialty}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Team 2 */}
        <div>
          <h3 className="text-2xl font-bold text-white mb-8 flex items-center gap-3">
            <span className="inline-block w-3 h-3 rounded-full bg-yellow-500"></span>
            Team 2 - VEX Robotics Division
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {team2Members.map((member) => (
              <div 
                key={member.id}
                className="p-6 rounded-2xl bg-slate-900/30 backdrop-blur-md border border-slate-700/40 hover:bg-slate-800/40 hover:border-slate-600/50 transition-all duration-300"
              >
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-yellow-500/20 to-red-500/20 border border-yellow-500/30 flex items-center justify-center mb-4 mx-auto">
                  <span className="text-2xl font-bold text-yellow-400">{member.name.charAt(0)}</span>
                </div>
                <h4 className="text-lg font-bold text-white text-center mb-1">{member.name}</h4>
                <p className="text-sm text-yellow-400 text-center mb-2 font-medium">{member.role}</p>
                <p className="text-xs text-slate-400 text-center">{member.specialty}</p>
              </div>
            ))}
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
              <img src="/Images/678235897_1485046506604187_4125957943912417164_n.jpg" alt="QCU Logo" className="w-8 h-8 rounded-lg object-cover" />
              <span className="text-lg font-bold text-white">QCU ROBOTICS</span>
            </div>
            <p className="text-slate-400 text-sm leading-relaxed mb-6">
              Competing at the highest level. QCU Robotics Team brings innovation and excellence to international robotics competitions.
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
            <h4 className="text-white font-semibold mb-4">Competitions</h4>
            <ul className="space-y-2">
              {['FIRST Robotics', 'VEX Robotics', 'Robotic Sumo', 'Aerial Robotics'].map(link => (
                <li key={link}><a href="#" className="text-slate-400 hover:text-red-400 text-sm transition-colors">{link}</a></li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="text-white font-semibold mb-4">Organization</h4>
            <ul className="space-y-2">
              {['About QCU Robotics', 'Our Teams', 'Achievements', 'Community Partners'].map(link => (
                <li key={link}><a href="#" className="text-slate-400 hover:text-red-400 text-sm transition-colors">{link}</a></li>
              ))}
            </ul>
          </div>

          {/* Contact Col */}
          <div>
            <h4 className="text-white font-semibold mb-4">Get Involved</h4>
            <p className="text-slate-400 text-sm mb-4">Join our mailing list for updates on competitions and team announcements.</p>
            <div className="flex gap-2">
              <input 
                type="email" 
                placeholder="Enter email" 
                className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-red-500 w-full"
              />
              <button className="bg-slate-800 hover:bg-slate-700 text-white px-3 py-2 rounded-lg border border-slate-600 transition-colors">
                <Mail className="w-4 h-4" />
              </button>
            </div>
          </div>

        </div>
        
        <div className="pt-8 border-t border-slate-800 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-slate-500 text-sm">© 2026 QCU Robotics. All rights reserved.</p>
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
    <div className="min-h-screen bg-slate-950 text-slate-50 font-sans selection:bg-red-500/30">
      <AmbientBackground />
      <Navbar />
      
      <main>
        <Hero />
        <CompetitionsSection />
        <AboutSection />
        <TeamMembersSection />
        <TechnologySection />
      </main>

      <Footer />
    </div>
  );
}