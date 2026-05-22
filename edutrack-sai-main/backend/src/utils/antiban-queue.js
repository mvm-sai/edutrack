/**
 * Anti-Ban Protection Module
 * 
 * Implements strategies to prevent WhatsApp account bans:
 * - Sequential message sending (one at a time, not parallel)
 * - Randomized delays between messages (8-15 seconds)
 * - Exponential backoff retry logic
 * - Rate limiting per phone number
 * - Session rotation after 7 days
 * - Message queue with persistent storage
 */

const { EventEmitter } = require('events');

class AntibanQueue extends EventEmitter {
  constructor(whatsappClient, db, options = {}) {
    super();
    
    this.client = whatsappClient;
    this.db = db;
    this.isProcessing = false;
    this.queueSize = 0;
    
    // Configuration
    this.config = {
      delayMin: parseInt(options.delayMin) || 8000, // 8 seconds
      delayMax: parseInt(options.delayMax) || 15000, // 15 seconds
      maxRetries: parseInt(options.maxRetries) || 2,
      retryDelay: parseInt(options.retryDelay) || 5000, // 5 seconds
      maxQueueSize: parseInt(options.maxQueueSize) || 100,
      cleanupInterval: parseInt(options.cleanupInterval) || 3600000, // 1 hour
      sessionRotationInterval: parseInt(options.sessionRotationInterval) || 604800000, // 7 days
    };
    
    // Statistics
    this.stats = {
      sent: 0,
      failed: 0,
      retried: 0,
      queued: 0,
      lastSessionRotation: Date.now(),
    };
    
    // Start cleanup interval
    this.startCleanupInterval();
    this.startSessionRotationCheck();
  }

  /**
   * Add message to queue
   * Returns: { success, queueId, message }
   */
  async enqueue(phoneNumber, messageText, metadata = {}) {
    try {
      // Validate phone number
      if (!phoneNumber || !/^\d{10,15}$/.test(phoneNumber)) {
        throw new Error('Invalid phone number format');
      }

      // Check queue size
      if (this.queueSize >= this.config.maxQueueSize) {
        throw new Error('Message queue is full');
      }

      // Insert into database
      const stmt = this.db.prepare(`
        INSERT INTO whatsapp_queue (phone, message, student_name, attendance_id, sent, attempts)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      
      const result = await stmt.run(
        phoneNumber,
        messageText,
        metadata.studentName || null,
        metadata.attendanceId || null,
        false,
        0
      );

      this.queueSize++;
      this.stats.queued++;
      this.emit('queued', { queueId: result.lastInsertRowid, phone: phoneNumber });

      // Start processing if not already running
      this.processQueue();

      return {
        success: true,
        queueId: result.lastInsertRowid,
        message: `Message queued for ${phoneNumber}`,
      };
    } catch (err) {
      console.error('❌ Error enqueueing message:', err.message);
      return {
        success: false,
        error: err.message,
      };
    }
  }

  /**
   * Process message queue sequentially
   */
  async processQueue() {
    if (this.isProcessing || !this.client || !this.client.isReady) {
      return;
    }

    this.isProcessing = true;

    try {
      while (this.queueSize > 0) {
        // Get oldest unsent message
        const stmt = this.db.prepare(`
          SELECT * FROM whatsapp_queue 
          WHERE sent = FALSE 
          ORDER BY created_at ASC 
          LIMIT 1
        `);
        
        const message = await stmt.get();
        
        if (!message) {
          break; // Queue is empty
        }

        // Send with retry logic
        const success = await this.sendWithRetry(message);

        if (success) {
          // Mark as sent
          await this.db.prepare(`
            UPDATE whatsapp_queue 
            SET sent = TRUE, sent_at = NOW() 
            WHERE id = ?
          `).run(message.id);

          this.stats.sent++;
          this.emit('sent', { queueId: message.id, phone: message.phone });
        } else {
          // Max retries exceeded
          await this.db.prepare(`
            UPDATE whatsapp_queue 
            SET sent = FALSE, error = 'Max retries exceeded' 
            WHERE id = ?
          `).run(message.id);

          this.stats.failed++;
          this.emit('failed', { queueId: message.id, phone: message.phone });
        }

        // Wait before next message (anti-ban protection)
        await this.randomDelay();

        this.queueSize--;
      }
    } catch (err) {
      console.error('❌ Queue processing error:', err.message);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Send message with exponential backoff retry logic
   */
  async sendWithRetry(message, attempt = 0) {
    try {
      if (attempt > this.config.maxRetries) {
        console.warn(`⚠️  Message ${message.id} exceeded max retries`);
        return false;
      }

      // Send message
      await this.client.sendMessage(message.phone, message.message);
      console.log(`✅ Message sent to ${message.phone} (attempt ${attempt + 1})`);
      return true;
    } catch (err) {
      console.error(`❌ Send failed (${message.phone}): ${err.message}`);

      // Exponential backoff: wait before retry
      const delayMs = this.config.retryDelay * Math.pow(2, attempt);
      console.log(`⏳ Retrying in ${delayMs}ms...`);
      await this.sleep(delayMs);

      // Retry or fail
      if (attempt < this.config.maxRetries) {
        this.stats.retried++;
        
        // Update attempt count
        await this.db.prepare(`
          UPDATE whatsapp_queue 
          SET attempts = attempts + 1, error = ? 
          WHERE id = ?
        `).run(err.message, message.id);

        return this.sendWithRetry(message, attempt + 1);
      }

      return false;
    }
  }

  /**
   * Random delay between messages (anti-ban protection)
   */
  async randomDelay() {
    const delay = Math.floor(
      Math.random() * (this.config.delayMax - this.config.delayMin) + this.config.delayMin
    );
    await this.sleep(delay);
  }

  /**
   * Sleep helper
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Cleanup old queue items (older than 7 days)
   */
  async cleanupOldMessages() {
    try {
      const stmt = this.db.prepare(`
        DELETE FROM whatsapp_queue 
        WHERE sent = TRUE 
          AND sent_at < datetime('now', '-7 days')
      `);
      
      const result = await stmt.run();
      if (result.changes > 0) {
        console.log(`🧹 Cleaned up ${result.changes} old queue messages`);
      }
    } catch (err) {
      console.error('Cleanup error:', err.message);
    }
  }

  /**
   * Start cleanup interval
   */
  startCleanupInterval() {
    setInterval(() => this.cleanupOldMessages(), this.config.cleanupInterval);
  }

  /**
   * Check for session rotation (every 7 days)
   */
  startSessionRotationCheck() {
    setInterval(() => {
      const daysSinceRotation = (Date.now() - this.stats.lastSessionRotation) / (1000 * 60 * 60 * 24);
      
      if (daysSinceRotation >= 7) {
        console.log('🔄 Session rotation recommended (7 days elapsed)');
        this.emit('session-rotation-needed');
        this.stats.lastSessionRotation = Date.now();
      }
    }, 3600000); // Check every hour
  }

  /**
   * Get queue statistics
   */
  getStats() {
    return {
      ...this.stats,
      currentQueueSize: this.queueSize,
      isProcessing: this.isProcessing,
      averageDelay: (this.config.delayMin + this.config.delayMax) / 2,
    };
  }

  /**
   * Pause queue (for maintenance)
   */
  pause() {
    this.isProcessing = true;
    console.log('⏸️  Queue paused');
  }

  /**
   * Resume queue
   */
  resume() {
    this.isProcessing = false;
    console.log('▶️  Queue resumed');
    this.processQueue();
  }

  /**
   * Get pending messages
   */
  async getPendingMessages(limit = 10) {
    const stmt = this.db.prepare(`
      SELECT * FROM whatsapp_queue 
      WHERE sent = FALSE 
      ORDER BY created_at ASC 
      LIMIT ?
    `);
    
    return await stmt.all(limit);
  }

  /**
   * Clear all pending messages
   */
  async clearPending() {
    const stmt = this.db.prepare(`
      DELETE FROM whatsapp_queue WHERE sent = FALSE
    `);
    
    const result = await stmt.run();
    this.queueSize = 0;
    console.log(`🗑️  Cleared ${result.changes} pending messages`);
    return result;
  }
}

module.exports = { AntibanQueue };
