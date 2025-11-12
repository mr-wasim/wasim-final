// import clientPromise from "./mongodb.js";
// import { verifyToken } from "./auth.js";

// /**
//  * ✅ Get MongoDB Database Connection
//  */
// export async function getDb() {
//   try {
//     const client = await clientPromise;
//     return client.db("chimney_crm");
//   } catch (err) {
//     console.error("❌ Database connection failed:", err);
//     throw new Error("Database connection error");
//   }
// }

// /**
//  * ✅ Get Authenticated User from Request
//  */
// export function getUser(req) {
//   try {
//     const token =
//       req.cookies?.token || req.headers.authorization?.replace("Bearer ", "");

//     if (!token) {
//       console.warn("⚠️ No token found in request");
//       return null;
//     }

//     const payload = verifyToken(token);
//     return payload;
//   } catch (err) {
//     console.error("❌ Invalid token:", err.message);
//     return null;
//   }
// }

// /**
//  * ✅ Middleware to Require a Specific User Role
//  */
// export function requireRole(role) {
//   return (handler) => async (req, res) => {
//     const user = getUser(req);

//     if (!user) {
//       return res.status(401).json({ error: "Unauthorized: No token" });
//     }

//     if (user.role !== role) {
//       return res
//         .status(403)
//         .json({ error: `Forbidden: ${role} role required` });
//     }

//     try {
//       // Pass user to actual handler
//       return handler(req, res, user);
//     } catch (err) {
//       console.error("❌ Handler error:", err);
//       return res.status(500).json({ error: "Internal Server Error" });
//     }
//   };
// }


import clientPromise from "./mongodb.js";
import { verifyToken } from "./auth.js";

/**
 * ✅ Get MongoDB Database Connection
 * Uses database name from .env → process.env.MONGODB_DB
 */
export async function getDb() {
  try {
    const client = await clientPromise;

    const dbName = process.env.MONGODB_DB;
    if (!dbName) {
      throw new Error("❌ MONGODB_DB is not defined in .env file");
    }

    return client.db(dbName);
  } catch (err) {
    console.error("❌ Database connection failed:", err);
    throw new Error("Database connection error");
  }
}

/**
 * ✅ Get Authenticated User from Request (via JWT cookie or Bearer token)
 */
export function getUser(req) {
  try {
    const token =
      req.cookies?.token || req.headers.authorization?.replace("Bearer ", "");

    if (!token) {
      console.warn("⚠️ No token found in request");
      return null;
    }

    const payload = verifyToken(token);
    return payload;
  } catch (err) {
    console.error("❌ Invalid token:", err.message);
    return null;
  }
}

/**
 * ✅ Middleware to Require a Specific User Role (e.g., 'admin')
 */
export function requireRole(role) {
  return (handler) => async (req, res) => {
    const user = getUser(req);

    if (!user) {
      return res.status(401).json({ error: "Unauthorized: No token" });
    }

    if (user.role !== role) {
      return res.status(403).json({ error: `Forbidden: ${role} role required` });
    }

    try {
      // Pass authenticated user to next handler
      return handler(req, res, user);
    } catch (err) {
      console.error("❌ Handler error:", err);
      return res.status(500).json({ error: "Internal Server Error" });
    }
  };
}
