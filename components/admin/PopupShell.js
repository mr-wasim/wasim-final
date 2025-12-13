// components/admin/PopupShell.js
import { motion } from "framer-motion";

export default function PopupShell({ title, onClose, children, width = "max-w-3xl" }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.12 }} 
      className="fixed inset-0 bg-black/30 flex items-center justify-center z-[2000]"
      style={{
        backdropFilter: "blur(4px)",
        WebkitBackdropFilter: "blur(4px)",
        willChange: "opacity"
      }}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        transition={{ duration: 0.12, ease: "easeOut" }}
        className={`w-[92%] ${width} bg-white rounded-2xl shadow-2xl border border-gray-200 p-6`}
        style={{
          transform: "translateZ(0)",
          willChange: "transform, opacity"
        }}
      >
        {/* HEADER */}
        <div className="flex justify-between items-center mb-5">
          <h2 className="text-2xl font-semibold text-gray-800">{title}</h2>

          <button
            onClick={onClose}
            className="text-gray-500 hover:text-red-500 text-2xl leading-none"
          >
            ✕
          </button>
        </div>

        {/* CONTENT */}
        <div
          className="smooth-scroll"
          style={{
            maxHeight: "70vh",
            overflowY: "auto",
            paddingRight: "6px"
          }}
        >
          {children}
        </div>

        <style jsx>{`
          .smooth-scroll::-webkit-scrollbar {
            width: 6px;
          }
          .smooth-scroll::-webkit-scrollbar-thumb {
            background: rgba(150, 150, 150, 0.4);
            border-radius: 10px;
          }
        `}</style>
      </motion.div>
    </motion.div>
  );
}
