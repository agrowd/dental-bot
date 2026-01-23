import { exec } from 'child_process';
import path from 'path';
import BotInstance from './models/BotInstance';

export class InstanceManager {
    private static botRunnerPath = path.join(process.cwd(), 'bot-runner');

    static async listInstances() {
        return await BotInstance.find().sort({ createdAt: -1 });
    }

    static async createInstance(name: string) {
        // Find next available port (starting at 4001)
        const instances = await BotInstance.find().select('port');
        const usedPorts = instances.map(i => i.port);
        let port = 4001;
        while (usedPorts.includes(port)) {
            port++;
        }

        const id = name.toLowerCase().replace(/[^a-z0-9]/g, '-') + '-' + Math.random().toString(36).substring(2, 7);

        const instance = await BotInstance.create({
            id,
            name,
            port,
            status: 'offline'
        });

        return instance;
    }

    static async startInstance(id: string) {
        const instance = await BotInstance.findOne({ id });
        if (!instance) throw new Error('Instance not found');

        const mongoUri = process.env.MONGODB_URI;
        const sessionName = `.sessions/${instance.id}`;

        // PM2 command
        const command = `pm2 start index.js --name "${instance.id}" --env PORT=${instance.port} --env SESSION_NAME=${sessionName} --env MONGODB_URI="${mongoUri}"`;

        return new Promise((resolve, reject) => {
            exec(command, { cwd: this.botRunnerPath }, async (error) => {
                if (error) {
                    console.error(`PM2 start error for ${id}:`, error);
                    instance.status = 'error';
                    await instance.save();
                    reject(error);
                } else {
                    instance.status = 'starting';
                    await instance.save();
                    resolve(instance);
                }
            });
        });
    }

    static async stopInstance(id: string) {
        return new Promise((resolve, reject) => {
            exec(`pm2 stop ${id}`, async (error) => {
                if (error) {
                    console.error(`PM2 stop error for ${id}:`, error);
                    reject(error);
                } else {
                    await BotInstance.findOneAndUpdate({ id }, { status: 'offline' });
                    resolve(true);
                }
            });
        });
    }

    static async deleteInstance(id: string) {
        return new Promise((resolve, reject) => {
            exec(`pm2 delete ${id}`, async (error) => {
                // We don't necessarily care if it fails to delete if it's already gone from PM2
                await BotInstance.findOneAndDelete({ id });
                resolve(true);
            });
        });
    }
}
