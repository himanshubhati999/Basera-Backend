// Check property IDs in database
require('dotenv').config();
const mongoose = require('mongoose');
const Property = require('./models/Property');

const checkProperties = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB\n');

    const properties = await Property.find({}).select('_id title');
    
    console.log(`Total properties: ${properties.length}\n`);
    console.log('Sample property IDs:');
    
    properties.slice(0, 10).forEach((prop, index) => {
      console.log(`${index + 1}. ID: ${prop._id} (Type: ${typeof prop._id}, Length: ${prop._id.toString().length})`);
      console.log(`   Title: ${prop.title}`);
      console.log(`   Is valid ObjectId: ${mongoose.Types.ObjectId.isValid(prop._id)}`);
      console.log('');
    });

    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
};

checkProperties();
