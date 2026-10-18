import { usersCollection, ridersCollection, parcelsCollection, paymentsCollection } from "../config/db.js"; // live bindings
import { FINAL_STATUSES } from "../constants/delivery.js";
import { describeLocation } from "../utils/journey.js";
import { roundMoney, sumAmounts } from "../utils/money.js";

// ================= USER ROUTES =================

// Create a user on register / Google login (or update last login if they exist)
export const createUser = async (req, res) => {
  try {
    const email = req.body.email?.toLowerCase();

    if (!email) {
      return res.status(400).send({ message: "Email is required" });
    }

    const existingUser = await usersCollection.findOne({ email });

    if (existingUser) {
      await usersCollection.updateOne(
        { email },
        { $set: { last_login: new Date().toISOString() } }
      );
      return res.send({ message: "User already exists", inserted: false });
    }

    // Only save known fields. The role is ALWAYS "user" here, whatever the
    // browser sends: admins are made on the Make Admin page, riders by approval.
    const now = new Date().toISOString();
    const newUser = {
      email,
      name: req.body.name || "",
      photoURL: req.body.photoURL || "",
      role: "user",
      createdAt: now,
      last_login: now,
    };

    const result = await usersCollection.insertOne(newUser);

    res.status(201).send({
      message: "User created",
      inserted: true,
      insertedId: result.insertedId,
    });
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: "Failed to create user" });
  }
};

// Role of the logged-in user ("admin", "rider" or "user")
export const getUserRole = async (req, res) => {
  try {
    const email = req.decodedToken.email?.toLowerCase();

    const user = await usersCollection.findOne(
      { email },
      { projection: { role: 1 } }
    );

    res.send({ role: user?.role || "user" });
  } catch (error) {
    console.error("Get user role error:", error);
    res.status(500).send({ message: "Failed to get user role" });
  }
};

// ---------- PROFILE (any logged-in user, rider or admin) ----------

// Finds the logged-in user's document. Old accounts (made before sign-up saved
// users, or with capital letters in the email) are matched or created here.
const getOrCreateMe = async (decodedToken) => {
  const email = decodedToken.email?.toLowerCase();
  if (!email) return null;

  let user = await usersCollection.findOne({ email });
  if (user) return user;

  const escaped = email.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  user = await usersCollection.findOne({ email: { $regex: `^${escaped}$`, $options: "i" } });
  if (user) {
    await usersCollection.updateOne({ _id: user._id }, { $set: { email } });
    return { ...user, email };
  }

  const now = new Date().toISOString();
  const newUser = {
    email,
    name: decodedToken.name || "",
    photoURL: decodedToken.picture || "",
    role: "user",
    createdAt: now,
    last_login: now,
  };
  const result = await usersCollection.insertOne(newUser);
  return { _id: result.insertedId, ...newUser };
};

// The logged-in person's own profile
export const getMyProfile = async (req, res) => {
  try {
    const user = await getOrCreateMe(req.decodedToken);

    if (!user) {
      return res.status(404).send({ message: "Profile not found. Log out and log in again." });
    }

    res.send({
      email: user.email,
      name: user.name || req.decodedToken.name || "",
      phone: user.phone || "",
      photoURL: user.photoURL || req.decodedToken.picture || "",
      role: user.role || "user",
      createdAt: user.createdAt || user.created_at || null,
      last_login: user.last_login || null,
    });
  } catch (error) {
    console.error("Get profile error:", error);
    res.status(500).send({ message: "Failed to load profile" });
  }
};

// Update ONLY name and phone. The email can't be changed (it's the login).
export const updateMyProfile = async (req, res) => {
  try {
    const email = req.decodedToken.email?.toLowerCase();
    const name = String(req.body?.name ?? "").trim().replace(/\s+/g, " ");
    const phone = String(req.body?.phone ?? "").replace(/[\s-]/g, "");

    if (name.length < 2 || name.length > 50) {
      return res.status(400).send({ message: "Name must be 2 to 50 characters" });
    }
    if (phone && !/^01[3-9]\d{8}$/.test(phone)) {
      return res.status(400).send({ message: "Enter a valid Bangladeshi mobile number, e.g. 01712345678" });
    }

    const user = await getOrCreateMe(req.decodedToken);
    if (!user) {
      return res.status(404).send({ message: "Profile not found. Log out and log in again." });
    }

    // Only these two fields are ever written, whatever else the request contains
    await usersCollection.updateOne(
      { email },
      { $set: { name, phone, profile_updated_at: new Date().toISOString() } }
    );

    // Riders: keep the rider record in sync (admins and senders see this name/number)
    if (user.role === "rider") {
      await ridersCollection.updateOne(
        { email },
        { $set: { name, ...(phone ? { contact: phone } : {}) } }
      );
    }

    res.send({ email, name, phone });
  } catch (error) {
    console.error("Update profile error:", error);
    res.status(500).send({ message: "Failed to update profile" });
  }
};

// ================= USER HOME =================

export const getUserOverview = async (req, res) => {
  try {
    const email = req.decodedToken.email?.toLowerCase();

    const [parcels, payments, user] = await Promise.all([
      parcelsCollection.find({ created_by: email }).sort({ creationDate: -1, _id: -1 }).toArray(),
      paymentsCollection.find({ email }).project({ amount: 1 }).toArray(),
      usersCollection.findOne({ email }, { projection: { name: 1, phone: 1, createdAt: 1, created_at: 1 } }),
    ]);

    const unpaid = parcels.filter((p) => p.paymentStatus !== "paid");
    const active = parcels.filter(
      (p) => p.paymentStatus === "paid" && !FINAL_STATUSES.includes(p.deliveryStatus)
    );

    res.send({
      name: user?.name || "",
      memberSince: user?.createdAt || user?.created_at || null,
      counts: {
        total: parcels.length,
        unpaid: unpaid.length,
        active: active.length,
        delivered: parcels.filter((p) => p.deliveryStatus === "delivered").length,
        returned: parcels.filter((p) => p.deliveryStatus === "returned").length,
      },
      totalSpent: sumAmounts(payments),
      amountDue: roundMoney(unpaid.reduce((sum, p) => sum + (Number(p.cost) || 0), 0)),
      activeParcels: active.slice(0, 5).map((p) => ({
        _id: p._id,
        parcelName: p.parcelName,
        tracking_no: p.tracking_no,
        senderServiceCenter: p.senderServiceCenter,
        receiverServiceCenter: p.receiverServiceCenter,
        deliveryStatus: p.deliveryStatus,
        location: describeLocation(p).text,
        rider: p.assigned_rider_name || null,
      })),
      unpaidParcels: unpaid.slice(0, 5).map((p) => ({
        _id: p._id,
        parcelName: p.parcelName,
        cost: p.cost,
        senderServiceCenter: p.senderServiceCenter,
        receiverServiceCenter: p.receiverServiceCenter,
      })),
    });
  } catch (error) {
    console.error("User overview error:", error);
    res.status(500).send({ message: "Failed to load your overview" });
  }
};
