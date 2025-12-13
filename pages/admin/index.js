// pages/admin/index.js
import Header from "../../components/Header";
import { useEffect, useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";

import {
  LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend
} from "recharts";

// Firebase Notifications
import { db } from "../../lib/firebase";
import { collection, query, where, orderBy, onSnapshot, limit } from "firebase/firestore";

// Premium Popups
import TechnicianPopup from "../../components/admin/TechnicianPopup";
import FormsPopup from "../../components/admin/FormsPopup";
import ForwardedPopup from "../../components/admin/ForwardedPopup";
import PaymentPopup from "../../components/admin/PaymentPopup";

export default function AdminHome() {

  // STATES
  const [user, setUser] = useState(null);
  const [stats, setStats] = useState(null);
  const [chartData, setChartData] = useState([]);
  const [notifications, setNotifications] = useState([]);

  // POPUPS
  const [openTech, setOpenTech] = useState(false);
  const [openForms, setOpenForms] = useState(false);
  const [openForwarded, setOpenForwarded] = useState(false);
  const [openPayments, setOpenPayments] = useState(false);

  // FAST FETCH + SUPER OPTIMIZED
  useEffect(() => {
    (async () => {
      try {
        const me = await fetch("/api/auth/me");
        if (!me.ok) return (window.location.href = "/login");

        const u = await me.json();
        if (u.role !== "admin") return (window.location.href = "/login");
        setUser(u);

        // Fetch summary FAST
        const [sum] = await Promise.all([
          fetch("/api/admin/summary").then((r) => r.json())
        ]);

        setStats(sum);

        // Weekly data (static or dynamic)
        setChartData([
          { name: "Mon", calls: 12, forms: 5 },
          { name: "Tue", calls: 21, forms: 7 },
          { name: "Wed", calls: 17, forms: 6 },
          { name: "Thu", calls: 33, forms: 10 },
          { name: "Fri", calls: 28, forms: 9 },
          { name: "Sat", calls: 15, forms: 4 },
        ]);
      } catch (e) {
        console.log(e);
        toast.error("Something went wrong");
      }
    })();
  }, []);

  // NOTIFICATION LISTENER (Ultra optimized)
  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, "notifications"),
      where("to", "==", "admin"),
      orderBy("createdAt", "desc"),
      limit(20)
    );

    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

      if (data.length > notifications.length) {
        const newest = data[0];
        toast.success(`🔔 ${newest.message}`);
        new Audio("/notify.mp3").play().catch(() => {});
      }

      setNotifications(data);
    });

    return () => unsub();
  }, [user, notifications.length]);

  const COLORS = ["#3b82f6", "#10b981", "#facc15", "#ef4444"];

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#eef2ff] via-white to-[#dbeafe]">

      <Header user={user} />

      <main className="max-w-7xl mx-auto p-6 space-y-8">

        {/* Dashboard Title */}
        <motion.h1
          className="text-4xl font-bold text-gray-800 tracking-tight flex items-center justify-between"
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
        >
          Admin Dashboard
        </motion.h1>

        {/* Stats Section with glass effect */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {!stats
            ? [...Array(4)].map((_, i) => (
                <div
                  key={i}
                  className="h-28 bg-white/50 backdrop-blur-md shadow animate-pulse rounded-2xl"
                ></div>
              ))
            : (
              <>
                <StatCard title="Technicians" value={stats.techs} color="blue" onClick={() => setOpenTech(true)} />
                <StatCard title="Customer Forms" value={stats.forms} color="green" onClick={() => setOpenForms(true)} />
                <StatCard title="Forwarded Calls" value={stats.calls} color="yellow" onClick={() => setOpenForwarded(true)} />
                <StatCard title="Total Payments" value={`₹${stats.totalPayments}`} color="purple" onClick={() => setOpenPayments(true)} />
              </>
            )}
        </div>

        {/* Charts */}
        <div className="grid lg:grid-cols-2 gap-8">

          {/* Line Chart */}
          <motion.div className="bg-white/80 backdrop-blur-xl shadow-lg p-6 rounded-2xl border"
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>

            <h2 className="font-semibold text-gray-700 mb-3">Weekly Calls & Forms</h2>

            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={chartData}>
                <Line type="monotone" dataKey="calls" stroke="#2563eb" strokeWidth={3} dot={false} />
                <Line type="monotone" dataKey="forms" stroke="#16a34a" strokeWidth={3} dot={false} />
                <CartesianGrid stroke="#e5e7eb" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
              </LineChart>
            </ResponsiveContainer>
          </motion.div>

          {/* Pie chart */}
          <motion.div className="bg-white/80 backdrop-blur-xl shadow-lg p-6 rounded-2xl border"
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <h2 className="font-semibold text-gray-700 mb-3">Performance Overview</h2>

            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  outerRadius={90}
                  label
                  dataKey="value"
                  data={[
                    { name: "Technicians", value: stats?.techs || 0 },
                    { name: "Forms", value: stats?.forms || 0 },
                    { name: "Calls", value: stats?.calls || 0 },
                    { name: "Payments", value: stats?.totalPayments || 0 },
                  ]}
                >
                  {COLORS.map((c, i) => <Cell key={i} fill={c} />)}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </motion.div>
        </div>

        {/* Recent Forwarded Calls */}
        <motion.div
          className="bg-white/80 backdrop-blur-xl p-6 rounded-2xl shadow-lg border"
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex justify-between">
            <h2 className="font-semibold text-gray-700">Recent Forwarded Calls</h2>

            <button className="text-blue-600 hover:text-blue-800" onClick={() => window.location.reload()}>
              Refresh
            </button>
          </div>

          <RecentForwarded />
        </motion.div>
      </main>

      {/* POPUPS */}
      <AnimatePresence>
        {openTech && <TechnicianPopup onClose={() => setOpenTech(false)} />}
        {openForms && <FormsPopup onClose={() => setOpenForms(false)} />}
        {openForwarded && <ForwardedPopup onClose={() => setOpenForwarded(false)} />}
        {openPayments && <PaymentPopup onClose={() => setOpenPayments(false)} />}
      </AnimatePresence>
    </div>
  );
}

/* ---------------- STAT CARD ---------------- */
function StatCard({ title, value, color, onClick }) {
  const palette = {
    blue: "from-blue-500 to-blue-700",
    green: "from-green-500 to-green-700",
    yellow: "from-yellow-400 to-yellow-600",
    purple: "from-purple-500 to-purple-700",
  };

  return (
    <motion.div
      onClick={onClick}
      whileHover={{ scale: 1.07 }}
      whileTap={{ scale: 0.95 }}
      className={`p-5 rounded-2xl cursor-pointer text-white bg-gradient-to-br ${palette[color]} shadow-xl relative overflow-hidden`}
    >
      <div className="text-sm opacity-90">{title}</div>
      <div className="text-3xl font-bold">{value}</div>

      <motion.div
        initial={{ opacity: 0, scale: 0.5 }}
        animate={{ opacity: 0.2, scale: 1 }}
        className="absolute text-8xl -bottom-6 -right-4 font-bold select-none"
      >
        +
      </motion.div>
    </motion.div>
  );
}

/* -------------- RECENT FORWARDED TABLE ---------------- */
function RecentForwarded() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const r = await fetch("/api/admin/forwarded?limit=10");
      const d = await r.json();
      setItems(d.items || []);
      setLoading(false);
    })();
  }, []);

  if (loading) {
    return (
      <div className="mt-4 space-y-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-10 bg-gray-200 animate-pulse rounded-md"></div>
        ))}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto mt-4">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-blue-100 text-left">
            <th className="p-2">Client</th>
            <th className="p-2">Phone</th>
            <th className="p-2">Technician</th>
            <th className="p-2">Status</th>
            <th className="p-2">Date</th>
          </tr>
        </thead>

        <tbody>
          {items.map((it) => (
            <motion.tr
              key={it._id}
              className="border-t hover:bg-blue-50"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <td className="p-2">{it.clientName}</td>
              <td className="p-2">{it.phone}</td>
              <td className="p-2">{it.techName || "-"}</td>
              <td className="p-2">{it.status}</td>
              <td className="p-2">{new Date(it.createdAt).toLocaleString()}</td>
            </motion.tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
