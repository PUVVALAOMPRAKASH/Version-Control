import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Menu, X } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import { logoutUser } from "@/lib/authService";

const Navbar = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { currentUser, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 10) {
        setIsScrolled(true);
      } else {
        setIsScrolled(false);
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
      setMobileMenuOpen(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logoutUser();
      navigate('/');
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${isScrolled ? 'bg-white shadow-md py-2' : 'bg-transparent py-4'}`}>
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center">
          <div className="flex items-center">
            <Link to="/" className="text-2xl font-bold text-brand-purple mr-8">VersionControl</Link>
            <div className="hidden md:flex space-x-8">
              <button onClick={() => scrollToSection('about')} className="font-medium hover:text-brand-purple">About</button>
              <button onClick={() => scrollToSection('team')} className="font-medium hover:text-brand-purple">Team</button>
              <button onClick={() => scrollToSection('contact')} className="font-medium hover:text-brand-purple">Contact Us</button>
            </div>
          </div>
          
          <div className="hidden md:flex space-x-4">
            {!loading && (
              currentUser ? (
                <>
                  <Link to="/home">
                    <Button variant="outline" className="font-medium">Dashboard</Button>
                  </Link>
                  <Button 
                    onClick={handleLogout} 
                    className="font-medium bg-brand-purple hover:bg-brand-purple/90"
                  >
                    Logout
                  </Button>
                </>
              ) : (
                <>
                  <Link to="/signup">
                    <Button variant="outline" className="font-medium">Sign Up</Button>
                  </Link>
                  <Link to="/login">
                    <Button className="font-medium bg-brand-purple hover:bg-brand-purple/90">Login</Button>
                  </Link>
                </>
              )
            )}
          </div>
          
          <div className="md:hidden">
            <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="text-gray-700">
              {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>
      </div>
      
      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-white shadow-lg">
          <div className="px-4 py-2 space-y-2">
            <button onClick={() => scrollToSection('about')} className="block w-full text-left py-2 font-medium hover:text-brand-purple">About</button>
            <button onClick={() => scrollToSection('team')} className="block w-full text-left py-2 font-medium hover:text-brand-purple">Team</button>
            <button onClick={() => scrollToSection('contact')} className="block w-full text-left py-2 font-medium hover:text-brand-purple">Contact Us</button>
            <div className="flex space-x-2 pt-2">
              {!loading && (
                currentUser ? (
                  <>
                    <Link to="/home" className="flex-1">
                      <Button variant="outline" className="w-full font-medium">Dashboard</Button>
                    </Link>
                    <Button 
                      onClick={handleLogout} 
                      className="flex-1 w-full font-medium bg-brand-purple hover:bg-brand-purple/90"
                    >
                      Logout
                    </Button>
                  </>
                ) : (
                  <>
                    <Link to="/signup" className="flex-1">
                      <Button variant="outline" className="w-full font-medium">Sign Up</Button>
                    </Link>
                    <Link to="/login" className="flex-1">
                      <Button className="w-full font-medium bg-brand-purple hover:bg-brand-purple/90">Login</Button>
                    </Link>
                  </>
                )
              )}
            </div>
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
