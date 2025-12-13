import { useEffect, useState } from "react";
import PopupShell from "./PopupShell";

export default function TechnicianPopup({ onClose }) {
  const [techs, setTechs] = useState(null);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [filterMode, setFilterMode] = useState("month");

  useEffect(() => {
    load();
  }, []);

  async function load(apply = false) {
    setTechs(null); // show skeleton

    try {
      let url = "/api/admin/get-technicians";

      if (filterMode === "month") url += "?range=month";

      if (filterMode === "custom" && apply && startDate && endDate)
        url += `?start=${startDate}&end=${endDate}`;

      const res = await fetch(url, { cache: "no-store" });
      const d = await res.json();

      const list = (d.data || []).map((t) => ({
        id: t._id,
        name: t.name || t.username || "Unknown",
        totalCalls: t.totalCalls || 0,
        pending: t.pending || 0,
        closed: t.closed || 0,
        cancelled: t.cancelled || 0,
      }));

      setTechs(list);
    } catch (err) {
      console.error(err);
      setTechs([]);
    }
  }

  return (
    <PopupShell title="Technicians Overview" onClose={onClose}>
      
      {/* FILTER SECTION */}
      <div className="mb-5 p-3 bg-gray-50 rounded-2xl border">

        {/* FILTER BUTTONS */}
        <div className="flex flex-wrap gap-3 mb-3">
          
          <button
            onClick={() => {
              setFilterMode("month");
              load();
            }}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition ${
              filterMode === "month"
                ? "bg-blue-600 text-white shadow"
                : "bg-white border"
            }`}
          >
            This Month
          </button>

          <button
            onClick={() => setFilterMode("custom")}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition ${
              filterMode === "custom"
                ? "bg-blue-600 text-white shadow"
                : "bg-white border"
            }`}
          >
            Custom Date
          </button>

        </div>

        {/* CUSTOM DATE UI */}
        {filterMode === "custom" && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-center">

            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-white p-2 px-4 rounded-xl border shadow-sm w-full"
            />

            <span className="text-center text-gray-500">to</span>

            <div className="flex gap-2">
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-white p-2 px-4 rounded-xl border shadow-sm w-full"
              />

              <button
                onClick={() => load(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded-xl shadow hover:bg-blue-700 transition"
              >
                Apply
              </button>
            </div>

          </div>
        )}
      </div>

      {/* SKELETON LOADER */}
      {techs === null && (
        <div className="space-y-4 animate-fadeIn">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="p-5 bg-white rounded-2xl shadow border animate-pulse">
              <div className="h-4 bg-gray-300 rounded w-1/3 mb-3" />
              <div className="h-3 bg-gray-200 rounded w-1/4 mb-4" />

              <div className="grid grid-cols-3 gap-3">
                <div className="h-10 bg-gray-200 rounded-xl"></div>
                <div className="h-10 bg-gray-200 rounded-xl"></div>
                <div className="h-10 bg-gray-200 rounded-xl"></div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* NO DATA */}
      {techs !== null && techs.length === 0 && (
        <div className="text-center text-gray-500 py-10 bg-yellow-50 rounded-2xl border">
          No technicians found.
        </div>
      )}

      {/* TECHNICIAN LIST */}
      {techs !== null && techs.length > 0 && (
        <div className="space-y-4 will-change-transform">
          {techs.map((t) => (
            <div
              key={t.id}
              className="p-5 bg-white rounded-2xl shadow-md border hover:shadow-xl hover:border-blue-400 transition cursor-pointer"
              style={{ transform: "translateZ(0)" }}
            >
              <div className="flex justify-between">
                <div>
                  <div className="text-xl font-semibold text-gray-800">{t.name}</div>
                  <div className="text-sm text-gray-500">{t.phone}</div>
                </div>

                <div className="text-right">
                  <div className="text-xs text-gray-500">Total Calls</div>
                  <div className="text-2xl font-bold text-blue-600">
                    {t.totalCalls}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 mt-3 text-sm">
                <div className="bg-yellow-50 p-2 rounded-xl text-center">
                  Pending <br />
                  <b className="text-yellow-600">{t.pending}</b>
                </div>

                <div className="bg-green-50 p-2 rounded-xl text-center">
                  Closed <br />
                  <b className="text-green-600">{t.closed}</b>
                </div>

                <div className="bg-red-50 p-2 rounded-xl text-center">
                  Cancelled <br />
                  <b className="text-red-600">{t.cancelled}</b>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </PopupShell>
  );
}
