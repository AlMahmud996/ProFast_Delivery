import { ObjectId } from "mongodb";
import { notificationsCollection } from "../config/db.js"; // live binding

// ================= NOTIFICATION BELL =================

// The logged-in person's latest notifications + unread count
export const getNotifications = async (req, res) => {
  try {
    const email = req.decodedToken.email?.toLowerCase();
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));

    const [items, unreadCount] = await Promise.all([
      notificationsCollection
        .find({ recipientEmail: email })
        .sort({ created_at: -1, _id: -1 })
        .limit(limit)
        .toArray(),
      notificationsCollection.countDocuments({ recipientEmail: email, read: false }),
    ]);

    res.send({ unreadCount, items });
  } catch (error) {
    console.error("Fetch notifications error:", error);
    res.status(500).send({ message: "Failed to load notifications" });
  }
};

// Mark one notification as read (only your own)
export const markNotificationRead = async (req, res) => {
  try {
    const { id } = req.params;
    if (!ObjectId.isValid(id)) {
      return res.status(400).send({ message: "Invalid notification id" });
    }

    const result = await notificationsCollection.updateOne(
      { _id: new ObjectId(id), recipientEmail: req.decodedToken.email?.toLowerCase() },
      { $set: { read: true, read_at: new Date().toISOString() } }
    );

    res.send(result);
  } catch (error) {
    console.error("Read notification error:", error);
    res.status(500).send({ message: "Failed to update notification" });
  }
};

// Mark all of your notifications as read
export const markAllNotificationsRead = async (req, res) => {
  try {
    const result = await notificationsCollection.updateMany(
      { recipientEmail: req.decodedToken.email?.toLowerCase(), read: false },
      { $set: { read: true, read_at: new Date().toISOString() } }
    );
    res.send({ modifiedCount: result.modifiedCount });
  } catch (error) {
    console.error("Read all notifications error:", error);
    res.status(500).send({ message: "Failed to update notifications" });
  }
};
