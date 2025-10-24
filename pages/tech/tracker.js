import { useEffect } from "react";

export default function TechnicianTracker() {
  useEffect(() => {
    const technicianId = "TECH123"; // unique ID
    const sendLocation = async (lat, lng) => {
      await fetch("/api/update-location", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ technicianId, lat, lng }),
      });
    };

    if ("geolocation" in navigator) {
      const watchId = navigator.geolocation.watchPosition(
        (pos) => {
          const { latitude, longitude } = pos.coords;
          sendLocation(latitude, longitude);
        },
        (err) => console.error(err),
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 10000 }
      );

      return () => navigator.geolocation.clearWatch(watchId);
    }
  }, []);

  return (
    <div className="text-center py-10">
      <h2>📍 Tracking Active...</h2>
    </div>
  );
}
