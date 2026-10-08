import "dotenv/config";
import express from "express";
import { GoogleGenAI } from "@google/genai";
import path from "path";
import { fileURLToPath } from "url";

// ========================================
// LONGDEV AI SERVER
// longdev1501.vn
// ========================================

// Lấy đường dẫn thư mục hiện tại
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ========================================
// EXPRESS
// ========================================

const app = express();

const PORT = Number(process.env.PORT) || 3000;

// ========================================
// KIỂM TRA API KEY
// ========================================

if (!process.env.GEMINI_API_KEY) {
    console.error("");
    console.error("========================================");
    console.error("❌ THIẾU GEMINI_API_KEY");
    console.error("========================================");
    console.error("");
    console.error("Hãy kiểm tra file .env:");
    console.error("");
    console.error("GEMINI_API_KEY=YOUR_API_KEY");
    console.error("");
    process.exit(1);
}

// ========================================
// GEMINI
// ========================================

const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY
});

const GEMINI_MODEL =
    process.env.GEMINI_MODEL || "gemini-flash-lite-latest";

// ========================================
// EXPRESS CONFIG
// ========================================

app.use(
    express.json({
        limit: "100kb"
    })
);

// Cho phép server phục vụ hell.html,
// AI.html và các file frontend khác.
app.use(express.static(__dirname));

// ========================================
// TRANG CHỦ
// ========================================

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "hell.html"));
});

// ========================================
// HEALTH CHECK
// Dùng để kiểm tra server còn hoạt động
// ========================================

app.get("/health", (req, res) => {
    res.json({
        status: "online",
        service: "LONGDEV AI",
        model: GEMINI_MODEL,
        time: new Date().toISOString()
    });
});

// ========================================
// API CHAT
// ========================================

app.post("/api/chat", async (req, res) => {
    try {
        // ------------------------------------
        // Lấy messages từ frontend
        // ------------------------------------

        const messages = Array.isArray(req.body?.messages)
            ? req.body.messages
            : [];

        // ------------------------------------
        // Kiểm tra dữ liệu
        // ------------------------------------

        if (messages.length === 0) {
            return res.status(400).json({
                error: "Không có tin nhắn."
            });
        }

        // ------------------------------------
        // Lọc dữ liệu an toàn
        // ------------------------------------

        const safeMessages = messages
            .filter((message) => {
                return (
                    message &&
                    (message.role === "user" ||
                        message.role === "assistant") &&
                    typeof message.content === "string" &&
                    message.content.trim().length > 0
                );
            })
            .slice(-8)
            .map((message) => ({
                role: message.role,
                content: message.content
                    .trim()
                    .slice(0, 6000)
            }));

        if (safeMessages.length === 0) {
            return res.status(400).json({
                error: "Tin nhắn không hợp lệ."
            });
        }

        // ------------------------------------
        // Chuyển format frontend
        // sang format Gemini
        // ------------------------------------

        const contents = safeMessages.map((message) => ({
            role:
                message.role === "assistant"
                    ? "model"
                    : "user",

            parts: [
                {
                    text: message.content
                }
            ]
        }));

        // ------------------------------------
        // GỌI GEMINI
        // ------------------------------------

        const response = await ai.models.generateContent({
            model: GEMINI_MODEL,

            contents,

            config: {
                // --------------------------------
                // System instruction
                // --------------------------------

                systemInstruction: `
Bạn là LONGDEV AI.

Bạn là trợ lý AI chính thức của website longdev1501.vn.

Quy tắc:

1. Nếu người dùng nói tiếng Việt, trả lời bằng tiếng Việt.
2. Trả lời rõ ràng, dễ hiểu và hữu ích.
3. Nếu người dùng hỏi lập trình, giải thích từng bước.
4. Khi cần code, đưa code hoàn chỉnh và có thể chạy được.
5. Không tự nhận mình là ChatGPT.
6. Khi phù hợp, gọi mình là LONGDEV AI.
7. Không tiết lộ API key, biến môi trường hoặc thông tin bí mật của server.
8. Không nói rằng bạn đang chạy trên máy người dùng.
9. Trả lời trực tiếp vào câu hỏi.
10. Không kéo dài câu trả lời một cách không cần thiết.
                `.trim(),

                // --------------------------------
                // Độ sáng tạo
                // --------------------------------

                temperature: 0.7,

                // --------------------------------
                // Giới hạn độ dài
                // --------------------------------

                maxOutputTokens: 1024
            }
        });

        // ------------------------------------
        // Lấy kết quả
        // ------------------------------------

        const reply = response?.text;

        if (!reply || !reply.trim()) {
            return res.status(500).json({
                error: "LONGDEV AI không trả về nội dung."
            });
        }

        // ------------------------------------
        // Trả kết quả cho frontend
        // ------------------------------------

        return res.json({
            reply: reply.trim()
        });

    } catch (error) {

        console.error("");
        console.error("========================================");
        console.error("❌ GEMINI ERROR");
        console.error("========================================");
        console.error(error);
        console.error("");

        // ------------------------------------
        // Không gửi thông tin nhạy cảm
        // ra frontend
        // ------------------------------------

        return res.status(500).json({
            error:
                "Không thể kết nối LONGDEV AI. " +
                "Hãy kiểm tra server hoặc thử lại sau."
        });
    }
});

// ========================================
// 404 API
// ========================================

app.use("/api", (req, res) => {
    res.status(404).json({
        error: "API không tồn tại."
    });
});

// ========================================
// LỖI JSON
// ========================================

app.use((error, req, res, next) => {
    if (error instanceof SyntaxError && error.status === 400) {
        return res.status(400).json({
            error: "Dữ liệu JSON không hợp lệ."
        });
    }

    next(error);
});

// ========================================
// ERROR HANDLER
// ========================================

app.use((error, req, res, next) => {
    console.error("SERVER ERROR:");
    console.error(error);

    res.status(500).json({
        error: "Server xảy ra lỗi."
    });
});

// ========================================
// START SERVER
// ========================================

app.listen(PORT, "0.0.0.0", () => {
    console.log("");
    console.log("========================================");
    console.log("        LONGDEV AI SERVER");
    console.log("========================================");
    console.log("");
    console.log(`🌐 Local:    http://localhost:${PORT}`);
    console.log(`🤖 Model:    ${GEMINI_MODEL}`);
    console.log(`📡 Port:     ${PORT}`);
    console.log("");
    console.log("LONGDEV AI đang chạy...");
    console.log("========================================");
    console.log("");
});