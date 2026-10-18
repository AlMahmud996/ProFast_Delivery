
import { useState, useRef, useEffect } from "react";

import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  useMap,
} from "react-leaflet";

import "leaflet/dist/leaflet.css";
import L from "leaflet";

import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

import districts from "../../assets/data/districts";

// Custom marker icon
const customIcon = L.icon({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

// This component controls the map position
const MapController = ({ selectedDistrict, markerRefs }) => {
  const map = useMap();

  useEffect(() => {
    if (selectedDistrict) {
      const position = [
        selectedDistrict.latitude,
        selectedDistrict.longitude,
      ];

      map.flyTo(position, 11, {
        duration: 1.5,
      });

      // Open the selected district's popup
      const marker = markerRefs.current[selectedDistrict.district];

      if (marker) {
        setTimeout(() => {
          marker.openPopup();
        }, 1600);
      }
    }
  }, [selectedDistrict, map, markerRefs]);

  return null;
};

const Coverage = () => {
  const [searchText, setSearchText] = useState("");
  const [selectedDistrict, setSelectedDistrict] = useState(null);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const markerRefs = useRef({});

  const position = [23.685, 90.3563];

  // Find districts by case-insensitive partial matching
  const filteredDistricts = districts.filter((district) =>
    district.district
      .toLowerCase()
      .includes(searchText.trim().toLowerCase())
  );

  // Select a district from the suggestions
  const handleSelectDistrict = (district) => {
    setSearchText(district.district);
    setSelectedDistrict(district);
    setShowSuggestions(false);
  };

  // Handle Enter key
  const handleSearch = (e) => {
    if (e.key === "Enter" && filteredDistricts.length > 0) {
      handleSelectDistrict(filteredDistricts[0]);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-10">

      {/* Page title */}
      <h1 className="text-3xl md:text-5xl font-bold text-center mb-8">
        We are available in 64 districts
      </h1>

      {/* Search box */}
      <div className="max-w-xl mx-auto mb-8 relative">

        <label className="input input-bordered flex items-center gap-2 w-full">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="w-5 h-5 opacity-60"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>

          <input
            type="text"
            className="grow"
            placeholder="Search district name..."
            value={searchText}
            onChange={(e) => {
              setSearchText(e.target.value);
              setShowSuggestions(true);
              setSelectedDistrict(null);
            }}
            onFocus={() => setShowSuggestions(true)}
            onKeyDown={handleSearch}
          />

          {searchText && (
            <button
              type="button"
              className="btn btn-ghost btn-xs"
              onClick={() => {
                setSearchText("");
                setSelectedDistrict(null);
                setShowSuggestions(false);
              }}
            >
              ✕
            </button>
          )}
        </label>

        {/* Search suggestions */}
        {showSuggestions && searchText.trim() && (
          <ul className="absolute top-full left-0 right-0 mt-2
            bg-base-100 shadow-xl rounded-xl z-[1000]
            border border-base-300 max-h-60 overflow-y-auto">

            {filteredDistricts.length > 0 ? (
              filteredDistricts.map((district) => (
                <li key={district.district}>
                  <button
                    type="button"
                    className="w-full text-left px-4 py-3
                      hover:bg-base-200 flex justify-between
                      items-center"
                    onClick={() => handleSelectDistrict(district)}
                  >
                    <span>{district.district}</span>
                    <span className="text-sm opacity-60">
                      {district.region}
                    </span>
                  </button>
                </li>
              ))
            ) : (
              <li className="p-4 text-center opacity-60">
                No district found
              </li>
            )}
          </ul>
        )}
      </div>

      {/* Map */}
      <div className="w-full h-[700px] rounded-2xl
        overflow-hidden shadow-lg">

        <MapContainer
          center={position}
          zoom={7}
          scrollWheelZoom={true}
          className="w-full h-full"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {/* Controls map position after district selection */}
          <MapController
            selectedDistrict={selectedDistrict}
            markerRefs={markerRefs}
          />

          {/* All district markers */}
          {districts.map((district) => (
            <Marker
              key={district.district}
              position={[
                district.latitude,
                district.longitude,
              ]}
              icon={customIcon}
              ref={(marker) => {
                markerRefs.current[district.district] = marker;
              }}
            >
              <Popup>
                <div className="min-w-40">
                  <h2 className="text-lg font-bold">
                    {district.district}
                  </h2>

                  <p>
                    <strong>Division:</strong>{" "}
                    {district.region}
                  </p>

                  <p>
                    <strong>Status:</strong>{" "}
                    {district.status}
                  </p>

                  <p className="font-semibold mt-2">
                    Covered Areas:
                  </p>

                  <ul className="list-disc pl-5">
                    {district.covered_area.map((area) => (
                      <li key={area}>{area}</li>
                    ))}
                  </ul>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>
    </div>
  );
};

export default Coverage;