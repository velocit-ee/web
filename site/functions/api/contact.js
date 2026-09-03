// Cloudflare Pages Function for /api/contact

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const data = await request.json();
    const { name, email, message } = data;

    if (!email || !message || !name) {
      return new Response(JSON.stringify({ success: false, message: "All fields are required." }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (env.RESEND_API_KEY && env.NOTIFY_PERSONAL_EMAIL) {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${env.RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "inquiries@velocit.ee",
          to: [env.NOTIFY_PERSONAL_EMAIL],
          subject: `Contact Form: ${name}`,
          text: `Name: ${name}\nEmail: ${email}\n\nMessage:\n${message}`,
          reply_to: email,
        }),
      });

      if (!res.ok) {
        return new Response(JSON.stringify({ success: false, message: "Failed to send message." }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        });
      }
    }

    return new Response(JSON.stringify({ success: true, message: "Message sent successfully." }), {
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
