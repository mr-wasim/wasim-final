export default function handler(req, res) {
  if (req.method === "POST") {
    return res.status(200).json({ message: "POST OK" });
  } else {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }
}
