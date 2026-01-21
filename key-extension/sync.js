// Sync storage configuration
const SYNC_VERSION = 1;
const DEFAULT_SETTINGS = {
    darkMode: false,
    autoLock: true,
    autoLockDelay: 5, // minutes
    lastSynced: null,
    version: SYNC_VERSION
};

export const sync = {
    // Initialize sync storage with default settings
    async initialize() {
        try {
            const settings = await this.getSettings();
            if (!settings || settings.version !== SYNC_VERSION) {
                await this.setSettings(DEFAULT_SETTINGS);
            }
            return await this.getSettings();
        } catch (error) {
            console.error('Sync initialization error:', error);
            throw new Error('Failed to initialize sync storage');
        }
    },

    // Get all settings
    async getSettings() {
        return new Promise((resolve) => {
            chrome.storage.sync.get(['settings'], (result) => {
                resolve(result.settings || DEFAULT_SETTINGS);
            });
        });
    },

    // Update settings
    async setSettings(settings) {
        return new Promise((resolve, reject) => {
            chrome.storage.sync.set({
                settings: {
                    ...settings,
                    lastSynced: Date.now()
                }
            }, () => {
                if (chrome.runtime.lastError) {
                    reject(chrome.runtime.lastError);
                } else {
                    resolve();
                }
            });
        });
    },

    // Update a single setting
    async updateSetting(key, value) {
        const settings = await this.getSettings();
        settings[key] = value;
        return this.setSettings(settings);
    },

    // Store key metadata (non-sensitive data)
    async syncKeyMetadata(keys) {
        const metadata = keys.map(key => ({
            id: key.id,
            name: key.name,
            createdAt: key.createdAt,
            lastUsed: key.lastUsed
        }));

        return new Promise((resolve, reject) => {
            chrome.storage.sync.set({ keyMetadata: metadata }, () => {
                if (chrome.runtime.lastError) {
                    reject(chrome.runtime.lastError);
                } else {
                    resolve();
                }
            });
        });
    },

    // Get key metadata
    async getKeyMetadata() {
        return new Promise((resolve) => {
            chrome.storage.sync.get(['keyMetadata'], (result) => {
                resolve(result.keyMetadata || []);
            });
        });
    },

    // Check if sync is enabled
    async isSyncEnabled() {
        return new Promise((resolve) => {
            chrome.storage.sync.getBytesInUse(null, (bytesInUse) => {
                resolve(bytesInUse !== undefined);
            });
        });
    },

    // Clear sync data
    async clearSync() {
        return new Promise((resolve, reject) => {
            chrome.storage.sync.clear(() => {
                if (chrome.runtime.lastError) {
                    reject(chrome.runtime.lastError);
                } else {
                    resolve();
                }
            });
        });
    },

    // Listen for sync changes
    addSyncListener(callback) {
        chrome.storage.onChanged.addListener((changes, areaName) => {
            if (areaName === 'sync') {
                callback(changes);
            }
        });
    }
}; 