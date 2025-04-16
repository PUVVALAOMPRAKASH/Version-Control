
import React from 'react';
import { Github, Linkedin, Twitter } from "lucide-react";

const teamMembers = [
  {
    name: "Alex Johnson",
    role: "Lead Developer",
    bio: "Full-stack developer with 8+ years of experience in version control systems and distributed applications.",
    image: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=200&h=200&fit=crop"
  },
  {
    name: "Samantha Lee",
    role: "Product Designer",
    bio: "UX/UI designer focused on creating intuitive interfaces that make complex version control simple for everyone.",
    image: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=200&h=200&fit=crop"
  },
  {
    name: "Michael Rodriguez",
    role: "DevOps Engineer",
    bio: "Cloud infrastructure expert ensuring our version control system is fast, reliable, and secure at any scale.",
    image: "https://images.unsplash.com/photo-1500048993953-d23a436266cf?q=80&w=200&h=200&fit=crop"
  }
];

const TeamSection = () => {
  return (
    <div id="team" className="py-20 bg-gradient-to-br from-gray-50 to-purple-50">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold mb-4 text-brand-dark">Meet Our Team</h2>
          <p className="text-lg text-gray-600 max-w-3xl mx-auto">
            Talented professionals dedicated to making version control accessible to everyone
          </p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {teamMembers.map((member, index) => (
            <div key={index} className="bg-white rounded-xl overflow-hidden shadow-md transition-all duration-300 hover:-translate-y-2 hover:shadow-lg">
              <div className="p-6">
                <div className="w-32 h-32 mx-auto mb-6 rounded-full overflow-hidden border-4 border-brand-purple/20">
                  <img 
                    src={member.image} 
                    alt={member.name} 
                    className="w-full h-full object-cover"
                  />
                </div>
                <h3 className="text-xl font-semibold mb-1 text-center text-brand-dark">{member.name}</h3>
                <p className="text-brand-purple text-center mb-4">{member.role}</p>
                <p className="text-gray-600 text-center mb-6">{member.bio}</p>
                <div className="flex justify-center space-x-4">
                  <a href="#" className="text-gray-400 hover:text-brand-pink transition-colors">
                    <Twitter size={20} />
                  </a>
                  <a href="#" className="text-gray-400 hover:text-brand-blue transition-colors">
                    <Linkedin size={20} />
                  </a>
                  <a href="#" className="text-gray-400 hover:text-brand-purple transition-colors">
                    <Github size={20} />
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default TeamSection;
