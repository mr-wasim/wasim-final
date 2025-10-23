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
    <header className="sticky top-0 z-50 bg-[#2563eb] shadow-md transition-all duration-300">
      <div className="max-w-7xl mx-auto flex justify-between items-center px-5 py-4">
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
            className="text-2xl font-bold tracking-tight text-white cursor-pointer"
          >
            Chimney <span className="text-blue-100">Solutions</span>
          </h1>
        </div>

        {/* DESKTOP NAV */}
        <nav className="hidden md:flex items-center gap-6 text-white font-medium">
          {navLinks[user?.role]?.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`flex items-center gap-2 hover:text-blue-100 transition ${
                router.pathname === link.href ? "font-semibold underline underline-offset-4" : ""
              }`}
            >
              {link.icon}
              {link.label}
            </Link>
          ))}
        </nav>

        {/* RIGHT SIDE */}
        <div className="flex items-center gap-5">
          {/* Notification Icon */}
          <button className="relative text-white hover:scale-110 transition">
            <FiBell className="text-xl" />
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
              3
            </span>
          </button>

          {/* Profile Dropdown */}
          <div className="relative">
            <button
              onClick={() => setProfileOpen(!profileOpen)}
              className="flex items-center gap-2 bg-white/10 hover:bg-white/20 px-3 py-2 rounded-lg text-white font-semibold transition"
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
                  className="absolute right-0 mt-3 w-52 bg-white rounded-lg shadow-lg overflow-hidden z-50"
                >
                  <Link
                    href="/tech/profile"
                    className="flex items-center gap-2 px-4 py-3 text-gray-700 hover:bg-blue-50 transition"
                  >
                    <FiUser /> My Profile
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="flex items-center gap-2 w-full text-left px-4 py-3 text-red-600 hover:bg-red-50 transition"
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
            className="fixed top-0 left-0 w-72 h-full bg-[#2563eb] text-white z-40 p-6 flex flex-col shadow-2xl md:hidden"
          >
            <h2 className="text-lg font-semibold mb-4 border-b border-white/20 pb-2">
              {user?.role === "admin" ? "Admin Menu" : "Technician Menu"}
            </h2>

            {navLinks[user?.role]?.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg transition ${
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

            <div className="mt-auto pt-6 border-t border-white/20">
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 w-full px-3 py-2 bg-red-500 hover:bg-red-600 rounded-lg text-white font-semibold transition"
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
