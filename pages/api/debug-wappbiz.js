// pages/api/debug-wappbiz.js
import fetch from "node-fetch";

export default async function handler(req, res) {
  const apiKey = process.env.WAPPBIZ_KEY || req.query.key;

  const testPayload = {
    phone: "+919999999999", // dummy number
    template_name: "service_registered",
    data: {
      name: "Test",
      items: "Debug",
      orderId: "01/01/2025"
    }
  };

  console.log("🔍 Testing request with key:", apiKey);

  const attempts = [
    { note: "Header → apikey", headers: { apikey: apiKey } },
    { note: "Header → apiKey", headers: { apiKey: apiKey } },
    { note: "Header → Authorization", headers: { Authorization: apiKey } },
    { note: "Header → Authorization apikey KEY", headers: { Authorization: `apikey ${apiKey}` } }
  ];

  const results = [];

  for (const a of attempts) {
    try {
      const r = await fetch("https://api.wapp.biz/api/external/sendTemplate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...a.headers,
        },
        body: JSON.stringify(testPayload),
      });
      const json = await r.json();
      results.push({ attempt: a.note, response: json });
    } catch (err) {
      results.push({ attempt: a.note, error: err.message });
    }
  }

  // Try sending key inside body (last test)
  try {
    const r = await fetch("https://api.wapp.biz/api/external/sendTemplate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        apikey: apiKey,
        ...testPayload,
      }),
    });
    const json = await r.json();
    results.push({ attempt: "Body → apikey", response: json });
  } catch (err) {
    results.push({ attempt: "Body → apikey", error: err.message });
  }

  // Try sending key in URL
  try {
    const r = await fetch(
      `https://api.wapp.biz/api/external/sendTemplate?apikey=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(testPayload),
      }
    );
    const json = await r.json();
    results.push({ attempt: "URL Query → apikey", response: json });
  } catch (err) {
    results.push({ attempt: "URL Query → apikey", error: err.message });
  }

  console.log("🧪 Debug results:", results);
  return res.status(200).json({ debug: results });
}
