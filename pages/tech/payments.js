// pages/tech/payment.js
"use client";
export const dynamic = "force-dynamic";

import Header from "../../components/Header";
import BottomNav from "../../components/BottomNav";
import SignaturePad from "react-signature-canvas";
import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";

/* 🔊 SUCCESS SOUND (forward.mp3) */
const successSound = typeof window !== "undefined" ? new Audio("/forward.mp3") : null;
function playSuccessSound() {
  try {
    if (!successSound) return;
    successSound.currentTime = 0;
    successSound.play().catch(() => {});
  } catch {}
}

/* Normalizer helpers */
function normalizeKey(clientName = "", phone = "", address = "") {
  return (
    String(clientName || "")
      .toLowerCase()
      .replace(/\s+/g, " ")
      .replace(/[^\w\d\s+,-]/g, "")
      .trim() +
    "|" +
    String(phone || "").toLowerCase().replace(/\s+/g, "").replace(/\D/g, "") +
    "|" +
    String(address || "").toLowerCase().replace(/\s+/g, " ").trim()
  );
}

/* Simple debounce hook (client-side) */
function useDebounced(value, ms = 250) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

export default function Payments() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const [deviceToken, setDeviceToken] = useState(null);

  const [form, setForm] = useState({ receiver: "", receiverSignature: "" });
  const sigRef = useRef();
  const [canvasWidth, setCanvasWidth] = useState(500);

  // lifetime calls with merged paymentStatus + activityTime
  const [calls, setCalls] = useState([]);
  const [callsLoading, setCallsLoading] = useState(false);

  const [callModalOpen, setCallModalOpen] = useState(false);
  const [callSearch, setCallSearch] = useState("");
  const callSearchDebounced = useDebounced(callSearch, 220);

  // Changed per your request: remove "All" — keep "pending" and "paid"
  const [modalTab, setModalTab] = useState("pending"); // default pending
  const [showAllInModal, setShowAllInModal] = useState(false);

  const [selectedCalls, setSelectedCalls] = useState([]);
  const [showSuccessOverlay, setShowSuccessOverlay] = useState(false);

  /* responsive canvas */
  useEffect(() => {
    const updateSize = () => setCanvasWidth(window.innerWidth < 640 ? window.innerWidth - 40 : 500);
    updateSize();
    window.addEventListener("resize", updateSize);
    return () => window.removeEventListener("resize", updateSize);
  }, []);

  /* quick fetch current user (must be technician) */
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

  /* -------------------------
     loadCalls: concurrent fetch + build fast index + compute activityTime
     - Uses: /api/tech/my-calls?pageSize=1000  (forwarded calls lifetime)
     - Uses: /api/tech/payment-check            (payments summary - supports multiple shapes)
     Behavior:
       * Payment detection: callId match OR normalized (name|phone|address) match
       * activityTime = max(call.createdAt, paymentTimeIfKnown)
       * final sort: newest activity first (descending)
  ------------------------- */
  const loadCalls = useCallback(async () => {
    setCallsLoading(true);
    try {
      // fetch both endpoints concurrently for speed
      const params = new URLSearchParams({ tab: "All Calls", page: "1", pageSize: "1000" });
      const callsPromise = fetch("/api/tech/my-calls?" + params.toString(), { cache: "no-store" }).then((r) => r.json());
      const paymentsPromise = fetch("/api/tech/payment-check", { cache: "no-store" }).then((r) => {
        if (!r.ok) return r.json().catch(() => null);
        return r.json().catch(() => null);
      }).catch(() => null);

      const [d1, d2] = await Promise.all([callsPromise, paymentsPromise]);

      const apiCalls = Array.isArray(d1?.items) ? d1.items : [];

      // Build payment maps
      const paidByCallId = new Set();
      const paidKeySet = new Set();
      const paidTimeByCallId = {}; // callId -> timestamp (ms) if available

      if (d2) {
        if (Array.isArray(d2.items) && d2.items.length > 0) {
          // payments documents
          for (const payDoc of d2.items) {
            const payCreated = payDoc.createdAt ? (new Date(payDoc.createdAt)).getTime() : (payDoc.updatedAt ? (new Date(payDoc.updatedAt)).getTime() : 0);
            if (Array.isArray(payDoc.calls)) {
              for (const pc of payDoc.calls) {
                if (!pc) continue;
                if (pc.callId) {
                  paidByCallId.add(String(pc.callId));
                  const cId = String(pc.callId);
                  if (!paidTimeByCallId[cId] || (payCreated && payCreated > paidTimeByCallId[cId])) {
                    paidTimeByCallId[cId] = payCreated;
                  }
                }
                const key = normalizeKey(pc.clientName || pc.name || "", pc.phone || pc.mobile || "", pc.address || pc.addr || pc.location || "");
                if (key) paidKeySet.add(key);
              }
            }
          }
        } else if (Array.isArray(d2.paidCallIds) && d2.paidCallIds.length > 0) {
          for (const id of d2.paidCallIds) paidByCallId.add(String(id));
        } else if (Array.isArray(d2.paidKeys) && d2.paidKeys.length > 0) {
          for (const k of d2.paidKeys) paidKeySet.add(String(k));
        }
      }

      // Map calls with payment detection and activityTime
      const mapped = apiCalls.map((i) => {
        const createdAt = i.createdAt ? new Date(i.createdAt) : null;
        const createdAtMs = createdAt ? createdAt.getTime() : 0;
        const callIdStr = String(i._id || i.id || "");
        const clientName = i.clientName ?? i.customerName ?? i.name ?? i.fullName ?? "";
        const phone = i.phone ?? i.mobile ?? "";
        const address = i.address ?? i.addr ?? i.location ?? "";
        const price = Number(i.price || 0);

        // Payment detection: callId OR normalized key (name|phone|address) OR raw i.paymentStatus
        let paymentStatus = "Pending";
        const rawPaymentStatus =
          i.paymentStatus || i.payment_status || i.payment_state || i.paymentDone || i.isPaymentDone || "";
        if (rawPaymentStatus === true) paymentStatus = "Paid";
        else if (rawPaymentStatus === false) paymentStatus = "Pending";
        else if (typeof rawPaymentStatus === "string") {
          const s = rawPaymentStatus.toLowerCase();
          if (s === "paid" || s === "payment done" || s === "done" || s === "completed") paymentStatus = "Paid";
        }

        const normalized = normalizeKey(clientName, phone, address);

        // If admin maps mark as paid
        if (paidByCallId.has(callIdStr)) paymentStatus = "Paid";
        if (paidKeySet.has(normalized)) paymentStatus = "Paid";

        // Payment time if we have recorded one
        const payTime = paidTimeByCallId[callIdStr] || 0;

        // Activity time: prefer payment time if available else createdAt
        const activityTime = Math.max(createdAtMs, payTime);

        return {
          _id: callIdStr,
          clientName,
          phone,
          address,
          type: i.type ?? "",
          price,
          status: i.status ?? "Pending",
          createdAt: i.createdAt ?? "",
          createdAtTime: createdAtMs,
          paymentStatus,
          paymentTime: payTime,
          activityTime,
        };
      });

      // Sort by activityTime desc (latest activity first)
      mapped.sort((a, b) => {
        if ((b.activityTime || 0) !== (a.activityTime || 0)) return (b.activityTime || 0) - (a.activityTime || 0);
        return (b.createdAtTime || 0) - (a.createdAtTime || 0);
      });

      setCalls(mapped);
    } catch (err) {
      console.error("Calls load error:", err);
      toast.error("Failed to load calls");
    } finally {
      setCallsLoading(false);
    }
  }, []);

  /* initial load when user present */
  useEffect(() => {
    if (!user) return;
    loadCalls();
  }, [user, loadCalls]);

  /* Firebase push (unchanged) */
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        if (typeof window === "undefined" || !"Notification" in window) return;
        const { getMessaging, getToken, onMessage } = await import("firebase/messaging");
        const { initializeApp, getApps, getApp } = await import("firebase/app");
        const firebaseConfig = {
          apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
          authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
          projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
          storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
          messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
          appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
        };
        const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
        const messaging = getMessaging(app);
        const permission = await Notification.requestPermission();
        if (permission !== "granted") return;
        const token = await getToken(messaging, { vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY });
        if (mounted && token) {
          setDeviceToken(token);
          fetch("/api/save-fcm-token", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token }) }).catch(() => {});
        }
        onMessage(messaging, (payload) => {
          toast.custom(<div className="bg-blue-600 text-white px-4 py-2 rounded-lg shadow-lg">📢 {payload?.notification?.title || "New Notification"}<br />{payload?.notification?.body || ""}</div>);
        });
      } catch (err) {
        console.error("🔥 Firebase Messaging Init Error:", err);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const clearSig = useCallback(() => {
    sigRef.current?.clear();
    setForm((prev) => ({ ...prev, receiverSignature: "" }));
  }, []);

  const handleChange = useCallback((field) => (e) => setForm((prev) => ({ ...prev, [field]: e.target.value })), []);

  const addCallToSelected = useCallback((call) => {
    if (!call) return;
    setSelectedCalls((prev) => {
      if (prev.some((c) => c._id === call._id)) return prev;
      return [...prev, { ...call, onlineAmount: "", cashAmount: "" }];
    });
    setCallModalOpen(false);
  }, []);

  const removeSelectedCall = useCallback((id) => setSelectedCalls((prev) => prev.filter((c) => c._id !== id)), []);
  const updateSelectedAmount = useCallback((id, field, value) => setSelectedCalls((prev) => prev.map((c) => (c._id === id ? { ...c, [field]: value } : c))), []);

  const { totalOnline, totalCash, totalCombined } = useMemo(() => {
    let online = 0, cash = 0;
    for (const c of selectedCalls) {
      online += Number(c.onlineAmount || 0);
      cash += Number(c.cashAmount || 0);
    }
    return { totalOnline: online, totalCash: cash, totalCombined: online + cash };
  }, [selectedCalls]);

  // counts for UI
  const pendingCount = useMemo(() => calls.filter((c) => c.paymentStatus !== "Paid").length, [calls]);
  const paidCount = useMemo(() => calls.filter((c) => c.paymentStatus === "Paid").length, [calls]);

  /* Filtered + slice for modal: search (debounced) and small default slice for speed */
  const filteredCallsForModal = useMemo(() => {
    const q = (callSearchDebounced || "").trim().toLowerCase();
    // base list per modalTab
    let base = calls;
    if (modalTab === "pending") base = calls.filter((c) => c.paymentStatus !== "Paid");
    else base = calls.filter((c) => c.paymentStatus === "Paid");

    if (q.length > 0) {
      base = base.filter((c) => (c.clientName || "").toLowerCase().includes(q) || (c.phone || "").toLowerCase().includes(q) || (c.address || "").toLowerCase().includes(q));
      return base;
    }

    const defaultLimit = modalTab === "paid" ? 5 : 6;
    if (showAllInModal) return base;
    return base.slice(0, defaultLimit);
  }, [calls, modalTab, callSearchDebounced, showAllInModal]);

  /* Submit payment logic (client-side strict checks + POST to /api/tech/payment) */
  const submit = useCallback(async (e) => {
    e.preventDefault();
    if (!selectedCalls.length) return toast.error("Please select at least one call");
    if (!form.receiver) return toast.error("Please enter paying name");
    const receiverSignature = form.receiverSignature || sigRef.current?.toDataURL();
    if (!receiverSignature) return toast.error("Receiver signature required");

    // client-side strict validation: each selected call entered (online+cash) must equal call.price
    for (const c of selectedCalls) {
      const expected = Number(c.price || 0);
      const entered = Number(c.onlineAmount || 0) + Number(c.cashAmount || 0);
      if (!Number.isFinite(entered) || entered <= 0) return toast.error(`Enter amounts for ${c.clientName || c.phone || c._id}`);
      if (entered !== expected) return toast.error(`Price mismatch for ${c.clientName || c.phone || c._id}. Expected ₹${expected}, entered ₹${entered}`);
      // re-check canonical record hasn't changed
      const canonical = calls.find((x) => x._id === c._id);
      if (!canonical) return toast.error(`Call not found anymore: ${c.clientName || c._id}`);
      const keySel = normalizeKey(c.clientName, c.phone, c.address) + `|${Number(c.price || 0)}`;
      const keyCan = normalizeKey(canonical.clientName, canonical.phone, canonical.address) + `|${Number(canonical.price || 0)}`;
      if (keySel !== keyCan) return toast.error(`Selected call data mismatch for ${c.clientName || c._id} — please reselect from modal`);
    }

    let mode = "";
    if (totalOnline > 0 && totalCash > 0) mode = "Both";
    else if (totalOnline > 0) mode = "Online";
    else if (totalCash > 0) mode = "Cash";
    if (!mode) return toast.error("Please enter at least one amount (online/cash)");

    try {
      const payload = {
        receiver: form.receiver,
        mode,
        onlineAmount: String(totalOnline),
        cashAmount: String(totalCash),
        receiverSignature,
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

      const r = await fetch("/api/tech/payment", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const d = await r.json();
      if (!r.ok) {
        const msg = d?.message || d?.error || "Failed to record payment";
        return toast.error(msg);
      }

      // optimistic update: mark selected calls as Paid and set paymentTime = now
      const nowMs = Date.now();
      const paidIds = new Set(selectedCalls.map((c) => c._id));
      setCalls((prev) => prev.map((c) => (paidIds.has(c._id) ? { ...c, paymentStatus: "Paid", paymentTime: nowMs, activityTime: Math.max(c.activityTime || 0, nowMs) } : c)));

      playSuccessSound();
      toast.success("✅ Payment recorded successfully");

      setShowSuccessOverlay(true);
      setTimeout(() => setShowSuccessOverlay(false), 1600);

      setForm({ receiver: "", receiverSignature: "" });
      setSelectedCalls([]);
      clearSig();

      // re-fetch canonical data to be safe (re-merge)
      await loadCalls();
    } catch (err) {
      console.error("Payment submission failed:", err);
      toast.error("Error recording payment");
    }
  }, [selectedCalls, form, totalOnline, totalCash, calls, loadCalls, clearSig]);

  if (loading) return (<div className="p-6 space-y-4 animate-pulse"><div className="h-8 bg-gray-200 rounded w-1/2 mx-auto"></div><div className="h-6 bg-gray-200 rounded w-3/4 mx-auto"></div><div className="h-6 bg-gray-200 rounded w-2/3 mx-auto"></div><div className="h-40 bg-gray-200 rounded"></div></div>);

  return (
    <div className="pb-20">
      <Header user={user} />
      <main className="max-w-2xl mx-auto p-4 space-y-3">
        <div className="card bg-white p-4 rounded-2xl shadow-md">
          <div className="flex items-center gap-2 mb-3"><div>💳</div><div className="font-semibold text-gray-800 text-lg">Service Payments</div></div>

          <form onSubmit={submit} className="grid gap-3">
            <div className="space-y-1">
              <div className="text-sm font-semibold text-gray-700">Select Call(s)</div>
              <button type="button" onClick={() => { setCallSearch(""); setShowAllInModal(false); setModalTab("pending"); setCallModalOpen(true); }} className="w-full border rounded-lg px-3 py-2 bg-gray-50 hover:bg-gray-100 flex justify-between items-center text-sm">
                <span className="truncate">{selectedCalls.length ? `${selectedCalls.length} call(s) selected` : "Tap to select calls"}</span>
                <span className="text-gray-500 text-xs">View Calls ▾</span>
              </button>
            </div>

            {/* Selected calls */}
            {selectedCalls.length > 0 ? (
              <div className="space-y-2">
                {selectedCalls.map((c) => (
                  <div key={c._id} className="border rounded-xl p-3 bg-slate-50 flex flex-col gap-2">
                    <div className="flex justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <div className="truncate">
                            <div className="text-sm font-semibold truncate">{c.clientName || "Unknown"}</div>
                            <div className="text-xs text-gray-600">{c.phone || "-"}</div>
                          </div>
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border whitespace-nowrap ${c.paymentStatus === "Paid" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-amber-50 text-amber-700 border-amber-200"}`}>{c.paymentStatus === "Paid" ? "Payment Done" : "Pending Payment"}</span>
                        </div>
                        <div className="text-xs text-gray-500 line-clamp-1">{c.address || "-"}</div>
                        <div className="text-[11px] text-gray-400 mt-0.5">{c.type || "Service"} • ₹{c.price}</div>
                      </div>
                      <button type="button" className="text-xs text-red-500 hover:text-red-600 flex-shrink-0" onClick={() => removeSelectedCall(c._id)}>✕ Remove</button>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <div className="mb-1 text-gray-600">Online Amount (₹)</div>
                        <input type="number" className="w-full border rounded-lg px-2 py-1" value={c.onlineAmount} onChange={(e) => updateSelectedAmount(c._id, "onlineAmount", e.target.value)} min="0" />
                      </div>
                      <div>
                        <div className="mb-1 text-gray-600">Cash Amount (₹)</div>
                        <input type="number" className="w-full border rounded-lg px-2 py-1" value={c.cashAmount} onChange={(e) => updateSelectedAmount(c._id, "cashAmount", e.target.value)} min="0" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-xs text-gray-500 border border-dashed rounded-xl p-3 bg-slate-50">No calls selected yet. Select at least one call to record payment.</div>
            )}

            {/* totals */}
            <div className="text-xs text-gray-700 bg-slate-50 border rounded-xl px-3 py-2 flex flex-wrap gap-2 justify-between">
              <span>Online: <span className="font-semibold">₹{totalOnline || 0}</span></span>
              <span>Cash: <span className="font-semibold">₹{totalCash || 0}</span></span>
              <span>Total: <span className="font-semibold">₹{totalCombined || 0}</span></span>
            </div>

            <div>
              <div className="text-sm font-semibold mb-1">Paying Name</div>
              <input className="input w-full border rounded-lg px-3 py-2 focus:ring focus:ring-blue-200 text-sm" placeholder="Customer who paid" value={form.receiver} onChange={handleChange("receiver")} />
            </div>

            <div>
              <div className="text-sm font-semibold mb-1">Receiver Signature</div>
              <div className="border rounded-xl overflow-hidden shadow-sm"><SignaturePad ref={sigRef} canvasProps={{ className: "sigCanvas bg-white w-full", width: canvasWidth, height: 200 }} /></div>
              <div className="text-xs text-gray-500 mt-1">Signature required. <button type="button" onClick={clearSig} className="underline">Clear</button></div>
            </div>

            <button className="bg-blue-600 text-white w-full rounded-lg py-2 font-medium hover:bg-blue-700 active:scale-95 transition disabled:opacity-60" type="submit">Submit Payment</button>
          </form>
        </div>
      </main>

      <BottomNav />

      {/* CALL SELECT MODAL */}
      <AnimatePresence>{callModalOpen && (
        <motion.div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 flex items-center justify-center p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <motion.div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-4 max-h:[80vh] max-h-[80vh] flex flex-col" initial={{ scale: 0.95, opacity: 0, y: 12 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 12 }}>
            <div className="flex justify-between items-center mb-3">
              <div className="flex gap-2 items-center">
                <h2 className="font-semibold text-sm">Select Call</h2>
                <div className="text-xs text-gray-500">({calls.length} total)</div>
              </div>

              <div className="flex items-center gap-2">
                <div className="rounded-xl bg-slate-50 border px-2 py-1 text-xs flex gap-1">
                  <button onClick={() => { setModalTab("pending"); setShowAllInModal(false); }} className={`px-2 py-1 rounded-md ${modalTab === "pending" ? "bg-blue-600 text-white" : "text-slate-700"}`}>Pending ({pendingCount})</button>
                  <button onClick={() => { setModalTab("paid"); setShowAllInModal(false); }} className={`px-2 py-1 rounded-md ${modalTab === "paid" ? "bg-blue-600 text-white" : "text-slate-700"}`}>Paid ({paidCount})</button>
                </div>
                <button onClick={() => setCallModalOpen(false)} className="text-gray-500 hover:text-black text-lg">✕</button>
              </div>
            </div>

            <input className="border rounded-lg px-3 py-2 mb-2 text-sm" placeholder="Search by name / phone / address" value={callSearch} onChange={(e) => { setCallSearch(e.target.value || ""); setShowAllInModal(true); }} />

            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {callsLoading && <div className="text-center text-gray-500 py-4 text-sm">Loading calls...</div>}
              {!callsLoading && filteredCallsForModal.length === 0 && <div className="text-center text-gray-500 py-4 text-sm">No calls found.</div>}
              {!callsLoading && filteredCallsForModal.map((c) => (
                <button key={c._id} type="button" onClick={() => addCallToSelected(c)} className="w-full border rounded-xl px-3 py-2 text-sm hover:bg-blue-50 text-left transition">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-semibold truncate">{c.clientName || "Unknown"}</div>
                      <div className="text-xs text-gray-600">{c.phone}</div>
                      <div className="text-xs text-gray-500 line-clamp-1">{c.address}</div>
                      <div className="text-[11px] text-gray-400">{c.type || "Service"} • ₹{c.price}</div>
                      <div className="text-[11px] text-gray-400 mt-1">{c.activityTime ? `Last activity: ${new Date(c.activityTime).toLocaleString()}` : ""}</div>
                    </div>

                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border whitespace-nowrap ${c.paymentStatus === "Paid" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-amber-50 text-amber-700 border-amber-200"}`}>
                      {c.paymentStatus === "Paid" ? "Payment Done" : "Pending Payment"}
                    </span>
                  </div>
                </button>
              ))}
            </div>

            <div className="mt-3 flex gap-2">
              {!showAllInModal ? <button onClick={() => setShowAllInModal(true)} className="flex-1 bg-white border rounded-xl py-2 text-sm">Show more</button> : <button onClick={() => { setShowAllInModal(false); setCallSearch(""); }} className="flex-1 bg-white border rounded-xl py-2 text-sm">Collapse</button>}
              <button onClick={() => setCallModalOpen(false)} className="w-28 bg-gray-900 text-white py-2 rounded-xl text-sm">Close</button>
            </div>
          </motion.div>
        </motion.div>
      )}</AnimatePresence>

      <AnimatePresence>{showSuccessOverlay && (
        <motion.div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <motion.div initial={{ scale: 0.7, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.7, opacity: 0, y: 20 }} transition={{ type: "spring", stiffness: 180, damping: 15 }} className="relative bg-white rounded-3xl px-8 py-6 shadow-2xl text-center max-w-xs w-full overflow-hidden">
            <div className="pointer-events-none absolute -top-10 -left-10 h-24 w-24 bg-blue-100 rounded-full opacity-70" />
            <div className="pointer-events-none absolute -bottom-12 -right-6 h-28 w-28 bg-emerald-100 rounded-full opacity-70" />
            <div className="relative z-10 flex flex-col items-center gap-2">
              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 220, delay: 0.05 }} className="h-14 w-14 rounded-full bg-emerald-500 flex items-center justify-center shadow-lg"><span className="text-white text-3xl">✔</span></motion.div>
              <div className="text-base font-semibold text-gray-900">Payment Saved Successfully</div>
              <div className="text-xs text-gray-600">All call payments recorded. Great job! ✨</div>
            </div>
          </motion.div>
        </motion.div>
      )}</AnimatePresence>
    </div>
  );
}
