import { createTransport, Transporter } from "nodemailer";
import fs from "fs/promises";
import path from "path";
import Handlebars from "handlebars";

export class MailService {
  private transporter: Transporter;

  constructor() {
    this.transporter = createTransport({
      service: "gmail",
      auth: {
        user: process.env.MAIL_USER,
        pass: process.env.MAIL_PASSWORD,
      },
    });
  }

  sendMail = async (
    to: string,
    subject: string,
    templateName: string,
    context: any
  ) => {
    const templateDir = path.resolve(__dirname, "templates");

    const templatePath = path.join(templateDir, `${templateName}.hbs`);

    const templateSource = await fs.readFile(templatePath, "utf-8");

    const compiledTemplate = Handlebars.compile(templateSource);

    const html = compiledTemplate(context);

    await this.transporter.sendMail({
      to,
      subject,
      from: "BlogHub",
      html: html,
    });
  };
}
