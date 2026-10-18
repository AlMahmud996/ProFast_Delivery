import { ObjectId } from "mongodb";
import { stripe } from "../config/stripe.js"; // Stripe client
import { parcelsCollection, paymentsCollection } from "../config/db.js"; // live bindings
import { BDT_PER_USD } from "../constants/money.js";
import { getRouteType } from "../utils/delivery.js";
import { addTracking } from "../services/notification.service.js";
import { findAutoRider, assignRider, markPendingAssignment } from "../services/rider.service.js";

// ================= PAYMENT ROUTES =================

// Create a Stripe PaymentIntent for an unpaid parcel.
// The amount is read from the database, never from the client,
// so nobody can change the price in the browser.
export const createPaymentIntent = async (req, res) => {
  try {
    const { parcelId } = req.body;

    if (!ObjectId.isValid(parcelId)) {
      return res.status(400).send({ message: "Invalid parcel id" });
    }

    const parcel = await parcelsCollection.findOne({
      _id: new ObjectId(parcelId),
    });

    if (!parcel) {
      return res.status(404).send({ message: "Parcel not found" });
    }

    if (
      parcel.created_by?.toLowerCase() !==
      req.decodedToken.email?.toLowerCase()
    ) {
      return res
        .status(403)
        .send({ message: "You cannot pay for this parcel" });
    }

    if (parcel.paymentStatus === "paid") {
      return res.status(400).send({ message: "Parcel is already paid" });
    }

    // BDT cost -> USD cents (Stripe wants the smallest currency unit)
    const amountInCents = Math.round((Number(parcel.cost) / BDT_PER_USD) * 100);

    if (!amountInCents || amountInCents < 50) {
      return res
        .status(400)
        .send({ message: "Amount is too small for Stripe (minimum $0.50)" });
    }

    // No payment_method_types here: newer Stripe API versions reject it.
    // Allowed methods (card is on by default) come from the Stripe Dashboard.
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountInCents,
      currency: "usd",
      // POST /payments checks this to make sure the payment is for this parcel
      metadata: { parcelId },
    });

    res.send({ clientSecret: paymentIntent.client_secret });
  } catch (error) {
    console.error("Create payment intent error:", error.message);
    // Stripe errors have a readable message, e.g. "Invalid API Key provided"
    res.status(500).send({
      message: error.type?.startsWith("Stripe")
        ? `Stripe error: ${error.message}`
        : "Failed to create payment intent",
    });
  }
};

// Save payment after Stripe confirms success
export const savePayment = async (req, res) => {
  try {
    const { parcelId, transactionId } = req.body;

    if (!ObjectId.isValid(parcelId) || !transactionId) {
      return res.status(400).send({ message: "Invalid payment data" });
    }

    const intent = await stripe.paymentIntents.retrieve(transactionId);

    if (
      intent.status !== "succeeded" ||
      intent.metadata.parcelId !== parcelId
    ) {
      return res.status(400).send({ message: "Payment not verified" });
    }

    const parcel = await parcelsCollection.findOne({
      _id: new ObjectId(parcelId),
    });

    if (!parcel) {
      return res.status(404).send({ message: "Parcel not found" });
    }

    if (
      parcel.created_by?.toLowerCase() !==
      req.decodedToken.email?.toLowerCase()
    ) {
      return res
        .status(403)
        .send({ message: "You cannot pay for this parcel" });
    }

    // Same transaction sent twice: return the saved result
    const existing = await paymentsCollection.findOne({ transactionId });

    if (existing) {
      return res.send({
        success: true,
        tracking_no: existing.tracking_no,
        transactionId,
      });
    }

    if (parcel.paymentStatus === "paid") {
      return res.status(400).send({ message: "Parcel is already paid" });
    }

    // Unique 6 digit tracking number
    let tracking_no;
    let taken = true;

    while (taken) {
      tracking_no = String(Math.floor(100000 + Math.random() * 900000));
      taken = await parcelsCollection.findOne({ tracking_no });
    }

    const paidAt = new Date().toISOString();

    await parcelsCollection.updateOne(
      { _id: new ObjectId(parcelId) },
      { $set: { paymentStatus: "paid", tracking_no, paid_at: paidAt } }
    );

    await paymentsCollection.insertOne({
      parcelId,
      parcelName: parcel.parcelName,
      email: parcel.created_by.toLowerCase(),
      amount: parcel.cost,
      transactionId,
      tracking_no,
      paid_at: paidAt,
    });

    await addTracking({
      tracking_no,
      parcelId,
      created_by: parcel.created_by.toLowerCase(),
      status: "paid",
      message: "Payment received.",
      created_at: paidAt,
    });

    // ---------- Pickup rider ----------
    // Same region: assign a rider automatically.
    // Different region (or no free rider): wait for an admin.
    const paidParcel = { ...parcel, tracking_no, paymentStatus: "paid" };
    let delivery = { deliveryStatus: "pending_assignment", rider_name: null };

    try {
      const routeType = getRouteType(parcel);
      const sameRegion = routeType === "local";

      // Remember the route so every later step knows which flow to follow
      await parcelsCollection.updateOne(
        { _id: parcel._id },
        { $set: { routeType } }
      );
      paidParcel.routeType = routeType;

      const rider = sameRegion ? await findAutoRider(paidParcel, "pickup") : null;

      if (rider) {
        await assignRider(paidParcel, rider, "auto", "pickup");
        delivery = { deliveryStatus: "rider_assigned", rider_name: rider.name };
      } else {
        await markPendingAssignment(
          paidParcel,
          sameRegion ? "no_rider_available" : "inter_region"
        );
      }
    } catch (assignError) {
      // The payment is already saved, so never fail the request here.
      // The parcel stays in the admin's "pending assignment" list.
      console.error("Auto assign rider error:", assignError);
    }

    res.send({ success: true, tracking_no, transactionId, ...delivery });
  } catch (error) {
    console.error("Save payment error:", error);
    res.status(500).send({ message: "Failed to save payment" });
  }
};

// Payment history of the logged-in user
export const getMyPayments = async (req, res) => {
  try {
    const tokenEmail = req.decodedToken.email?.toLowerCase();
    const requestedEmail = req.query.email?.toLowerCase();

    if (!tokenEmail) {
      return res.status(403).send({ message: "User email not available" });
    }

    if (requestedEmail && requestedEmail !== tokenEmail) {
      return res
        .status(403)
        .send({ message: "You cannot view another user's payments" });
    }

    const payments = await paymentsCollection
      .find({ email: tokenEmail })
      .sort({ paid_at: -1, _id: -1 })
      .toArray();

    res.send(payments);
  } catch (error) {
    console.error("Fetch payments error:", error);
    res.status(500).send({ message: "Failed to fetch payments" });
  }
};
