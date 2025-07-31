const Admin = require("../models/Admins");
const Organization = require("../models/Organizations");
const bcrypt = require('bcryptjs');
const config = require('../config');
const User = require("../models/Users");

exports.createOrganization = async (req, res) => {
  try {
    const { orgName, description, name, password, email } = req.body;

    // Validate required fields
    if (!orgName || !description || !name || !password || !email) {
      return res.status(400).json({ message: 'All fields are mandatory' });
    }
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
      password,
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

exports.deleteOrganization = async (req, res) => {
  try {
    const { organizationId } = req.params;

    if (!organizationId) {
      return res.status(400).json({ message: "Organization ID is required" });
    }

    // Check if organization exists
    const organizationDetails = await Organization.findById(organizationId);
    if (!organizationDetails) {
      return res.status(404).json({ message: "Organization does not exist" });
    }

    await User.deleteMany({ organization: organizationId })
    // Find and delete the admin linked to the organization
    const adminDetails = await Admin.findOne({ organization: organizationId });
    if (adminDetails) {
      await Admin.deleteOne({ _id: adminDetails._id });
    }

    // Delete the organization
    await Organization.findByIdAndDelete(organizationId);

    return res.status(200).json({
      message: "Organization and its admin deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting organization:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};



exports.getAllOrganization = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const total = await Organization.countDocuments();
    const organizations = await Organization.find()
      .skip(skip)
      .limit(limit);

    if (!organizations || organizations.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No organization created',
      });
    }

    // Map _id to orgId in each organization
    const formattedOrgs = organizations.map((org) => ({
      orgId: org._id,
      name: org.name,
      description: org.description,
      admins: org.admins.length,
      users: org.users.length,
      status: org.status,
      createdAt: org.createdAt,
      updatedAt: org.updatedAt,
    }));

    res.status(200).json({
      success: true,
      message: 'Organizations fetched successfully',
      page,
      totalPages: Math.ceil(total / limit),
      totalOrganizations: total,
      data: formattedOrgs,
    });
  } catch (error) {
    console.error('Error fetching organizations:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

