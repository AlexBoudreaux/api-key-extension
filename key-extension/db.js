import { encryption } from './encryption.js';
import { sync } from './sync.js';

// Database configuration
const DB_NAME = 'ApiKeyGarageDB';
const DB_VERSION = 1;
const STORE_NAME = 'apiKeys';

let dbConnection = null; // Global database connection

// Open database connection
const openDB = () => {
    return new Promise((resolve, reject) => {
        if (dbConnection) {
            resolve(dbConnection);
            return;
        }

        console.log('Opening database connection...');
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = (event) => {
            console.error('Database error:', event.target.error);
            reject(event.target.error);
        };

        request.onsuccess = (event) => {
            console.log('Database opened successfully');
            dbConnection = event.target.result;
            resolve(dbConnection);
        };

        request.onupgradeneeded = (event) => {
            console.log('Database upgrade needed');
            const database = event.target.result;
            if (!database.objectStoreNames.contains(STORE_NAME)) {
                const store = database.createObjectStore(STORE_NAME, { keyPath: 'id' });
                store.createIndex('name', 'name', { unique: false });
                store.createIndex('createdAt', 'createdAt', { unique: false });
                store.createIndex('lastUsed', 'lastUsed', { unique: false });
                console.log('Object store created');
            }
        };
    });
};

// Basic CRUD operations
export const db = {
    async initialize() {
        try {
            console.log('Initializing database...');
            await openDB();
            console.log('Database initialized');
            return true;
        } catch (error) {
            console.error('Database initialization error:', error);
            throw error;
        }
    },

    async addKey(key, password) {
        console.log('Adding key...');
        const database = await openDB();
        return new Promise(async (resolve, reject) => {
            try {
                const transaction = database.transaction(STORE_NAME, 'readwrite');
                const store = transaction.objectStore(STORE_NAME);
                
                // Encrypt the API key value
                console.log('Encrypting key value...');
                const encryptedValue = await encryption.encrypt(key.value, password);
                
                const newKey = {
                    id: crypto.randomUUID(),
                    key: encryptedValue,
                    name: key.name,
                    createdAt: Date.now(),
                    lastUsed: Date.now()
                };

                const request = store.add(newKey);

                request.onsuccess = async () => {
                    console.log('Key added successfully');
                    // Sync metadata after successful addition
                    const allKeys = await this.getAllKeys(password);
                    await sync.syncKeyMetadata(allKeys);
                    resolve(request.result);
                };

                request.onerror = (event) => {
                    console.error('Error adding key:', event.target.error);
                    reject(event.target.error);
                };

                transaction.oncomplete = () => {
                    console.log('Transaction completed');
                };

                transaction.onerror = (event) => {
                    console.error('Transaction error:', event.target.error);
                    reject(event.target.error);
                };
            } catch (error) {
                console.error('Add key error:', error);
                reject(error);
            }
        });
    },

    async getAllKeys(password) {
        console.log('Getting all keys...');
        const database = await openDB();
        return new Promise(async (resolve, reject) => {
            try {
                const transaction = database.transaction(STORE_NAME, 'readonly');
                const store = transaction.objectStore(STORE_NAME);
                const request = store.getAll();

                request.onsuccess = async () => {
                    const keys = request.result;
                    console.log(`Found ${keys.length} keys`);
                    // Decrypt all key values
                    const decryptedKeys = await Promise.all(
                        keys.map(async (key) => ({
                            ...key,
                            value: await encryption.decrypt(key.key, password)
                        }))
                    );
                    resolve(decryptedKeys);
                };

                request.onerror = (event) => {
                    console.error('Error getting keys:', event.target.error);
                    reject(event.target.error);
                };
            } catch (error) {
                console.error('Get all keys error:', error);
                reject(error);
            }
        });
    },

    async updateKey(key, password) {
        console.log('Updating key...');
        const database = await openDB();
        return new Promise(async (resolve, reject) => {
            try {
                const transaction = database.transaction(STORE_NAME, 'readwrite');
                const store = transaction.objectStore(STORE_NAME);
                
                // Encrypt the updated API key value
                const encryptedValue = await encryption.encrypt(key.value, password);
                
                const updatedKey = {
                    ...key,
                    key: encryptedValue,
                    lastUsed: Date.now()
                };

                const request = store.put(updatedKey);

                request.onsuccess = async () => {
                    console.log('Key updated successfully');
                    // Sync metadata after successful update
                    const allKeys = await this.getAllKeys(password);
                    await sync.syncKeyMetadata(allKeys);
                    resolve(request.result);
                };

                request.onerror = (event) => {
                    console.error('Error updating key:', event.target.error);
                    reject(event.target.error);
                };
            } catch (error) {
                console.error('Update key error:', error);
                reject(error);
            }
        });
    },

    async deleteKey(id, password) {
        console.log('Deleting key...');
        const database = await openDB();
        return new Promise(async (resolve, reject) => {
            try {
                const transaction = database.transaction(STORE_NAME, 'readwrite');
                const store = transaction.objectStore(STORE_NAME);
                const request = store.delete(id);

                request.onsuccess = async () => {
                    console.log('Key deleted successfully');
                    // Sync metadata after successful deletion
                    const allKeys = await this.getAllKeys(password);
                    await sync.syncKeyMetadata(allKeys);
                    resolve(request.result);
                };

                request.onerror = (event) => {
                    console.error('Error deleting key:', event.target.error);
                    reject(event.target.error);
                };
            } catch (error) {
                console.error('Delete key error:', error);
                reject(error);
            }
        });
    },

    async getKeyById(id, password) {
        console.log('Getting key by ID...');
        const database = await openDB();
        return new Promise(async (resolve, reject) => {
            try {
                const transaction = database.transaction(STORE_NAME, 'readonly');
                const store = transaction.objectStore(STORE_NAME);
                const request = store.get(id);

                request.onsuccess = async () => {
                    if (request.result) {
                        const key = request.result;
                        console.log('Key found');
                        // Decrypt the key value
                        const decryptedValue = await encryption.decrypt(key.key, password);
                        resolve({
                            ...key,
                            value: decryptedValue
                        });
                    } else {
                        console.log('Key not found');
                        resolve(null);
                    }
                };

                request.onerror = (event) => {
                    console.error('Error getting key:', event.target.error);
                    reject(event.target.error);
                };
            } catch (error) {
                console.error('Get key by ID error:', error);
                reject(error);
            }
        });
    }
}; 