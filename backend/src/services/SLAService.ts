// Stub file for SLAService
export class SLAService {
  async checkSLA(conversationId: string): Promise<any> {
    return { breached: false };
  }

  async updateSLA(conversationId: string, data: any): Promise<any> {
    return data;
  }
}

export const slaService = new SLAService();
export default slaService;
