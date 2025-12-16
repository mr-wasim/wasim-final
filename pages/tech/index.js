"use client";

import Header from "../../components/Header";
import BottomNav from "../../components/BottomNav";
import SignaturePad from "react-signature-canvas";
import {
  useEffect,
  useRef,
  useState,
  useTransition,
  useMemo,
} from "react";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";

// 🔊 SUCCESS SOUND (same forward.mp3)
const successSound =
  typeof window !== "undefined" ? new Audio("/forward.mp3") : null;

function playSuccessSound() {
  try {
    if (!successSound) return;
    successSound.currentTime = 0;
    successSound.play().catch(() => {});
  } catch {}
}

// ======================================================
//                 MAIN TECH HOME PAGE
// ======================================================

export default function TechHome() {
  const [user, setUser] = useState(null);
  const [isPending, startTransition] = useTransition();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    clientName: "",
    address: "",
    payment: "",
    phone: "",
    status: "Services Done",
    signature: "",
  });

  const [canvasWidth, setCanvasWidth] = useState(500);
  const sigRef = useRef();

  // ---------------- Call Select Modal States ----------------
  const [calls, setCalls] = useState([]);
  const [callsLoading, setCallsLoading] = useState(false);
  const [callModalOpen, setCallModalOpen] = useState(false);
  const [callSearch, setCallSearch] = useState("");
  const [selectedCall, setSelectedCall] = useState(null);

  // 🎉 Happy success overlay
  const [showSuccessOverlay, setShowSuccessOverlay] = useState(false);

  // ---------------- Responsive Canvas ----------------
  useEffect(() => {
    const updateSize = () => {
      setCanvasWidth(window.innerWidth < 500 ? window.innerWidth - 40 : 500);
    };
    updateSize();
    window.addEventListener("resize", updateSize);
    return () => window.removeEventListener("resize", updateSize);
  }, []);

  // ======================================================
  //     CORRECT & FULL FAST CALL FETCHER (WORKING)
  // ======================================================
  const loadCalls = async () => {
    try {
      setCallsLoading(true);

      const params = new URLSearchParams({
        tab: "All Calls",
        page: "1",
        pageSize: "50",
      });

      const r = await fetch("/api/tech/my-calls?" + params.toString(), {
        cache: "no-store",
      });

      const d = await r.json();

      if (d?.success && Array.isArray(d.items)) {
        const mapped = d.items.map((i) => ({
          _id: i._id || i.id || "",
          clientName:
            i.clientName ??
            i.customerName ??
            i.name ??
            i.fullName ??
            "",
          phone: i.phone ?? "",
          address: i.address ?? "",
          type: i.type ?? "",
          price: i.price ?? 0,
          status: i.status ?? "Pending",
          createdAt: i.createdAt ?? "",
          timeZone: i.timeZone ?? "",
          notes: i.notes ?? "",
        }));

        setCalls(mapped);
      } else {
        console.warn("No calls found");
      }
    } catch (err) {
      console.error("Calls load error:", err);
    } finally {
      setCallsLoading(false);
    }
  };

  // ======================================================
  //                 AUTH + LOAD CALLS
  // ======================================================
  useEffect(() => {
    (async () => {
      try {
        const me = await fetch("/api/auth/me", { cache: "no-store" });
        if (!me.ok) {
          window.location.href = "/login";
          return;
        }

        const u = await me.json();
        if (u.role !== "technician") {
          window.location.href = "/login";
          return;
        }

        startTransition(() => {
          setUser(u);
          setLoading(false);
        });

        loadCalls();
      } catch {
        window.location.href = "/login";
      }
    })();
  }, []);

  // ======================================================
  //                 CLEAR SIGNATURE
  // ======================================================
  function clearSig() {
    sigRef.current?.clear();
    setForm((prev) => ({ ...prev, signature: "" }));
  }

  // ======================================================
  //     Auto-Fill FORM when selecting a call from Modal
  // ======================================================
  function handleSelectCall(call) {
    if (!call) return;

    startTransition(() => {
      setSelectedCall(call);
      setForm((prev) => ({
        ...prev,
        clientName: call.clientName || "",
        address: call.address || "",
        phone: call.phone || "",
        payment: call.price ?? "",
      }));

      setCallModalOpen(false);
    });
  }

  // ======================================================
  //                 SUBMIT FORM
  // ======================================================
  async function submit(e) {
    e.preventDefault();
    try {
      setSubmitting(true);
      const signature = form.signature || sigRef.current?.toDataURL();
      const r = await fetch("/api/tech/submit-form", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, signature }),
      });
      const d = await r.json();
      if (!r.ok) {
        toast.error(d.error || "Failed");
        return;
      }

      // 🔊 SUCCESS SOUND
      playSuccessSound();

      // 🎉 Happy toast
      toast.success("Form submitted ✅");

      // 🎉 Show happy overlay
      setShowSuccessOverlay(true);
      setTimeout(() => {
        setShowSuccessOverlay(false);
      }, 1600);

      setForm({
        clientName: "",
        address: "",
        payment: "",
        phone: "",
        status: "Services Done",
        signature: "",
      });
      setSelectedCall(null);
      clearSig();
    } catch (err) {
      console.error(err);
      toast.error("Submit failed");
    } finally {
      setSubmitting(false);
    }
  }

  // ======================================================
  //                    LOADING SKELETON
  // ======================================================
  const Skeleton = () => (
    <div className="animate-pulse space-y-4 p-4">
      <div className="h-6 bg-gray-200 rounded w-1/3"></div>
      <div className="h-10 bg-gray-200 rounded"></div>
      <div className="h-10 bg-gray-200 rounded"></div>
      <div className="h-10 bg-gray-200 rounded"></div>
      <div className="h-10 bg-gray-200 rounded"></div>
      <div className="h-32 bg-gray-200 rounded"></div>
      <div className="h-10 bg-gray-300 rounded w-1/2 mx-auto"></div>
    </div>
  );

  // ======================================================
  //               SEARCH FILTER inside Modal
  // ======================================================
  const filteredCalls = useMemo(() => {
    if (!callSearch.trim()) return calls;
    const q = callSearch.toLowerCase();
    return calls.filter(
      (c) =>
        (c.clientName || "").toLowerCase().includes(q) ||
        (c.phone || "").toLowerCase().includes(q) ||
        (c.address || "").toLowerCase().includes(q)
    );
  }, [calls, callSearch]);

  // ======================================================
  //                     MAIN UI
  // ======================================================
  return (
    <div className="pb-16">
      <Header user={user} />

      <main className="max-w-2xl mx-auto p-4 space-y-3">
        <div className="card shadow-md p-4 rounded-2xl border border-gray-100 bg-white">
          <div className="flex items-center gap-2 mb-3">
            <div>📝</div>
            <div className="font-semibold text-lg">Service Form</div>
          </div>

          {loading ? (
            <Skeleton />
          ) : (
            <form onSubmit={submit} className="grid gap-3">
              {/* ---------------- SELECT CALL BUTTON ---------------- */}
              <div className="space-y-1">
                <div className="text-sm font-semibold text-gray-700">
                  Select Call (Auto-fill)
                </div>

                <button
                  type="button"
                  onClick={() => setCallModalOpen(true)}
                  className="w-full border rounded-lg px-3 py-2 bg-gray-50 hover:bg-gray-100 flex justify-between"
                >
                  <span className="truncate">
                    {selectedCall
                      ? `${selectedCall.clientName} (${selectedCall.phone})`
                      : "Choose from your assigned calls"}
                  </span>
                  <span className="text-gray-500 text-xs">▾</span>
                </button>
              </div>

              {/* ---------------- FORM INPUTS ---------------- */}
              <input
                className="input border rounded-lg p-2"
                placeholder="Client Name"
                value={form.clientName}
                onChange={(e) =>
                  setForm((p) => ({ ...p, clientName: e.target.value }))
                }
                required
              />

              <input
                className="input border rounded-lg p-2"
                placeholder="Client Address"
                value={form.address}
                onChange={(e) =>
                  setForm((p) => ({ ...p, address: e.target.value }))
                }
                required
              />

              <input
                className="input border rounded-lg p-2"
                type="number"
                placeholder="Payment (₹)"
                value={form.payment}
                onChange={(e) =>
                  setForm((p) => ({ ...p, payment: e.target.value }))
                }
              />

              <input
                className="input border rounded-lg p-2"
                placeholder="Phone Number"
                value={form.phone}
                onChange={(e) =>
                  setForm((p) => ({ ...p, phone: e.target.value }))
                }
                required
              />

              <select
                className="input border rounded-lg p-2"
                value={form.status}
                onChange={(e) =>
                  setForm((p) => ({ ...p, status: e.target.value }))
                }
              >
                <option>Services Done</option>
                <option>Installation Done</option>
                <option>Complaint Done</option>
                <option>Under Process</option>
              </select>

              {/* ---------------- SIGNATURE PAD ---------------- */}
              <div>
                <div className="text-sm font-semibold mb-1">Client Signature</div>
                <div className="border rounded-xl overflow-hidden">
                  <SignaturePad
                    ref={sigRef}
                    canvasProps={{
                      width: canvasWidth,
                      height: 200,
                      className: "sigCanvas w-full",
                    }}
                  />
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  Sign inside the box.
                  <button
                    type="button"
                    onClick={clearSig}
                    className="underline ml-2"
                  >
                    Clear
                  </button>
                </div>
              </div>

              <button
                className="bg-blue-600 text-white font-semibold py-2 rounded-lg mt-2 active:scale-95 disabled:opacity-60"
                disabled={submitting}
              >
                {submitting ? "Submitting..." : "Submit"}
              </button>
            </form>
          )}
        </div>
      </main>

      <BottomNav />

      {/* ======================================================
                     CALL SELECTION MODAL
      ====================================================== */}
      <AnimatePresence>
        {callModalOpen && (
          <motion.div
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="w-full max-w-md bg-white rounded-2xl shadow-xl p-4 max-h-[80vh] flex flex-col"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
            >
              <div className="flex justify-between mb-3">
                <h2 className="font-semibold">Select Call</h2>
                <button
                  onClick={() => setCallModalOpen(false)}
                  className="text-gray-500 hover:text-black text-lg"
                >
                  ✕
                </button>
              </div>

              <input
                className="border rounded-lg px-3 py-2 mb-2 text-sm"
                placeholder="Search by name / phone / address"
                value={callSearch}
                onChange={(e) => setCallSearch(e.target.value)}
              />

              <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                {callsLoading && (
                  <div className="text-center text-gray-500 py-4 text-sm">
                    Loading calls...
                  </div>
                )}

                {!callsLoading &&
                  filteredCalls.map((c) => (
                    <button
                      key={c._id}
                      type="button"
                      onClick={() => handleSelectCall(c)}
                      className="w-full border rounded-xl px-3 py-2 text-sm hover:bg-blue-50 text-left transition"
                    >
                      <div className="font-semibold">{c.clientName}</div>
                      <div className="text-xs text-gray-600">{c.phone}</div>
                      <div className="text-xs text-gray-500">{c.address}</div>
                      <div className="text-[11px] text-gray-400">
                        {c.type} • ₹{c.price}
                      </div>
                    </button>
                  ))}

                {!callsLoading && filteredCalls.length === 0 && (
                  <div className="text-center text-gray-500 py-4 text-sm">
                    No calls found.
                  </div>
                )}
              </div>

              <button
                onClick={() => setCallModalOpen(false)}
                className="mt-3 bg-gray-900 text-white py-2 rounded-xl text-sm"
              >
                Close
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ======================================================
                     HAPPY SUCCESS OVERLAY
      ====================================================== */}
      <AnimatePresence>
        {showSuccessOverlay && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              initial={{ scale: 0.7, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.7, opacity: 0, y: 20 }}
              transition={{ type: "spring", stiffness: 180, damping: 15 }}
              className="relative bg-white rounded-3xl px-8 py-6 shadow-2xl text-center max-w-xs w-full overflow-hidden"
            >
              {/* soft background circles */}
              <div className="pointer-events-none absolute -top-10 -left-10 h-24 w-24 bg-blue-100 rounded-full opacity-70" />
              <div className="pointer-events-none absolute -bottom-12 -right-6 h-28 w-28 bg-emerald-100 rounded-full opacity-70" />

              <div className="relative z-10 flex flex-col items-center gap-2">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 220, delay: 0.05 }}
                  className="h-14 w-14 rounded-full bg-emerald-500 flex items-center justify-center shadow-lg"
                >
                  <span className="text-white text-3xl">✔</span>
                </motion.div>
                <div className="text-base font-semibold text-gray-900">
                  Service Saved Successfully
                </div>
                <div className="text-xs text-gray-600">
                  Client details & signature recorded. Great job! ✨
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
