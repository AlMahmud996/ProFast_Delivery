import { createRequire } from "module"; // this file is an ES module, so "require" doesn't exist by default

const require = createRequire(import.meta.url);

// ================= SERVICE CENTERS =================
// Copy of the client's src/assets/warehouse.json, placed in the project root (next to index.js).
// Used to find a parcel's region from its service center (district).
let districtToRegion = {};
// District -> { lat, lng }, used to find riders in NEARBY districts
let districtCoords = {};
try {
  const serviceCenters = require("../warehouse.json"); // ../ because this file lives in /utils
  districtToRegion = Object.fromEntries(
    serviceCenters.map((c) => [c.district, c.region])
  );
  districtCoords = Object.fromEntries(
    serviceCenters
      .filter((c) => typeof c.latitude === "number" && typeof c.longitude === "number")
      .map((c) => [c.district, { lat: c.latitude, lng: c.longitude }])
  );
} catch {
  console.warn(
    "warehouse.json not found next to index.js: every parcel will need an admin to assign a rider"
  );
}

// Straight-line distance in km between two districts' service centers (null if unknown)
export const distanceKm = (fromDistrict, toDistrict) => {
  const a = districtCoords[fromDistrict];
  const b = districtCoords[toDistrict];
  if (!a || !b) return null;
  if (fromDistrict === toDistrict) return 0;

  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return Math.round(6371 * 2 * Math.asin(Math.sqrt(h)));
};

// Region of the sender ("sender") or receiver ("receiver") side of a parcel
export const getRegion = (parcel, side) =>
  parcel[`${side}Region`] ||
  districtToRegion[parcel[`${side}ServiceCenter`]] ||
  null;
