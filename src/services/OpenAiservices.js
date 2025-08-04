const { OpenAI } = require('openai');
const config = require('../config');

const openai = new OpenAI({
  apiKey: config.openAiKey
});

/**
 * Generates a response from the LLM using user query and document context.
 * @param {string} userQuery - The question asked by the user.
 * @param {string} contextText - The context extracted from the documents.
 * @returns {Promise<string>} - The AI-generated response.
 */
const getLLMResponse = async (userQuery, contextText) => {
  console.log(userQuery, contextText)
  if (!userQuery || !contextText) {
    throw new Error('❌ Both userQuery and contextText are required.');
  }

  // System message to guide model behavior
  const systemPrompt = `
You are a helpful assistant answering questions strictly based on internal organization documents.

Instructions:
- Use ONLY the provided context to answer the question.
- If you cannot find an answer, say: "Sorry, I couldn't find relevant information in the documents."
- Keep the tone professional, clear, and concise.
`.trim();

  // User input combining context and query
  const userPrompt = `
📚 Context:
${contextText}

❓ Question:
${userQuery}
`.trim();

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini', // Or switch to 'gpt-4o' / 'gpt-3.5-turbo' as needed
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.3,
      max_tokens: 600,
    });
    console.log("answer",completion.choices[0].message)

    return completion.choices?.[0]?.message?.content?.trim() || 'No response generated.';
  } catch (error) {
    console.error('❌ Error in getLLMResponse:', error);
    throw new Error('Failed to generate AI response.');
  }
};

module.exports = { getLLMResponse };
