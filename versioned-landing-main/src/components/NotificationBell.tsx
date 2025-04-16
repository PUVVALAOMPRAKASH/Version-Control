import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getUnreadNotificationsCount } from "@/lib/notificationService";
import { useAuth } from "@/lib/AuthContext";

const NotificationBell = () => {
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  
  useEffect(() => {
    const loadUnreadCount = async () => {
      if (!currentUser) return;
      
      try {
        setIsLoading(true);
        const result = await getUnreadNotificationsCount();
        
        if (result.success) {
          setUnreadCount(result.count || 0);
        }
      } catch (err) {
        console.error("Error loading notifications count:", err);
      } finally {
        setIsLoading(false);
      }
    };
    
    loadUnreadCount();
    
    // Set up polling for new notifications
    const intervalId = setInterval(loadUnreadCount, 60000); // Check every minute
    
    return () => clearInterval(intervalId);
  }, [currentUser]);
  
  const handleClick = () => {
    navigate("/notifications");
  };
  
  return (
    <Button 
      variant="ghost" 
      size="icon" 
      className="relative text-white hover:bg-white/10"
      onClick={handleClick}
    >
      <Bell className="h-5 w-5" />
      {!isLoading && unreadCount > 0 && (
        <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-medium text-white">
          {unreadCount > 9 ? '9+' : unreadCount}
        </span>
      )}
    </Button>
  );
};

export default NotificationBell; 