const express = require('express');
const { getChatResponse } = require('../controllers/ChatBotController');
const verifyAccessToken = require('../middlewares/verifyAccessToken');
const router = express.Router();



router.post('/get-response',verifyAccessToken, getChatResponse);


module.exports = router;