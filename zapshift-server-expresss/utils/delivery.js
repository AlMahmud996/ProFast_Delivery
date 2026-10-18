import { getRegion } from "./geo.js"; // region lookup for a parcel side

// "local" or "inter_region"
export const getRouteType = (parcel) => {
  if (parcel.routeType) return parcel.routeType;
  const from = getRegion(parcel, "sender");
  const to = getRegion(parcel, "receiver");
  return from && from === to ? "local" : "inter_region";
};

// The next step a rider can take, based on the current status and route
export const getNextRiderStep = (parcel) => {
  const routeType = getRouteType(parcel);
  switch (parcel.deliveryStatus) {
    case "rider_assigned":
      return "picked_up";
    case "picked_up":
      return routeType === "local" ? "in_transit" : "at_origin_hub";
    case "in_transit":
      return routeType === "local" ? "delivered" : null;
    case "delivery_rider_assigned":
      return "out_for_delivery";
    case "out_for_delivery":
      return "delivered";
    // ----- returns -----
    case "returning":
      return routeType === "local" ? "returned" : "return_at_hub";
    case "return_rider_assigned":
      return "return_out_for_delivery";
    case "return_out_for_delivery":
      return "returned";
    default:
      return null;
  }
};

// A delivery attempt can fail only at the last step before "delivered"
export const canFailDelivery = (parcel) => getNextRiderStep(parcel) === "delivered";

// Which leg a parcel needs a rider for
export const getAssignmentLeg = (parcel) => {
  if (["at_destination_hub", "delivery_rider_assigned"].includes(parcel.deliveryStatus)) return "delivery";
  if (["return_at_origin_hub", "return_rider_assigned"].includes(parcel.deliveryStatus)) return "return";
  return "pickup";
};

// Which job the CURRENT rider of a parcel is doing (for pay and the rider's page)
export const getCurrentLeg = (parcel) => {
  const routeType = getRouteType(parcel);
  const s = parcel.deliveryStatus;
  if (["return_rider_assigned", "return_out_for_delivery"].includes(s)) return "return";
  if (routeType === "local") return "full";
  if (["delivery_rider_assigned", "out_for_delivery", "returning"].includes(s)) return "delivery";
  return "pickup";
};

// Where a rider has to go for a leg: the sender's service center for pickup and
// return (the parcel goes back to the sender), the receiver's for delivery
export const getLegLocation = (parcel, leg) => {
  const side = leg === "delivery" ? "receiver" : "sender";
  return {
    district: parcel[`${side}ServiceCenter`],
    region: getRegion(parcel, side),
  };
};
