const Notification = require('../models/Notification');

// Helper function to create notification
const createNotification = async (userId, type, title, message, data = {}) => {
  try {
    const notification = new Notification({
      user: userId,
      type,
      title,
      message,
      data
    });
    await notification.save();
    return notification;
  } catch (error) {
    console.error('Error creating notification:', error);
    return null;
  }
};

// Get all notifications for a user
exports.getNotifications = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    const { page = 1, limit = 20, unreadOnly = false } = req.query;
    
    const query = { user: userId };
    if (unreadOnly === 'true') {
      query.isRead = false;
    }
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const [notifications, total] = await Promise.all([
      Notification.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Notification.countDocuments(query)
    ]);
    
    const unreadCount = await Notification.countDocuments({ user: userId, isRead: false });
    
    return res.json({
      success: true,
      notifications: notifications.map(n => ({
        id: n._id,
        type: n.type,
        title: n.title,
        message: n.message,
        data: n.data,
        isRead: n.isRead,
        readAt: n.readAt,
        createdAt: n.createdAt
      })),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit))
      },
      unreadCount
    });
  } catch (error) {
    console.error('Error getting notifications:', error);
    return res.status(500).json({
      success: false,
      error: 'Có lỗi xảy ra khi tải thông báo'
    });
  }
};

// Mark notification as read
exports.markAsRead = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    const { notificationId } = req.params;
    
    const notification = await Notification.findOne({
      _id: notificationId,
      user: userId
    });
    
    if (!notification) {
      return res.status(404).json({
        success: false,
        error: 'Không tìm thấy thông báo'
      });
    }
    
    notification.isRead = true;
    notification.readAt = new Date();
    await notification.save();
    
    return res.json({
      success: true,
      message: 'Đã đánh dấu đã đọc'
    });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    return res.status(500).json({
      success: false,
      error: 'Có lỗi xảy ra khi đánh dấu đã đọc'
    });
  }
};

// Mark all notifications as read
exports.markAllAsRead = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    
    await Notification.updateMany(
      { user: userId, isRead: false },
      { isRead: true, readAt: new Date() }
    );
    
    return res.json({
      success: true,
      message: 'Đã đánh dấu tất cả là đã đọc'
    });
  } catch (error) {
    console.error('Error marking all as read:', error);
    return res.status(500).json({
      success: false,
      error: 'Có lỗi xảy ra khi đánh dấu tất cả là đã đọc'
    });
  }
};

// Get unread count
exports.getUnreadCount = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    
    const unreadCount = await Notification.countDocuments({
      user: userId,
      isRead: false
    });
    
    return res.json({
      success: true,
      unreadCount
    });
  } catch (error) {
    console.error('Error getting unread count:', error);
    return res.status(500).json({
      success: false,
      error: 'Có lỗi xảy ra khi lấy số thông báo chưa đọc'
    });
  }
};

// Export helper function for use in other modules
exports.createNotification = createNotification;

