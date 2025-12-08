/**
 * Offline Queue Manager
 * Stores failed save operations and retries them when network is restored
 * Items persist indefinitely until successfully synced
 */

interface QueueItem {
    id: string;
    timestamp: number;
    data: any;
    retryCount: number;
}

const QUEUE_KEY = 'sba-offline-queue';

class OfflineQueueManager {
    private queue: QueueItem[] = [];

    constructor() {
        this.loadQueue();
    }

    /**
     * Load queue from localStorage
     */
    private loadQueue() {
        try {
            const stored = localStorage.getItem(QUEUE_KEY);
            this.queue = stored ? JSON.parse(stored) : [];
        } catch (error) {
            console.error('Failed to load offline queue:', error);
            this.queue = [];
        }
    }

    /**
     * Save queue to localStorage
     */
    private saveQueue() {
        try {
            localStorage.setItem(QUEUE_KEY, JSON.stringify(this.queue));
        } catch (error) {
            console.error('Failed to save offline queue:', error);
        }
    }

    /**
     * Add item to queue
     */
    addToQueue(data: any): string {
        const item: QueueItem = {
            id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            timestamp: Date.now(),
            data,
            retryCount: 0,
        };

        this.queue.push(item);
        this.saveQueue();
        console.log(`Added item to offline queue. Queue size: ${this.queue.length}`);
        return item.id;
    }

    /**
     * Get queue size
     */
    getQueueSize(): number {
        return this.queue.length;
    }

    /**
     * Get all queue items
     */
    getQueue(): QueueItem[] {
        return [...this.queue];
    }

    /**
     * Process queue with provided save function
     * Items persist until successfully synced - no retry limit
     * Returns true if all items processed successfully
     */
    async processQueue(saveFn: (data: any) => Promise<void>): Promise<boolean> {
        if (this.queue.length === 0) return true;

        console.log(`Processing offline queue (${this.queue.length} items)...`);
        const itemsToProcess = [...this.queue];
        let allSuccess = true;

        for (const item of itemsToProcess) {
            try {
                await saveFn(item.data);
                // Success - remove from queue
                this.queue = this.queue.filter(i => i.id !== item.id);
                console.log(`Successfully processed queue item ${item.id}`);
            } catch (error) {
                console.error(`Failed to process queue item ${item.id}:`, error);

                // Increment retry count for tracking, but don't remove
                const queueItem = this.queue.find(i => i.id === item.id);
                if (queueItem) {
                    queueItem.retryCount++;
                    console.log(`Item ${item.id} will be retried (attempt ${queueItem.retryCount})`);
                }

                allSuccess = false;
            }
        }

        this.saveQueue();
        console.log(`Queue processing complete. Remaining: ${this.queue.length}`);
        return allSuccess;
    }

    /**
     * Clear entire queue
     */
    clearQueue() {
        this.queue = [];
        this.saveQueue();
        console.log('Offline queue cleared');
    }

    /**
     * Remove specific item from queue
     */
    removeItem(id: string) {
        this.queue = this.queue.filter(item => item.id !== id);
        this.saveQueue();
    }
}

// Singleton instance
export const offlineQueue = new OfflineQueueManager();
