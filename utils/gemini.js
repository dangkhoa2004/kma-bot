const fetch = (...args) =>
  import("node-fetch").then(({ default: fetch }) => fetch(...args));

async function askGemini(question, apiKey) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
  const body = {
    contents: [{ parts: [{ text: question }] }],
  };

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await response.json();
    const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    return reply || "⚠️ Không có phản hồi từ Gemini.";
  } catch (error) {
    console.error("Gemini API error:", error);
    return "❌ Đã xảy ra lỗi khi gọi Google AI.";
  }
}

module.exports = { askGemini };
