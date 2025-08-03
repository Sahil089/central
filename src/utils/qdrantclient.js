const { QdrantClient } = require('@qdrant/js-client-rest');
const config = require("../config/index")


const client = new QdrantClient({
    url: config.qdrantUrl,
    apiKey: config.qdrantKey,
});

module.exports = client;