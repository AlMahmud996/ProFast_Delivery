import { TRUCK_COST_PER_PARCEL } from "./money.js"; // the line-haul fee equals the truck cost

// ================= PRICING =================
// The SERVER decides the price. The browser's "cost" is ignored, so nobody can
// book a parcel for ৳1 by editing the request.
export const PRICING = {
  document: { withinDistrict: 60, outsideDistrict: 80 },
  nonDocument: {
    includedKg: 3, // price below covers up to 3 kg
    withinDistrict: 110,
    outsideDistrict: 150,
    perExtraKg: 40, // every kg above 3 kg (rounded up)
    outsideDistrictHeavyExtra: 40, // extra for heavy parcels sent outside the district
  },
  // Inter-region (different division) parcels go by truck between warehouses.
  // This fee covers the truck, so those parcels are never sold at a loss.
  lineHaulFee: TRUCK_COST_PER_PARCEL,
  maxWeightKg: 50,
};
