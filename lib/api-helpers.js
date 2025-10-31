import clientPromise from "./mongodb.js";
import { verifyToken } from "./auth.js";

// ✅ Database connection helper
export async function getDb() {
  const client = await clientPromise;
  return client.db("chimney_crm");
}

// ✅ User fetch helper (token decode)
export function getUser(req) {
  try {
    const token =
      req.cookies?.token ||
      req.headers.authorization?.replace("Bearer ", "");

    if (!token) return null;

    const payload = verifyToken(token);
    return payload || null;
  } catch (error) {
    console.error("getUser error:", error);
    return null;
  }
}

// ✅ Role-based access middleware (fully fixed)
export function requireRole(role) {
  return function (handler) {
    return async function (req, res) {
      try {
        // Get logged-in user info
        const user = getUser(req);

        // If no user or wrong role → block access
        if (!user || user.role !== role) {
          return res.status(401).json({ error: "Unauthorized" });
        }

        // 🟢 Await the handler (important for async functions)
        await handler(req, res, user);
      } catch (error) {
        console.error("requireRole error:", error);
        // Always send a valid JSON response
        if (!res.headersSent) {
          return res.status(500).json({ error: "Server Error" });
        }
      }
    };
  };
}
