const express = require('express');
const verifyAccessToken = require('../middlewares/verifyAccessToken');
const { createUser } = require('../controllers/AdminLevelControllers');
const router = express.Router();



router.post('/create-user',verifyAccessToken, createUser);


module.exports = router;
