import { motion } from "framer-motion";

export default function PopupShell({ title, onClose, children, width = "max-w-3xl" }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[999] flex items-center justify-center 
      bg-black/30 backdrop-blur-sm"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.7, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.7, y: 20 }}
        transition={{ type: "spring", stiffness: 120, damping: 12 }}
        className={`w-[92%] ${width} bg-white/70 backdrop-blur-xl 
        shadow-[0_8px_30px_rgb(0,0,0,0.12)] 
        rounded-3xl border border-white/40 p-7`}
      >
        {/* HEADER */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-800 tracking-tight">
            {title}
          </h2>

          <button
            onClick={onClose}
            className="text-gray-600 hover:text-red-500 transition text-lg"
          >
            ✕
          </button>
        </div>

        {/* CONTENT */}
        <div className="max-h-[60vh] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-gray-300">
          {children}
        </div>
      </motion.div>
    </motion.div>
  );
}
