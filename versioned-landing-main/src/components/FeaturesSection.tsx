
import React from 'react';
import { GitBranch, GitMerge, History, Share2, Shield, Users } from "lucide-react";

const features = [
  {
    icon: <GitBranch className="text-brand-purple" size={24} />,
    title: "Branching & Merging",
    description: "Create branches to work on features without affecting the main codebase, then merge when ready."
  },
  {
    icon: <History className="text-brand-pink" size={24} />,
    title: "Complete History",
    description: "View a detailed timeline of all changes made to your files with ability to revert to any point."
  },
  {
    icon: <Users className="text-brand-blue" size={24} />,
    title: "Team Collaboration",
    description: "Work together seamlessly with built-in tools for reviewing, commenting, and approving changes."
  },
  {
    icon: <Shield className="text-brand-teal" size={24} />,
    title: "Secure Versioning",
    description: "Enterprise-grade security ensures your code and sensitive files are protected at all times."
  },
  {
    icon: <Share2 className="text-brand-orange" size={24} />,
    title: "Integrated Sharing",
    description: "Share specific versions with stakeholders using secure, temporary access links."
  },
  {
    icon: <GitMerge className="text-brand-green" size={24} />,
    title: "Conflict Resolution",
    description: "Smart tools to help detect and resolve merge conflicts quickly and efficiently."
  }
];

const FeaturesSection = () => {
  return (
    <div className="py-20 github-gradient">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold mb-4 gradient-text">Powerful Features</h2>
          <p className="text-lg text-gray-300 max-w-3xl mx-auto">
            Our version control system comes with everything you need to manage projects of any size
          </p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <div key={index} className="glass-card rounded-xl p-6 hover:shadow-xl transition-shadow duration-300 hover:translate-y-[-4px] transform transition-transform">
              <div className="bg-black/30 rounded-lg h-12 w-12 flex items-center justify-center mb-4 shadow-sm">
                {feature.icon}
              </div>
              <h3 className="text-xl font-semibold mb-2 text-white">{feature.title}</h3>
              <p className="text-gray-300">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default FeaturesSection;
