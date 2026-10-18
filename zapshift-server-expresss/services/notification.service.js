import { notificationsCollection, trackingCollection, usersCollection } from "../config/db.js"; // live bindings

// ================= NOTIFICATIONS =================
// Never let a notification problem break the real action (payment, delivery, ...)

// Send a bell notification to one person
export const notify = async (recipientEmail, { type, title, message, link, parcelId, tracking_no }) => {
  if (!recipientEmail) return;
  try {
    await notificationsCollection.insertOne({
      recipientEmail: recipientEmail.toLowerCase(),
      type,
      title,
      message,
      link: link || null,
      parcelId: parcelId || null,
      tracking_no: tracking_no || null,
      read: false,
      created_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Notification failed:", error.message);
  }
};

// Send the same notification to every admin
export const notifyAdmins = async (data) => {
  try {
    const admins = await usersCollection.find({ role: "admin" }).project({ email: 1 }).toArray();
    await Promise.all(admins.map((a) => notify(a.email, data)));
  } catch (error) {
    console.error("Admin notification failed:", error.message);
  }
};

// Bell titles for the sender, per tracking status
const SENDER_NOTIFICATION_TITLES = {
  paid: "Payment received",
  pending_assignment: "Waiting for a rider",
  rider_assigned: "Rider assigned",
  picked_up: "Parcel picked up",
  in_transit: "On the way",
  at_origin_hub: "At the warehouse",
  dispatched_to_hub: "On the truck",
  at_destination_hub: "Reached destination warehouse",
  delivery_rider_assigned: "Delivery rider assigned",
  out_for_delivery: "Out for delivery",
  delivered: "Delivered",
  failed_attempt: "Delivery attempt failed",
  returning: "Returning to you",
  return_at_hub: "Return: at warehouse",
  return_in_transit: "Return: on the truck",
  return_at_origin_hub: "Return: back in your area",
  return_rider_assigned: "Return rider assigned",
  return_out_for_delivery: "Return: on the way to you",
  returned: "Returned to you",
};

// Save a tracking update (timeline) AND tell the sender with a bell notification
export const addTracking = async (entry) => {
  await trackingCollection.insertOne(entry);

  const title = SENDER_NOTIFICATION_TITLES[entry.status];
  if (title && entry.created_by) {
    await notify(entry.created_by, {
      type: "parcel_update",
      title,
      message: entry.message,
      link: entry.parcelId ? `/dashboard/parcel/${entry.parcelId}` : null,
      parcelId: entry.parcelId,
      tracking_no: entry.tracking_no,
    });
  }
};
