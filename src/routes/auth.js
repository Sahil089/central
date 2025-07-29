const express = require('express');
const router = express.Router();
const { loginSuperAdmin, refreshAccessToken } = require('../controllers/authControllers');


router.post('/super-admin/login', loginSuperAdmin);
router.post('/refresh-token',refreshAccessToken)

module.exports = router;
