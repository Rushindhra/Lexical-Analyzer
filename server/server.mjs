import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { GoogleGenerativeAI } from "@google/generative-ai";
dotenv.config();
const app = express();
const port = process.env.PORT || 5000;
app.use(cors());
app.use(express.json());
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
app.post("/api/analyze", async (req, res) => {
  try {
    const { code, language } = req.body;
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    const prompt = `
      You are an expert ${language} code reviewer.
      Analyze the following code and identify:
      - Possible errors or inefficiencies
      - Code improvements
      - Suggestions for optimization
      - Find the errors and fix the code
      Code:
      ${code}
    `;

    const result = await model.generateContent(prompt);
    const analysis = result.response.text();

    res.json({ analysis });
  } catch (error) {
    console.error("Gemini Error:", error);
    res.status(500).json({ error: "Failed to analyze code." });
  }
});
app.get("/", (req, res) => {
  res.send("Gemini AI backend is running 🚀");
});
app.listen(port, () => {
  console.log(`✅ Server running on http://localhost:${port}`);
});

