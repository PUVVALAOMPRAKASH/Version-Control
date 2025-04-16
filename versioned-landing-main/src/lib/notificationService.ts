import { db } from './firebase';
import { 
  collection, 
  addDoc, 
  getDocs, 
  query, 
  where, 
  doc, 
  updateDoc, 
  deleteDoc, 
  getDoc, 
  orderBy,
  limit, 
  Timestamp,
  DocumentData,
  QueryDocumentSnapshot
} from 'firebase/firestore';
import { getCurrentUser } from './authService';

export interface Notification {
  id?: string;
  userId: string;
  type: string;
  message: string;
  details?: any;
  read: boolean;
  createdAt: string;
}

// Get all notifications for the current user
export const getNotifications = async (
  limitCount: number = 50
): Promise<{ success: boolean; notifications?: Notification[]; error?: string }> => {
  try {
    const currentUser = getCurrentUser();
    
    if (!currentUser) {
      return { success: false, error: 'User not authenticated' };
    }
    
    const notificationQuery = query(
      collection(db, "notifications"),
      where("userId", "==", currentUser.uid),
      orderBy("createdAt", "desc"),
      limit(limitCount)
    );
    
    const snapshot = await getDocs(notificationQuery);
    
    const notifications: Notification[] = [];
    
    snapshot.forEach((doc) => {
      const data = doc.data();
      notifications.push({
        id: doc.id,
        userId: data.userId,
        type: data.type,
        message: data.message,
        details: data.details || {},
        read: data.read || false,
        createdAt: data.createdAt
      });
    });
    
    return { success: true, notifications };
  } catch (error: any) {
    console.error("Error getting notifications:", error);
    return { 
      success: false, 
      error: error.message || 'Failed to get notifications' 
    };
  }
};

// Get unread notifications count
export const getUnreadNotificationsCount = async (): Promise<{ success: boolean; count?: number; error?: string }> => {
  try {
    const currentUser = getCurrentUser();
    
    if (!currentUser) {
      return { success: false, error: 'User not authenticated' };
    }
    
    const notificationQuery = query(
      collection(db, "notifications"),
      where("userId", "==", currentUser.uid),
      where("read", "==", false)
    );
    
    const snapshot = await getDocs(notificationQuery);
    
    return { success: true, count: snapshot.size };
  } catch (error: any) {
    console.error("Error getting unread notifications count:", error);
    return { 
      success: false, 
      error: error.message || 'Failed to get notifications count'
    };
  }
};

// Mark a notification as read
export const markNotificationAsRead = async (
  notificationId: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    const currentUser = getCurrentUser();
    
    if (!currentUser) {
      return { success: false, error: 'User not authenticated' };
    }
    
    // Get the notification to verify ownership
    const notificationRef = doc(db, "notifications", notificationId);
    const notificationSnap = await getDoc(notificationRef);
    
    if (!notificationSnap.exists()) {
      return { success: false, error: 'Notification not found' };
    }
    
    const notificationData = notificationSnap.data();
    
    // Verify the notification belongs to this user
    if (notificationData.userId !== currentUser.uid) {
      return { success: false, error: 'Notification does not belong to this user' };
    }
    
    // Update the notification
    await updateDoc(notificationRef, {
      read: true
    });
    
    return { success: true };
  } catch (error: any) {
    console.error("Error marking notification as read:", error);
    return { 
      success: false, 
      error: error.message || 'Failed to update notification' 
    };
  }
};

// Mark all notifications as read
export const markAllNotificationsAsRead = async (): Promise<{ success: boolean; error?: string }> => {
  try {
    const currentUser = getCurrentUser();
    
    if (!currentUser) {
      return { success: false, error: 'User not authenticated' };
    }
    
    // Get all unread notifications for this user
    const notificationQuery = query(
      collection(db, "notifications"),
      where("userId", "==", currentUser.uid),
      where("read", "==", false)
    );
    
    const snapshot = await getDocs(notificationQuery);
    
    // Update each notification
    const updatePromises = snapshot.docs.map(doc => 
      updateDoc(doc.ref, { read: true })
    );
    
    await Promise.all(updatePromises);
    
    return { success: true };
  } catch (error: any) {
    console.error("Error marking all notifications as read:", error);
    return { 
      success: false, 
      error: error.message || 'Failed to update notifications' 
    };
  }
};

// Delete a notification
export const deleteNotification = async (
  notificationId: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    const currentUser = getCurrentUser();
    
    if (!currentUser) {
      return { success: false, error: 'User not authenticated' };
    }
    
    // Get the notification to verify ownership
    const notificationRef = doc(db, "notifications", notificationId);
    const notificationSnap = await getDoc(notificationRef);
    
    if (!notificationSnap.exists()) {
      return { success: false, error: 'Notification not found' };
    }
    
    const notificationData = notificationSnap.data();
    
    // Verify the notification belongs to this user
    if (notificationData.userId !== currentUser.uid) {
      return { success: false, error: 'Notification does not belong to this user' };
    }
    
    // Delete the notification
    await deleteDoc(notificationRef);
    
    return { success: true };
  } catch (error: any) {
    console.error("Error deleting notification:", error);
    return { 
      success: false, 
      error: error.message || 'Failed to delete notification' 
    };
  }
};

// Create a notification (mainly for internal use)
export const createNotification = async (
  userId: string,
  type: string,
  message: string,
  details?: any
): Promise<{ success: boolean; notificationId?: string; error?: string }> => {
  try {
    console.log(`Creating notification for user ${userId} of type ${type}`);
    console.log("Notification details:", details);
    
    if (!userId) {
      console.error("Error: userId is required for creating a notification");
      return { success: false, error: 'userId is required' };
    }
    
    const currentUser = getCurrentUser();
    if (!currentUser) {
      console.error("Error: No authenticated user found");
      return { success: false, error: 'User not authenticated' };
    }
    
    const timestamp = new Date().toISOString();
    
    const newNotification = {
      userId,
      type,
      message,
      details: details || {},
      read: false,
      createdAt: timestamp,
      createdBy: currentUser.uid // Add who created the notification
    };
    
    console.log("Notification data to be saved:", newNotification);
    
    try {
      const docRef = await addDoc(collection(db, "notifications"), newNotification);
      console.log("Notification created successfully with ID:", docRef.id);
      
      return { 
        success: true, 
        notificationId: docRef.id 
      };
    } catch (firestoreError: any) {
      console.error("Firestore error creating notification:", firestoreError);
      
      // If we have a permissions error, return a specific message
      if (firestoreError.code === 'permission-denied') {
        return {
          success: false,
          error: 'Permission denied. Check Firestore security rules for notifications collection.'
        };
      }
      
      throw firestoreError; // Re-throw to be caught by the outer catch
    }
  } catch (error: any) {
    console.error("Error creating notification:", error);
    return { 
      success: false, 
      error: error.message || 'Failed to create notification' 
    };
  }
};