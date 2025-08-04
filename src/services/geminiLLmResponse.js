const { GoogleGenerativeAI } = require('@google/generative-ai');
const config = require('../config');

const genAI = new GoogleGenerativeAI(config.geminiKey);

/**
 * Generates a response using Google Gemini based on user query and context.
 * @param {string} userQuery - The question asked by the user.
 * @param {string} contextText - The context extracted from documents.
 * @returns {Promise<string>} - The AI-generated response.
 */
const GeminiLLMResponse = async (userQuery, contextText) => {
  if (!userQuery || !contextText) {
    throw new Error('❌ Both userQuery and contextText are required.');
  }

  const prompt = `
You are a helpful assistant answering questions strictly based on internal organization documents.

Instructions:
- Use ONLY the provided context to answer the question.
- If you cannot find an answer, say: "Sorry, I couldn't find relevant information in the documents."
- Keep the tone professional, clear, and concise.

📚 Context:
${contextText}

❓ Question:
${userQuery}
  `.trim();

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' }); // or gemini-1.5-flash

    const result = await model.generateContent(prompt); // No need for role/parts

    const response = result.response.text().trim();
    return response || 'No response generated.';
  } catch (error) {
    console.error('❌ Error in GeminiLLMResponse:', error);
    throw new Error('Failed to generate Gemini AI response.');
  }
};

module.exports = { GeminiLLMResponse };
