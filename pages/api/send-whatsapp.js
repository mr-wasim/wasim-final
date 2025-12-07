import fetch from "node-fetch";

async function sendWhatsAppMessage(phone, clientName, serviceType) {
  phone = phone.startsWith("+91") ? phone : "+91" + phone;

  const apiKey = "28b55ddd7e798fc7b49725ecec55bfd25bcc605d2a2267536a2d39598b4f54b2";

  const formattedDate = new Date().toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  const payload = {
    template_name: "service_registered",
    phone: phone,
    name: clientName,
    parameters: `${clientName}, ${serviceType}, ${formattedDate}`
  };

  const url = `https://api.wapp.biz/api/external/sendTemplate?apikey=${apiKey}`;

  console.log("📩 Payload Sent:", payload);

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  const result = await response.json();
  console.log("📨 WhatsApp API Result:", result);
  return result;
}

export default sendWhatsAppMessage;
