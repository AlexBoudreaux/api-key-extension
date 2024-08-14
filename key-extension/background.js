// Data structures
class ApiKey {
  constructor(id, key, name, createdAt, lastUsed) {
      this.id = id;
      this.key = key;
      this.name = name;
      this.createdAt = createdAt;
      this.lastUsed = lastUsed;
  }
}

class UrlUsageHistory {
  constructor(url, keyId, useCount, lastUsed) {
      this.url = url;
      this.keyId = keyId;
      this.useCount = useCount;
      this.lastUsed = lastUsed;
  }
}

// Global variables
let apiKeys = [];
let urlUsageHistory = [];
let recentKeysCache = {};

// Helper functions
function isRecent(apiKey, hours = 12) {
  return (Date.now() - apiKey.createdAt) < hours * 3600 * 1000;
}

function getDomain(url) {
  const urlObj = new URL(url);
  return urlObj.hostname;
}

function getUrlUsageHistory(url) {
  const domain = getDomain(url);
  return urlUsageHistory.filter(usage => getDomain(usage.url) === domain);
}

function recencyBonus(lastUsed) {
  const hoursAgo = (Date.now() - lastUsed) / (3600 * 1000);
  return Math.max(24 - hoursAgo, 0);
}

function decayFactor(lastUsed) {
  const daysAgo = (Date.now() - lastUsed) / (24 * 3600 * 1000);
  return Math.exp(-daysAgo / 30); // Exponential decay with a half-life of about 30 days
}

// Scoring and ranking functions
function calculateScore(apiKey, currentUrl) {
  let baseScore = 0;
  if (isRecent(apiKey)) {
      baseScore += 10;
  }
  const usage = getUrlUsageHistory(currentUrl);
  for (let item of usage) {
      if (item.keyId === apiKey.id) {
          const decayedUseCount = item.useCount * decayFactor(item.lastUsed);
          baseScore += Math.min(decayedUseCount * 2, 50);
          baseScore += recencyBonus(item.lastUsed);
      }
  }
  return baseScore;
}

function rankApiKeys(currentUrl) {
  const scoredKeys = apiKeys.map(key => ({
      key: key,
      score: calculateScore(key, currentUrl)
  }));
  return scoredKeys.sort((a, b) => b.score - a.score);
}

// Usage tracking functions
function updateUrlUsageHistory(keyId, url) {
  const domain = getDomain(url);
  const existingUsage = urlUsageHistory.find(usage => getDomain(usage.url) === domain && usage.keyId === keyId);
  if (existingUsage) {
      existingUsage.useCount += 1;
      existingUsage.lastUsed = Date.now();
      existingUsage.url = url; // Update to the most recent URL for this domain
  } else {
      urlUsageHistory.push(new UrlUsageHistory(url, keyId, 1, Date.now()));
  }
}

function updateRecentKeysCache(keyId) {
  recentKeysCache[keyId] = Date.now();
}

function trackKeyUsage(keyId, url) {
  updateUrlUsageHistory(keyId, url);
  updateRecentKeysCache(keyId);
}

// Add this function to generate a unique ID
function generateUniqueId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// Add this function to add a new API key
function addApiKey(name, key) {
  const newKey = new ApiKey(generateUniqueId(), key, name, Date.now(), Date.now());
  apiKeys.push(newKey);
  return saveApiKeys();
}

// Add this function to delete an API key
function deleteApiKey(keyId) {
  apiKeys = apiKeys.filter(key => key.id !== keyId);
  return saveApiKeys();
}

function saveApiKeys() {
  return new Promise((resolve, reject) => {
    chrome.storage.sync.set({apiKeys: apiKeys}, () => {
      if (chrome.runtime.lastError) {
        console.error('Error saving API keys to sync storage:', chrome.runtime.lastError);
        // Backup to localStorage
        localStorage.setItem('apiKeys', JSON.stringify(apiKeys));
        reject(chrome.runtime.lastError);
      } else {
        resolve();
      }
    });
  });
}

function loadApiKeys() {
  chrome.storage.sync.get(['apiKeys'], (result) => {
    if (chrome.runtime.lastError) {
      console.error('Error loading API keys from sync storage:', chrome.runtime.lastError);
      // Try to load from localStorage
      const localBackup = localStorage.getItem('apiKeys');
      if (localBackup) {
        apiKeys = JSON.parse(localBackup);
      }
    } else {
      apiKeys = result.apiKeys || [];
    }
  });
}

// Call loadApiKeys when the extension starts
loadApiKeys();

// Periodically check and restore data integrity
setInterval(() => {
  loadApiKeys();
}, 5 * 60 * 1000); // Check every 5 minutes

// Main function
function getRankedApiKeys(currentUrl) {
  return rankApiKeys(currentUrl).map(item => item.key);
}

// Chrome extension specific functions
chrome.runtime.onInstalled.addListener(function() {
  // Initialize with some dummy data
  apiKeys = [
      new ApiKey("1", "key1", "Key 1", Date.now() - 24 * 3600 * 1000, Date.now()),
      new ApiKey("2", "key2", "Key 2", Date.now() - 2 * 3600 * 1000, Date.now()),
      new ApiKey("3", "key3", "Key 3", Date.now(), Date.now()),
  ];
  chrome.storage.sync.set({apiKeys: apiKeys}, () => {
    if (chrome.runtime.lastError) {
      console.error('Error initializing API keys:', chrome.runtime.lastError);
    }
  });
});

// Update the message listener to handle deleting API keys
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.action === "updateRanking") {
    const rankedKeys = getRankedApiKeys(request.url);
    saveApiKeys()
      .then(() => sendResponse({success: true}))
      .catch((error) => sendResponse({success: false, error: error.message}));
  } else if (request.action === "trackUsage") {
    trackKeyUsage(request.keyId, request.url);
    sendResponse({success: true});
  } else if (request.action === "addApiKey") {
    addApiKey(request.name, request.key)
      .then(() => sendResponse({success: true}))
      .catch((error) => sendResponse({success: false, error: error.message}));
  } else if (request.action === "deleteApiKey") {
    deleteApiKey(request.keyId)
      .then(() => sendResponse({success: true}))
      .catch((error) => sendResponse({success: false, error: error.message}));
  }
  return true; // Keeps the message channel open for async response
});

// Periodically clean up old data (e.g., every hour)
setInterval(() => {
  const threeMonthsAgo = Date.now() - 90 * 24 * 3600 * 1000;
  urlUsageHistory = urlUsageHistory.filter(usage => usage.lastUsed > threeMonthsAgo);
  for (let keyId in recentKeysCache) {
      if (recentKeysCache[keyId] < threeMonthsAgo) {
          delete recentKeysCache[keyId];
      }
  }
}, 3600 * 1000);

