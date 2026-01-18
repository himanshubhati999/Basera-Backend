// Script to clean up wishlist data - removes invalid entries
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');

const cleanWishlist = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Find all users with wishlist data
    const users = await User.find({ wishlist: { $exists: true, $ne: [] } });
    console.log(`Found ${users.length} users with wishlist data`);

    for (const user of users) {
      console.log(`\nUser: ${user.email}`);
      console.log(`Current wishlist:`, user.wishlist);
      
      // Filter out any invalid ObjectIds (numbers or invalid strings)
      const validWishlist = user.wishlist.filter(id => {
        // Check if it's a valid MongoDB ObjectId
        return mongoose.Types.ObjectId.isValid(id) && String(id).length === 24;
      });

      console.log(`Valid wishlist:`, validWishlist);
      
      // Clear the wishlist to start fresh
      user.wishlist = [];
      await user.save();
      console.log(`✓ Cleared wishlist for ${user.email}`);
    }

    console.log('\n✓ Wishlist cleanup complete!');
    process.exit(0);
  } catch (error) {
    console.error('Error cleaning wishlist:', error);
    process.exit(1);
  }
};

cleanWishlist();
