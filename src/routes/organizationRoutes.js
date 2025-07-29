const express = require('express');
const { createOrganization } = require('../controllers/createOrganizationController');
const verifyAccessToken = require('../middlewares/verifyAccessToken');
const router = express.Router();



router.post('/super-admin/create-organization',verifyAccessToken, createOrganization);

module.exports = router;
