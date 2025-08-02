const ChatHistory = require("../models/ChatHistory");
const Organization = require("../models/Organizations");
const User = require("../models/Users");


exports.createUser = async (req, res) => {
  try {
    const { adminId, OrgId, name, email, password } = req.body;

    // Validate input fields
    if (!name || !email || !password || !adminId || !OrgId) {
      return res.status(400).json({ message: "All fields are mandatory" });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({ message: "User already exists with this email" });
    }


    // Create and save user
    const newUser = new User({
      name,
      email,
      password,
      organization: OrgId,
      createdBy: adminId,
    });

    await newUser.save();
    await Organization.findByIdAndUpdate(
  OrgId,
  { $push: { users: newUser._id } },
  { new: true } // returns the updated document (optional)
);
    res.status(201).json({
      success: true,
      message: "User created successfully",
      user: {
        userId: newUser._id,
        name: newUser.name,
        email: newUser.email,
      },
    });
  } catch (error) {
    console.error("Error creating user:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

exports.deleteUser = async (req, res) => {
  try {
    const { userId, orgId } = req.params;

    // Validate input
    if (!userId || !orgId) {
      return res.status(400).json({ message: "userId and orgId are required" });
    }

    // Delete the user
    const deletedUser = await User.findByIdAndDelete(userId);
    if (!deletedUser) {
      return res.status(404).json({ message: "User not found" });
    }

    // Remove the user ID from the organization’s users array
    await Organization.findByIdAndUpdate(
      orgId,
      { $pull: { users: userId } },
      { new: true }
    );
    await ChatHistory.deleteMany({organization:orgId});

    res.status(200).json({
      success: true,
      message: "User deleted and removed from organization",
    });
  } catch (error) {
    console.error("Error deleting user:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
