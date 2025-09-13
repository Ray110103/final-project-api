import "reflect-metadata"; // 👈 WAJIB PALING ATAS
import { App } from "./app";

const main = () => {
  const app = new App();
  app.start();
};

main();
