import { RETURN_STATUSES, FINAL_STATUSES } from "../constants/delivery.js"; // status groups
import { getRouteType } from "./delivery.js";

// One sentence about where the parcel is, and who has it
export const describeLocation = (p) => {
  const rider = p.assigned_rider_name || "the rider";
  const s = p.paymentStatus !== "paid" ? "unpaid" : p.deliveryStatus || "pending_assignment";
  const from = p.senderServiceCenter;
  const to = p.receiverServiceCenter;

  const map = {
    unpaid: { text: `With the sender in ${from} (not paid yet)`, holder: "sender" },
    pending_assignment: { text: `With the sender in ${from}, waiting for a pickup rider`, holder: "sender" },
    rider_assigned: { text: `With the sender, ${rider} is coming to pick it up`, holder: "sender" },
    picked_up: { text: `With ${rider} (picked up from the sender)`, holder: "rider" },
    in_transit: { text: `With ${rider}, on the way to ${p.receiverName || "the receiver"}`, holder: "rider" },
    at_origin_hub: { text: `At the ${from} warehouse, waiting for a truck`, holder: "warehouse" },
    dispatched_to_hub: { text: `On the truck ${from} → ${to}`, holder: "truck" },
    at_destination_hub: { text: `At the ${to} warehouse, waiting for a delivery rider`, holder: "warehouse" },
    delivery_rider_assigned: { text: `At the ${to} warehouse, ${rider} will collect it`, holder: "warehouse" },
    out_for_delivery: { text: `With ${rider}, out for delivery`, holder: "rider" },
    delivered: { text: `Delivered to ${p.receiverName || "the receiver"}`, holder: "receiver" },
    returning: { text: `With ${rider}, coming back after failed delivery`, holder: "rider" },
    return_at_hub: { text: `At the ${to} warehouse (return), waiting for a truck`, holder: "warehouse" },
    return_in_transit: { text: `On the truck back ${to} → ${from}`, holder: "truck" },
    return_at_origin_hub: { text: `At the ${from} warehouse (return), waiting for a rider`, holder: "warehouse" },
    return_rider_assigned: { text: `At the ${from} warehouse (return), ${rider} will collect it`, holder: "warehouse" },
    return_out_for_delivery: { text: `With ${rider}, bringing it back to the sender`, holder: "rider" },
    returned: { text: `Returned to ${p.senderName || "the sender"}`, holder: "sender" },
  };

  return { status: s, ...(map[s] || { text: s.replaceAll("_", " "), holder: "unknown" }) };
};

// The chain of people and places a parcel passes through, with which step it's on.
// Local:  Sender → Rider → Receiver
// Inter:  Sender → Pickup rider → Warehouse → Truck → Warehouse → Delivery rider → Receiver
// A return adds the way back.
export const buildJourney = (p) => {
  const s = p.paymentStatus !== "paid" ? "unpaid" : p.deliveryStatus || "pending_assignment";
  const local = getRouteType(p) === "local";
  const isReturn = RETURN_STATUSES.includes(s) || s === "returned";
  const riderName = (info) => info?.name || null;

  const sender = { key: "sender", type: "person", label: "Sender", name: p.senderName || p.created_by, detail: p.senderServiceCenter };
  const receiver = { key: "receiver", type: "person", label: "Receiver", name: p.receiverName, detail: p.receiverServiceCenter };

  let nodes;
  let index; // which node the parcel is at now

  if (local) {
    const rider = {
      key: "rider",
      type: "rider",
      label: "Rider",
      name: riderName(p.pickup_rider) || p.assigned_rider_name,
      detail: p.pickup_rider?.contact || p.assigned_rider_contact,
    };
    if (isReturn) {
      nodes = [sender, rider, { ...sender, key: "sender_back", label: "Back to sender" }];
      index = s === "returned" ? 2 : 1;
    } else {
      nodes = [sender, rider, receiver];
      index = { picked_up: 1, in_transit: 1, delivered: 2 }[s] ?? 0;
    }
  } else {
    const pickupRider = { key: "pickup_rider", type: "rider", label: "Pickup rider", name: riderName(p.pickup_rider), detail: p.pickup_rider?.district };
    const originHub = { key: "origin_hub", type: "warehouse", label: "Warehouse", name: `${p.senderServiceCenter} warehouse` };
    const truck = { key: "truck", type: "truck", label: "Truck", name: p.vehicleNo || "Line-haul truck" };
    const destHub = { key: "dest_hub", type: "warehouse", label: "Warehouse", name: `${p.receiverServiceCenter} warehouse` };
    const deliveryRider = { key: "delivery_rider", type: "rider", label: "Delivery rider", name: riderName(p.delivery_rider), detail: p.delivery_rider?.district };

    nodes = [sender, pickupRider, originHub, truck, destHub, deliveryRider];

    if (isReturn) {
      nodes.push(
        { ...destHub, key: "dest_hub_back", label: "Warehouse (return)" },
        { ...truck, key: "truck_back", label: "Truck back", name: p.returnVehicleNo || "Line-haul truck" },
        { ...originHub, key: "origin_hub_back", label: "Warehouse (return)" },
        { key: "return_rider", type: "rider", label: "Return rider", name: riderName(p.return_rider), detail: p.return_rider?.district },
        { ...sender, key: "sender_back", label: "Back to sender" }
      );
      index = {
        returning: 5,
        return_at_hub: 6,
        return_in_transit: 7,
        return_at_origin_hub: 8,
        return_rider_assigned: 8,
        return_out_for_delivery: 9,
        returned: 10,
      }[s];
    } else {
      nodes.push(receiver);
      index = {
        picked_up: 1,
        at_origin_hub: 2,
        dispatched_to_hub: 3,
        at_destination_hub: 4,
        delivery_rider_assigned: 4,
        out_for_delivery: 5,
        delivered: 6,
      }[s] ?? 0;
    }
  }

  const finished = FINAL_STATUSES.includes(s);
  return nodes.map((n, i) => ({
    ...n,
    state: i < index || (finished && i === index) ? "done" : i === index ? "current" : "upcoming",
  }));
};
