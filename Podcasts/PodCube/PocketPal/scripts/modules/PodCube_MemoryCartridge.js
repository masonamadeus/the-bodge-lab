/**
 * PodCube_MemoryCartridge
 * Provides persistent storage functionality for the PodCube application.
 * 
 * Responsibilities:
 * - Provides simple get/set interface for data storage
 * - Handles serialization/deserialization
 * - Manages cache expiration
 * - Follows naming conventions for stored data
 */
export class MemoryCartridge {
    constructor() {
        this.prefix = 'podcube_';  // Namespace our storage keys
        this.defaultTTL = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
        this.db = null;
        this.dbName = 'PodCubeDB';
        this.storeName = 'binaryData';
        this.initDB();
    }

    /**
     * Initialize IndexedDB for binary storage
     */
    async initDB() {
        try {
            const request = indexedDB.open(this.dbName, 1);
            
            request.onerror = (event) => {
                console.error("MemoryCartridge: Error opening DB:", event.target.error);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains(this.storeName)) {
                    db.createObjectStore(this.storeName, { keyPath: 'id' });
                }
            };

            request.onsuccess = (event) => {
                this.db = event.target.result;
                console.log("MemoryCartridge: DB initialized successfully");
                PodCube.MSG.publish('MemoryCartridge-Ready');
            };
        } catch (error) {
            console.error("MemoryCartridge: Failed to initialize DB:", error);
        }
    }

    // Regular localStorage methods
    
    /**
     * Store data in localStorage
     * @param {string} key - Storage key
     * @param {*} data - JSON-serializable data to store
     * @param {number} [ttl] - Time to live in milliseconds
     */
    save(key, data, ttl = this.defaultTTL) {
        const storageKey = this.prefix + key;
        const storageData = {
            data,
            timestamp: Date.now(),
            expires: Date.now() + ttl
        };
        
        try {
            localStorage.setItem(storageKey, JSON.stringify(storageData));
            PodCube.MSG.publish('MemoryCartridge-Saved', { key });
        } catch (error) {
            console.error(`MemoryCartridge: Failed to save ${key}:`, error);
            throw error;
        }
    }

    /**
     * Load data from localStorage
     * @param {string} key - Storage key
     * @returns {*} Stored data or null if expired/not found
     */
    load(key) {
        const storageKey = this.prefix + key;
        try {
            const stored = localStorage.getItem(storageKey);
            if (!stored) return null;

            const { data, expires } = JSON.parse(stored);
            
            if (Date.now() > expires) {
                this.delete(key);
                return null;
            }

            PodCube.MSG.publish('MemoryCartridge-Loaded', { key });
            return data;
        } catch (error) {
            console.error(`MemoryCartridge: Failed to load ${key}:`, error);
            return null;
        }
    }    /**
     * Get all storage keys
     * @returns {Promise<string[]>} Array of storage keys without prefix
     */
    async getAllKeys() {
        const allKeys = Object.keys(localStorage);
        return allKeys
            .filter(key => key.startsWith(this.prefix))
            .map(key => key.slice(this.prefix.length));
    }

    /**
     * Delete data from localStorage
     * @param {string} key - Storage key
     */
    delete(key) {
        const storageKey = this.prefix + key;
        try {
            localStorage.removeItem(storageKey);
            PodCube.MSG.publish('MemoryCartridge-Deleted', { key });
        } catch (error) {
            console.error(`MemoryCartridge: Failed to delete ${key}:`, error);
        }
    }

    /**
     * Check if data exists and is not expired in localStorage
     * @param {string} key - Storage key
     * @returns {boolean} True if valid data exists
     */
    exists(key) {
        const storageKey = this.prefix + key;
        try {
            const stored = localStorage.getItem(storageKey);
            if (!stored) return false;

            const { expires } = JSON.parse(stored);
            return Date.now() <= expires;
        } catch {
            return false;
        }
    }

    // Binary data methods using IndexedDB
    
    /**
     * Store binary data in IndexedDB
     * @param {string} key - Storage key
     * @param {Blob} blob - Binary data to store
     * @param {number} [ttl] - Time to live in milliseconds
     */
    async saveBlob(key, blob, ttl = this.defaultTTL) {
        if (!this.db) {
            console.warn("MemoryCartridge: DB not ready, waiting...");
            await new Promise(resolve => {
                const checkDB = () => {
                    if (this.db) resolve();
                    else setTimeout(checkDB, 100);
                };
                checkDB();
            });
        }

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);
            
            const record = {
                id: key,
                data: blob,
                timestamp: Date.now(),
                expires: Date.now() + ttl
            };

            const request = store.put(record);
            request.onsuccess = () => {
                PodCube.MSG.publish('MemoryCartridge-Saved', { key });
                resolve();
            };
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Load binary data from IndexedDB
     * @param {string} key - Storage key
     * @returns {Promise<Blob|null>} Stored blob or null if expired/not found
     */
    async loadBlob(key) {
        if (!this.db) return null;

        try {
            const result = await new Promise((resolve, reject) => {
                const transaction = this.db.transaction([this.storeName], 'readonly');
                const store = transaction.objectStore(this.storeName);
                const request = store.get(key);
                
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            });

            if (!result) return null;

            if (Date.now() > result.expires) {
                await this.deleteBlob(key);
                return null;
            }

            PodCube.MSG.publish('MemoryCartridge-Loaded', { key });
            return result.data;
        } catch (error) {
            console.error(`MemoryCartridge: Failed to load blob ${key}:`, error);
            return null;
        }
    }

    /**
     * Delete binary data from IndexedDB
     * @param {string} key - Storage key
     */
    async deleteBlob(key) {
        if (!this.db) return;

        try {
            await new Promise((resolve, reject) => {
                const transaction = this.db.transaction([this.storeName], 'readwrite');
                const store = transaction.objectStore(this.storeName);
                const request = store.delete(key);
                
                request.onsuccess = () => resolve();
                request.onerror = () => reject(request.error);
            });
            PodCube.MSG.publish('MemoryCartridge-Deleted', { key });
        } catch (error) {
            console.error(`MemoryCartridge: Failed to delete blob ${key}:`, error);
            throw error;
        }
    }

    /**
     * Check if binary data exists and is not expired
     * @param {string} key - Storage key
     * @returns {Promise<boolean>} True if valid blob exists
     */
    async blobExists(key) {
        if (!this.db) return false;

        try {
            const result = await new Promise((resolve, reject) => {
                const transaction = this.db.transaction([this.storeName], 'readonly');
                const store = transaction.objectStore(this.storeName);
                const request = store.get(key);
                
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            });

            return result && Date.now() <= result.expires;
        } catch {
            return false;
        }
    }

    /**
     * Clear all PodCube stored data
     */
    async format() {
        // Clear localStorage
        try {
            const keys = Object.keys(localStorage).filter(key => 
                key.startsWith(this.prefix)
            );
            keys.forEach(key => localStorage.removeItem(key));
        } catch (error) {
            console.error('MemoryCartridge: Failed to clear localStorage:', error);
        }

        // Clear IndexedDB
        if (this.db) {
            try {
                await new Promise((resolve, reject) => {
                    const transaction = this.db.transaction([this.storeName], 'readwrite');
                    const store = transaction.objectStore(this.storeName);
                    const request = store.clear();
                    
                    request.onsuccess = () => resolve();
                    request.onerror = () => reject(request.error);
                });
            } catch (error) {
                console.error('MemoryCartridge: Failed to clear IndexedDB:', error);
            }
        }

        PodCube.MSG.publish('MemoryCartridge-Formatted');
    }
}

