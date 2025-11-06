import Link from "next/link";
import { useRouter } from "next/router";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FiMenu,
  FiX,
  FiUser,
  FiHome,
  FiFileText,
  FiPhoneCall,
  FiDollarSign,
  FiUsers,
  FiPlus,
  FiBell,
  FiLogOut,

} from "react-icons/fi";

export default function Header({ user }) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  };

  const navLinks = {
    admin: [
      { href: "/admin", label: "Dashboard", icon: <FiHome /> },
      { href: "/admin/forms", label: "Service Forms", icon: <FiFileText /> },
      { href: "/admin/forward", label: "Call Forwarding", icon: <FiPhoneCall /> },
      { href: "/admin/forwarded", label: "Forwarded Calls", icon: <FiPhoneCall /> },
      { href: "/admin/payments", label: "Payments / Reports", icon: <FiDollarSign /> },
      { href: "/admin/techs", label: "Technicians", icon: <FiUsers /> },
      { href: "/admin/create-tech", label: "Create Technician", icon: <FiPlus /> },
   
    ],
    technician: [
      { href: "/tech", label: "Dashboard", icon: <FiHome /> },
      { href: "/tech/payments", label: "Payment Mode", icon: <FiDollarSign /> },
    ],
  };

  return (
    <header className="sticky top-0 z-50 bg-gradient-to-r from-[#2563eb] via-[#1e4ed8] to-[#2563eb] backdrop-blur-lg bg-opacity-90 shadow-lg transition-all duration-300">
      <div className="max-w-7xl mx-auto flex justify-between items-center px-6 py-3">
        {/* LOGO */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="md:hidden text-2xl text-white hover:scale-110 transition-transform"
          >
            {menuOpen ? <FiX /> : <FiMenu />}
          </button>

          <h1
            onClick={() => router.push("/")}
            className="text-xl md:text-2xl font-extrabold tracking-tight text-white cursor-pointer hover:scale-105 transition-transform"
          >
            Chimney <span className="text-blue-100">Solutions</span>
          </h1>
        </div>

        {/* DESKTOP NAV */}
        <nav className="hidden md:flex items-center gap-6 text-sm text-white font-medium relative">
          {navLinks[user?.role]?.map((link) => (
            <div key={link.href} className="group relative">
              <Link
                href={link.href}
                className={`flex items-center gap-1.5 transition-all duration-200 ${
                  router.pathname === link.href
                    ? "text-white font-semibold"
                    : "text-white/80 hover:text-white"
                }`}
              >
                <span className="text-base">{link.icon}</span>
                <span className="truncate">{link.label}</span>
              </Link>
              <span
                className={`absolute left-0 bottom-[-5px] h-[2px] w-0 bg-white rounded-full transition-all duration-300 group-hover:w-full ${
                  router.pathname === link.href ? "w-full" : ""
                }`}
              ></span>
            </div>
          ))}
        </nav>

        {/* RIGHT SIDE */}
        <div className="flex items-center gap-4">
          {/* Notification */}
          <button className="relative text-white hover:scale-110 transition">
            <FiBell className="text-lg" />
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] font-bold rounded-full w-3.5 h-3.5 flex items-center justify-center">
              3
            </span>
          </button>

          {/* Profile */}
          <div className="relative">
            <button
              onClick={() => setProfileOpen(!profileOpen)}
              className="flex items-center gap-1.5 bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-lg text-sm text-white font-semibold shadow-inner transition-all"
            >
              <FiUser />
              {user?.name || "Profile"}
            </button>

            <AnimatePresence>
              {profileOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                  className="absolute right-0 mt-3 w-52 bg-white rounded-xl shadow-xl overflow-hidden z-50"
                >
                  <Link
                    href="/tech/profile"
                    className="flex items-center gap-2 px-4 py-2.5 text-gray-700 hover:bg-blue-50 transition text-sm"
                  >
                    <FiUser /> My Profile
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="flex items-center gap-2 w-full text-left px-4 py-2.5 text-red-600 hover:bg-red-50 transition text-sm"
                  >
                    <FiLogOut /> Logout
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* MOBILE MENU */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={{ type: "spring", stiffness: 100, damping: 20 }}
            className="fixed top-0 left-0 w-72 h-full bg-[#2563eb] text-white z-40 p-6 flex flex-col shadow-2xl md:hidden overflow-y-auto scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent"
          >
            <h2 className="text-base font-semibold mb-4 border-b border-white/20 pb-2">
              {user?.role === "admin" ? "Admin Menu" : "Technician Menu"}
            </h2>

            {navLinks[user?.role]?.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition ${
                  router.pathname === link.href
                    ? "bg-white/20 font-semibold"
                    : "hover:bg-white/10"
                }`}
                onClick={() => setMenuOpen(false)}
              >
                {link.icon}
                {link.label}
              </Link>
            ))}

            <div className="mt-auto pt-4 border-t border-white/20">
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 w-full px-3 py-2 bg-red-500 hover:bg-red-600 rounded-lg text-white text-sm font-semibold transition"
              >
                <FiLogOut /> Logout
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
