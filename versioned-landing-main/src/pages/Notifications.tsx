import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Bell,
  ArrowLeft,
  Loader2,
  AlertCircle,
  CheckCircle,
  Trash2,
  RefreshCw,
  GitPullRequest,
  MessageSquare,
  UserPlus,
  Eye,
  Check,
  ClipboardCheck
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import {
  getNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
  Notification
} from "@/lib/notificationService";
import { useAuth } from "@/lib/AuthContext";
import { formatDistanceToNow } from "date-fns";
import {
  updateAccessRequest
} from "@/lib/repositoryService";
import { processPendingCommit } from "@/lib/s3Service";

const Notifications = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { currentUser } = useAuth();
  const [processingRequest, setProcessingRequest] = useState<{[key: string]: boolean}>({});
  
  const loadNotifications = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const result = await getNotifications();
      
      if (!result.success) {
        throw new Error(result.error || "Failed to load notifications");
      }
      
      setNotifications(result.notifications || []);
    } catch (err: any) {
      console.error("Error loading notifications:", err);
      setError(err.message || "An error occurred");
    } finally {
      setIsLoading(false);
    }
  };
  
  useEffect(() => {
    loadNotifications();
  }, [currentUser]);
  
  const handleReadNotification = async (notification: Notification) => {
    if (!notification.id) return;
    
    try {
      // If it's already read, just navigate
      if (notification.read) {
        handleNavigateToNotification(notification);
        return;
      }
      
      const result = await markNotificationAsRead(notification.id);
      
      if (!result.success) {
        throw new Error(result.error || "Failed to mark notification as read");
      }
      
      // Update local state
      setNotifications(prev => 
        prev.map(n => 
          n.id === notification.id ? { ...n, read: true } : n
        )
      );
      
      // Navigate to the relevant page
      handleNavigateToNotification(notification);
      
    } catch (err: any) {
      console.error("Error marking notification as read:", err);
      toast({
        title: "Error",
        description: err.message || "Failed to update notification",
        variant: "destructive"
      });
    }
  };
  
  const handleNavigateToNotification = (notification: Notification) => {
    // Navigate based on notification type
    const { type, details } = notification;
    
    try {
      if (type.includes('pull_request') && details?.pullRequestId) {
        // Store current path in sessionStorage before navigating
        sessionStorage.setItem('returnPath', '/notifications');
        navigate(`/pull-request/${details.pullRequestId}`);
      } else if (type === 'collaboration_invite' && details?.repositoryId) {
        // Store current path in sessionStorage before navigating
        sessionStorage.setItem('returnPath', '/notifications');
        navigate(`/repository/${details.repositoryId}`);
      } else {
        // Default to dashboard
        navigate("/dashboard");
      }
    } catch (error) {
      console.error("Navigation error:", error);
      // Default fallback
      navigate("/dashboard");
    }
  };
  
  const handleDeleteNotification = async (notification: Notification) => {
    if (!notification.id) return;
    
    try {
      const result = await deleteNotification(notification.id);
      
      if (!result.success) {
        throw new Error(result.error || "Failed to delete notification");
      }
      
      // Update local state
      setNotifications(prev => 
        prev.filter(n => n.id !== notification.id)
      );
      
      toast({
        title: "Notification deleted",
        description: "The notification has been removed",
      });
      
    } catch (err: any) {
      console.error("Error deleting notification:", err);
      toast({
        title: "Error",
        description: err.message || "Failed to delete notification",
        variant: "destructive"
      });
    }
  };
  
  const handleMarkAllAsRead = async () => {
    try {
      const result = await markAllNotificationsAsRead();
      
      if (!result.success) {
        throw new Error(result.error || "Failed to mark all as read");
      }
      
      // Update local state
      setNotifications(prev => 
        prev.map(n => ({ ...n, read: true }))
      );
      
      toast({
        title: "All notifications marked as read",
        description: "Your notifications have been updated"
      });
      
    } catch (err: any) {
      console.error("Error marking all as read:", err);
      toast({
        title: "Error",
        description: err.message || "Failed to update notifications",
        variant: "destructive"
      });
    }
  };
  
  const handleAccessRequest = async (notification: Notification, approve: boolean) => {
    if (!notification.details?.requesterId || !notification.details?.repositoryId) {
      console.error("Missing request details:", notification);
      toast({
        title: "Error",
        description: "Missing request details",
        variant: "destructive"
      });
      return;
    }
    
    const requestId = notification.details.requestId;
    if (!requestId) {
      console.error("Missing requestId in notification details:", notification.details);
      toast({
        title: "Error",
        description: "Missing request ID in notification. Please check browser console for details.",
        variant: "destructive"
      });
      return;
    }
    
    try {
      setProcessingRequest(prev => ({ ...prev, [notification.id!]: true }));
      
      const result = await updateAccessRequest(requestId, approve);
      
      if (result.success) {
        // Update notification as read
        await markNotificationAsRead(notification.id!);
        
        // Update UI
        setNotifications(prev => 
          prev.map(n => 
            n.id === notification.id ? { ...n, read: true } : n
          )
        );
        
        toast({
          title: approve ? "Access Granted" : "Access Denied",
          description: approve 
            ? `User has been granted access to the repository` 
            : `Access request has been denied`,
        });
      } else {
        toast({
          title: "Error",
          description: result.error || "Failed to process request",
          variant: "destructive"
        });
      }
    } catch (err: any) {
      console.error("Error processing access request:", err);
      toast({
        title: "Error",
        description: err.message || "An error occurred",
        variant: "destructive"
      });
    } finally {
      setProcessingRequest(prev => ({ ...prev, [notification.id!]: false }));
    }
  };
  
  const handleProcessCommit = async (notification: Notification, approve: boolean) => {
    if (!notification.details?.repositoryId || !notification.details?.commitTimestamp || !notification.details?.fileName) {
      console.error("Missing commit details:", notification);
      toast({
        title: "Error",
        description: "Missing commit details",
        variant: "destructive"
      });
      return;
    }
    
    try {
      setProcessingRequest(prev => ({ ...prev, [notification.id!]: true }));
      
      const result = await processPendingCommit(
        notification.details.repositoryId,
        notification.details.commitTimestamp,
        notification.details.fileName,
        approve,
        "Processed via notification"
      );
      
      if (result.success) {
        // Update notification as read
        await markNotificationAsRead(notification.id!);
        
        // Update UI
        setNotifications(prev => 
          prev.map(n => 
            n.id === notification.id ? { ...n, read: true } : n
          )
        );
        
        toast({
          title: approve ? "Changes Approved" : "Changes Rejected",
          description: approve 
            ? `The changes have been approved and applied to the repository` 
            : `The changes have been rejected`,
        });
      } else {
        toast({
          title: "Error",
          description: result.error || "Failed to process commit request",
          variant: "destructive"
        });
      }
    } catch (err: any) {
      console.error("Error processing commit request:", err);
      toast({
        title: "Error",
        description: err.message || "An error occurred",
        variant: "destructive"
      });
    } finally {
      setProcessingRequest(prev => ({ ...prev, [notification.id!]: false }));
    }
  };
  
  const getNotificationIcon = (type: string) => {
    if (type.includes('pull_request')) {
      return <GitPullRequest className="h-5 w-5 text-purple-500" />;
    } else if (type.includes('comment')) {
      return <MessageSquare className="h-5 w-5 text-blue-500" />;
    } else if (type.includes('access_request')) {
      return <UserPlus className="h-5 w-5 text-green-500" />;
    } else if (type.includes('commit_request')) {
      return <ClipboardCheck className="h-5 w-5 text-orange-500" />;
    } else {
      return <Bell className="h-5 w-5 text-gray-500" />;
    }
  };
  
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-violet-800 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-10 w-10 animate-spin text-white mx-auto mb-4" />
          <p className="text-white">Loading notifications...</p>
        </div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-violet-800 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full">
          <div className="text-center text-red-600 mb-4">
            <AlertCircle className="h-10 w-10 mx-auto mb-2" />
            <p>{error}</p>
          </div>
          <Button onClick={() => navigate("/dashboard")} className="w-full">
            Back to Dashboard
          </Button>
        </div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-violet-800 text-black">
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-3xl mx-auto bg-white rounded-lg shadow-xl overflow-hidden">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center gap-3 mb-6">
              <Button 
                variant="ghost" 
                size="icon"
                onClick={() => navigate("/home")}
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div className="flex items-center">
                <Bell className="h-6 w-6 text-brand-purple mr-2" />
                <h1 className="text-2xl font-bold">Notifications</h1>
              </div>
              <div className="ml-auto flex space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={loadNotifications}
                  className="flex items-center"
                >
                  <RefreshCw className="h-4 w-4 mr-1" />
                  Refresh
                </Button>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleMarkAllAsRead}
                  className="flex items-center"
                  disabled={notifications.every(n => n.read)}
                >
                  <Check className="h-4 w-4 mr-1" />
                  Mark All Read
                </Button>
              </div>
            </div>
            
            {notifications.length === 0 ? (
              <div className="text-center py-12 border border-dashed border-gray-300 rounded-lg">
                <Bell className="h-12 w-12 mx-auto text-gray-400 mb-3" />
                <h3 className="text-lg font-medium text-gray-700 mb-1">No notifications</h3>
                <p className="text-gray-500">You don't have any notifications yet</p>
              </div>
            ) : (
              <div className="divide-y">
                {notifications.map((notification) => (
                  <div 
                    key={notification.id} 
                    className={`py-4 flex items-start ${!notification.read ? 'bg-gray-50' : ''} hover:bg-gray-50`}
                  >
                    <div className="mr-3 mt-1">
                      {getNotificationIcon(notification.type)}
                    </div>
                    
                    <div className="flex-1">
                      <p className={`mb-1 ${!notification.read ? 'font-medium' : ''}`}>
                        {notification.message}
                      </p>
                      <p className="text-sm text-gray-500">
                        {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
                      </p>
                      
                      {notification.type === 'access_request' && !notification.read && (
                        <div className="mt-2 flex space-x-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="w-20 bg-red-50 border-red-200 hover:bg-red-100 text-red-600"
                            onClick={() => handleAccessRequest(notification, false)}
                            disabled={processingRequest[notification.id!]}
                          >
                            {processingRequest[notification.id!] ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              'Reject'
                            )}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="w-20 bg-green-50 border-green-200 hover:bg-green-100 text-green-600"
                            onClick={() => handleAccessRequest(notification, true)}
                            disabled={processingRequest[notification.id!]}
                          >
                            {processingRequest[notification.id!] ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              'Approve'
                            )}
                          </Button>
                        </div>
                      )}

                      {notification.type === 'commit_request' && (
                        <div className="mt-2 flex space-x-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="w-20 bg-red-50 border-red-200 hover:bg-red-100 text-red-600"
                            onClick={() => handleProcessCommit(notification, false)}
                            disabled={processingRequest[notification.id!]}
                          >
                            {processingRequest[notification.id!] ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              'Reject'
                            )}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="w-20 bg-green-50 border-green-200 hover:bg-green-100 text-green-600"
                            onClick={() => handleProcessCommit(notification, true)}
                            disabled={processingRequest[notification.id!]}
                          >
                            {processingRequest[notification.id!] ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              'Approve'
                            )}
                          </Button>
                        </div>
                      )}
                      
                      {notification.type === 'pull_request' || notification.type === 'comment' && notification.details?.url && (
                        <div className="mt-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="flex items-center"
                            onClick={() => handleNavigateToNotification(notification)}
                          >
                            <Eye className="h-3 w-3 mr-1" />
                            View
                          </Button>
                        </div>
                      )}
                    </div>
                    
                    <div className="flex space-x-1 ml-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleReadNotification(notification)}
                        title={notification.read ? "View" : "Mark as read"}
                      >
                        {notification.read ? (
                          <Eye className="h-4 w-4 text-gray-500" />
                        ) : (
                          <CheckCircle className="h-4 w-4 text-green-500" />
                        )}
                      </Button>
                      
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteNotification(notification)}
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Notifications; 