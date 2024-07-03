// Fetch API keys from storage and display them
function loadAndDisplayKeys() {
  chrome.storage.local.get(['apiKeys'], function(result) {
      const apiKeys = result.apiKeys || [];
      displayTopKeys(apiKeys.slice(0, 3));
      displayAllKeys(apiKeys);
  });
}

function displayTopKeys(keys) {
  const topKeysDiv = document.getElementById('topKeys');
  topKeysDiv.innerHTML = '';
  keys.forEach(key => {
      const keyElement = createKeyElement(key);
      topKeysDiv.appendChild(keyElement);
  });
}

function displayAllKeys(keys) {
  const allKeysDiv = document.getElementById('allKeys');
  allKeysDiv.innerHTML = '';
  keys.forEach(key => {
      const keyElement = createKeyElement(key);
      allKeysDiv.appendChild(keyElement);
  });
}

function createKeyElement(key) {
  const keyDiv = document.createElement('div');
  keyDiv.className = 'api-key';
  
  const nameSpan = document.createElement('span');
  nameSpan.className = 'api-key-name';
  nameSpan.textContent = key.name;
  keyDiv.appendChild(nameSpan);

  keyDiv.appendChild(document.createElement('br'));

  const valueSpan = document.createElement('span');
  valueSpan.className = 'api-key-value';
  valueSpan.textContent = `${key.key.substr(0, 8)}...`;
  keyDiv.appendChild(valueSpan);

  const feedbackSpan = document.createElement('span');
  feedbackSpan.className = 'copy-feedback';
  feedbackSpan.textContent = 'Copied!';
  keyDiv.appendChild(feedbackSpan);

  const deleteButton = document.createElement('button');
  deleteButton.className = 'delete-key';
  deleteButton.textContent = 'X';
  deleteButton.addEventListener('click', (e) => {
      e.stopPropagation();  // Prevent the copy action
      deleteApiKey(key.id);
  });
  keyDiv.appendChild(deleteButton);

  keyDiv.addEventListener('click', () => {
      copyToClipboard(key.key, feedbackSpan);
      trackKeyUsage(key.id);
  });

  return keyDiv;
}

function copyToClipboard(text, feedbackElement) {
  navigator.clipboard.writeText(text).then(() => {
      feedbackElement.style.display = 'inline';
      setTimeout(() => {
          feedbackElement.style.display = 'none';
      }, 2000);
  }, (err) => {
      console.error('Could not copy text: ', err);
  });
}

function trackKeyUsage(keyId) {
  chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      const currentUrl = tabs[0].url;
      chrome.runtime.sendMessage({action: "trackUsage", keyId: keyId, url: currentUrl});
  });
}

function deleteApiKey(keyId) {
  if (confirm('Are you sure you want to delete this API key?')) {
      chrome.runtime.sendMessage({action: "deleteApiKey", keyId: keyId}, function(response) {
          if (response.success) {
              loadAndDisplayKeys();
          } else {
              alert('Failed to delete API key. Please try again.');
          }
      });
  }
}

document.getElementById('showAllKeys').addEventListener('click', function() {
  const allKeysDiv = document.getElementById('allKeys');
  allKeysDiv.style.display = allKeysDiv.style.display === 'none' ? 'block' : 'none';
  this.textContent = allKeysDiv.style.display === 'none' ? 'Show All Keys' : 'Hide All Keys';
});

document.getElementById('showAddKeyForm').addEventListener('click', function() {
  const addKeyForm = document.getElementById('addKeyForm');
  addKeyForm.style.display = addKeyForm.style.display === 'none' ? 'block' : 'none';
  this.textContent = addKeyForm.style.display === 'none' ? 'Add New API Key' : 'Cancel';
});

document.getElementById('addKey').addEventListener('click', function() {
  const keyName = document.getElementById('keyName').value;
  const keyValue = document.getElementById('keyValue').value;
  
  if (keyName && keyValue) {
      chrome.runtime.sendMessage({
          action: "addApiKey",
          name: keyName,
          key: keyValue
      }, function(response) {
          if (response.success) {
              document.getElementById('keyName').value = '';
              document.getElementById('keyValue').value = '';
              document.getElementById('addKeyForm').style.display = 'none';
              document.getElementById('showAddKeyForm').textContent = 'Add New API Key';
              loadAndDisplayKeys();
          } else {
              alert('Failed to add API key. Please try again.');
          }
      });
  } else {
      alert('Please enter both a name and value for the API key.');
  }
});

// Update API key ranking when popup is opened
chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
  const currentUrl = tabs[0].url;
  chrome.runtime.sendMessage({action: "updateRanking", url: currentUrl});
});

// Initial load
loadAndDisplayKeys();