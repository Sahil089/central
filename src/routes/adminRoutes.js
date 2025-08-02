const express = require('express');
const verifyAccessToken = require('../middlewares/verifyAccessToken');
const { createUser, deleteUser } = require('../controllers/AdminLevelControllers');
const { createFolder, deleteFolders, uploadFile, getRootFolders, getFolderContents } = require('../controllers/RepoOprations');
const upload = require('../middlewares/FileUploads');
const router = express.Router();



router.post('/create-user',verifyAccessToken, createUser);
router.delete('/delete-user/:userId/:orgId',verifyAccessToken, deleteUser);
router.post('/create-folder',verifyAccessToken, createFolder);
router.delete('/delete-folder/:folderId/:OrgId/:AdminId',verifyAccessToken, deleteFolders);
router.post('/upload-file',verifyAccessToken,upload.array('files'), uploadFile);
router.get('/folders/root/:OrgId',verifyAccessToken,getRootFolders);
router.get('/folders/contents/:folderId/:OrgId',verifyAccessToken,getFolderContents);
module.exports = router;
