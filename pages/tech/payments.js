"use client";
export const dynamic = "force-dynamic";

import Header from "../../components/Header";
import BottomNav from "../../components/BottomNav";
import SignaturePad from "react-signature-canvas";
import { useEffect, useRef, useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";

// 🔊 SUCCESS SOUND (forward.mp3)
const successSound =
  typeof window !== "undefined" ? new Audio("/forward.mp3") : null;

function playSuccessSound() {
  try {
    if (!successSound) return;
    successSound.currentTime = 0;
    successSound.play().catch(() => {});
  } catch {}
}

export default function Payments() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const [deviceToken, setDeviceToken] = useState(null);

  // 🔹 Paying name + signature only (mode/amounts auto-calc होंगे)
  const [form, setForm] = useState({
    receiver: "",
    receiverSignature: "",
  });

  const sigRef = useRef();
  const [canvasWidth, setCanvasWidth] = useState(500);

  // 🔹 Call selection states (multi-call)
  const [calls, setCalls] = useState([]);
  const [callsLoading, setCallsLoading] = useState(false);
  const [callModalOpen, setCallModalOpen] = useState(false);
  const [callSearch, setCallSearch] = useState("");

  // 🟦 Technician-selected calls with per-call payments
  const [selectedCalls, setSelectedCalls] = useState([]);

  // 🎉 Happy success overlay
  const [showSuccessOverlay, setShowSuccessOverlay] = useState(false);

  // ✅ Responsive SignaturePad width
  useEffect(() => {
    const updateSize = () => {
      setCanvasWidth(window.innerWidth < 640 ? window.innerWidth - 40 : 500);
    };
    updateSize();
    window.addEventListener("resize", updateSize);
    return () => window.removeEventListener("resize", updateSize);
  }, []);

  // ✅ Fetch user fast
  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      try {
        const me = await fetch("/api/auth/me", { signal: controller.signal });
        if (!me.ok) {
          window.location.href = "/login";
          return;
        }
        const u = await me.json();
        if (u.role !== "technician") {
          window.location.href = "/login";
          return;
        }
        setUser(u);
      } catch (err) {
        if (err.name !== "AbortError") console.error(err);
      } finally {
        setLoading(false);
      }
    })();
    return () => controller.abort();
  }, []);

  // ✅ Load technician calls (same source जैसा /tech/my-calls वाले page में)
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
        }));
        setCalls(mapped);
      }
    } catch (err) {
      console.error("Calls load error:", err);
    } finally {
      setCallsLoading(false);
    }
  };

  // पहली बार page load पर ही calls भी preload कर देंगे
  useEffect(() => {
    if (!user) return;
    loadCalls();
  }, [user]);

  // ✅ Firebase Push Notification Setup (lazy load)
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { getMessaging, getToken, onMessage } = await import(
          "firebase/messaging"
        );
        const { initializeApp, getApps, getApp } = await import("firebase/app");

        const firebaseConfig = {
          apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
          authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
          projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
          storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
          messagingSenderId:
            process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
          appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
        };

        const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
        const messaging = getMessaging(app);

        const permission = await Notification.requestPermission();
        if (permission !== "granted") return;

        const token = await getToken(messaging, {
          vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
        });

        if (mounted && token) {
          setDeviceToken(token);
          await fetch("/api/save-fcm-token", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token }),
          });
        }

        onMessage(messaging, (payload) => {
          toast.custom(
            <div className="bg-blue-600 text-white px-4 py-2 rounded-lg shadow-lg">
              📢 {payload?.notification?.title || "New Notification"}
              <br />
              {payload?.notification?.body || ""}
            </div>
          );
        });
      } catch (err) {
        console.error("🔥 Firebase Messaging Init Error:", err);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // ✅ Clear signature
  const clearSig = () => {
    sigRef.current?.clear();
    setForm((prev) => ({ ...prev, receiverSignature: "" }));
  };

  // ✅ Input handler
  const handleChange = (field) => (e) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }));

  // 🔹 Add call to selected list (multi-select)
  const addCallToSelected = (call) => {
    if (!call) return;
    setSelectedCalls((prev) => {
      if (prev.some((c) => c._id === call._id)) return prev; // already added
      return [
        ...prev,
        {
          ...call,
          onlineAmount: "",
          cashAmount: "",
        },
      ];
    });
    setCallModalOpen(false);
  };

  const removeSelectedCall = (id) => {
    setSelectedCalls((prev) => prev.filter((c) => c._id !== id));
  };

  const updateSelectedAmount = (id, field, value) => {
    setSelectedCalls((prev) =>
      prev.map((c) =>
        c._id === id
          ? {
              ...c,
              [field]: value,
            }
          : c
      )
    );
  };

  // 🔢 Totals
  const { totalOnline, totalCash, totalCombined } = useMemo(() => {
    let online = 0;
    let cash = 0;
    for (const c of selectedCalls) {
      online += Number(c.onlineAmount || 0);
      cash += Number(c.cashAmount || 0);
    }
    return {
      totalOnline: online,
      totalCash: cash,
      totalCombined: online + cash,
    };
  }, [selectedCalls]);

  // 🔍 Filtered calls for modal search
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

  // ✅ Submit form
  async function submit(e) {
    e.preventDefault();

    if (!selectedCalls.length) {
      return toast.error("Please select at least one call");
    }

    if (!form.receiver) {
      return toast.error("Please enter paying name");
    }

    const receiverSignature =
      form.receiverSignature || sigRef.current?.toDataURL();
    if (!receiverSignature) {
      return toast.error("Receiver signature required");
    }

    // Mode derive automatically
    let mode = "";
    if (totalOnline > 0 && totalCash > 0) mode = "Both";
    else if (totalOnline > 0) mode = "Online";
    else if (totalCash > 0) mode = "Cash";

    if (!mode) {
      return toast.error("Please enter at least one amount (online/cash)");
    }

    try {
      const payload = {
        receiver: form.receiver,
        mode,
        onlineAmount: String(totalOnline),
        cashAmount: String(totalCash),
        receiverSignature,
        // per-call breakdown (backend extra info)
        calls: selectedCalls.map((c) => ({
          callId: c._id,
          clientName: c.clientName,
          phone: c.phone,
          address: c.address,
          type: c.type,
          price: c.price,
          onlineAmount: Number(c.onlineAmount || 0),
          cashAmount: Number(c.cashAmount || 0),
        })),
      };

      const r = await fetch("/api/tech/payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const d = await r.json();
      if (!r.ok) {
        return toast.error(d.message || "Failed to record payment");
      }

      // 🔊 SOUND
      playSuccessSound();

      // 🎉 Toast
      toast.success("✅ Payment recorded successfully");

      // 🔔 Optional notification
      if (deviceToken) {
        await fetch("/api/sendNotification", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            token: deviceToken,
            title: "New Payment Recorded 💰",
            body: `${form.receiver} paid ₹${totalCombined} (${mode})`,
          }),
        });
      }

      // 🎉 Happy overlay
      setShowSuccessOverlay(true);
      setTimeout(() => setShowSuccessOverlay(false), 1600);

      // Reset after success
      setForm({
        receiver: "",
        receiverSignature: "",
      });
      setSelectedCalls([]);
      clearSig();
    } catch (err) {
      console.error("Payment submission failed:", err);
      toast.error("Error recording payment");
    }
  }

  // ✅ Skeleton UI while loading
  if (loading)
    return (
      <div className="p-6 space-y-4 animate-pulse">
        <div className="h-8 bg-gray-200 rounded w-1/2 mx-auto"></div>
        <div className="h-6 bg-gray-200 rounded w-3/4 mx-auto"></div>
        <div className="h-6 bg-gray-200 rounded w-2/3 mx-auto"></div>
        <div className="h-40 bg-gray-200 rounded"></div>
      </div>
    );

  return (
    <div className="pb-20">
      <Header user={user} />

      <main className="max-w-2xl mx-auto p-4 space-y-3">
        <div className="card bg-white p-4 rounded-2xl shadow-md">
          <div className="flex items-center gap-2 mb-3">
            <div>💳</div>
            <div className="font-semibold text-gray-800 text-lg">
              Service Payments
            </div>
          </div>

          <form onSubmit={submit} className="grid gap-3">
            {/* 🔹 Select Call */}
            <div className="space-y-1">
              <div className="text-sm font-semibold text-gray-700">
                Select Call(s)
              </div>
              <button
                type="button"
                onClick={() => setCallModalOpen(true)}
                className="w-full border rounded-lg px-3 py-2 bg-gray-50 hover:bg-gray-100 flex justify-between items-center text-sm"
              >
                <span className="truncate">
                  {selectedCalls.length
                    ? `${selectedCalls.length} call(s) selected`
                    : "Tap to select calls"}
                </span>
                <span className="text-gray-500 text-xs">View Calls ▾</span>
              </button>
            </div>

            {/* 🔹 Selected Calls List with Payment Inputs */}
            {selectedCalls.length > 0 ? (
              <div className="space-y-2">
                {selectedCalls.map((c) => (
                  <div
                    key={c._id}
                    className="border rounded-xl p-3 bg-slate-50 flex flex-col gap-2"
                  >
                    <div className="flex justify-between gap-2">
                      <div>
                        <div className="text-sm font-semibold">
                          {c.clientName || "Unknown"}
                        </div>
                        <div className="text-xs text-gray-600">
                          {c.phone || "-"}
                        </div>
                        <div className="text-xs text-gray-500 line-clamp-1">
                          {c.address || "-"}
                        </div>
                        <div className="text-[11px] text-gray-400 mt-0.5">
                          {c.type || "Service"} • ₹{c.price}
                        </div>
                      </div>
                      <button
                        type="button"
                        className="text-xs text-red-500 hover:text-red-600"
                        onClick={() => removeSelectedCall(c._id)}
                      >
                        ✕ Remove
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <div className="mb-1 text-gray-600">
                          Online Amount (₹)
                        </div>
                        <input
                          type="number"
                          className="w-full border rounded-lg px-2 py-1"
                          value={c.onlineAmount}
                          onChange={(e) =>
                            updateSelectedAmount(
                              c._id,
                              "onlineAmount",
                              e.target.value
                            )
                          }
                          min="0"
                        />
                      </div>
                      <div>
                        <div className="mb-1 text-gray-600">
                          Cash Amount (₹)
                        </div>
                        <input
                          type="number"
                          className="w-full border rounded-lg px-2 py-1"
                          value={c.cashAmount}
                          onChange={(e) =>
                            updateSelectedAmount(
                              c._id,
                              "cashAmount",
                              e.target.value
                            )
                          }
                          min="0"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-xs text-gray-500 border border-dashed rounded-xl p-3 bg-slate-50">
                No calls selected yet. Select at least one call to record
                payment.
              </div>
            )}

            {/* 🔹 Totals */}
            <div className="text-xs text-gray-700 bg-slate-50 border rounded-xl px-3 py-2 flex flex-wrap gap-2 justify-between">
              <span>
                Online:{" "}
                <span className="font-semibold">₹{totalOnline || 0}</span>
              </span>
              <span>
                Cash:{" "}
                <span className="font-semibold">₹{totalCash || 0}</span>
              </span>
              <span>
                Total:{" "}
                <span className="font-semibold">₹{totalCombined || 0}</span>
              </span>
            </div>

            {/* 🔹 Paying Name */}
            <div>
              <div className="text-sm font-semibold mb-1">Paying Name</div>
              <input
                className="input w-full border rounded-lg px-3 py-2 focus:ring focus:ring-blue-200 text-sm"
                placeholder="Customer who paid"
                value={form.receiver}
                onChange={handleChange("receiver")}
              />
            </div>

            {/* 🔹 Signature */}
            <div>
              <div className="text-sm font-semibold mb-1">
                Receiver Signature
              </div>
              <div className="border rounded-xl overflow-hidden shadow-sm">
                <SignaturePad
                  ref={sigRef}
                  canvasProps={{
                    className: "sigCanvas bg-white w-full",
                    width: canvasWidth,
                    height: 200,
                  }}
                />
              </div>
              <div className="text-xs text-gray-500 mt-1">
                Signature required.{" "}
                <button
                  type="button"
                  onClick={clearSig}
                  className="underline"
                >
                  Clear
                </button>
              </div>
            </div>

            {/* 🔹 Submit */}
            <button
              className="bg-blue-600 text-white w-full rounded-lg py-2 font-medium hover:bg-blue-700 active:scale-95 transition disabled:opacity-60"
              type="submit"
            >
              Submit Payment
            </button>
          </form>
        </div>
      </main>

      <BottomNav />

      {/* 🔵 CALL SELECT MODAL */}
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
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
            >
              <div className="flex justify-between items-center mb-3">
                <h2 className="font-semibold text-sm">Select Call</h2>
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
                      onClick={() => addCallToSelected(c)}
                      className="w-full border rounded-xl px-3 py-2 text-sm hover:bg-blue-50 text-left transition"
                    >
                      <div className="font-semibold">
                        {c.clientName || "Unknown"}
                      </div>
                      <div className="text-xs text-gray-600">{c.phone}</div>
                      <div className="text-xs text-gray-500 line-clamp-1">
                        {c.address}
                      </div>
                      <div className="text-[11px] text-gray-400">
                        {c.type || "Service"} • ₹{c.price}
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

      {/* 🎉 HAPPY SUCCESS OVERLAY */}
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
                  Payment Saved Successfully
                </div>
                <div className="text-xs text-gray-600">
                  All call payments recorded. Great job! ✨
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
