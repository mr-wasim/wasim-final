// components/RequireLocation.js
import { useEffect, useState } from "react";

export default function RequireLocation({ children }) {
  const [status, setStatus] = useState("pending"); // pending | allowed | denied

  useEffect(() => {
    // Trigger geolocation request immediately on mobile
    if (!navigator.geolocation) {
      alert("Geolocation not supported by your browser");
      setStatus("denied");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        console.log("User coords:", position.coords);
        setStatus("allowed");
      },
      (error) => {
        console.error("Location error:", error);
        setStatus("denied");
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 } // mobile-friendly options
    );
  }, []);

  if (status === "pending") {
    // Waiting for permission
    return (
      <div className="flex items-center justify-center h-screen bg-gray-100">
        <p className="text-lg font-semibold">
          Please allow location to continue...
        </p>
      </div>
    );
  }

  if (status === "denied") {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-gray-100">
        <p className="text-red-600 font-bold mb-4">
          Location permission is required to use this app.
        </p>
        <button
          className="px-4 py-2 bg-blue-600 text-white rounded"
          onClick={() => window.location.reload()}
        >
          Try Again
        </button>
      </div>
    );
  }

  return children;
}
