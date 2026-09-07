const mongoose = require('mongoose');
const dns = require('dns');

// Force Node.js to use Google's DNS (8.8.8.8) instead of the system router DNS.
// This fixes 'querySrv ECONNREFUSED' errors caused by routers/ISPs that
// do not support SRV record lookups required by MongoDB Atlas +srv connection strings.
dns.setServers(['8.8.8.8', '8.8.4.4']);

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI);
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`❌ MongoDB Error: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;
