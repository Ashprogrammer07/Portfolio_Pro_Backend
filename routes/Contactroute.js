const express=require("express");
const router=express.Router();
const {submitContact,getContacts,getContact,updateContact,deleteContact,getContactStats}=require("../controller/contactController");
const {protect, adminonly} = require('../middleware/auth');


router.post('/submit',submitContact);

// ✅ Add protection to admin routes:
router.get('/admin', getContacts); // Add middlewares
router.get('/admin/stats', getContactStats); // Add middlewares
router.get('/:id',  getContact); // Add middlewares
router.put('/:id',   updateContact); // Add middlewares
router.delete('/:id',   deleteContact); // Add middlewares

module.exports=router;