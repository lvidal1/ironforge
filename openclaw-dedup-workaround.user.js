// ==UserScript==
// @name         OpenClaw Duplicate Message Fix
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Fixes duplicate assistant messages in OpenClaw Control UI by deduplicating at the DOM level
// @author       You
// @match        http://localhost:18789/*
// @match        http://127.0.0.1:18789/*
// @grant        none
// @run-at       document-end
// ==/UserScript==

(function () {
  'use strict';

  // Track text content hashes of assistant messages to detect duplicates
  const seenMessages = new Map();
  const MESSAGE_SELECTOR = '.chat-message--assistant, [data-role="assistant"]';

  // Debounce function to avoid excessive processing
  function debounce(fn, delay) {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), delay);
    };
  }

  // Get a hash of message content for comparison
  function getContentHash(element) {
    // Get the text content of the message
    const textContent = element.textContent?.trim().replace(/\s+/g, ' ');
    if (!textContent) return null;
    // Simple hash
    let hash = 0;
    for (let i = 0; i < textContent.length; i++) {
      const char = textContent.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return `${hash}:${textContent.slice(0, 100)}`;
  }

  // Check if an element is a streaming/typing indicator (not a real message)
  function isStreamingIndicator(element) {
    const classes = element.className || '';
    return classes.includes('streaming') ||
           classes.includes('typing') ||
           classes.includes('loading') ||
           classes.includes('cursor') ||
           element.getAttribute('aria-busy') === 'true' ||
           element.querySelector('.streaming-cursor, .typing-indicator') !== null;
  }

  // Check if element is an invisible/filter-out message
  function isInvisibleMessage(element) {
    // Check for empty or single-character messages
    const text = element.textContent?.trim();
    if (!text || text.length <= 1) return true;
    // Check for heartbeat messages
    if (text.includes('HEARTBEAT_OK')) return true;
    return false;
  }

  // Deduplicate messages in the DOM
  function deduplicateMessages() {
    const messages = document.querySelectorAll(MESSAGE_SELECTOR);
    const toRemove = [];

    for (const msg of messages) {
      if (isStreamingIndicator(msg)) continue;
      if (isInvisibleMessage(msg)) continue;

      const hash = getContentHash(msg);
      if (!hash) continue;

      if (seenMessages.has(hash)) {
        toRemove.push(msg);
      } else {
        seenMessages.set(hash, msg);
      }
    }

    // Remove duplicates (keep the first occurrence)
    for (const msg of toRemove) {
      try {
        // Fade out before removing
        msg.style.transition = 'opacity 0.3s ease';
        msg.style.opacity = '0';
        setTimeout(() => {
          if (msg.parentNode) {
            msg.parentNode.removeChild(msg);
          }
        }, 300);
      } catch (e) {
        // Ignore removal errors
      }
    }
  }

  // Observer callback for DOM changes
  const debouncedDedup = debounce(deduplicateMessages, 500);

  // Set up MutationObserver to watch for new messages
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.addedNodes.length > 0) {
        debouncedDedup();
      }
    }
  });

  // Start observing the chat area
  function startObserving() {
    const chatArea = document.querySelector('.chat-messages, .chat__messages, [data-testid="chat-messages"]');
    if (!chatArea) {
      // Try harder to find the chat area
      const allElements = document.querySelectorAll('*');
      for (const el of allElements) {
        if (el.children?.length > 3 && el.querySelector(MESSAGE_SELECTOR)) {
          observer.observe(el, { childList: true, subtree: true });
          break;
        }
      }
    } else {
      observer.observe(chatArea, { childList: true, subtree: true });
    }
  }

  // Try to start observing immediately
  startObserving();

  // Re-try if not found (handles lazy loading)
  let retryCount = 0;
  const retryInterval = setInterval(() => {
    retryCount++;
    if (retryCount > 10) {
      clearInterval(retryInterval);
      return;
    }
    const observerInstance = observer;
    if (observerInstance._observerConnected === false) {
      startObserving();
    }
  }, 1000);

  // Also run dedup on a regular interval as a safety net
  setInterval(() => {
    deduplicateMessages();
  }, 2000);

  // Clean up seen messages periodically (every 30 seconds) to prevent memory leaks
  setInterval(() => {
    seenMessages.clear();
  }, 30000);

  console.log('[OpenClaw Dedup] Duplicate message fix active');
})();
