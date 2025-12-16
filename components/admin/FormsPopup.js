import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import PopupShell from "./PopupShell";

export default function FormsPopup({ onClose }) {
  const [forms, setForms] = useState(null);
  const [active, setActive] = useState(null);

  // preview image for lightbox
  const [preview, setPreview] = useState(null);

  // Filter system
  const [filterMode, setFilterMode] = useState("month");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  useEffect(() => {
    load();
  }, []);

  /** LOAD CUSTOMER FORMS **/
  async function load(apply = false) {
    try {
      setForms(null);

      let url = "/api/admin/forms";

      if (filterMode === "month") url += "?range=month";
      if (filterMode === "custom" && apply && startDate && endDate)
        url += `?start=${startDate}&end=${endDate}`;

      const r = await fetch(url, { cache: "no-store" });
      const d = await r.json();

      // Correct technician name mapping and normalize stickers field
      const list = (d.items || []).map((x) => ({
        ...x,
        techName:
          x.techUsername ||
          x.technician?.username ||
          x.technicianName ||
          x.tech ||
          x.assignedTech ||
          "N/A",
        stickers: Array.isArray(x.stickers) ? x.stickers : (x.sticker ? [x.sticker] : []),
      }));

      setForms(list);
    } catch (err) {
      console.error(err);
      setForms([]);
    }
  }

  return (
    <PopupShell title="Customer Forms" onClose={onClose} width="max-w-4xl">
      {/* FILTER BAR */}
      <div className="mb-5 p-3 bg-gray-50 rounded-2xl border">
        <div className="flex flex-wrap gap-3 mb-3">
          <button
            onClick={() => { setFilterMode("month"); load(); }}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition ${
              filterMode === "month" ? "bg-blue-600 text-white shadow" : "bg-white border"
            }`}
          >
            This Month
          </button>

          <button
            onClick={() => setFilterMode("custom")}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition ${
              filterMode === "custom" ? "bg-blue-600 text-white shadow" : "bg-white border"
            }`}
          >
            Custom Date
          </button>
        </div>

        {/* DATE FILTER UI */}
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

      {/* LOADING SKELETON */}
      {forms === null && (
        <div className="space-y-3">
          {[1,2,3].map(i => (
            <div key={i} className="p-4 bg-white rounded-2xl border shadow animate-pulse">
              <div className="h-4 bg-gray-300 w-1/3 rounded mb-2"></div>
              <div className="h-3 bg-gray-200 w-1/4 rounded"></div>
            </div>
          ))}
        </div>
      )}

      {/* EMPTY */}
      {forms !== null && forms.length === 0 && (
        <div className="text-center py-10 text-gray-500 bg-yellow-50 border rounded-xl">
          No forms found.
        </div>
      )}

      {/* FORMS LIST */}
      {forms !== null && forms.length > 0 && (
        <div className="space-y-3">
          {forms.map((f) => (
            <motion.div
              key={f._id}
              onClick={() => setActive(f)}
              whileHover={{ scale: 1.015 }}
              className="p-4 bg-white rounded-2xl shadow border cursor-pointer transition flex items-center gap-4"
            >
              {/* thumbnail (if available) */}
              <div className="w-16 h-16 flex-shrink-0 rounded-lg overflow-hidden bg-slate-100 border">
                {f.stickers && f.stickers.length > 0 ? (
                  <img
                    src={f.stickers[0]}
                    alt="sticker thumbnail"
                    className="w-full h-full object-cover"
                    onError={(e) => { e.currentTarget.src = "/placeholder-image.png"; }}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-xs text-gray-400">
                    No Photo
                  </div>
                )}
              </div>

              <div className="flex-1">
                <div className="text-lg font-semibold text-gray-800">{f.clientName || f.name}</div>
                <div className="text-sm text-gray-500">{f.phone}</div>
                <div className="text-xs text-gray-500 mt-1">Submitted by: <b>{f.techName}</b></div>
              </div>

              <div className="text-right">
                <div className="text-sm text-gray-400">{new Date(f.createdAt).toLocaleDateString()}</div>
                <div className="mt-2 inline-flex items-center gap-2">
                  <div className="text-xs text-slate-600 bg-slate-100 px-2 py-1 rounded-full">
                    {f.stickers?.length || 0} photo{(f.stickers?.length || 0) !== 1 ? "s" : ""}
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* DETAILS POPUP */}
      <AnimatePresence>
        {active && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur flex items-center justify-center z-[1000]"
          >
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 15 }}
              transition={{ duration: 0.18 }}
              className="bg-white w-[92%] max-w-xl rounded-2xl p-6 shadow-xl border overflow-auto max-h-[90vh]"
            >
              {/* HEADER */}
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-semibold text-gray-800">{active.clientName}</h3>

                <button
                  onClick={() => setActive(null)}
                  className="text-gray-600 hover:text-red-500 text-xl"
                >
                  ✕
                </button>
              </div>

              {/* DETAILS */}
              <div className="space-y-3 text-gray-700 text-sm">
                <p><b>Phone:</b> {active.phone}</p>
                <p><b>Address:</b> {active.address}</p>
                <p><b>Service Type:</b> {active.type}</p>
                <p><b>Created:</b> {new Date(active.createdAt).toLocaleString()}</p>
                <p><b>Technician:</b> {active.techName}</p>

                {/* Signature */}
                {active.signature && (
                  <div>
                    <b>Customer Signature:</b>
                    <img
                      src={active.signature}
                      className="mt-2 w-full h-32 object-contain border p-2 rounded-xl"
                      alt="signature"
                      onError={(e) => { e.currentTarget.style.display = "none"; }}
                    />
                  </div>
                )}

                {/* Notes */}
                {active.extraNotes && <p><b>Notes:</b> {active.extraNotes}</p>}

                {/* Stickers gallery */}
                <div>
                  <b>Photos:</b>
                  {(!active.stickers || active.stickers.length === 0) ? (
                    <div className="mt-2 text-xs text-gray-500">No photos uploaded for this form.</div>
                  ) : (
                    <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {active.stickers.map((url, i) => (
                        <div key={i} className="relative rounded-lg overflow-hidden border bg-white">
                          <img
                            src={url}
                            alt={`photo-${i}`}
                            className="w-full h-28 object-cover cursor-pointer"
                            onClick={() => setPreview(url)}
                            onError={(e) => { e.currentTarget.src = "/placeholder-image.png"; }}
                          />
                          <div className="p-2 text-[11px] text-slate-600 flex items-center justify-between">
                            <div className="truncate">Photo {i + 1}</div>
                            <div className="flex gap-1">
                              <a
                                href={url}
                                target="_blank"
                                rel="noreferrer"
                                className="text-xs text-slate-500 underline"
                              >
                                Open
                              </a>
                              <a
                                href={url}
                                download
                                className="text-xs text-slate-500 underline"
                              >
                                Download
                              </a>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-4 flex justify-end gap-2">
                <button
                  className="px-4 py-2 bg-red-500 text-white rounded-xl shadow hover:bg-red-600"
                  onClick={() => setActive(null)}
                >
                  Close
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* IMAGE PREVIEW LIGHTBOX */}
      <AnimatePresence>
        {preview && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/70 p-4"
            onClick={() => setPreview(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="max-w-[95%] max-h-[95%] rounded-xl overflow-hidden bg-black"
              onClick={(e) => e.stopPropagation()}
            >
              <img src={preview} alt="preview" className="max-w-full max-h-[80vh] object-contain block m-auto" />
              <div className="p-3 bg-black/60 flex justify-end gap-2">
                <a href={preview} target="_blank" rel="noreferrer" className="text-white text-sm underline">Open in new tab</a>
                <a href={preview} download className="text-white text-sm underline">Download</a>
                <button onClick={() => setPreview(null)} className="text-white text-sm ml-4">Close</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </PopupShell>
  );
}
