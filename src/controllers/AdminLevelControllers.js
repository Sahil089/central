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
