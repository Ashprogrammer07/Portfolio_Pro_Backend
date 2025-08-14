const Skill = require('../models/Skill');

const createSkill = async (req, res) => {
  
  try {
    const skillData = {
      ...req.body,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    if (req.body.yearsOfExperience) {
      skillData.yearsOfExperience = parseInt(req.body.yearsOfExperience);
    }

    if (req.body.level) {
      skillData.level = Math.min(10, Math.max(1, parseInt(req.body.level)));
    }

    const skill = await Skill.create(skillData);

    res.status(201).json({
      success: true,
      message: 'Skill created successfully',
      data: skill
    });
  } catch (error) {
    console.error('Create skill error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create skill',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

const getSkills = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 100,
      category,
      level,
      search,
      isActive = true
    } = req.query;

    let query = { isActive };

    if (category) query.category = category;
    if (level) query.level = parseInt(level);
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { category: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));

    const skills = await Skill.find(query)
      .sort({ category: 1, level: -1, name: 1 })
      .limit(limitNum)
      .skip((pageNum - 1) * limitNum)
      .lean();

    const total = await Skill.countDocuments(query);

    const groupedSkills = skills.reduce((acc, skill) => {
      const category = skill.category || 'Other';
      if (!acc[category]) {
        acc[category] = {
          category,
          icon: skill.icon || '🔧',
          items: []
        };
      }
      acc[category].items.push(skill);
      return acc;
    }, {});

    const formattedSkills = Object.values(groupedSkills);

    res.status(200).json({
      success: true,
      count: skills.length,
      total,
      totalPages: Math.ceil(total / limitNum),
      currentPage: pageNum,
      data: formattedSkills
    });
  } catch (error) {
    console.error('Get skills error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch skills',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

const getSkill = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid skill ID format'
      });
    }

    const skill = await Skill.findById(id);

    if (!skill) {
      return res.status(404).json({
        success: false,
        message: 'Skill not found'
      });
    }

    res.status(200).json({
      success: true,
      data: skill
    });
  } catch (error) {
    console.error('Get skill error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch skill',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

const updateSkill = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid skill ID format'
      });
    }

    const updateData = {
      ...req.body,
      updatedAt: new Date()
    };

    if (req.body.level) {
      updateData.level = Math.min(10, Math.max(1, parseInt(req.body.level)));
    }

    if (req.body.yearsOfExperience) {
      updateData.yearsOfExperience = parseInt(req.body.yearsOfExperience);
    }

    const skill = await Skill.findByIdAndUpdate(
      id,
      updateData,
      {
        new: true,
        runValidators: true
      }
    );

    if (!skill) {
      return res.status(404).json({
        success: false,
        message: 'Skill not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Skill updated successfully',
      data: skill
    });
  } catch (error) {
    console.error('Update skill error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update skill',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

const deleteSkill = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid skill ID format'
      });
    }

    const skill = await Skill.findByIdAndDelete(id);

    if (!skill) {
      return res.status(404).json({
        success: false,
        message: 'Skill not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Skill deleted successfully',
      data: { deletedId: id }
    });
  } catch (error) {
    console.error('Delete skill error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete skill',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

const getSkillStats = async (req, res) => {
  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    
    const [
      totalSkills,
      activeSkills,
      skillsByCategory,
      skillsByLevel,
      recentSkills,
      featuredSkills,
      averageLevel
    ] = await Promise.all([
      Skill.countDocuments(),
      Skill.countDocuments({ isActive: true }),
      
      Skill.aggregate([
        { $match: { isActive: true } },
        {
          $group: {
            _id: '$category',
            count: { $sum: 1 },
            avgLevel: { $avg: '$level' },
            icon: { $first: '$icon' }
          }
        },
        { $sort: { count: -1 } }
      ]),
      
      Skill.aggregate([
        { $match: { isActive: true } },
        {
          $group: {
            _id: '$level',
            count: { $sum: 1 }
          }
        },
        { $sort: { _id: -1 } }
      ]),
      
      Skill.countDocuments({
        createdAt: { $gte: thirtyDaysAgo },
        isActive: true
      }),

      Skill.countDocuments({ featured: true, isActive: true }),

      Skill.aggregate([
        { $match: { isActive: true } },
        {
          $group: {
            _id: null,
            avgLevel: { $avg: '$level' }
          }
        }
      ])
    ]);

    const totalCategories = skillsByCategory.length;
    const averageSkillsPerCategory = totalCategories > 0 ? Math.round(activeSkills / totalCategories) : 0;
    const averageSkillLevel = averageLevel.length > 0 ? averageLevel[0].avgLevel : 0;

    const categoryStats = skillsByCategory.map(cat => ({
      category: cat._id,
      count: cat.count,
      averageLevel: Math.round(cat.avgLevel * 10) / 10,
      icon: cat.icon || '🔧'
    }));

    const levelDistribution = Array.from({ length: 10 }, (_, i) => {
      const level = i + 1;
      const found = skillsByLevel.find(item => item._id === level);
      return {
        level,
        count: found ? found.count : 0,
        percentage: activeSkills > 0 ? Math.round((found ? found.count : 0) / activeSkills * 100) : 0
      };
    });

    res.status(200).json({
      success: true,
      data: {
        totalSkills: activeSkills,
        totalCategories,
        averageSkillsPerCategory,
        averageSkillLevel: Math.round(averageSkillLevel * 10) / 10,
        recentSkills,
        featuredSkills,
        skillsByCategory: categoryStats,
        skillsByLevel: levelDistribution,
        lastUpdated: new Date().toISOString(),
        summary: {
          beginnerSkills: skillsByLevel.filter(s => s._id <= 3).reduce((sum, s) => sum + s.count, 0),
          intermediateSkills: skillsByLevel.filter(s => s._id >= 4 && s._id <= 6).reduce((sum, s) => sum + s.count, 0),
          advancedSkills: skillsByLevel.filter(s => s._id >= 7 && s._id <= 8).reduce((sum, s) => sum + s.count, 0),
          expertSkills: skillsByLevel.filter(s => s._id >= 9).reduce((sum, s) => sum + s.count, 0)
        }
      }
    });
  } catch (error) {
    console.error('Get skill stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch skill statistics',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

module.exports = {
  createSkill,
  getSkills,
  getSkill,
  updateSkill,
  deleteSkill,
  getSkillStats
};
