const express = require('express');
const router = express.Router();
const { loginSuperAdmin, refreshAccessToken, login } = require('../controllers/authControllers');


router.post('/super-admin/login', loginSuperAdmin);
router.post('/refresh-token',refreshAccessToken)
router.post('/organization/login', login);

module.exports = router;
