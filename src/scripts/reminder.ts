import cron from 'node-cron';
import { PrismaService } from '../modules/prisma/prisma.service';
import { MailService } from '../modules/mail/mail.service';

export class CronService {
  private prisma: PrismaService;
  private mailService: MailService;
  
  constructor() {
    this.prisma = new PrismaService();
    this.mailService = new MailService();
    this.initCronJobs();
  }

  private initCronJobs() {
    // Run every day at 8 AM
    cron.schedule('0 8 * * *', async () => {
      await this.sendCheckinReminders();
    });
  }

  private async sendCheckinReminders() {
    try {
      // Get tomorrow's date
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);
      
      // Get the day after tomorrow (to get the full day of tomorrow)
      const dayAfterTomorrow = new Date(tomorrow);
      dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 1);

      // Find all transactions that are PAID and start tomorrow
      const transactions = await this.prisma.transaction.findMany({
        where: {
          status: 'PAID',
          startDate: {
            gte: tomorrow,
            lt: dayAfterTomorrow
          }
        },
        include: {
          user: true,
          room: {
            include: {
              property: true
            }
          }
        }
      });

      // Send an email for each transaction
      for (const transaction of transactions) {
        const context = {
          userName: transaction.user.name,
          propertyName: transaction.room.property.title,
          roomName: transaction.room.name,
          startDate: transaction.startDate,
          endDate: transaction.endDate,
          propertyAddress: transaction.room.property.address,
          checkInTime: "14:00", // Standard check-in time
          checkOutTime: "12:00", // Standard check-out time
          contactInfo: transaction.room.property.tenantId, // Could be enhanced with tenant contact details
          // Add any other relevant details
        };

        await this.mailService.sendMail(
          transaction.user.email,
          'Reminder: Check-in Tomorrow',
          'checkin-reminder',
          context
        );
      }
    } catch (error) {
      console.error('Error sending check-in reminders:', error);
    }
  }
}