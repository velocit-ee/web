// Cloudflare Pages Function for /api/waitlist
// Uses Resend to store the audience. Eliminates the need for Postgres.

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const { email } = await request.json();

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return new Response(JSON.stringify({ success: false, message: "Invalid email format." }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Call Resend API directly to add to audience
    if (env.RESEND_API_KEY && env.RESEND_AUDIENCE_ID) {
      const res = await fetch("https://api.resend.com/audiences/" + env.RESEND_AUDIENCE_ID + "/contacts", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${env.RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, unsubscribed: false }),
      });

      if (!res.ok) {
        console.error("Resend API error:", await res.text());
        return new Response(JSON.stringify({ success: false, message: "Failed to join waitlist. Please try again." }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        });
      }
    } else {
      console.warn("Missing RESEND_API_KEY or RESEND_AUDIENCE_ID in environment.");
    }

    // Optional: Send notification email to admin
    if (env.RESEND_API_KEY && env.NOTIFY_PERSONAL_EMAIL) {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${env.RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "inquiries@velocit.ee",
          to: [env.NOTIFY_PERSONAL_EMAIL],
          subject: "New Velocitee Vector signup",
          text: `New waitlist signup\n\nEmail: ${email}\nTime: ${new Date().toUTCString()}`,
        }),
      });
    }

    return new Response(JSON.stringify({ success: true, message: "You're on the list." }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ success: false, message: "Network error." }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
