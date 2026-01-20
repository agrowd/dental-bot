// @ts-nocheck
import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://mongo:27017/odontobot';
console.log('[NEXTJS] DB URI:', MONGODB_URI.replace(/\/\/([^:]+):([^@]+)@/, '//***:***@')); // Mask credentials

if (!global.mongoose) {
    global.mongoose = {
        conn: null,
        promise: null,
    };
}

export async function dbConnect() {
    if (global.mongoose.conn) {
        return global.mongoose.conn;
    }

    if (!global.mongoose.promise) {
        const opts = {
            bufferCommands: false,
        };

        global.mongoose.promise = mongoose.connect(MONGODB_URI, opts).then((mongoose) => {
            return mongoose;
        });
    }

    try {
        global.mongoose.conn = await global.mongoose.promise;
    } catch (e) {
        global.mongoose.promise = null;
        throw e;
    }

    return global.mongoose.conn;
}
