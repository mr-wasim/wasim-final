"use client";
import Header from "../../components/Header";
import BottomNav from "../../components/BottomNav";
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import toast from "react-hot-toast";
import { motion } from "framer-motion";
import {
  FiClock,
  FiAlertTriangle,
  FiCheckCircle,
  FiRefreshCw,
  FiPhone,
  FiMapPin,
} from "react-icons/fi";
import {
  collection,
  query as fsQuery,
  where,
  onSnapshot,
  orderBy,
} from "firebase/firestore";
import { getToken, onMessage, isSupported } from "firebase/messaging";
import { db, messaging } from "../../lib/firebase";

const TABS = ["All Calls", "Today Calls", "Pending", "Closed"];
const PAGE_SIZE = 5; // per page 5 hi dikhेंगे

// =====================
// UI: Skeleton loaders
// =====================
function Shimmer() {
  return (
    <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.6s_infinite] bg-gradient-to-r from-transparent via-white/40 to-transparent rounded-2xl" />
  );
}

function CallCardSkeleton() {
  return (
    <div className="relative overflow-hidden rounded-2xl p-4 border border-slate-200/70 bg-white/60 backdrop-blur-xl">
      <Shimmer />
      <div className="flex items-center gap-3">
        <div className="h-12 w-12 rounded-full bg-gray-200" />
        <div className="flex-1">
          <div className="h-5 w-40 bg-gray-200 rounded" />
          <div className="mt-2 h-3 w-56 bg-gray-200 rounded" />
        </div>
      </div>
      <div className="mt-3 h-3 w-64 bg-gray-200 rounded" />
      <div className="mt-2 h-3 w-44 bg-gray-200 rounded" />
      <div className="mt-2 h-10 w-full bg-gray-200 rounded" />
    </div>
  );
}

/**
 * Utility: safeExtract
 * Tries many possible keys for a field (server might send different names)
 */
function safeExtract(obj, keys) {
  for (const k of keys) {
    if (obj == null) continue;
    if (Object.prototype.hasOwnProperty.call(obj, k) && obj[k] !== undefined && obj[k] !== null) {
      return obj[k];
    }
  }
  return "";
}

export default function Calls() {
  const [user, setUser] = useState(null);
  const [tab, setTab] = useState("All Calls");

  const [items, setItems] = useState([]); // current page items only
  const [page, setPage] = useState(1); // 1-indexed
  const [total, setTotal] = useState(0); // server total (fallback handled)
  const [hasMore, setHasMore] = useState(false); // server hint for next page

  const [initialLoading, setInitialLoading] = useState(true);
  const [isFetching, setIsFetching] = useState(false);
  const [updatingId, setUpdatingId] = useState(null);

  const [selectedCall, setSelectedCall] = useState(null); // for modal

  const loadingRef = useRef(false);
  const abortRef = useRef(null);

  // =====================
  // Firebase Messaging (robust)
  // =====================
  useEffect(() => {
    async function setupMessaging() {
      try {
        const supported = await isSupported();
        if (!supported) return;
        if (!messaging) return;
        const permission = await Notification.requestPermission();
        if (permission === "granted" && user?._id) {
          try {
            const token = await getToken(messaging, {
              vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
            });
            if (token) {
              await fetch("/api/save-fcm-token", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ userId: user._id, token }),
              });
            }
          } catch (err) {
            console.error("FCM token error:", err);
          }
        }

        onMessage(messaging, (payload) => {
          toast.custom(
            <div className="bg-blue-600 text-white px-4 py-2 rounded-xl shadow-lg">
              🔔 {payload.notification?.title || "New Notification"}
              <div className="text-sm text-gray-100">{payload.notification?.body}</div>
            </div>,
            { duration: 5000 }
          );
        });
      } catch (e) {
        console.warn("Messaging not supported:", e?.message || e);
      }
    }

    if (typeof window !== "undefined" && user) setupMessaging();
  }, [user]);

  // =====================
  // Helpers
  // =====================
  function timeAgo(dateStr) {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    const seconds = Math.floor((new Date() - date) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  }

  const filterItems = useCallback(
    (list) => {
      const todayDate = new Date().toISOString().split("T")[0];
      const filtered = (() => {
        if (tab === "Today Calls") {
          return list.filter((c) =>
            (c.createdAt ? c.createdAt.split("T")[0] : "") === todayDate
          );
        }
        if (tab === "Pending") return list.filter((c) => c.status === "Pending");
        if (tab === "Closed") return list.filter((c) => c.status === "Closed");
        return list;
      })();

      return filtered;
    },
    [tab]
  );

  // =====================
  // Data: fetch current page
  // =====================
  const load = useCallback(
    async ({ reset = false, showToast = false } = {}) => {
      if (loadingRef.current) return;
      loadingRef.current = true;

      if (abortRef.current) abortRef.current.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        if (reset) setInitialLoading(true);
        setIsFetching(true);

        const params = new URLSearchParams({
          tab,
          page: String(page),
          pageSize: String(PAGE_SIZE),
        });

        const r = await fetch(`/api/tech/my-calls?${params.toString()}`, {
          cache: "no-store",
          signal: controller.signal,
        });

        const d = await r.json();
        if (d?.success && Array.isArray(d.items)) {
          const mapped = d.items.map((i) => {
            // robust mapping with fallbacks
            const clientName = safeExtract(i, ["clientName", "name", "client_name", "customerName"]) || "";
            const phone = safeExtract(i, ["phone", "mobile", "contact"]) || "";
            const address = safeExtract(i, ["address", "addr", "location"]) || "";
            const type = safeExtract(i, ["type", "service", "category"]) || "";
            const price = safeExtract(i, ["price", "amount", "cost"]) || 0;
            const status = safeExtract(i, ["status"]) || "Pending";
            const createdAt = safeExtract(i, ["createdAt", "created_at", "created"]) || "";

            // timeZone field fallbacks
            const timeZone = safeExtract(i, ["timeZone", "time_zone", "timezone", "preferredTime", "preferred_time"]) || "";

            // notes field fallbacks
            const notes = safeExtract(i, ["notes", "note", "remarks", "remark", "description", "details"]) || "";

            return {
              _id: i._id || i.id || (i._id && typeof i._id === "string" ? i._id : ""),
              clientName,
              phone,
              address,
              type,
              price,
              status,
              createdAt,
              timeZone,
              notes,
              // keep raw object for modal if needed
              __raw: i,
            };
          });

          const filtered = filterItems(mapped);

          const serverTotal =
            typeof d.total === "number"
              ? d.total
              : typeof d.count === "number"
              ? d.count
              : d.itemsTotal ?? 0;

          setTotal(serverTotal || 0);
          setHasMore(
            typeof d.hasMore === "boolean"
              ? d.hasMore
              : filtered.length === PAGE_SIZE
          );

          setItems(filtered);
          if (showToast) toast.success("Data updated");
        } else {
          throw new Error(d?.error || "Failed to load calls");
        }
      } catch (err) {
        if (err.name !== "AbortError") {
          console.error("Load error:", err);
          toast.error(err.message || "Failed to load");
        }
      } finally {
        setIsFetching(false);
        setInitialLoading(false);
        loadingRef.current = false;
      }
    },
    [tab, page, filterItems]
  );

  // Auth + realtime notifications (Firestore)
  useEffect(() => {
    (async () => {
      const me = await fetch("/api/auth/me");
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
      await load({ reset: true });

      if (db) {
        try {
          const q = fsQuery(
            collection(db, "notifications"),
            where("to", "==", u.username || u.email || u._id),
            orderBy("createdAt", "desc")
          );
          const unsubscribe = onSnapshot(q, (snapshot) => {
            snapshot.docChanges().forEach((change) => {
              if (change.type === "added") {
                const data = change.doc.data();
                toast.custom(
                  <div className="bg-blue-600 text-white px-4 py-2 rounded-xl shadow-lg">
                    🔔 {data.message}
                  </div>,
                  { duration: 4000 }
                );
              }
            });
          });
          return () => unsubscribe();
        } catch (e) {
          console.warn("Firestore realtime error:", e);
        }
      } else {
        console.warn("⚠️ Firestore not initialized.");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // tab change → reset to page 1 and load
  useEffect(() => {
    setPage(1);
  }, [tab]);

  // load whenever page/tab/user ready
  useEffect(() => {
    if (!user) return;
    load({ reset: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, tab, user]);

  // Update status (same functionality)
  async function updateStatus(id, status) {
    const prev = items;
    setUpdatingId(id);
    setItems((list) => list.map((c) => (c._id === id ? { ...c, status } : c)));
    try {
      const r = await fetch("/api/tech/update-call", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Failed");
      toast.success("Status Updated");
      if (status === "Closed") {
        await fetch("/api/notify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            to: "admin",
            title: "Call Closed ✅",
            body: `${user?.username || "Technician"} has closed a call.`,
          }),
        });
      }
    } catch (err) {
      toast.error(err.message || "Update failed");
      setItems(prev); // rollback
    } finally {
      setUpdatingId(null);
    }
  }

  function startNavigation(address) {
    if (!address) return toast.error("No address found!");
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const { latitude, longitude } = pos.coords;
          const origin = `${latitude},${longitude}`;
          const destination = encodeURIComponent(address);
          const ua = navigator.userAgent || "";
          if (/Android/i.test(ua)) {
            window.location.href = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&travelmode=driving`;
          } else if (/iPhone|iPad|iPod/i.test(ua)) {
            window.location.href = `maps://?saddr=${origin}&daddr=${destination}&dirflg=d`;
          } else {
            window.open(
              `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&travelmode=driving`,
              "_blank"
            );
          }
        },
        () => toast.error("Please enable location to start navigation.")
      );
    } else toast.error("Geolocation not supported on this device.");
  }

  // Derived
  const totalPages = useMemo(() => {
    if (total && total > 0) return Math.max(1, Math.ceil(total / PAGE_SIZE));
    return hasMore ? page + 1 : page;
  }, [total, page, hasMore]);

  // Modal close handler with escape key
  useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape") setSelectedCall(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="pb-20 min-h-screen bg-[radial-gradient(1200px_500px_at_50%_-10%,#e6f0ff,transparent),linear-gradient(to_bottom,#f8fbff,#ffffff)]">
      <Header user={user} />

      <main className="max-w-3xl mx-auto p-4 space-y-4">
        {/* Tabs */}
        <div className="sticky top-0 z-20">
          <div className="rounded-2xl border bg-white/70 backdrop-blur-xl supports-[backdrop-filter]:bg-white/60 shadow-sm">
            <div className="flex gap-2 overflow-x-auto scrollbar-hide p-2">
              {TABS.map((t) => (
                <button
                  key={t}
                  onClick={() => {
                    setTab(t);
                  }}
                  className={`whitespace-nowrap px-3 py-2 rounded-xl text-sm font-semibold transition-all duration-300 border ${
                    tab === t
                      ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md scale-[1.02] border-transparent"
                      : "bg-white hover:bg-slate-50 text-slate-700 border-slate-200"
                  }`}
                >
                  {t}
                </button>
              ))}
              <button
                onClick={() => {
                  load({ reset: true, showToast: true });
                }}
                className="ml-auto px-3 py-2 rounded-xl text-sm font-semibold bg-white border border-slate-200 flex items-center gap-2 hover:bg-slate-50"
                title="Refresh"
                disabled={isFetching}
              >
                <motion.span
                  animate={{ rotate: isFetching ? 360 : 0 }}
                  transition={{ repeat: isFetching ? Infinity : 0, duration: 1 }}
                >
                  <FiRefreshCw />
                </motion.span>
                Refresh
              </button>
            </div>
          </div>
        </div>

        {/* Meta */}
        <div className="text-xs sm:text-sm text-gray-600 px-1">
          Page <span className="font-semibold">{page}</span> of{" "}
          <span className="font-semibold">{totalPages}</span>{" "}
          <span className="ml-2">({items.length} on this page)</span>
          {typeof total === "number" && total > 0 && (
            <span className="ml-2">
              • Total: <span className="font-semibold">{total}</span>
            </span>
          )}
        </div>

        {/* Calls List */}
        <div className="space-y-3">
          {initialLoading && (
            <>
              {Array.from({ length: 5 }).map((_, i) => (
                <CallCardSkeleton key={i} />
              ))}
            </>
          )}

          {!initialLoading && items.length === 0 && (
            <div className="rounded-2xl border border-dashed p-10 text-center text-gray-500 bg-white/60 backdrop-blur-xl">
              No calls found
            </div>
          )}

          {!initialLoading &&
            items.map((call, idx) => {
              const pending = call.status === "Pending";
              const closed = call.status === "Closed";
              const uniqueKey = `${call._id || "row"}_${call.createdAt || "t"}_${idx}`;

              return (
                <motion.div
                  key={uniqueKey}
                  initial={{ opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35 }}
                  className={`relative overflow-hidden rounded-2xl border backdrop-blur-xl transition-all duration-300 hover:shadow-xl ${
                    pending
                      ? "border-rose-200/70 bg-gradient-to-br from-white/80 via-rose-50/70 to-white/70"
                      : closed
                      ? "border-emerald-200/70 bg-gradient-to-br from-white/80 via-emerald-50/70 to-white/70"
                      : "border-slate-200/70 bg-white/70"
                  }`}
                >
                  {/* Ribbons */}
                  {pending && (
                    <div className="absolute right-0 top-0">
                      <div className="px-2 py-1 text-[10px] sm:text-xs font-bold text-white bg-rose-600 rounded-bl-xl">
                        MISSED / PENDING
                      </div>
                    </div>
                  )}
                  {closed && (
                    <div className="absolute right-0 top-0">
                      <div className="px-2 py-1 text-[10px] sm:text-xs font-bold text-white bg-emerald-600 rounded-bl-xl">
                        CALL ENDED
                      </div>
                    </div>
                  )}

                  {/* Ringing / Ended aura */}
                  {pending && (
                    <div className="pointer-events-none absolute -inset-1 rounded-3xl ring-1 ring-rose-300/30">
                      <div className="absolute -z-10 inset-0 animate-pulse bg-[radial-gradient(400px_200px_at_95%_-20%,rgba(244,63,94,0.12),transparent)]" />
                    </div>
                  )}
                  {closed && (
                    <div className="pointer-events-none absolute -inset-1 rounded-3xl ring-1 ring-emerald-300/30">
                      <div className="absolute -z-10 inset-0 animate-pulse bg-[radial-gradient(400px_200px_at_95%_-20%,rgba(16,185,129,0.12),transparent)]" />
                    </div>
                  )}

                  {/* Header row */}
                  <div className="p-4 pb-2 flex items-start gap-3">
                    {/* Avatar with ripple for ringing */}
                    <div className="relative">
                      <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-blue-600 shadow-md flex items-center justify-center text-white font-bold">
                        {String(call.clientName || "?")
                          .trim()
                          .slice(0, 1)
                          .toUpperCase()}
                      </div>

                      {/* Ringing ripples */}
                      {pending && (
                        <>
                          <span className="absolute -inset-1 rounded-3xl border border-rose-400/30 animate-[ping_1.6s_linear_infinite]" />
                          <span className="absolute -inset-2 rounded-3xl border border-rose-300/20 animate-[ping_2.2s_linear_infinite]" />
                        </>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-lg sm:text-xl font-extrabold tracking-tight text-slate-900">
                          {call.clientName || "—"}
                        </h3>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide ${
                            pending
                              ? "bg-rose-100 text-rose-700"
                              : "bg-emerald-100 text-emerald-700"
                          }`}
                        >
                          {call.status}
                        </span>
                      </div>

                      <div className="mt-2 flex flex-col gap-2 text-[13px] text-slate-700">
                        {/* Vertical single-column info (TRUNCATE in list) */}

                        {/* Phone */}
                        <div className="flex items-start gap-3">
                          <FiPhone className="text-slate-500 mt-1" />
                          <div className="leading-relaxed">
                            <div className="text-xs text-slate-500">Phone</div>
                            <div
                              className="text-sm font-medium truncate max-w-[240px]"
                              title={call.phone || ""}
                            >
                              {call.phone || "—"}
                            </div>
                          </div>
                        </div>

                        {/* Address */}
                        <div className="flex items-start gap-3">
                          <FiMapPin className="text-slate-500 mt-1" />
                          <div className="leading-relaxed">
                            <div className="text-xs text-slate-500">Address</div>
                            <div
                              className="text-sm font-medium truncate max-w-[240px]"
                              title={call.address || ""}
                            >
                              {call.address || "—"}
                            </div>
                          </div>
                        </div>

                        {/* Type */}
                        <div className="flex items-start gap-3">
                          <FiAlertTriangle className="text-slate-500 mt-1" />
                          <div className="leading-relaxed">
                            <div className="text-xs text-slate-500">Type</div>
                            <div
                              className="text-sm font-medium truncate max-w-[240px]"
                              title={call.type || ""}
                            >
                              {call.type || "—"}
                            </div>
                          </div>
                        </div>

                        {/* Price */}
                        <div className="flex items-start gap-3">
                          <FiCheckCircle className="text-slate-500 mt-1" />
                          <div className="leading-relaxed">
                            <div className="text-xs text-slate-500">Price</div>
                            <div
                              className="text-sm font-medium truncate max-w-[240px]"
                              title={String(call.price ?? "")}
                            >
                              ₹{call.price ?? 0}
                            </div>
                          </div>
                        </div>

                        {/* Time Zone */}
                        <div className="flex items-start gap-3">
                          <FiClock className="text-slate-500 mt-1" />
                          <div className="leading-relaxed">
                            <div className="text-xs text-slate-500">Time Zone</div>
                            <div
                              className="text-sm font-medium truncate max-w-[240px]"
                              title={call.timeZone || ""}
                            >
                              {call.timeZone || "—"}
                            </div>
                          </div>
                        </div>

                        {/* Notes */}
                        <div className="flex items-start gap-3">
                          <FiAlertTriangle className="text-slate-500 mt-1" />
                          <div className="leading-relaxed">
                            <div className="text-xs text-slate-500">Notes</div>
                            <div
                              className="text-sm font-medium truncate max-w-[240px]"
                              title={call.notes || ""}
                            >
                              {call.notes || "—"}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 text-xs text-gray-500 mt-1">
                          <FiClock className="shrink-0" />
                          <div>Received {timeAgo(call.createdAt)}</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Action bar */}
                  <div className="px-4 pb-4 pt-2">
                    <div className="flex flex-wrap gap-2">
                      <a
                        className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold shadow-sm transition-all ${
                          pending
                            ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                            : "bg-slate-900 hover:bg-black text-white"
                        }`}
                        href={`tel:${call.phone}`}
                      >
                        <motion.span
                          animate={pending ? { scale: [1, 1.08, 1] } : {}}
                          transition={{ repeat: pending ? Infinity : 0, duration: 1.3 }}
                          className="inline-flex"
                        >
                          <FiPhone />
                        </motion.span>
                        Call
                      </a>

                      <button
                        className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold bg-white border border-slate-200 hover:bg-slate-50"
                        onClick={() => startNavigation(call.address)}
                      >
                        <FiMapPin />
                        Go
                      </button>

                      <button
                        className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold bg-white border border-slate-200 hover:bg-slate-50"
                        onClick={() => setSelectedCall(call)}
                      >
                        Show Details
                      </button>

                      <select
                        className="px-3 py-2 rounded-xl border bg-white text-sm"
                        value={call.status}
                        disabled={updatingId === call._id}
                        onChange={(e) => updateStatus(call._id, e.target.value)}
                      >
                        <option>Pending</option>
                        <option>Closed</option>
                      </select>
                    </div>
                  </div>
                </motion.div>
              );
            })}

          {/* Pagination controls */}
          {!initialLoading && (
            <div className="flex items-center justify-between pt-2">
              <button
                className="px-3 py-2 rounded-xl text-sm font-semibold bg-white border border-slate-200 hover:bg-slate-50 disabled:opacity-60"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1 || isFetching}
              >
                ← Prev
              </button>

              <div className="text-xs text-gray-600">
                Page {page} / {totalPages}
              </div>

              <button
                className="px-3 py-2 rounded-xl text-sm font-semibold bg-white border border-slate-200 hover:bg-slate-50 disabled:opacity-60"
                onClick={() => setPage((p) => p + 1)}
                disabled={(!hasMore && page >= totalPages) || isFetching}
              >
                Next →
              </button>
            </div>
          )}

          {/* Loading spinner for fetch */}
          {isFetching && !initialLoading && (
            <div className="flex items-center justify-center py-3 text-sm text-gray-600">
              <motion.div
                className="mr-2"
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 1 }}
              >
                <FiRefreshCw />
              </motion.div>
              Loading...
            </div>
          )}
        </div>
      </main>

      <BottomNav />

      {/* DETAILS MODAL - Glassmorphism (full details, no truncation) */}
      {selectedCall && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setSelectedCall(null)}
          />
          <div className="relative w-full max-w-2xl max-h-[90vh] overflow-auto rounded-2xl mt-[50px] p-6 bg-white backdrop-blur-xl border border-white/30 shadow-xl">
            <button
              onClick={() => setSelectedCall(null)}
              className="absolute right-4 top-4 text-gray-700 hover:text-black"
              aria-label="Close details"
            >
              ✕
            </button>

            <h2 className="text-2xl font-extrabold mb-3">Call Details</h2>

            <div className="space-y-4 text-slate-800">
              {/* Client */}
              <div>
                <div className="text-xs text-slate-500">Client</div>
                <div className="text-lg font-semibold break-words whitespace-pre-wrap">{selectedCall.clientName || "—"}</div>
              </div>

              {/* Phone */}
              <div className="flex items-start gap-3">
                <FiPhone className="text-slate-500 mt-1" />
                <div>
                  <div className="text-xs text-slate-500">Phone</div>
                  <div className="text-sm break-words whitespace-pre-wrap">{selectedCall.phone || "—"}</div>
                </div>
              </div>

              {/* Address */}
              <div className="flex items-start gap-3">
                <FiMapPin className="text-slate-500 mt-1" />
                <div>
                  <div className="text-xs text-slate-500">Address</div>
                  <div className="text-sm break-words whitespace-pre-wrap">{selectedCall.address || "—"}</div>
                </div>
              </div>

              {/* Type & Price */}
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-start gap-3">
                  <FiAlertTriangle className="text-slate-500 mt-1" />
                  <div>
                    <div className="text-xs text-slate-500">Type</div>
                    <div className="text-sm break-words whitespace-pre-wrap">{selectedCall.type || "—"}</div>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <FiCheckCircle className="text-slate-500 mt-1" />
                  <div>
                    <div className="text-xs text-slate-500">Price</div>
                    <div className="text-sm break-words whitespace-pre-wrap">₹{selectedCall.price ?? 0}</div>
                  </div>
                </div>
              </div>

              {/* Time Zone */}
              <div className="flex items-start gap-3">
                <FiClock className="text-slate-500 mt-1" />
                <div>
                  <div className="text-xs text-slate-500">Time Zone</div>
                  <div className="text-sm break-words whitespace-pre-wrap">{selectedCall.timeZone || "—"}</div>
                </div>
              </div>

              {/* Notes */}
              <div className="flex items-start gap-3">
                <FiAlertTriangle className="text-slate-500 mt-1" />
                <div>
                  <div className="text-xs text-slate-500">Notes</div>
                  <div className="text-sm break-words whitespace-pre-wrap">{selectedCall.notes || "—"}</div>
                </div>
              </div>

             

            {/* Actions */}
<div className="flex justify-end gap-3 mt-4">

  {/* Call */}
  <a
    href={`tel:${selectedCall.phone}`}
    className="
      h-11 w-11 flex items-center justify-center 
      rounded-xl bg-blue-600 text-white shadow 
      hover:bg-blue-700 active:scale-95 transition
    "
    title="Call Client"
  >
    <FiPhone className="text-[20px]" />
  </a>

  {/* Maps */}
  <button
    onClick={() => startNavigation(selectedCall.address)}
    className="
      h-11 w-11 flex items-center justify-center
      rounded-xl bg-white border border-slate-200 text-slate-700 
      hover:bg-slate-50 active:scale-95 transition
    "
    title="Open in Maps"
  >
    <FiMapPin className="text-[20px]" />
  </button>

  {/* Close */}
  <button
    onClick={() => setSelectedCall(null)}
    className="
      h-11 w-11 flex items-center justify-center
      rounded-xl bg-gray-100 border border-slate-300 text-slate-700 
      hover:bg-gray-200 active:scale-95 transition
    "
    title="Close"
  >
    ✕
  </button>

</div>

            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        @keyframes shimmer {
          100% {
            transform: translateX(100%);
          }
        }
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </div>
  );
}
