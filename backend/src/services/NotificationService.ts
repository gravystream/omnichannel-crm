// Stub file for NotificationService
export class NotificationService {
  async send(userId: string, message: string): Promise<void> {
    console.log(`[NotificationService] ${userId}: ${message}`);
  }

  async sendEmail(to: string, subject: string, body: string): Promise<void> {
    console.log(`[NotificationService] Email to ${to}: ${subject}`);
  }
}

export const notificationService = new NotificationService();
export default notificationService;
