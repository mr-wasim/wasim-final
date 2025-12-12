// export const runtime = "nodejs";

// import { getDb, requireRole } from "../../../lib/api-helpers.js";

// async function handler(req, res, user) {
//   if (req.method !== "GET")
//     return res.status(405).json({ success: false, error: "Method not allowed" });

//   try {
//     let {
//       page = "1",
//       pageSize = "20",
//       search = "",
//       from = "",
//       to = "",
//     } = req.query;

//     const db = await getDb();
//     const coll = db.collection("forwarded_calls");

//     const isExportAll = pageSize === "all";

//     const match = {};

//     if (search?.trim()) {
//       const q = search.trim();
//       match.$or = [
//         { clientName: { $regex: q, $options: "i" } },
//         { customerName: { $regex: q, $options: "i" } },
//         { phone: { $regex: q, $options: "i" } },
//         { address: { $regex: q, $options: "i" } },
//       ];
//     }

//     if (from) {
//       const d = new Date(from);
//       if (!isNaN(d)) match.createdAt = { ...(match.createdAt || {}), $gte: d };
//     }

//     if (to) {
//       const d = new Date(`${to}T23:59:59.999`);
//       if (!isNaN(d)) match.createdAt = { ...(match.createdAt || {}), $lte: d };
//     }

//     const total = await coll.countDocuments(match);

//     // ⭐ EXPORT MODE → FULL DATA, NO LIMIT
//     if (isExportAll) {
//       const fullItems = await coll
//         .find(match)
//         .sort({ createdAt: -1 })
//         .project({
//           _id: { $toString: "$_id" },
//           clientName: 1,
//           customerName: 1,
//           phone: 1,
//           address: 1,
//           type: 1,
//           serviceType: 1,
//           price: 1,
//           createdAt: 1,
//           serviceDate: 1,
//           techName: 1,
//           technicianName: 1,
//           techUsername: 1,
//         })
//         .toArray();

//       return res.status(200).json({
//         success: true,
//         total,
//         items: fullItems,
//         hasMore: false,
//         mode: "export-all",
//       });
//     }

//     // ⭐ NORMAL PAGINATION (UI uses infinite scroll)
//     const pageNum = Math.max(parseInt(page) || 1, 1);
//     const limit = parseInt(pageSize) || 20;
//     const skip = (pageNum - 1) * limit;

//     const items = await coll
//       .find(match)
//       .sort({ createdAt: -1 })
//       .skip(skip)
//       .limit(limit)
//       .project({
//         _id: { $toString: "$_id" },
//         clientName: 1,
//         customerName: 1,
//         phone: 1,
//         address: 1,
//         type: 1,
//         serviceType: 1,
//         price: 1,
//         createdAt: 1,
//         serviceDate: 1,
//         techName: 1,
//         technicianName: 1,
//         techUsername: 1,
//       })
//       .toArray();

//     return res.json({
//       success: true,
//       items,
//       total,
//       hasMore: skip + items.length < total,
//       nextPage: skip + items.length < total ? pageNum + 1 : null,
//     });
//   } catch (err) {
//     console.error(err);
//     return res.status(500).json({
//       success: false,
//       error: "Internal Server Error",
//     });
//   }
// }

// export default requireRole("admin")(handler);
