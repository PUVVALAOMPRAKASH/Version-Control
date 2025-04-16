
import React from 'react';
import { Button } from "@/components/ui/button";
import { GitBranch, GitMerge, GitPullRequest } from "lucide-react";

const HeroSection = () => {
  return (
    <div id="about" className="pt-28 pb-20 github-gradient hero-gradient">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row items-center">
          <div className="md:w-1/2 mb-10 md:mb-0">
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold mb-4 leading-tight">
              Version Control for <span className="gradient-text">Everyone</span>
            </h1>
            <p className="text-lg md:text-xl text-gray-300 mb-8">
              A powerful, easy-to-use platform for managing file versions. 
              Perfect for developers, designers, and teams of all sizes.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Button className="bg-brand-purple hover:bg-brand-purple/90 text-lg py-6 px-8">Get Started</Button>
              <Button variant="outline" className="text-lg py-6 px-8 border-brand-purple text-brand-purple hover:bg-brand-purple/10">View Documentation</Button>
            </div>
          </div>
          <div className="md:w-1/2 md:pl-12">
            <div className="relative glass-card rounded-xl shadow-xl p-6 border border-gray-700">
              <div className="absolute -top-6 -right-6 bg-brand-blue text-white p-3 rounded-lg shadow-lg">
                <GitMerge size={28} />
              </div>
              <div className="flex items-center mb-6">
                <GitBranch className="text-brand-purple mr-2" size={20} />
                <div className="h-2 w-2 rounded-full bg-green-500 mr-2"></div>
                <h3 className="font-semibold text-white">main</h3>
              </div>
              <div className="space-y-4">
                <div className="flex items-start">
                  <div className="bg-gray-800 rounded-full h-10 w-10 flex items-center justify-center mr-3 mt-1">
                    <span className="font-medium text-xs text-gray-200">JD</span>
                  </div>
                  <div className="bg-gray-800/50 rounded-lg p-4 flex-1">
                    <p className="font-medium text-white">Updated dashboard component</p>
                    <p className="text-sm text-gray-400">2 hours ago</p>
                  </div>
                </div>
                <div className="flex items-start">
                  <div className="bg-gray-800 rounded-full h-10 w-10 flex items-center justify-center mr-3 mt-1">
                    <span className="font-medium text-xs text-gray-200">SL</span>
                  </div>
                  <div className="bg-gray-800/50 rounded-lg p-4 flex-1">
                    <p className="font-medium text-white">Fixed responsiveness issues</p>
                    <p className="text-sm text-gray-400">Yesterday</p>
                  </div>
                </div>
                <div className="flex items-start">
                  <div className="bg-brand-purple/20 rounded-full h-10 w-10 flex items-center justify-center mr-3 mt-1">
                    <GitPullRequest className="text-brand-purple" size={18} />
                  </div>
                  <div className="bg-gray-800/50 rounded-lg p-4 flex-1">
                    <p className="font-medium text-white">Merge pull request #42</p>
                    <p className="text-sm text-gray-400">2 days ago</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HeroSection;
