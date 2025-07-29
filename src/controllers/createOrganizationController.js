const Admin = require("../models/Admins");
const Organization = require("../models/Organizations");
const bcrypt = require('bcryptjs');
const config = require('../config');

exports.createOrganization = async (req, res) => {
  try {
    const { orgName, description, name, password, email } = req.body;

    // Validate required fields
    if (!orgName || !description || !name || !password || !email) {
      return res.status(400).json({ message: 'All fields are mandatory' });
    }
    const hashedPassword = await bcrypt.hash(password, config.bcryptsalt);
    // Check for existing organization and admin
    const orgExists = await Organization.findOne({ name: orgName });
    if (orgExists) {
      return res.status(400).json({ message: 'Organization with the same name already exists' });
    }

    const adminExists = await Admin.findOne({ email });
    if (adminExists) {
      return res.status(400).json({ message: 'Admin with the same email already exists' });
    }

    // Create organization first
    const newOrg = new Organization({
      name: orgName,
      description,
    });
    await newOrg.save();

    // Hash admin password
    

    // Create admin linked to organization
    const newAdmin = new Admin({
      name,
      email,
      password: hashedPassword,
      organization: newOrg._id, // link to created org
    });
    await newAdmin.save();

    // Push admin to org.admins array
    newOrg.admins.push(newAdmin._id);
    await newOrg.save(); // update organization

    res.status(201).json({
      message: 'Organization and admin created successfully',
      organization: {
        id: newOrg._id,
        name: newOrg.name,
        description: newOrg.description,
        status: newOrg.status,
      },
      admin: {
        id: newAdmin._id,
        name: newAdmin.name,
        email: newAdmin.email,
        role: newAdmin.role,
        status: newAdmin.status,
      },
    });

  } catch (error) {
    console.error('Error creating organization:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};
