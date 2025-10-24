import Header from "../../components/Header";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import toast from "react-hot-toast";
import {
  LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from "recharts";

// 🔥 Firebase Imports
import { db } from "../../lib/firebase";
import { collection, query, where, orderBy, onSnapshot } from "firebase/firestore";

export default function AdminHome() {
  const [user, setUser] = useState(null);
  const [stats, setStats] = useState(null);
  const [chartData, setChartData] = useState([]);
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    (async () => {
      const me = await fetch("/api/auth/me");
      if (me.ok) {
        const u = await me.json();
        if (u.role !== "admin") {
          window.location.href = "/login";
          return;
        }
        setUser(u);
      }

      const r = await fetch("/api/admin/summary");
      const d = await r.json();
      setStats(d);

      // Demo Chart Data
      setChartData([
        { name: "Mon", calls: 30, forms: 12 },
        { name: "Tue", calls: 45, forms: 22 },
        { name: "Wed", calls: 40, forms: 18 },
        { name: "Thu", calls: 60, forms: 28 },
        { name: "Fri", calls: 35, forms: 14 },
        { name: "Sat", calls: 25, forms: 10 },
      ]);
    })();
  }, []);

  // 🔥 Real-Time Notification Listener
  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, "notifications"),
      where("to", "==", "admin"),
      orderBy("createdAt", "desc")
    );

    const unsub = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

      // check for new notifications only
      if (data.length > notifications.length) {
        const newNoti = data[0];
        toast.success(`🔔 ${newNoti.message || "New Notification"}`);
        const audio = new Audio("/notify.mp3");
        audio.play().catch(() => {});
      }

      setNotifications(data);
    });

    return () => unsub();
  }, [user, notifications]);

  const COLORS = ["#2563eb", "#16a34a", "#facc15", "#ef4444"];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-100">
      <Header user={user} />

      <main className="max-w-7xl mx-auto p-6 space-y-8">
        {/* === DASHBOARD TITLE === */}
        <motion.h1
          className="text-3xl font-extrabold text-gray-800 mb-4 flex items-center justify-between"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <span>Admin Dashboard</span>

          {/* 🔔 Notification Count */}
          <span className="bg-red-500 text-white px-3 py-1 rounded-full text-sm shadow">
            {notifications.length} New
          </span>
        </motion.h1>

        {/* === STATS CARDS === */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {stats ? (
            <>
              <StatCard title="Technicians" value={stats.techs} color="blue" />
              <StatCard title="Forms Submitted" value={stats.forms} color="green" />
              <StatCard title="Forwarded Calls" value={stats.calls} color="yellow" />
              <StatCard title="Total Payments" value={`₹${stats.totalPayments}`} color="purple" />
            </>
          ) : (
            Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="h-28 bg-gray-200 animate-pulse rounded-2xl"
              ></div>
            ))
          )}
        </div>

        {/* === GRAPH SECTION === */}
        <div className="grid lg:grid-cols-2 gap-8">
          <motion.div
            className="bg-white p-6 rounded-2xl shadow-md border border-gray-100"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <h2 className="font-semibold text-gray-700 mb-3">Weekly Calls & Forms Trend</h2>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={chartData}>
                <Line type="monotone" dataKey="calls" stroke="#2563eb" strokeWidth={3} />
                <Line type="monotone" dataKey="forms" stroke="#16a34a" strokeWidth={3} />
                <CartesianGrid stroke="#ccc" strokeDasharray="5 5" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
              </LineChart>
            </ResponsiveContainer>
          </motion.div>

          <motion.div
            className="bg-white p-6 rounded-2xl shadow-md border border-gray-100"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <h2 className="font-semibold text-gray-700 mb-3">Performance Overview</h2>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  dataKey="value"
                  data={[
                    { name: "Technicians", value: stats?.techs || 0 },
                    { name: "Forms", value: stats?.forms || 0 },
                    { name: "Calls", value: stats?.calls || 0 },
                    { name: "Payments", value: stats?.totalPayments || 0 },
                  ]}
                  cx="50%"
                  cy="50%"
                  outerRadius={90}
                  label
                >
                  {COLORS.map((color, index) => (
                    <Cell key={`cell-${index}`} fill={color} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </motion.div>
        </div>

        {/* === RECENT CALLS SECTION === */}
        <motion.div
          className="bg-white p-6 rounded-2xl shadow-md border border-gray-100"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-700 text-lg">Recent Forwarded Calls</h2>
            <button
              onClick={() => toast.success("Refreshing data...")}
              className="text-sm text-blue-600 hover:text-blue-800 font-medium"
            >
              Refresh
            </button>
          </div>
          <RecentForwarded />
        </motion.div>
      </main>
    </div>
  );
}

/* === STAT CARD COMPONENT === */
function StatCard({ title, value, color }) {
  const colorMap = {
    blue: "from-blue-500 to-blue-600",
    green: "from-green-500 to-green-600",
    yellow: "from-yellow-400 to-yellow-500",
    purple: "from-purple-500 to-purple-600",
  };
  return (
    <motion.div
      className={`p-5 rounded-2xl shadow-md text-white bg-gradient-to-br ${colorMap[color]} relative overflow-hidden`}
      whileHover={{ scale: 1.03 }}
      transition={{ type: "spring", stiffness: 200 }}
    >
      <div className="text-sm font-medium opacity-90">{title}</div>
      <div className="text-3xl font-bold mt-1">{value}</div>
      <div className="absolute -bottom-5 -right-5 opacity-20 text-6xl font-bold">
        +
      </div>
    </motion.div>
  );
}

/* === RECENT CALLS TABLE === */
function RecentForwarded() {
  const [items, setItems] = useState(null);
  useEffect(() => {
    let cancelled = false;
    async function load() {
      const r = await fetch("/api/admin/forwarded?limit=10");
      const d = await r.json();
      if (!cancelled) setItems(d.items);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left bg-blue-50">
            <th className="p-2 font-semibold text-gray-700">Client</th>
            <th className="p-2 font-semibold text-gray-700">Phone</th>
            <th className="p-2 font-semibold text-gray-700">Technician</th>
            <th className="p-2 font-semibold text-gray-700">Status</th>
            <th className="p-2 font-semibold text-gray-700">Date</th>
          </tr>
        </thead>
        <tbody>
          {items ? (
            items.map((it) => (
              <tr
                key={it._id}
                className="border-t hover:bg-blue-50 transition-colors duration-200"
              >
                <td className="p-2">{it.clientName}</td>
                <td className="p-2">{it.phone}</td>
                <td className="p-2">{it.techName || "-"}</td>
                <td
                  className={`p-2 font-medium ${
                    it.status === "Closed"
                      ? "text-green-600"
                      : it.status === "Pending"
                      ? "text-yellow-500"
                      : "text-gray-700"
                  }`}
                >
                  {it.status}
                </td>
                <td className="p-2 text-gray-500">
                  {new Date(it.createdAt).toLocaleString()}
                </td>
              </tr>
            ))
          ) : (
            Array.from({ length: 5 }).map((_, i) => (
              <tr key={i}>
                <td colSpan="5" className="p-3">
                  <div className="h-5 bg-gray-200 animate-pulse rounded"></div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
