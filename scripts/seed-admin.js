// Script to create initial admin user
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/odontobot';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@clinica.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123456';

const AdminSchema = new mongoose.Schema({
    email: String,
    passwordHash: String,
    createdAt: Date,
});

const Admin = mongoose.model('Admin', AdminSchema);

async function seed() {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('Connected to MongoDB');

        // Check if admin exists
        const existing = await Admin.findOne({ email: ADMIN_EMAIL.toLowerCase() });

        if (existing) {
            console.log('Admin user already exists:', ADMIN_EMAIL);
            process.exit(0);
        }

        // Hash password
        const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);

        // Create admin
        await Admin.create({
            email: ADMIN_EMAIL.toLowerCase(),
            passwordHash,
            createdAt: new Date(),
        });

        console.log('✅ Admin user created successfully!');
        console.log('Email:', ADMIN_EMAIL);
        console.log('Password:', ADMIN_PASSWORD);
        console.log('\n⚠️  CHANGE THE PASSWORD AFTER FIRST LOGIN!\n');

    } catch (error) {
        console.error('Seed error:', error);
        process.exit(1);
    } finally {
        await mongoose.disconnect();
    }
}

seed();
