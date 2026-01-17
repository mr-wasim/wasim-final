import { serialize } from "cookie";

export default function handler(req, res) {
  // Clear cookie immediately
  res.setHeader(
    "Set-Cookie",
    serialize("token", "", {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      maxAge: 0,
      secure: process.env.NODE_ENV === "production",
    })
  );

  return res.status(200).json({ ok: true, message: "Logged out" });
}
