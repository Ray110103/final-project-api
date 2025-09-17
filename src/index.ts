import { App } from "./app";
import { initializedWorkers } from "./workers/index";
import { CronService } from "./scripts/reminder";

const main = () => {
  const app = new App();
  // Initialize background workers (BullMQ) and cron jobs
  initializedWorkers();
  new CronService();
  app.start();
};

main();
