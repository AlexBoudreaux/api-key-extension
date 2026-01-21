import { db } from './db.js';
import { sync } from './sync.js';
import { encryption } from './encryption.js';

// State management configuration
const DEFAULT_STATE = {
    isInitialized: false,
    isLocked: true,
    isLoading: false,
    error: null,
    keys: [],
    settings: null,
    searchQuery: '',
    selectedKeyId: null,
    isFirstTimeSetup: true
};

const STORAGE_KEYS = {
    INITIALIZED: 'initialized'
};

class StateManager {
    constructor() {
        this._state = { ...DEFAULT_STATE };
        this._listeners = new Set();
        this._password = null;
    }

    // Get current state
    getState() {
        return { ...this._state };
    }

    // Subscribe to state changes
    subscribe(listener) {
        this._listeners.add(listener);
        // Immediately call with current state
        listener(this.getState());
        return () => this._listeners.delete(listener);
    }

    // Notify listeners of state changes
    _notify() {
        this._listeners.forEach(listener => listener(this.getState()));
    }

    // Update state
    _setState(newState) {
        this._state = { ...this._state, ...newState };
        this._notify();
    }

    // Check if this is first time setup
    async _checkFirstTimeSetup() {
        return new Promise((resolve) => {
            chrome.storage.local.get([STORAGE_KEYS.INITIALIZED], (result) => {
                resolve(!result[STORAGE_KEYS.INITIALIZED]);
            });
        });
    }

    // Mark setup as complete
    async _markSetupComplete() {
        return new Promise((resolve) => {
            chrome.storage.local.set({ [STORAGE_KEYS.INITIALIZED]: true }, resolve);
        });
    }

    // Initialize the application
    async initialize() {
        this._setState({ isLoading: true });
        try {
            await db.initialize();
            const settings = await sync.getSettings();
            const isFirstTime = await this._checkFirstTimeSetup();
            
            this._setState({
                isInitialized: true,
                isLoading: false,
                settings,
                isFirstTimeSetup: isFirstTime,
                error: null
            });
            return true;
        } catch (error) {
            console.error('Initialization error:', error);
            this._setState({
                isLoading: false,
                error: 'Failed to initialize application'
            });
            return false;
        }
    }

    // Create initial password
    async createPassword(password) {
        if (!this._state.isFirstTimeSetup) {
            throw new Error('Password already set');
        }

        this._setState({ isLoading: true });
        try {
            // Create a test key to verify the password works
            const testKey = {
                name: '_test',
                value: 'test_value'
            };
            await db.addKey(testKey, password);
            this._password = password;
            
            // Mark setup as complete
            await this._markSetupComplete();
            
            this._setState({
                isFirstTimeSetup: false,
                isLocked: false,
                isLoading: false,
                error: null
            });
            return true;
        } catch (error) {
            console.error('Create password error:', error);
            this._setState({
                isLoading: false,
                error: 'Failed to create password'
            });
            return false;
        }
    }

    // Lock/Unlock functions
    async unlock(password) {
        this._setState({ isLoading: true });
        try {
            // Validate password by trying to decrypt a test value
            const isValid = await this._validatePassword(password);
            if (!isValid) {
                throw new Error('Invalid password');
            }

            this._password = password;
            const keys = await db.getAllKeys(password);
            this._setState({
                isLocked: false,
                isLoading: false,
                keys: keys.filter(k => k.name !== '_test'), // Hide test key
                error: null
            });
            return true;
        } catch (error) {
            this._setState({
                isLoading: false,
                error: 'Invalid password'
            });
            return false;
        }
    }

    lock() {
        this._password = null;
        this._setState({
            ...DEFAULT_STATE,
            isInitialized: true,
            isFirstTimeSetup: false,
            settings: this._state.settings
        });
    }

    // Key management functions
    async addKey(name, value) {
        if (!this._password) throw new Error('Application is locked');
        
        this._setState({ isLoading: true });
        try {
            await db.addKey({ name, value }, this._password);
            const keys = await db.getAllKeys(this._password);
            this._setState({
                isLoading: false,
                keys: keys.filter(k => k.name !== '_test'),
                error: null
            });
            return true;
        } catch (error) {
            this._setState({
                isLoading: false,
                error: 'Failed to add key'
            });
            return false;
        }
    }

    async updateKey(id, updates) {
        if (!this._password) throw new Error('Application is locked');
        
        this._setState({ isLoading: true });
        try {
            const existingKey = await db.getKeyById(id, this._password);
            if (!existingKey) throw new Error('Key not found');

            const updatedKey = { ...existingKey, ...updates };
            await db.updateKey(updatedKey, this._password);
            const keys = await db.getAllKeys(this._password);
            this._setState({
                isLoading: false,
                keys: keys.filter(k => k.name !== '_test'),
                error: null
            });
            return true;
        } catch (error) {
            this._setState({
                isLoading: false,
                error: 'Failed to update key'
            });
            return false;
        }
    }

    async deleteKey(id) {
        if (!this._password) throw new Error('Application is locked');
        
        this._setState({ isLoading: true });
        try {
            await db.deleteKey(id, this._password);
            const keys = await db.getAllKeys(this._password);
            this._setState({
                isLoading: false,
                keys: keys.filter(k => k.name !== '_test'),
                error: null,
                selectedKeyId: null
            });
            return true;
        } catch (error) {
            this._setState({
                isLoading: false,
                error: 'Failed to delete key'
            });
            return false;
        }
    }

    // Settings management
    async updateSettings(updates) {
        this._setState({ isLoading: true });
        try {
            const newSettings = { ...this._state.settings, ...updates };
            await sync.setSettings(newSettings);
            this._setState({
                isLoading: false,
                settings: newSettings,
                error: null
            });
            return true;
        } catch (error) {
            this._setState({
                isLoading: false,
                error: 'Failed to update settings'
            });
            return false;
        }
    }

    // Search and selection
    setSearchQuery(query) {
        this._setState({ searchQuery: query });
    }

    setSelectedKey(keyId) {
        this._setState({ selectedKeyId: keyId });
    }

    // Helper functions
    async _validatePassword(password) {
        try {
            const keys = await db.getAllKeys(password);
            const testKey = keys.find(k => k.name === '_test');
            return testKey && testKey.value === 'test_value';
        } catch {
            return false;
        }
    }
}

// Export a singleton instance
export const state = new StateManager(); 