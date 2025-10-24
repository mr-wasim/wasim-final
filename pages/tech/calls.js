import Header from "../../components/Header";
import BottomNav from "../../components/BottomNav";
import { useEffect, useState, useRef } from "react";
import toast from "react-hot-toast";
import { motion } from "framer-motion";
import { FiClock, FiAlertTriangle, FiCheckCircle } from "react-icons/fi";

const TABS = ["All Calls", "Today Calls", "Pending", "Closed"];

export default function Calls() {
  const [user, setUser] = useState(null);
  const [tab, setTab] = useState("All Calls");
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [count, setCount] = useState(0);
  const loadingRef = useRef(false);

  // Format "time ago"
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

  // Load calls
  async function load(showToast = false) {
    if (loadingRef.current) return;
    loadingRef.current = true;
    try {
      const params = new URLSearchParams({ tab, page });
      const r = await fetch("/api/tech/my-calls?" + params.toString(), {
        cache: "no-store",
      });
      const d = await r.json();
      if (d.success && Array.isArray(d.items)) {
        const mapped = d.items.map((i) => ({
          _id: i._id,
          clientName: i.clientName || i.name || "",
          phone: i.phone || "",
          address: i.address || "",
          type: i.type || i.service || "",
          price: i.price || i.amount || 0,
          status: i.status || "Pending",
          createdAt: i.createdAt || i.created_at || "",
        }));

        let filtered = mapped;
        const todayDate = new Date().toISOString().split("T")[0];
        if (tab === "Today Calls") {
          filtered = mapped.filter(
            (c) => (c.createdAt ? c.createdAt.split("T")[0] : "") === todayDate
          );
        } else if (tab === "Pending") {
          filtered = mapped.filter((c) => c.status === "Pending");
        } else if (tab === "Closed") {
          filtered = mapped.filter((c) => c.status === "Closed");
        }

        setItems(filtered);
        setCount(filtered.length);
        if (showToast) toast.success("Data updated");
      }
    } catch (err) {
      console.error("Load error:", err);
    } finally {
      loadingRef.current = false;
    }
  }

  // Authentication
  useEffect(() => {
    (async () => {
      const me = await fetch("/api/auth/me");
      if (!me.ok) return (window.location.href = "/login");
      const u = await me.json();
      if (u.role !== "technician") return (window.location.href = "/login");
      setUser(u);
      load(false);
    })();
  }, []);

  // Refresh on tab/page change
  useEffect(() => {
    if (user) load(false);
  }, [tab, page]);

  // Auto-refresh every 30s
  useEffect(() => {
    const t = setInterval(() => load(false), 30000);
    return () => clearInterval(t);
  }, [tab, page]);

  // Update call status
  async function updateStatus(id, status) {
    try {
      const r = await fetch("/api/tech/update-call", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Failed");
      toast.success("Status Updated");
      await load(false);
    } catch (err) {
      toast.error(err.message);
    }
  }

  // Mobile Navigation
  function startNavigation(address) {
    if (!address) {
      toast.error("No address found!");
      return;
    }

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
            toast.error("Please open this on a mobile device to launch Google Maps.");
          }
        },
        () => toast.error("Please enable location to start navigation.")
      );
    } else {
      toast.error("Geolocation not supported on this device.");
    }
  }

  return (
    <div className="pb-16">
      <Header user={user} />

      <main className="max-w-3xl mx-auto p-4 space-y-3">
        {/* Tabs */}
        <div className="card">
          <div className="flex gap-2 overflow-x-auto">
            {TABS.map((t) => (
              <button
                key={t}
                onClick={() => {
                  setTab(t);
                  setPage(1);
                }}
                className={`btn whitespace-nowrap transition-all duration-300 ${
                  tab === t
                    ? "bg-blue-600 text-white scale-105 shadow-md"
                    : "bg-gray-100 hover:bg-gray-200"
                }`}
              >
                {t}
                {t === "Today Calls" && (
                  <span className="ml-1 badge bg-red-100 text-red-600">
                    NEW
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Calls List */}
        <div className="card space-y-3">
          {items.length === 0 && (
            <p className="text-center text-gray-500">No calls found</p>
          )}

          {items.map((call) => {
            const pending = call.status === "Pending";
            const closed = call.status === "Closed";

            return (
              <motion.div
                key={call._id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className={`border rounded-xl p-4 transition-all duration-300 hover:shadow-lg ${
                  pending
                    ? "bg-gradient-to-r from-red-50 via-orange-50 to-orange-100 border-orange-300"
                    : closed
                    ? "bg-gradient-to-r from-green-50 via-emerald-50 to-emerald-100 border-green-300"
                    : "bg-white"
                }`}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <div className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-700 bg-clip-text text-transparent">
                      {call.clientName}
                    </div>
                    <p className="text-sm text-gray-600">
                      <strong>Phone:</strong> {call.phone}
                    </p>
                    <p className="text-sm text-gray-600">
                      <strong>Address:</strong> {call.address}
                    </p>
                    <p className="text-sm text-gray-600">
                      <strong>Type:</strong> {call.type}
                    </p>
                    <p className="text-sm text-gray-600">
                      <strong>Price:</strong> ₹{call.price}
                    </p>
                    <div className="flex items-center mt-1 text-xs text-gray-500">
                      <FiClock className="mr-1" />
                      Received {timeAgo(call.createdAt)}
                    </div>
                  </div>

                  <div className="flex flex-col items-center">
                    {pending && (
                      <motion.div
                        animate={{ scale: [1, 1.2, 1] }}
                        transition={{ repeat: Infinity, duration: 1.2 }}
                        className="text-orange-600"
                      >
                        <FiAlertTriangle size={22} />
                      </motion.div>
                    )}
                    {closed && (
                      <motion.div
                        initial={{ rotate: -15, scale: 0.8 }}
                        animate={{ rotate: 0, scale: 1 }}
                        transition={{ type: "spring", stiffness: 200 }}
                        className="text-green-600"
                      >
                        <FiCheckCircle size={24} />
                      </motion.div>
                    )}
                    <span
                      className={`text-xs font-semibold mt-1 ${
                        pending ? "text-orange-600" : "text-green-700"
                      }`}
                    >
                      {call.status}
                    </span>
                  </div>
                </div>

                {/* Buttons */}
                <div className="flex gap-2 mt-3">
                  <a
                    className="btn bg-green-600 text-white"
                    href={`tel:${call.phone}`}
                  >
                    Call
                  </a>
                  <button
                    className="btn bg-gray-100"
                    onClick={() => startNavigation(call.address)}
                  >
                    Go
                  </button>
                  {tab === "All Calls" ? (
                    <select
                      className="input"
                      value={call.status}
                      onChange={(e) =>
                        updateStatus(call._id, e.target.value)
                      }
                    >
                      <option>Pending</option>
                      <option>Closed</option>
                    </select>
                  ) : (
                    <button
                      className="btn bg-gray-100"
                      onClick={() => updateStatus(call._id, "Closed")}
                    >
                      Close Call
                    </button>
                  )}
                </div>
              </motion.div>
            );
          })}

          {/* Pagination */}
          <div className="flex justify-between mt-3 items-center">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              className="btn bg-gray-100"
            >
              Prev
            </button>
            <div className="text-sm text-gray-600">
              Page {page} • Showing {items.length} of {count}
            </div>
            <button
              disabled={items.length < 4}
              onClick={() => setPage((p) => p + 1)}
              className="btn bg-gray-100"
            >
              Next
            </button>
          </div>
        </div>
      </main>

      <BottomNav />
    </div>
  );
}
