import { GoogleGenAI } from "@google/genai";

export const getAiResponse = async (req, res) => {
  try {
    const { prompt } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: "Prompt is required" });
    }

    // You will need to add GEMINI_API_KEY to your .env file
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    
    // Using gemini-2.5-flash as the default model
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
    });

    res.status(200).json({ text: response.text });
  } catch (error) {
    console.error("Error in getAiResponse controller:", error.message);
    res.status(500).json({ error: "Thất bại khi lấy dữ liệu từ AI. Vui lòng kiểm tra lại cấu hình." });
  }
};
