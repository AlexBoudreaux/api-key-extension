// Encryption configuration
const ALGORITHM = 'AES-GCM';
const KEY_LENGTH = 256;
const SALT_LENGTH = 16;
const IV_LENGTH = 12;
const ITERATIONS = 100000;

// Helper function to generate encryption key from password
async function getKey(password, salt) {
    try {
        console.log('Generating key from password...');
        const encoder = new TextEncoder();
        const passwordBuffer = encoder.encode(password);
        
        // Import the password as a key
        const keyMaterial = await crypto.subtle.importKey(
            'raw',
            passwordBuffer,
            { name: 'PBKDF2' },
            false,
            ['deriveBits', 'deriveKey']
        );
        
        // Derive the actual encryption key
        return await crypto.subtle.deriveKey(
            {
                name: 'PBKDF2',
                salt: salt,
                iterations: ITERATIONS,
                hash: 'SHA-256'
            },
            keyMaterial,
            { name: ALGORITHM, length: KEY_LENGTH },
            true, // extractable
            ['encrypt', 'decrypt']
        );
    } catch (error) {
        console.error('Key generation error:', error);
        throw error;
    }
}

export const encryption = {
    // Generate a random password for the user's first use
    async generatePassword() {
        try {
            const bytes = new Uint8Array(32);
            crypto.getRandomValues(bytes);
            return Array.from(bytes)
                .map(b => b.toString(16).padStart(2, '0'))
                .join('');
        } catch (error) {
            console.error('Password generation error:', error);
            throw error;
        }
    },

    // Encrypt data
    async encrypt(data, password) {
        try {
            console.log('Starting encryption...');
            
            // Generate salt and IV
            const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
            const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
            
            // Get encryption key
            const key = await getKey(password, salt);
            
            // Encrypt the data
            const encoder = new TextEncoder();
            const dataBuffer = encoder.encode(JSON.stringify(data));
            
            const encrypted = await crypto.subtle.encrypt(
                { name: ALGORITHM, iv },
                key,
                dataBuffer
            );
            
            // Combine salt, IV, and encrypted data
            const result = new Uint8Array(salt.length + iv.length + encrypted.byteLength);
            result.set(salt, 0);
            result.set(iv, salt.length);
            result.set(new Uint8Array(encrypted), salt.length + iv.length);
            
            // Convert to base64
            console.log('Encryption completed successfully');
            return btoa(String.fromCharCode.apply(null, result));
        } catch (error) {
            console.error('Encryption error:', error);
            throw new Error(`Encryption failed: ${error.message}`);
        }
    },

    // Decrypt data
    async decrypt(encryptedData, password) {
        try {
            console.log('Starting decryption...');
            
            // Convert from base64
            const data = new Uint8Array(atob(encryptedData).split('').map(c => c.charCodeAt(0)));
            
            // Extract salt, IV, and encrypted data
            const salt = data.slice(0, SALT_LENGTH);
            const iv = data.slice(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
            const encrypted = data.slice(SALT_LENGTH + IV_LENGTH);
            
            // Get decryption key
            const key = await getKey(password, salt);
            
            // Decrypt the data
            const decrypted = await crypto.subtle.decrypt(
                { name: ALGORITHM, iv },
                key,
                encrypted
            );
            
            // Convert back to object
            const decoder = new TextDecoder();
            const decryptedText = decoder.decode(decrypted);
            console.log('Decryption completed successfully');
            return JSON.parse(decryptedText);
        } catch (error) {
            console.error('Decryption error:', error);
            throw new Error(`Decryption failed: ${error.message}`);
        }
    },

    // Validate password
    async validatePassword(password, testData = { test: 'data' }) {
        try {
            console.log('Validating password...');
            const encrypted = await this.encrypt(testData, password);
            const decrypted = await this.decrypt(encrypted, password);
            const isValid = decrypted.test === testData.test;
            console.log('Password validation:', isValid ? 'successful' : 'failed');
            return isValid;
        } catch (error) {
            console.error('Password validation error:', error);
            return false;
        }
    }
}; 