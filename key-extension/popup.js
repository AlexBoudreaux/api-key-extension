import { state } from './state.js';
import { encryption } from './encryption.js';

// UI Elements
const loginSection = document.getElementById('loginSection');
const keySection = document.getElementById('keySection');
const loginError = document.getElementById('loginError');
const keysList = document.getElementById('keysList');

// Initialize the application
async function init() {
    try {
        await state.initialize();
        
        // Subscribe to state changes
        state.subscribe(handleStateChange);
        
        // Set up event listeners
        setupEventListeners();
    } catch (error) {
        console.error('Initialization error:', error);
        showError('Failed to initialize application');
    }
}

// Set up event listeners
function setupEventListeners() {
    // Login/Create Password
    document.getElementById('loginBtn').addEventListener('click', async () => {
        const password = document.getElementById('password').value;
        if (!password) {
            showError('Please enter a password');
            return;
        }
        
        try {
            const currentState = state.getState();
            if (currentState.isFirstTimeSetup) {
                // Create new password
                const success = await state.createPassword(password);
                if (!success) {
                    showError('Failed to create password. Please try again.');
                }
            } else {
                // Login with existing password
                const success = await state.unlock(password);
                if (!success) {
                    showError('Invalid password. Please try again.');
                }
            }
        } catch (error) {
            console.error('Password operation error:', error);
            showError(error.message || 'An error occurred. Please try again.');
        }
    });

    // Add enter key support for password
    document.getElementById('password').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            document.getElementById('loginBtn').click();
        }
    });

    // Lock
    document.getElementById('lockBtn').addEventListener('click', () => {
        try {
            state.lock();
            // Clear password field
            document.getElementById('password').value = '';
        } catch (error) {
            console.error('Lock error:', error);
            showError('Failed to lock the application');
        }
    });

    // Add key
    document.getElementById('addKeyBtn').addEventListener('click', async () => {
        const name = document.getElementById('keyName').value.trim();
        const value = document.getElementById('keyValue').value.trim();
        
        if (!name || !value) {
            showError('Please enter both name and value');
            return;
        }
        
        try {
            const success = await state.addKey(name, value);
            if (success) {
                // Clear inputs
                document.getElementById('keyName').value = '';
                document.getElementById('keyValue').value = '';
            } else {
                showError('Failed to add key. Please try again.');
            }
        } catch (error) {
            console.error('Add key error:', error);
            showError(error.message || 'Failed to add key');
        }
    });
}

// Handle state changes
function handleStateChange(newState) {
    try {
        // Update login button text and description
        const loginBtn = document.getElementById('loginBtn');
        const loginText = document.querySelector('#loginSection h3');
        
        if (newState.isFirstTimeSetup) {
            loginBtn.textContent = 'Create Password';
            loginText.textContent = 'Create Password';
            document.getElementById('password').placeholder = 'Enter new password';
        } else {
            loginBtn.textContent = 'Login';
            loginText.textContent = 'Login';
            document.getElementById('password').placeholder = 'Enter password';
        }
        
        // Update UI based on lock state
        loginSection.classList.toggle('hidden', !newState.isLocked);
        keySection.classList.toggle('hidden', newState.isLocked);
        
        // Show error if present
        if (newState.error) {
            showError(newState.error);
        } else {
            loginError.classList.add('hidden');
        }
        
        // Update keys list if unlocked
        if (!newState.isLocked) {
            renderKeys(newState.keys);
        }
    } catch (error) {
        console.error('State change error:', error);
    }
}

// Render keys list
function renderKeys(keys) {
    keysList.innerHTML = '';
    
    if (keys.length === 0) {
        keysList.innerHTML = '<div class="key-item">No keys added yet</div>';
        return;
    }
    
    keys.forEach(key => {
        const keyElement = document.createElement('div');
        keyElement.className = 'key-item';
        
        keyElement.innerHTML = `
            <div>
                <strong>${key.name}</strong>
                <br>
                <span>${maskKey(key.value)}</span>
            </div>
            <div>
                <button class="copy-btn" data-value="${key.value}">Copy</button>
                <button class="delete-btn" data-id="${key.id}">Delete</button>
            </div>
        `;
        
        // Add event listeners
        keyElement.querySelector('.copy-btn').addEventListener('click', (e) => {
            const value = e.target.dataset.value;
            navigator.clipboard.writeText(value);
            e.target.textContent = 'Copied!';
            setTimeout(() => {
                e.target.textContent = 'Copy';
            }, 2000);
        });
        
        keyElement.querySelector('.delete-btn').addEventListener('click', (e) => {
            const id = e.target.dataset.id;
            if (confirm('Are you sure you want to delete this key?')) {
                state.deleteKey(id);
            }
        });
        
        keysList.appendChild(keyElement);
    });
}

// Helper functions
function showError(message) {
    loginError.textContent = message;
    loginError.classList.remove('hidden');
}

function maskKey(key) {
    if (key.length <= 8) return '••••••••';
    return key.substr(0, 4) + '••••' + key.substr(-4);
}

// Initialize the application
init();
