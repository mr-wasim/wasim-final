// components/Header.js
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";
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
  FiLogOut,
  FiEdit,
  FiArrowRight,
  FiPhoneForwarded,
  FiUserCheck
} from "react-icons/fi";

/** Safe, SSR-friendly reduced-motion hook */
function useSafeReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(!!mq.matches);
    update();
    if (mq.addEventListener) {
      mq.addEventListener("change", update);
      return () => mq.removeEventListener("change", update);
    } else {
      mq.addListener(update);
      return () => mq.removeListener(update);
    }
  }, []);
  return reduced;
}

export default function Header({
  user = { role: "technician", name: "User", id: "" },
}) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const shouldReduceMotion = useSafeReducedMotion();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") {
        setMenuOpen(false);
        setProfileOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const safeNavigate = (href) => {
    if (!href) return;
    if (router?.pathname === href) return;
    router.push(href);
  };

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {}
    finally { safeNavigate("/login"); }
  };

 const navLinks = useMemo(
  () => ({
    admin: [
      { href: "/admin", label: "Dashboard", icon: <FiHome /> },
      { href: "/admin/forms", label: "Service Forms", icon: <FiFileText /> },

      // Forward Call (Best Icon)
      { href: "/admin/forward", label: "New Call Assign", icon: <FiPhoneForwarded /> },

      // Forwarded Calls
      // { href: "/admin/forwarded", label: "All Customers", icon: <FiUsers /> },

      // Edit Calls – EDIT ICON
      { href: "/admin/all-calls", label: "Edit Calls", icon: <FiEdit /> },

      { href: "/admin/all-customers", label: "All Customers", icon: <FiUsers /> },

      // Technician Calls – TECHNICIAN ICON
      { href: "/admin/technician-calls", label: "Technician Call Details", icon: <FiUserCheck /> },

      { href: "/admin/payments", label: "Payments / Reports", icon: <FiDollarSign /> },
      { href: "/admin/techs", label: "Technicians", icon: <FiUsers /> },
      { href: "/admin/create-tech", label: "Create Technician", icon: <FiPlus /> },
    ],

    technician: [
      { href: "/tech", label: "Dashboard", icon: <FiHome /> },
      { href: "/tech/payments", label: "Payment Mode", icon: <FiDollarSign /> },
    ],
  }),
  []
);


  const links = navLinks[user?.role] || [];
  const isActive = (href) =>
    router.pathname === href || router.pathname?.startsWith(href + "/");

  const initials = (name) => {
    const chars = (name || "")
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((s) => s[0]?.toUpperCase())
      .join("");
    return chars || "U";
  };

  const isAdmin = user?.role === "admin";

  return (
    <>
      <header
        className={[
          "sticky top-0 z-[90] transition-all duration-200",
          "bg-gradient-to-r from-[#1e3a8a] via-[#1d4ed8] to-[#1e40af]",
          "backdrop-blur-xl bg-opacity-90",
          scrolled ? "shadow-2xl shadow-blue-900/20" : "shadow-lg shadow-blue-900/10",
        ].join(" ")}
        role="banner"
      >
        <div className="max-w-screen-2xl mx-auto flex items-center justify-between px-3 sm:px-6 py-3">

          {/* LEFT SIDE */}
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((v) => !v)}
              className="md:hidden text-2xl text-white hover:scale-105 active:scale-95 transition-transform focus:outline-none focus:ring-2 focus:ring-white/60 rounded-lg p-1"
            >
              {menuOpen ? <FiX /> : <FiMenu />}
            </button>

            <Link href="/" className="select-none cursor-pointer group min-w-0">
              <div className="flex items-center gap-2">
                <motion.div
                  layout
                  className="h-9 w-9 rounded-xl bg-white/15 ring-1 ring-white/20 grid place-items-center shadow-inner"
                  whileHover={shouldReduceMotion ? {} : { scale: 1.05 }}
                  transition={{ duration: 0.12 }}
                >
                  <span className="text-white font-black">CS</span>
                </motion.div>
                <h1 className="text-xl md:text-2xl font-extrabold tracking-tight text-white truncate">
                  Chimney <span className="text-blue-100">Solutions</span>
                </h1>
              </div>
              <div className="h-0.5 w-0 group-hover:w-full transition-all duration-300 bg-white/30 rounded-full" />
            </Link>
          </div>

          {/* DESKTOP NAV */}
          <nav aria-label="Primary" className="hidden md:flex items-center justify-center flex-1 min-w-0 px-2">
            {isAdmin ? (
              <div className="relative w-full max-w-[980px]">
                <div className="pointer-events-none absolute left-0 top-0 h-full w-6 rounded-l-[22px] bg-gradient-to-r from-white/80 to-transparent" />
                <div className="pointer-events-none absolute right-0 top-0 h-full w-6 rounded-r-[22px] bg-gradient-to-l from-white/80 to-transparent" />

                <div className="relative bg-white/90 backdrop-blur rounded-[22px] p-1 shadow-sm ring-1 ring-black/5 flex items-center gap-1 overflow-x-auto no-scrollbar">
                  {links.map((link) => {
                    const active = isActive(link.href);
                    return (
                      <Link key={link.href} href={link.href} aria-current={active ? "page" : undefined} className="relative block">
                        <span
                          className={[
                            "flex items-center gap-2 px-4 py-2 rounded-[18px] text-sm whitespace-nowrap",
                            "transition duration-150",
                            active ? "text-white" : "text-gray-700 hover:text-gray-900",
                          ].join(" ")}
                        >
                          {active && (
                            <motion.span
                              layoutId="adminTabHighlight"
                              transition={{ duration: 0.15 }}
                              className="absolute inset-0 rounded-[18px] bg-gradient-to-r from-indigo-600 to-blue-600 shadow-md"
                              aria-hidden="true"
                            />
                          )}
                          <span className="relative z-[1] text-base opacity-90">{link.icon}</span>
                          <span className="relative z-[1] truncate font-medium">{link.label}</span>
                        </span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center flex-1 min-w-0 overflow-x-auto no-scrollbar md:flex-wrap gap-1.5 text-sm text-white font-medium">
                {links.map((link) => (
                  <div key={link.href} className="relative group shrink-0">
                    <Link
                      href={link.href}
                      className={[
                        "flex items-center gap-2 px-2.5 py-2 rounded-xl transition-all duration-150",
                        isActive(link.href)
                          ? "bg-white/15 ring-1 ring-white/20 text-white"
                          : "text-white/80 hover:text-white hover:bg-white/10",
                      ].join(" ")}
                    >
                      <span className="text-base" aria-hidden="true">{link.icon}</span>
                      <span className="truncate">{link.label}</span>
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </nav>

          {/* RIGHT PROFILE */}
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="relative">
              <button
                type="button"
                onClick={() => setProfileOpen((v) => !v)}
                aria-haspopup="menu"
                aria-expanded={profileOpen}
                className="flex items-center gap-2 bg-white/15 hover:bg-white/25 px-2.5 py-1.5 rounded-xl text-sm text-white font-semibold shadow-inner transition active:scale-95"
              >
                <div className="h-7 w-7 rounded-full bg-white/20 ring-1 ring-white/30 grid place-items-center">
                  <span className="text-[11px] font-bold">{initials(user?.name)}</span>
                </div>
                <span className="hidden sm:block max-w-[140px] truncate">{user?.name || "Profile"}</span>
                <FiUser aria-hidden="true" className="opacity-80" />
              </button>

              <AnimatePresence>
                {profileOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.12 }}
                    className="absolute right-0 mt-3 w-56 bg-white rounded-2xl shadow-2xl overflow-hidden z-[120] ring-1 ring-black/5"
                    role="menu"
                  >
                    <div className="px-4 py-3 border-b border-gray-100">
                      <p className="text-xs uppercase tracking-wider text-gray-500">Signed in as</p>
                      <p className="text-sm font-semibold text-gray-900 truncate">{user?.name || "User"}</p>
                      <p className="text-[11px] text-gray-500">Role: {user?.role || "guest"}</p>
                    </div>
                    <Link
                      href={user?.role === "admin" ? "/admin" : "/tech/profile"}
                      className="flex items-center gap-2 px-4 py-2.5 text-gray-700 hover:bg-blue-50 transition text-sm"
                      role="menuitem"
                      onClick={() => setProfileOpen(false)}
                    >
                      <FiUser aria-hidden="true" /> My Profile
                    </Link>
                    <button
                      onClick={handleLogout}
                      className="flex items-center gap-2 w-full text-left px-4 py-2.5 text-red-600 hover:bg-red-50 transition text-sm"
                      role="menuitem"
                    >
                      <FiLogOut aria-hidden="true" /> Logout
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </header>

      {/* MOBILE MENU */}
      <AnimatePresence>
        {menuOpen && (
          <>
            <motion.div
              key="overlay"
              className="fixed inset-0 bg-black/40 backdrop-blur-sm md:hidden z-[100]"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              onClick={() => setMenuOpen(false)}
            />

            <motion.nav
              key="drawer"
              aria-label="Mobile"
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ duration: 0.2 }}
              className="fixed top-0 left-0 w-80 max-w-[85vw] h-full bg-gradient-to-b from-[#1d4ed8] to-[#1e40af] text-white z-[110] p-6 flex flex-col shadow-2xl md:hidden overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-lg bg-white/20 grid place-items-center ring-1 ring-white/20">
                    <span className="text-xs font-bold">CS</span>
                  </div>
                </div>
                <button
                  type="button"
                  aria-label="Close menu"
                  onClick={() => setMenuOpen(false)}
                  className="text-2xl p-1 rounded-lg hover:bg-white/10"
                >
                  <FiX />
                </button>
              </div>

              <p className="text-xs uppercase tracking-wider text-white/80 mb-3">
                {user?.role === "admin" ? "Admin Menu" : "Technician Menu"}
              </p>

              <div className="space-y-1">
                {links.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={[
                      "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition",
                      isActive(link.href)
                        ? "bg-white/20 ring-1 ring-white/20"
                        : "hover:bg-white/10",
                    ].join(" ")}
                    onClick={() => setMenuOpen(false)}
                  >
                    <span className="text-lg" aria-hidden="true">{link.icon}</span>
                    <span>{link.label}</span>
                  </Link>
                ))}
              </div>

              <div className="mt-auto pt-5">
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-2 w-full px-3 py-2.5 bg-red-500 hover:bg-red-600 rounded-xl text-white text-sm font-semibold transition shadow-lg"
                >
                  <FiLogOut aria-hidden="true" /> Logout
                </button>
                <p className="text-[11px] text-white/70 mt-3">v1.0 • Secure • Fast UI</p>
              </div>
            </motion.nav>
          </>
        )}
      </AnimatePresence>

      <style jsx global>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </>
  );
}
