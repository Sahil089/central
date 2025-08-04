
const { GeminiLLMResponse } = require("../services/geminiLLmResponse");
const { getLLMResponse } = require("../services/OpenAiservices");
const { searchSimilarChunks } = require("../services/searchEmbeddings");



exports.getChatResponse = async (req, res) => {
  const { OrgId, Query } = req.body;

  if (!Query) {
    return res.status(200).json({ message: "Sorry, I couldn't understand your query." });
  }

  try {
    // Step 1: Search similar chunks from vector DB
    const chunks = await searchSimilarChunks({ orgId: OrgId, query: Query });
    if (!chunks.length) {
      return res.status(200).json({ message: 'No relevant documents found.' });
    }
    

    const context = chunks.map((c, i) => `Source [${i + 1}]:\n${c.chunk}`).join('\n\n');
    const response = await GeminiLLMResponse(Query, context); // your RAG prompt to OpenAI

    return res.status(200).json({
      answer: response,
      sources: chunks.map(c => ({
        fileName: c.fileName,
        url: c.fileUrl
      }))
    });

  } catch (err) {
    console.error('❌ Error getting chat response:', err);
    res.status(500).json({ error: 'Failed to get response.' });
  }
};