import { PRICING } from "../constants/pricing.js"; // price table
import { RIDER_SHARE, RIDER_PAY_CAP } from "../constants/delivery.js"; // rider pay rules
import { TRUCK_COST_PER_PARCEL } from "../constants/money.js";
import { getRouteType } from "./delivery.js";
import { roundMoney } from "./money.js";

// Price of a parcel, with a breakdown the customer can see
export const calculatePrice = (parcel) => {
  const isDocument = parcel.parcelType === "document";
  const weight = Math.max(0, Number(parcel.weight ?? parcel.parcelWeight) || 0);
  const sameDistrict =
    !!parcel.senderServiceCenter && parcel.senderServiceCenter === parcel.receiverServiceCenter;
  const area = sameDistrict ? "withinDistrict" : "outsideDistrict";
  const routeType = getRouteType(parcel);

  const breakdown = [];

  if (isDocument) {
    breakdown.push({
      label: `Document, ${sameDistrict ? "within district" : "outside district"}`,
      amount: PRICING.document[area],
    });
  } else {
    const p = PRICING.nonDocument;
    breakdown.push({
      label: `Non-document up to ${p.includedKg} kg, ${sameDistrict ? "within district" : "outside district"}`,
      amount: p[area],
    });

    const extraKg = Math.ceil(Math.max(0, weight - p.includedKg));
    if (extraKg > 0) {
      breakdown.push({ label: `Extra weight: ${extraKg} kg × ৳${p.perExtraKg}`, amount: extraKg * p.perExtraKg });
      if (!sameDistrict) {
        breakdown.push({ label: "Heavy parcel outside district", amount: p.outsideDistrictHeavyExtra });
      }
    }
  }

  const deliveryCharge = breakdown.reduce((sum, b) => sum + b.amount, 0);
  const lineHaulFee = routeType === "inter_region" ? PRICING.lineHaulFee : 0;

  if (lineHaulFee) {
    breakdown.push({ label: "Line-haul (truck between divisions)", amount: lineHaulFee });
  }

  return {
    deliveryType: sameDistrict ? "within-district" : "outside-district",
    routeType,
    weight,
    deliveryCharge,
    lineHaulFee,
    total: deliveryCharge + lineHaulFee,
    breakdown,
  };
};

// The part of the price riders are paid from (price without the line-haul fee)
export const getDeliveryCharge = (parcel) => {
  const cost = Number(parcel.cost) || 0;
  const lineHaul = Number(parcel.lineHaulFee) || 0;
  return Math.max(0, cost - lineHaul);
};

// What a rider earns for one leg of a parcel: share of the delivery charge, up to the cap
export const riderPay = (parcel, leg) => {
  const base = getDeliveryCharge(parcel);
  const raw = base * RIDER_SHARE[leg];
  const cap = RIDER_PAY_CAP[leg];
  const amount = roundMoney(cap != null ? Math.min(raw, cap) : raw);
  return { amount, base, sharePercent: RIDER_SHARE[leg] * 100, capped: cap != null && raw > cap, cap };
};

// What the company keeps from a parcel after all riders and the truck
export const companyMargin = (parcel) => {
  const cost = Number(parcel.cost) || 0;
  if (getRouteType(parcel) === "local") return roundMoney(cost - riderPay(parcel, "full").amount);
  return roundMoney(
    cost - riderPay(parcel, "pickup").amount - riderPay(parcel, "delivery").amount - TRUCK_COST_PER_PARCEL
  );
};
