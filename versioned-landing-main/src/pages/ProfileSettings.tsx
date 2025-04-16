import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/lib/AuthContext";
import { ArrowLeft, User, Mail, Lock } from "lucide-react";

const ProfileSettings = () => {
  const navigate = useNavigate();
  const { currentUser, userProfile } = useAuth();
  const [username, setUsername] = useState(userProfile?.username || "");
  const [email] = useState(currentUser?.email || "");

  // Get initials for avatar fallback
  const getInitials = () => {
    if (!userProfile?.username) return "U";
    return userProfile.username.substring(0, 2).toUpperCase();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-violet-800 flex items-center justify-center p-4">
      {/* Background Pattern */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-purple-900/20 via-transparent to-transparent"></div>
      <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center [mask-image:linear-gradient(180deg,white,rgba(255,255,255,0))]"></div>
      
      <div className="w-full max-w-xl z-10">
        <Button 
          variant="ghost" 
          className="mb-4 text-white hover:bg-white/10" 
          onClick={() => navigate(-1)}
        >
          <ArrowLeft className="h-4 w-4 mr-2" /> Back to Dashboard
        </Button>
        
        <Card className="bg-white/10 backdrop-blur-md border-white/10 text-white shadow-xl">
          <CardHeader className="border-b border-white/10 pb-6">
            <CardTitle className="text-2xl font-bold">Profile Settings</CardTitle>
            <CardDescription className="text-gray-300">
              View and manage your account details
            </CardDescription>
          </CardHeader>
          
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row items-center md:items-start gap-6">
              <div className="flex flex-col items-center">
                <Avatar className="h-24 w-24 border-2 border-white/20">
                  <AvatarImage src={currentUser?.photoURL || ""} />
                  <AvatarFallback className="bg-purple-700 text-white text-2xl">
                    {getInitials()}
                  </AvatarFallback>
                </Avatar>
                <Button variant="ghost" className="mt-4 text-sm hover:bg-white/10">
                  Change Avatar
                </Button>
              </div>
              
              <div className="flex-1 space-y-4 w-full">
                <div className="space-y-2">
                  <Label htmlFor="username" className="text-white flex items-center gap-2">
                    <User className="h-4 w-4" /> Username
                  </Label>
                  <Input
                    id="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="bg-white/5 border-white/10 text-white"
                    disabled
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-white flex items-center gap-2">
                    <Mail className="h-4 w-4" /> Email Address
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    className="bg-white/5 border-white/10 text-white"
                    disabled
                  />
                </div>
                
                <div className="pt-2">
                  <Button variant="outline" className="bg-white/5 border-white/20 text-white hover:bg-white/10 w-full">
                    <Lock className="h-4 w-4 mr-2" /> Change Password
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
          
          <CardFooter className="flex justify-between border-t border-white/10 pt-6">
            <Button 
              variant="ghost" 
              className="text-red-400 hover:text-red-300 hover:bg-red-900/20"
            >
              Delete Account
            </Button>
            <Button className="bg-brand-purple hover:bg-brand-purple/90">
              Save Changes
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
};

export default ProfileSettings; 