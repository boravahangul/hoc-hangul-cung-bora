import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Lazy-initialized Gemini client
let genAIClient: GoogleGenAI | null = null;
function getGenAI(): GoogleGenAI | null {
  if (!process.env.GEMINI_API_KEY) {
    return null;
  }
  if (!genAIClient) {
    genAIClient = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return genAIClient;
}

// API: Health check
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", aiEnabled: Boolean(process.env.GEMINI_API_KEY) });
});

// API: AI Korean Study Bora Chat / Query
app.post("/api/Bora/chat", async (req, res) => {
  try {
    const { message, context, mode } = req.body;
    if (!message) {
      return res.status(400).json({ error: "Vui lòng nhập câu hỏi hoặc tin nhắn." });
    }

    const ai = getGenAI();
    if (!ai) {
      return res.json({
        reply: `안녕! Mình là K-Bora 💜, gia sư tiếng Hàn dễ thương của bạn nè! Hiện tại chế độ AI offline/mẫu. Câu hỏi của bạn: "${message}". Bạn có thể thêm khóa GEMINI_API_KEY để trò chuyện trực tiếp cùng K-Bora nhé! ✨`,
        mode: mode || "general"
      });
    }

    let systemInstruction = `Bạn là "K-Bora AI" (보라 💜) - gia sư tiếng Hàn cực kỳ đáng yêu, dễ thương, kiên nhẫn và luôn khích lệ người học (dùng các emoji đáng yêu như 💜, ✨, 🌸, 🧸 khi thích hợp). Bạn giải thích cặn kẽ bằng tiếng Việt rõ ràng, dễ hiểu.
Nhiệm vụ của bạn:
1. Giải thích từ vựng tiếng Hàn: nghĩa, phiên âm phát âm, gốc Hán-Hàn (nếu có), từ đồng nghĩa/trái nghĩa, và 2-3 câu ví dụ thực tế kèm dịch nghĩa tiếng Việt.
2. Giải thích ngữ pháp: công thức kết hợp (với V/A có hay không có patchim), ý nghĩa, hoàn cảnh sử dụng, so sánh với các cấu trúc tương đồng, lưu ý đặc biệt và ví dụ minh họa sinh động.
3. Chỉnh sửa câu (Feedback): Chỉ ra lỗi sai (nếu có) về trợ từ (은/는, 이/가, 을/를), kính ngữ (ㅂ/습니다, 아/어요), đuôi câu; sau đó gợi ý câu nói tự nhiên nhất của người Hàn bản xứ kèm lời động viên đáng yêu (파이팅! ✨).
4. Luyện tập Shadowing / Hội thoại: Đưa ra câu ngắn theo chủ đề, phiên âm và giải nghĩa.
Luôn định dạng câu trả lời rõ ràng, dùng gạch đầu dòng, tô đậm từ tiếng Hàn để người học dễ theo dõi. Giữ phong cách gần gũi, ấm áp, cổ vũ tinh thần học tập của bạn học.`;

    if (mode === "sentence_check") {
      systemInstruction += ` Chế độ: Kiểm tra và sửa lỗi câu tiếng Hàn của học viên. Hãy phân tích ngữ pháp, chỉ ra điểm chưa tự nhiên, cung cấp phiên bản sửa chuẩn và dịch nghĩa.`;
    } else if (mode === "word_deepdive") {
      systemInstruction += ` Chế độ: Phân tích sâu từ vựng tiếng Hàn, âm Hán Việt tương ứng, các dạng chia bất quy tắc (nếu có), từ ghép và các câu khẩu ngữ thường gặp.`;
    }

    const fullPrompt = context
      ? `Ngữ cảnh học tập hiện tại: ${context}\n\nCâu hỏi/Yêu cầu của học viên: ${message}`
      : message;

    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: fullPrompt,
      config: {
        systemInstruction,
        temperature: 0.7,
      },
    });

    return res.json({
      reply: response.text || "Xin lỗi, K-Bora chưa kịp nhận diện câu hỏi. Bạn vui lòng thử lại nhé!",
    });
  } catch (error: any) {
    console.error("AI Bora error:", error);
    return res.status(500).json({
      error: "Không thể kết nối với Bora AI lúc này. Vui lòng thử lại.",
      details: error.message,
    });
  }
});

// API: AI Analyze a sentence (breakdown words + grammar particles)
app.post("/api/Bora/analyze", async (req, res) => {
  try {
    const { sentence } = req.body;
    if (!sentence) {
      return res.status(400).json({ error: "Vui lòng cung cấp câu tiếng Hàn cần phân tích." });
    }

    const ai = getGenAI();
    if (!ai) {
      return res.json({
        analysis: `Phân tích mẫu cho câu: "${sentence}". (Thêm GEMINI_API_KEY để kích hoạt tính năng phân tích chi tiết từ AI).`,
      });
    }

    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: `Hãy phân tích chi tiết câu tiếng Hàn sau cho người học Việt Nam:
"${sentence}"

Yêu cầu định dạng rõ ràng:
1. Phát âm / Phiên âm chuẩn
2. Dịch nghĩa tiếng Việt chuẩn
3. Bóc tách từng thành phần trong câu (Từ gốc, Trợ từ / Tiểu từ, Đuôi liên kết, Đuôi kết thúc câu)
4. Điểm ngữ pháp trọng tâm trong câu
5. Một câu tương tự ứng dụng trong giao tiếp hàng ngày`,
      config: {
        systemInstruction: "Bạn là chuyên gia phân tích ngữ pháp tiếng Hàn cho người Việt.",
        temperature: 0.3,
      },
    });

    return res.json({
      analysis: response.text || "Không có kết quả phân tích.",
    });
  } catch (error: any) {
    console.error("Sentence analysis error:", error);
    return res.status(500).json({
      error: "Không thể phân tích câu. Vui lòng thử lại sau.",
    });
  }
});

async function startServer() {
  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`StudyBora Korean server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
