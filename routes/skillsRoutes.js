const express = require("express");
const router = express.Router();
const {
  createSkill,
  getSkills,
  getSkill,
  updateSkill,
  deleteSkill,
  getSkillStats
} = require("../controller/skillsController");
const { protect, adminonly } = require('../middleware/auth');

router.get('/admin/stats',  getSkillStats);
router.post('/create',   createSkill);
router.put('/:id',   updateSkill);
router.delete('/:id',   deleteSkill);

router.get('/', getSkills);
router.get('/:id', getSkill);

module.exports = router;
