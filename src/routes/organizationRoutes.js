const express = require('express');
const { createOrganization, deleteOrganization, getAllOrganization } = require('../controllers/createOrganizationController');
const verifyAccessToken = require('../middlewares/verifyAccessToken');
const router = express.Router();



router.post('/super-admin/create-organization',verifyAccessToken, createOrganization);
router.delete('/super-admin/delete-organization/:organizationId', verifyAccessToken, deleteOrganization);
router.get('/super-admin/get-organizations', verifyAccessToken, getAllOrganization);

module.exports = router;
