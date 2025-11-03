export async function POST(req) {
  try {
    // Request body read karna
    const body = await req.json();

    console.log("Forward API called with:", body);

    // Example response
    return Response.json({
      success: true,
      message: "Forward API working perfectly!",
      receivedData: body
    });

  } catch (error) {
    console.error("Error in /api/admin/forward:", error);
    return Response.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// (Optional) Agar GET request aaye to ye handle kare
export async function GET() {
  return Response.json({ message: "GET method not allowed here" }, { status: 405 });
}
