// pages/tech/calls.jsx  (replace your existing file)
"use client";

import Header from "../../components/Header";
import BottomNav from "../../components/BottomNav";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
  memo,
} from "react";
import toast from "react-hot-toast";
import { motion, AnimatePresence } from "framer-motion";
import {
  FiClock,
  FiAlertTriangle,
  FiCheckCircle,
  FiRefreshCw,
  FiPhone,
  FiMapPin,
  FiTag,
  FiSearch,
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

const TABS = ["All Calls", "Today Calls", "Pending", "Closed", "Canceled"];
const PAGE_SIZE = 5;

// ULTRA FAST STATUS SOUND (safe for SSR)
const statusSound = typeof window !== "undefined" ? new Audio("/forward.mp3") : null;
function playStatusSound() {
  try {
    if (!statusSound) return;
    statusSound.currentTime = 0;
    statusSound.play().catch(() => {});
  } catch (e) {
    console.warn("Sound error:", e?.message || e);
  }
}

function CallCardSkeleton() {
  return (
    <div className="relative overflow-hidden rounded-xl p-4 border border-slate-200 bg-white animate-pulse">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-slate-200" />
        <div className="flex-1 space-y-2">
          <div className="h-4 w-32 bg-slate-200 rounded" />
          <div className="h-3 w-44 bg-slate-200 rounded" />
        </div>
      </div>
      <div className="mt-3 h-3 w-64 bg-slate-200 rounded" />
      <div className="mt-2 h-3 w-40 bg-slate-200 rounded" />
      <div className="mt-3 h-9 w-full bg-slate-200 rounded" />
    </div>
  );
}

function safeExtract(obj, keys) {
  if (!obj) return "";
  for (const k of keys) {
    if (Object.prototype.hasOwnProperty.call(obj, k) && obj[k] !== undefined && obj[k] !== null) {
      return obj[k];
    }
  }
  return "";
}

function timeAgo(dateStr) {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

// Smaller animation durations for snappy feel
const ENTRY_DURATION = 0.12;
const HOVER_TRANSLATE = -4;

// highlight matched substring in plain text (returns React node)
function highlightText(text = "", q = "") {
  if (!q) return text;
  try {
    const t = String(text);
    const lower = t.toLowerCase();
    const ql = q.toLowerCase();
    const idx = lower.indexOf(ql);
    if (idx === -1) return t;
    return (
      <span>
        {t.slice(0, idx)}
        <mark className="bg-yellow-100 px-0.5 rounded">{t.slice(idx, idx + q.length)}</mark>
        {t.slice(idx + q.length)}
      </span>
    );
  } catch (e) {
    return text;
  }
}

// Card component (memoized)
const CallCard = memo(function CallCard({
  call,
  onUpdateStatus,
  onShowDetails,
  startNavigation,
  updatingId,
  index,
  animate,
  searchQuery,
  highlight,
}) {
  const pending = call.status === "Pending";
  const closed = call.status === "Closed";
  const canceled = call.status === "Canceled";
  const chooseRaw = (call.chooseLabel || call.chooseCall || "").toString();
  const chooseUpper = chooseRaw.toUpperCase();

  // choose badge classes (ensure readable text)
  const badgeClass =
    chooseUpper.includes("CHIMNEY") ? "text-white bg-gradient-to-r from-orange-400 to-rose-400" :
    chooseUpper.includes("TKS") ? "text-white bg-gradient-to-r from-blue-500 to-indigo-500" :
    "text-slate-800 bg-slate-100";

  const motionProps = animate
    ? {
        layout: true,
        initial: { opacity: 0, y: 8, scale: 0.995 },
        animate: { opacity: 1, y: 0, scale: 1 },
        transition: { duration: ENTRY_DURATION, delay: Math.min(index * 0.01, 0.12), ease: "easeOut" },
        whileHover: { y: HOVER_TRANSLATE, scale: 1.005 },
        whileTap: { scale: 0.995 },
      }
    : { layout: true };

  return (
    <motion.div
      {...motionProps}
      id={`call-${call._id}`}
      className={`relative overflow-hidden rounded-xl border bg-white transition-shadow duration-120 ${pending ? "border-rose-300" : closed ? "border-emerald-300" : canceled ? "border-slate-300" : "border-slate-200"} ${highlight ? "ring-2 ring-blue-200" : ""}`}
    >
      {/* choose badge (fixed color + readable) */}
      <div className="absolute left-4 top-[-7px] z-10">
        <div className="inline-flex items-center gap-2 px-2 py-1 rounded-full text-xs font-semibold tracking-wide" aria-hidden>
          <span className={`${badgeClass} inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-semibold`}>
            <FiTag />
            <span style={{ letterSpacing: "0.2px" }}>{chooseRaw ? chooseRaw.replace(/_/g, " ") : "—"}</span>
          </span>
        </div>
      </div>

      {pending && (
        <div className="absolute right-0 top-0">
          <div className="px-2 py-1 text-[10px] sm:text-xs font-bold text-white bg-rose-600 rounded-bl-xl">RINGING / MISSED</div>
        </div>
      )}
      {closed && (
        <div className="absolute right-0 top-0">
          <div className="px-2 py-1 text-[10px] sm:text-xs font-bold text-white bg-emerald-600 rounded-bl-xl">CALL ENDED</div>
        </div>
      )}
      {canceled && (
        <div className="absolute right-0 top-0">
          <div className="px-2 py-1 text-[10px] sm:text-xs font-bold text-white bg-slate-500 rounded-bl-xl">CALL CANCELED</div>
        </div>
      )}

      <div className="p-4 pb-2 flex items-start gap-3">
        <motion.div layout className="relative">
          <motion.div
            layout
            initial={{ rotate: 0 }}
            whileHover={{ rotate: 4 }}
            transition={{ duration: 0.25 }}
            className={`h-11 w-11 rounded-xl shadow flex items-center justify-center text-white text-sm font-bold ${pending ? "bg-rose-500" : "bg-blue-600"}`}
          >
            {String(call.clientName || "?").trim().slice(0, 1).toUpperCase()}
          </motion.div>
        </motion.div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-base sm:text-lg font-semibold tracking-tight text-slate-900">
              {searchQuery ? highlightText(call.clientName || "—", searchQuery) : (call.clientName || "—")}
            </h3>

            <motion.span layout className={`px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide ${pending ? "bg-rose-100 text-rose-700" : closed ? "bg-emerald-100 text-emerald-700" : canceled ? "bg-slate-100 text-slate-700" : "bg-slate-100 text-slate-700"}`}>
              {pending ? "Missed / Pending" : closed ? "Closed" : canceled ? "Canceled" : call.status}
            </motion.span>

            <motion.span
              layout
              className="ml-1 h-2 w-2 rounded-full"
              style={{ background: pending ? "#fb7185" : closed ? "#10b981" : canceled ? "#94a3b8" : "#94a3b8" }}
              animate={{ scale: [1, 1.2, 1], opacity: [1, 0.85, 1] }}
              transition={{ repeat: Infinity, duration: 1.6 }}
            />
          </div>

          <div className="mt-2 flex flex-col gap-2 text-[13px] text-slate-700">
            <div className="flex items-start gap-3">
              <FiPhone className="text-slate-500 mt-1 shrink-0" />
              <div className="leading-relaxed">
                <div className="text-xs text-slate-500">Phone</div>
                <div className="text-sm font-medium truncate max-w-[240px]" title={call.phone || ""}>
                  {searchQuery ? highlightText(call.phone || "—", searchQuery) : (call.phone || "—")}
                </div>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <FiMapPin className="text-slate-500 mt-1 shrink-0" />
              <div className="leading-relaxed">
                <div className="text-xs text-slate-500">Address</div>
                <div className="text-sm font-medium truncate max-w-[240px]" title={call.address || ""}>
                  {searchQuery ? highlightText(call.address || "—", searchQuery) : (call.address || "—")}
                </div>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <FiAlertTriangle className="text-slate-500 mt-1 shrink-0" />
              <div className="leading-relaxed">
                <div className="text-xs text-slate-500">Type</div>
                <div className="text-sm font-medium truncate max-w-[240px]" title={call.type || ""}>{call.type || "—"}</div>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <FiCheckCircle className="text-slate-500 mt-1 shrink-0" />
              <div className="leading-relaxed">
                <div className="text-xs text-slate-500">Price</div>
                <div className="text-sm font-medium truncate max-w-[240px]" title={String(call.price ?? "")}>₹{call.price ?? 0}</div>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <FiClock className="text-slate-500 mt-1 shrink-0" />
              <div className="leading-relaxed">
                <div className="text-xs text-slate-500">Time Zone</div>
                <div className="text-sm font-medium truncate max-w-[240px]" title={call.timeZone || ""}>{call.timeZone || "—"}</div>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <FiAlertTriangle className="text-slate-500 mt-1 shrink-0" />
              <div className="leading-relaxed">
                <div className="text-xs text-slate-500">Notes</div>
                <div className="text-sm font-medium truncate max-w-[240px]" title={call.notes || ""}>{call.notes || "—"}</div>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs text-gray-500 mt-1">
              <FiClock className="shrink-0" />
              <div>Received {timeAgo(call.createdAt)}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 pb-4 pt-2">
        <div className="flex flex-wrap gap-2">
          <a className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold shadow-sm transition-transform transition-colors ${pending ? "bg-rose-600 hover:bg-rose-700 text-white" : closed ? "bg-emerald-600 hover:bg-emerald-700 text-white" : "bg-slate-900 hover:bg-black text-white"} ${pending ? "pending-call-button" : ""}`} href={`tel:${call.phone}`}>
            <FiPhone />
            {pending ? "Call Back" : "Call"}
          </a>

          <button className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold bg-white border border-slate-200 hover:bg-slate-50" onClick={() => startNavigation(call.address)}>
            <FiMapPin /> Go
          </button>

          <button className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold bg-white border border-slate-200 hover:bg-slate-50" onClick={() => onShowDetails(call)}>
            Show Details
          </button>

          <select className="px-3 py-2 rounded-xl border bg-white text-sm" value={call.status} disabled={updatingId === call._id} onChange={(e) => onUpdateStatus(call._id, e.target.value)}>
            <option>Pending</option>
            <option>Closed</option>
            <option>Canceled</option>
          </select>
        </div>
      </div>
    </motion.div>
  );
});

// Details modal shows chooseCall as well
function DetailsModal({ call, onClose, startNavigation }) {
  if (!call) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <motion.div initial={{ scale: 0.99, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.99, opacity: 0 }} transition={{ duration: 0.12 }} className="relative w-full max-w-2xl max-h-[90vh] overflow-auto rounded-2xl mt-[50px] p-6 bg-white border border-slate-200 shadow-xl">
        <button onClick={onClose} className="absolute right-4 top-4 text-gray-700 hover:text-black" aria-label="Close details">✕</button>

        <h2 className="text-2xl font-extrabold mb-3">Call Details</h2>

        <div className="space-y-4 text-slate-800">
          <div>
            <div className="text-xs text-slate-500">Client</div>
            <div className="text-lg font-semibold break-words whitespace-pre-wrap">{call.clientName || "—"}</div>
          </div>

          <div className="flex items-start gap-3">
            <FiPhone className="text-slate-500 mt-1" />
            <div>
              <div className="text-xs text-slate-500">Phone</div>
              <div className="text-sm break-words whitespace-pre-wrap">{call.phone || "—"}</div>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <FiMapPin className="text-slate-500 mt-1" />
            <div>
              <div className="text-xs text-slate-500">Address</div>
              <div className="text-sm break-words whitespace-pre-wrap">{call.address || "—"}</div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex items-start gap-3">
              <FiAlertTriangle className="text-slate-500 mt-1" />
              <div>
                <div className="text-xs text-slate-500">Type</div>
                <div className="text-sm break-words whitespace-pre-wrap">{call.type || "—"}</div>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <FiCheckCircle className="text-slate-500 mt-1" />
              <div>
                <div className="text-xs text-slate-500">Price</div>
                <div className="text-sm break-words whitespace-pre-wrap">₹{call.price ?? 0}</div>
              </div>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <FiClock className="text-slate-500 mt-1" />
            <div>
              <div className="text-xs text-slate-500">Time Zone</div>
              <div className="text-sm break-words whitespace-pre-wrap">{call.timeZone || "—"}</div>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <FiAlertTriangle className="text-slate-500 mt-1" />
            <div>
              <div className="text-xs text-slate-500">Notes</div>
              <div className="text-sm break-words whitespace-pre-wrap">{call.notes || "—"}</div>
            </div>
          </div>

          {/* CHOOSE CALL display */}
          <div className="flex items-center gap-3">
            <FiTag className="text-slate-500 mt-1" />
            <div>
              <div className="text-xs text-slate-500">Choose Call</div>
              <div className="text-sm font-semibold">{call.chooseLabel || call.chooseCall || "—"}</div>
            </div>
          </div>

          <div className="flex justify-end gap-3 mt-4">
            <a href={`tel:${call.phone}`} className="h-11 w-11 flex items-center justify-center rounded-xl bg-blue-600 text-white shadow hover:bg-blue-700 active:scale-95 transition" title="Call Client">
              <FiPhone className="text-[20px]" />
            </a>

            <button onClick={() => startNavigation(call.address)} className="h-11 w-11 flex items-center justify-center rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 active:scale-95 transition" title="Open in Maps">
              <FiMapPin className="text-[20px]" />
            </button>

            <button onClick={onClose} className="h-11 w-11 flex items-center justify-center rounded-xl bg-gray-100 border border-slate-300 text-slate-700 hover:bg-gray-200 active:scale-95 transition" title="Close">✕</button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

export default function Calls() {
  // initialize tab from localStorage synchronously so component mounts with correct tab
  const initialTab = (typeof window !== "undefined" && window.localStorage.getItem("tech_calls_tab") && TABS.includes(window.localStorage.getItem("tech_calls_tab")))
    ? window.localStorage.getItem("tech_calls_tab")
    : "All Calls";

  const [user, setUser] = useState(null);
  const [tab, setTab] = useState(initialTab);

  const [items, setItems] = useState([]);
  const itemsRef = useRef([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);

  const [initialLoading, setInitialLoading] = useState(true);
  const [isFetching, setIsFetching] = useState(false);
  const [updatingId, setUpdatingId] = useState(null);

  const [selectedCall, setSelectedCall] = useState(null);

  const loadingRef = useRef(false);
  const abortRef = useRef(null);
  const mountedRef = useRef(true);

  // search state (top-most) - compact UI
  const [searchQuery, setSearchQuery] = useState("");
  const searchDebounceRef = useRef(null);
  const searchAbortRef = useRef(null);

  // Prefers-reduced-motion check and animation toggle
  const animateCards = useMemo(() => {
    if (typeof window === "undefined") return false;
    try {
      return !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch (e) {
      return true;
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (abortRef.current) abortRef.current.abort();
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
      if (searchAbortRef.current) searchAbortRef.current.abort();
    };
  }, []);

  // load cached items from localStorage for instant UI (runs after tab is set initially)
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(`tech_calls_cache_${tab}_p${page}`);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          itemsRef.current = parsed;
          setItems(parsed);
          setInitialLoading(false); // show cached immediately
        }
      }
    } catch (e) {
      // ignore
    }
  }, [tab, page]);

  // store tab selection to localStorage whenever it changes
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem("tech_calls_tab", tab);
    } catch (e) {}
  }, [tab]);

  // filter helper: accepts optional query string q and matches across many fields
  const filterItems = useCallback(
    (list, q = "") => {
      const todayDate = new Date().toISOString().split("T")[0];
      const ln = (q || "").toString().toLowerCase().trim();

      let base = list;

      if (tab === "Today Calls") {
        base = base.filter((c) => (c.createdAt ? c.createdAt.split("T")[0] : "") === todayDate && c.status !== "Canceled");
      } else if (tab === "Pending") base = base.filter((c) => c.status === "Pending");
      else if (tab === "Closed") base = base.filter((c) => c.status === "Closed");
      else if (tab === "Canceled") base = base.filter((c) => c.status === "Canceled");
      else base = base.filter((c) => c.status !== "Canceled");

      if (!ln) return base;

      // keyword match across fields (single char also matches)
      return base.filter((c) => {
        const fields = [
          c.clientName || "",
          c.phone || "",
          c.address || "",
          c.chooseLabel || "",
          c.notes || "",
          c.type || "",
          String(c.price || ""),
        ].join(" ").toLowerCase();

        return fields.includes(ln);
      });
    },
    [tab]
  );

  // Prevent unnecessary setItems when identical (fast diff)
  const applyItemsIfChanged = useCallback((newList) => {
    const prev = itemsRef.current;
    if (prev.length === newList.length && prev.every((p, i) => p._id === newList[i]._id && p.status === newList[i].status)) {
      return;
    }
    itemsRef.current = newList;
    if (mountedRef.current) setItems(newList);
  }, []);

  // map raw server item to our normalized shape
  const mapRawToCall = useCallback((i) => {
    const clientName = safeExtract(i, ["clientName", "name", "client_name", "customerName"]) || "";
    const phone = safeExtract(i, ["phone", "mobile", "contact"]) || "";
    const address = safeExtract(i, ["address", "addr", "location"]) || "";
    const type = safeExtract(i, ["type", "service", "category"]) || "";
    const price = safeExtract(i, ["price", "amount", "cost"]) || 0;
    const status = safeExtract(i, ["status"]) || "Pending";
    const createdAt = safeExtract(i, ["createdAt", "created_at", "created"]) || "";
    const timeZone = safeExtract(i, ["timeZone", "time_zone", "timezone", "preferredTime", "preferred_time"]) || "";
    const notes = safeExtract(i, ["notes", "note", "remarks", "remark", "description", "details"]) || "";

    const chooseCall = i.chooseCall ?? (i.__raw && i.__raw.chooseCall) ?? "";
    const chooseLabel = i.chooseLabel ?? (i.__raw && i.__raw.chooseLabel) ?? (chooseCall ? String(chooseCall).replace(/_/g, " ") : "");

    return {
      _id: i._id || i.id || "",
      clientName,
      phone,
      address,
      type,
      price,
      status,
      createdAt,
      timeZone,
      notes,
      chooseCall,
      chooseLabel,
      __raw: i,
    };
  }, []);

  const load = useCallback(
    async ({ reset = false, showToast = false, q = "" } = {}) => {
      if (loadingRef.current) return;
      loadingRef.current = true;

      if (abortRef.current) abortRef.current.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        if (reset) setInitialLoading(true);
        setIsFetching(true);

        const params = new URLSearchParams({ tab, page: String(page), pageSize: String(PAGE_SIZE) });
        if (q) params.set("q", q);

        const r = await fetch(`/api/tech/my-calls?${params.toString()}`, { cache: "no-store", signal: controller.signal });

        const d = await r.json();
        if (d?.success && Array.isArray(d.items)) {
          const mapped = d.items.map(mapRawToCall);
          const filtered = filterItems(mapped, q);

          const serverTotal = typeof d.total === "number" ? d.total : typeof d.count === "number" ? d.count : d.itemsTotal ?? 0;

          if (mountedRef.current) setTotal(serverTotal || 0);
          if (mountedRef.current) setHasMore(typeof d.hasMore === "boolean" ? d.hasMore : filtered.length === PAGE_SIZE);

          applyItemsIfChanged(filtered);

          // cache to localStorage for instant next load
          try {
            window.localStorage.setItem(`tech_calls_cache_${tab}_p${page}`, JSON.stringify(filtered));
          } catch (e) {}

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
        if (mountedRef.current) setIsFetching(false);
        if (mountedRef.current) setInitialLoading(false);
        loadingRef.current = false;
      }
    },
    [tab, page, filterItems, applyItemsIfChanged, mapRawToCall]
  );

  useEffect(() => {
    let unsubscribe = null;
    let didCancel = false;

    (async () => {
      try {
        const me = await fetch("/api/auth/me");
        if (!me.ok) {
          if (!didCancel) window.location.href = "/login";
          return;
        }
        const u = await me.json();
        if (u.role !== "technician") {
          if (!didCancel) window.location.href = "/login";
          return;
        }
        if (!didCancel) setUser(u);
        // now that user & tab are already correct, load uses current tab
        await load({ reset: true, q: searchQuery });

        if (db) {
          try {
            const q = fsQuery(collection(db, "notifications"), where("to", "==", u.username || u.email || u._id), orderBy("createdAt", "desc"));
            unsubscribe = onSnapshot(q, (snapshot) => {
              snapshot.docChanges().forEach((change) => {
                if (change.type === "added") {
                  const data = change.doc.data();
                  toast.custom(
                    <div className="bg-blue-600 text-white px-4 py-2 rounded-xl shadow-lg">🔔 {data.message}</div>,
                    { duration: 4000 }
                  );
                }
              });
            });
          } catch (e) {
            console.warn("Firestore realtime error:", e);
          }
        } else {
          console.warn("⚠️ Firestore not initialized.");
        }
      } catch (e) {
        console.warn("Auth/init error:", e);
      }
    })();

    return () => {
      didCancel = true;
      if (unsubscribe) try { unsubscribe(); } catch (e) {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setPage(1);
  }, [tab]);

  useEffect(() => {
    if (!user) return;
    load({ reset: true, q: searchQuery });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, tab, user]);

  const updateStatus = useCallback(
    async (id, status) => {
      playStatusSound();

      setUpdatingId(id);
      const prev = itemsRef.current;
      const optimistic = prev.map((c) => (c._id === id ? { ...c, status } : c));
      applyItemsIfChanged(optimistic);

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
          // background notify admin (non-blocking)
          fetch("/api/notify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ to: "admin", title: "Call Closed ✅", body: `${user?.username || "Technician"} has closed a call.` }),
          }).catch(() => {});
        }

        if (status === "Canceled") {
          const removed = itemsRef.current.filter((c) => c._id !== id);
          applyItemsIfChanged(removed);
        }
      } catch (err) {
        toast.error(err.message || "Update failed");
        applyItemsIfChanged(prev);
      } finally {
        if (mountedRef.current) setUpdatingId(null);
      }
    },
    [applyItemsIfChanged, user]
  );

  useEffect(() => {
    async function setupMessaging() {
      try {
        const supported = await isSupported();
        if (!supported) return;
        if (!messaging) return;
        const permission = await Notification.requestPermission();
        if (permission === "granted" && user?._id) {
          try {
            const token = await getToken(messaging, { vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY });
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
            <div className="bg-blue-600 text-white px-4 py-2 rounded-xl shadow-lg">🔔 {payload.notification?.title || "New Notification"}<div className="text-sm text-gray-100">{payload.notification?.body}</div></div>,
            { duration: 5000 }
          );
        });
      } catch (e) {
        console.warn("Messaging not supported:", e?.message || e);
      }
    }

    if (typeof window !== "undefined" && user) setupMessaging();
  }, [user]);

  const startNavigation = useCallback((address) => {
    if (!address) return toast.error("No address found!");
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((pos) => {
        const { latitude, longitude } = pos.coords;
        const origin = `${latitude},${longitude}`;
        const destination = encodeURIComponent(address);
        const ua = navigator.userAgent || "";
        if (/Android/i.test(ua)) {
          window.location.href = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&travelmode=driving`;
        } else if (/iPhone|iPad|iPod/i.test(ua)) {
          window.location.href = `maps://?saddr=${origin}&daddr=${destination}&dirflg=d`;
        } else {
          window.open(`https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&travelmode=driving`, "_blank");
        }
      }, () => toast.error("Please enable location to start navigation."));
    } else toast.error("Geolocation not supported on this device.");
  }, []);

  const totalPages = useMemo(() => {
    if (total && total > 0) return Math.max(1, Math.ceil(total / PAGE_SIZE));
    return hasMore ? page + 1 : page;
  }, [total, page, hasMore]);

  useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape") setSelectedCall(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const handleShowDetails = useCallback((call) => setSelectedCall(call), []);

  // ---- search input handler (top-most compact) ----
  const onSearchInput = useCallback((value) => {
    setSearchQuery(value);

    // apply instant client-side filter from cached items for snappy feel
    try {
      const cached = JSON.parse(window.localStorage.getItem(`tech_calls_cache_${tab}_p${page}`)) || itemsRef.current || [];
      const localFiltered = filterItems(cached, value);
      if (localFiltered.length > 0) {
        applyItemsIfChanged(localFiltered);
      } else {
        // show empty quickly while server search runs
        applyItemsIfChanged([]);
      }
    } catch (e) {}

    // cancel previous debounce
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    if (searchAbortRef.current) searchAbortRef.current.abort();

    // debounce server call slightly
    searchDebounceRef.current = setTimeout(() => {
      load({ reset: true, q: value });
    }, 300);
  }, [applyItemsIfChanged, filterItems, load, page, tab]);

  return (
    <div className="pb-20 min-h-screen bg-slate-50">
      <Header user={user} />

      <main className="max-w-3xl mx-auto p-4 space-y-3">
        {/* ----------------------
            1) TOP: COMPACT SEARCH SECTION
            ---------------------- */}
        <div className="top-0 z-30 bg-slate-50/95 backdrop-blur px-0">
          <div className="rounded-2xl border bg-white shadow-sm p-2">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  value={searchQuery}
                  onChange={(e) => onSearchInput(e.target.value)}
                  placeholder="Search Calls"
                  className="w-full pl-10 pr-3 py-2 rounded-xl border text-sm focus:outline-none"
                  aria-label="Search calls"
                />
              </div>

              <button
                onClick={() => load({ reset: true, showToast: true, q: searchQuery })}
                className="px-3 py-1.5 rounded-xl text-sm font-semibold bg-white border border-slate-200 flex items-center gap-2 hover:bg-slate-50 disabled:opacity-60"
                disabled={isFetching}
                title="Refresh"
              >
                <motion.span animate={isFetching ? { rotate: 360 } : { rotate: 0 }} transition={{ repeat: isFetching ? Infinity : 0, duration: 0.8 }}>
                  <FiRefreshCw />
                </motion.span>
              </button>
            </div>

          
          </div>
        </div>

        {/* ----------------------
            2) TABS (below compact search)
            ---------------------- */}
        <div className="sticky top-[64px] z-20 bg-slate-50/90 backdrop-blur">
          <div className="rounded-2xl border bg-white shadow-sm">
            <div className="flex gap-2 overflow-x-auto scrollbar-hide p-2">
              {TABS.map((t) => (
                <button key={t} onClick={() => setTab(t)} className={`whitespace-nowrap px-3 py-2 rounded-xl text-sm font-semibold transition-colors border ${tab === t ? "bg-blue-600 text-white border-blue-600" : "bg-white hover:bg-slate-50 text-slate-700 border-slate-200"}`}>
                  {t}
                </button>
              ))}
              <div className="ml-auto px-2 flex items-center text-xs text-gray-600">Page <span className="font-semibold ml-1">{page}</span> / <span className="font-semibold">{totalPages}</span></div>
            </div>
          </div>
        </div>

        {/* ----------------------
            3) CALLS LIST (below tabs)
            ---------------------- */}
        <div className="space-y-3">
          {initialLoading && Array.from({ length: 5 }).map((_, i) => <CallCardSkeleton key={i} />)}

          {!initialLoading && items.length === 0 && (
            <div className="rounded-2xl border border-dashed p-10 text-center text-gray-500 bg-white">No calls found</div>
          )}

          <AnimatePresence initial={false}>
            {!initialLoading && items.map((call, idx) => (
              <CallCard
                key={call._id || `call-${idx}`}
                call={call}
                index={idx}
                onUpdateStatus={updateStatus}
                onShowDetails={handleShowDetails}
                startNavigation={startNavigation}
                updatingId={updatingId}
                animate={animateCards && idx < 40}
                searchQuery={searchQuery}
                highlight={searchQuery && ((call.clientName||"").toLowerCase().includes(searchQuery.toLowerCase()) || (call.phone||"").toLowerCase().includes(searchQuery.toLowerCase()) || (call.address||"").toLowerCase().includes(searchQuery.toLowerCase()) || (call.chooseLabel||"").toLowerCase().includes(searchQuery.toLowerCase()) || (call.notes||"").toLowerCase().includes(searchQuery.toLowerCase()) || (String(call.price)||"").toLowerCase().includes(searchQuery.toLowerCase()))}
              />
            ))}
          </AnimatePresence>

          {!initialLoading && (
            <div className="flex items-center justify-between pt-2">
              <button className="px-3 py-2 rounded-xl text-sm font-semibold bg-white border border-slate-200 hover:bg-slate-50 disabled:opacity-60" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1 || isFetching}>← Prev</button>

              <div className="text-xs text-gray-600">Page {page} / {totalPages}</div>

              <button className="px-3 py-2 rounded-xl text-sm font-semibold bg-white border border-slate-200 hover:bg-slate-50 disabled:opacity-60" onClick={() => setPage((p) => p + 1)} disabled={(!hasMore && page >= totalPages) || isFetching}>Next →</button>
            </div>
          )}

          {isFetching && !initialLoading && (
            <div className="flex items-center justify-center py-3 text-sm text-gray-600">
              <motion.div className="mr-2" animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 0.8 }}>
                <FiRefreshCw />
              </motion.div>
              Loading...
            </div>
          )}
        </div>
      </main>

      <BottomNav />

      <AnimatePresence>{selectedCall && <DetailsModal call={selectedCall} onClose={() => setSelectedCall(null)} startNavigation={startNavigation} />}</AnimatePresence>

      <style jsx global>{`
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }

        .pending-card { position: relative; overflow: hidden; }
        .pending-card::before { content: ""; position: absolute; inset: 0; border-radius: inherit; pointer-events: none; box-shadow: 0 0 0 0 rgba(248, 113, 113, 0.12); animation: pendingGlow 1.0s ease-out infinite; }
        @keyframes pendingGlow { 0% { box-shadow: 0 0 0 0 rgba(248, 113, 113, 0.28); } 70% { box-shadow: 0 0 0 10px rgba(248, 113, 113, 0); } 100% { box-shadow: 0 0 0 0 rgba(248, 113, 113, 0); } }
        .pending-avatar { animation: pendingShake 0.9s ease-in-out infinite; }
        @keyframes pendingShake { 0%, 100% { transform: translateX(0); } 25% { transform: translateX(-1px); } 75% { transform: translateX(1px); } }
        .pending-call-button { animation: pendingPulse 1.0s ease-in-out infinite; }
        @keyframes pendingPulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.03); } }

        body::after {
          content: "";
          position: fixed;
          inset: 0;
          z-index: 0;
          pointer-events: none;
          background: radial-gradient(1000px 400px at 10% 10%, rgba(99,102,241,0.02), transparent 10%),
                      radial-gradient(800px 300px at 90% 90%, rgba(249,115,22,0.01), transparent 12%);
          mix-blend-mode: normal;
        }

        .closed-card { background: linear-gradient(to right, rgba(16, 185, 129, 0.03), #ffffff); }
        .canceled-card { opacity: 0.85; }

        mark { background: rgba(250, 204, 21, 0.2); padding: 0 0.1rem; border-radius: 3px; }
      `}</style>
    </div>
  );
}
