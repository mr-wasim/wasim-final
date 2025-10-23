import Header from "../../components/Header";
import BottomNav from "../../components/BottomNav";
import { useEffect, useState, useRef } from "react";
import toast from "react-hot-toast";

const TABS = ["All Calls", "Today Calls", "Pending", "Closed"];

export default function Calls() {
  const [user, setUser] = useState(null);
  const [tab, setTab] = useState("All Calls");
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [count, setCount] = useState(0);
  const loadingRef = useRef(false);

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

  // Mobile-Only Navigation
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
            // Android: open Google Maps app directly
            const url = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&travelmode=driving`;
            window.location.href = url;
          } else if (/iPhone|iPad|iPod/i.test(ua)) {
            // iOS: open Apple Maps app
            const url = `maps://?saddr=${origin}&daddr=${destination}&dirflg=d`;
            window.location.href = url;
          } else {
            // Desktop: show toast
            toast.error("Please open this on a mobile device to launch Google Maps.");
          }
        },
        (err) => {
          toast.error("Please enable location to start navigation.");
        }
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
                className={`btn whitespace-nowrap ${
                  tab === t ? "bg-blue-600 text-white" : "bg-gray-100"
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
        <div className="card space-y-2">
          {items.length === 0 && (
            <p className="text-center text-gray-500">No calls found</p>
          )}

          {items.map((call) => (
            <div
              key={call._id}
              className="border rounded-xl p-3 transition-all hover:shadow-md"
            >
              <div className="flex justify-between">
                <div>
                  <div className="text-3xl font-extrabold bg-gradient-to-r from-teal-500 via-blue-600 to-indigo-700 bg-clip-text text-transparent relative inline-block">
                    {call.clientName}
                    <span className="absolute left-0 -bottom-1 w-0 h-1 bg-indigo-700 rounded-full transition-all duration-500 group-hover:w-full"></span>
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
                </div>
                <div className="text-sm font-medium text-gray-700">
                  {call.status}
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

                {/* LIVE NAVIGATION */}
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
            </div>
          ))}

          {/* Pagination */}
          <div className="flex justify-between mt-3">
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
