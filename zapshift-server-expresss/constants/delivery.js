// ================= DELIVERY FLOW =================
//
// LOCAL parcel (sender and receiver in the same region, e.g. Dhaka -> Dhaka):
//   One rider does everything and earns 60% of the parcel cost.
//   pending_assignment -> rider_assigned -> picked_up -> in_transit -> delivered
//
// INTER-REGION parcel (e.g. Khulna -> Dhaka): three legs.
//   1. Pickup rider (Khulna) takes it to the Khulna warehouse, earns 30%.
//      pending_assignment -> rider_assigned -> picked_up -> at_origin_hub
//   2. Truck (admin) carries it from the Khulna warehouse to the Dhaka warehouse.
//      at_origin_hub -> dispatched_to_hub -> at_destination_hub
//   3. Delivery rider (Dhaka) takes it from the warehouse to the door, earns 30%.
//      at_destination_hub -> delivery_rider_assigned -> out_for_delivery -> delivered
//
// FAILED DELIVERY & RETURNS
//   The rider can mark a "failed attempt" (receiver unreachable, refused, ...) instead of
//   "delivered". After MAX_DELIVERY_ATTEMPTS failures the parcel goes back to the sender:
//   LOCAL:        returning (same rider) -> returned
//   INTER-REGION: returning (delivery rider) -> return_at_hub (destination warehouse)
//                 -> return_in_transit (truck back) -> return_at_origin_hub
//                 -> return_rider_assigned -> return_out_for_delivery -> returned
//
// Riders earn their share of the DELIVERY CHARGE (price without the line-haul fee),
// up to a maximum per job. The line-haul fee pays for the truck.

// Share of the delivery charge a rider earns for each kind of job
export const RIDER_SHARE = {
  full: 0.6, // local: pickup + door delivery by the same rider
  pickup: 0.3, // inter-region: sender -> origin warehouse
  delivery: 0.3, // inter-region: destination warehouse -> receiver
  return: 0.3, // inter-region return: origin warehouse -> back to the sender
};

// Most a rider can earn for one job (set a value to null for no limit)
export const RIDER_PAY_CAP = {
  full: 200,
  pickup: 100,
  delivery: 100,
  return: 100,
};

// Failed attempts allowed before a parcel is sent back to the sender
export const MAX_DELIVERY_ATTEMPTS = 2;
export const FAILED_REASONS = {
  unreachable: "Receiver not reachable",
  refused: "Receiver refused the parcel",
  wrong_address: "Wrong or incomplete address",
  not_home: "Receiver not at home",
  other: "Other reason",
};

// Parcels in these states belong to the rider currently assigned to them
export const RIDER_ACTIVE_STATUSES = [
  "rider_assigned",
  "picked_up",
  "in_transit",
  "delivery_rider_assigned",
  "out_for_delivery",
  "returning",
  "return_rider_assigned",
  "return_out_for_delivery",
];

// Statuses of a parcel on its way back to the sender
export const RETURN_STATUSES = [
  "returning",
  "return_at_hub",
  "return_in_transit",
  "return_at_origin_hub",
  "return_rider_assigned",
  "return_out_for_delivery",
];

// Finished parcels (nothing more will happen)
export const FINAL_STATUSES = ["delivered", "returned"];

// Kept for the rider workload count
export const BUSY_DELIVERY_STATUSES = RIDER_ACTIVE_STATUSES;

// Paid parcels waiting for an admin to choose a rider:
// a pickup rider (pending_assignment / old parcels with no status),
// a delivery rider (arrived at the destination warehouse)
// or a return rider (returned parcel back at the origin warehouse)
export const PENDING_ASSIGNMENT_FILTER = {
  paymentStatus: "paid",
  deliveryStatus: { $in: ["pending_assignment", null, "at_destination_hub", "return_at_origin_hub"] },
};

// What each leg is called in the parcel record and status
export const LEG_CONFIG = {
  pickup: { status: "rider_assigned", field: "pickup_rider", label: "pickup" },
  delivery: { status: "delivery_rider_assigned", field: "delivery_rider", label: "delivery" },
  return: { status: "return_rider_assigned", field: "return_rider", label: "return" },
};

// What Dispatch and Arrive do for each direction
export const HUB_MOVES = {
  at_origin_hub: { next: "dispatched_to_hub", expense: "truck", direction: "forward" },
  return_at_hub: { next: "return_in_transit", expense: "truck_return", direction: "return" },
};
export const HUB_ARRIVALS = {
  dispatched_to_hub: { next: "at_destination_hub", leg: "delivery", direction: "forward" },
  return_in_transit: { next: "return_at_origin_hub", leg: "return", direction: "return" },
};

// Filters for the admin parcel tracker
export const TRACKER_FILTERS = {
  all: {},
  unpaid: { paymentStatus: { $ne: "paid" } },
  needs_rider: { paymentStatus: "paid", deliveryStatus: { $in: ["pending_assignment", null, "at_destination_hub", "return_at_origin_hub"] } },
  with_rider: { deliveryStatus: { $in: RIDER_ACTIVE_STATUSES } },
  warehouse: { deliveryStatus: { $in: ["at_origin_hub", "dispatched_to_hub", "return_at_hub", "return_in_transit"] } },
  returns: { deliveryStatus: { $in: [...RETURN_STATUSES, "returned"] } },
  delivered: { deliveryStatus: "delivered" },
};
