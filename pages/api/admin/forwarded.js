//  // pages/api/admin/forwarded.js
// import { requireRole, getDb } from "../../../lib/api-helpers.js";

// async function handler(req, res) {
//   try {
//     const db = await getDb();

//     const {
//       q = "",
//       status = "",
//       page = 1,
//       limit = 20,
//     } = req.query;

//     const match = {};

//     // 🔍 SEARCH
//     if (q) {
//       match.$or = [
//         { clientName: { $regex: q, $options: "i" } },
//         { phone: { $regex: q, $options: "i" } },
//         { address: { $regex: q, $options: "i" } },
//         { techName: { $regex: q, $options: "i" } },
//       ];
//     }

//     // 🟦 STATUS FILTER
//     if (status) match.status = status;

//     const coll = db.collection("forwarded_calls");

//     // COUNT
//     const total = await coll.countDocuments(match);

//     // DATA
//     const items = await coll
//       .find(match)
//       .sort({ createdAt: -1 })
//       .skip((Number(page) - 1) * Number(limit))
//       .limit(Number(limit))
//       .toArray();

//     // MORE?
//     const hasMore = Number(page) * Number(limit) < total;

//     return res.json({
//       success: true,
//       total,
//       hasMore,
//       items: items.map((x) => ({
//         ...x,
//         _id: x._id.toString(),
//       })),
//     });

//   } catch (err) {
//     console.error("API ERROR:", err);
//     return res.status(500).json({
//       success: false,
//       error: "Internal server error",
//     });
//   }
// }

// export default requireRole("admin")(handler);
