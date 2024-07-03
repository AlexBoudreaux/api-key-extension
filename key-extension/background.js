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

function getUrlUsageHistory(url) {
  return urlUsageHistory.filter(usage => usage.url === url);
}

function recencyBonus(lastUsed) {
  const hoursAgo = (Date.now() - lastUsed) / (3600 * 1000);
  return Math.max(24 - hoursAgo, 0);
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
          baseScore += Math.min(item.useCount * 2, 50);
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
  const existingUsage = urlUsageHistory.find(usage => usage.url === url && usage.keyId === keyId);
  if (existingUsage) {
      existingUsage.useCount += 1;
      existingUsage.lastUsed = Date.now();
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
  chrome.storage.local.set({apiKeys: apiKeys});
}

// Add this function to delete an API key
function deleteApiKey(keyId) {
  apiKeys = apiKeys.filter(key => key.id !== keyId);
  chrome.storage.local.set({apiKeys: apiKeys});
}

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
  chrome.storage.local.set({apiKeys: apiKeys});
});

// Update the message listener to handle deleting API keys
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.action === "updateRanking") {
      const rankedKeys = getRankedApiKeys(request.url);
      chrome.storage.local.set({apiKeys: rankedKeys});
      sendResponse({success: true});
  } else if (request.action === "trackUsage") {
      trackKeyUsage(request.keyId, request.url);
      sendResponse({success: true});
  } else if (request.action === "addApiKey") {
      addApiKey(request.name, request.key);
      sendResponse({success: true});
  } else if (request.action === "deleteApiKey") {
      deleteApiKey(request.keyId);
      sendResponse({success: true});
  }
  return true; // Keeps the message channel open for async response
});

// Periodically clean up old data (e.g., every hour)
setInterval(() => {
  const oneMonthAgo = Date.now() - 30 * 24 * 3600 * 1000;
  urlUsageHistory = urlUsageHistory.filter(usage => usage.lastUsed > oneMonthAgo);
  for (let keyId in recentKeysCache) {
      if (recentKeysCache[keyId] < oneMonthAgo) {
          delete recentKeysCache[keyId];
      }
  }
}, 3600 * 1000);

