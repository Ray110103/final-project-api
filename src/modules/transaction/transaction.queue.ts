// /Transaction/transaction.queue.ts
import { Queue } from "bullmq";
import { connection } from "../../config/redis";

export class TransactionQueue {
  removeTransactionQueue(uuid: string) {
    throw new Error("Method not implemented.");
  }
  private queue: Queue;
  private reminderQueue: Queue;
  
  constructor() {
    this.queue = new Queue("transactionQueue", { connection });
    this.reminderQueue = new Queue("reminderQueue", { connection });
  }

  // Add transaction to expiration queue
  addNewTransactionQueue = async (uuid: string) => {
    return await this.queue.add(
      "newTransaction",
      { uuid },
      {
        jobId: uuid,
        delay: 60 * 60 * 1000, // 1 hour
        attempts: 3,
        removeOnComplete: true,
        backoff: { type: "exponential", delay: 1000 },
      }
    );
  };

  // Add reminder to queue
  addReminderQueue = async (uuid: string, date: Date) => {
    return await this.reminderQueue.add(
      "reminder",
      { uuid },
      {
        jobId: `reminder-${uuid}`,
        delay: date.getTime() - Date.now(),
        attempts: 3,
        removeOnComplete: true,
        backoff: { type: "exponential", delay: 1000 },
      }
    );
  };
}