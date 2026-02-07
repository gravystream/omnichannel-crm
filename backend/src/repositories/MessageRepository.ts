// Stub file for MessageRepository
export class MessageRepository {
  async findByConversationId(conversationId: string): Promise<any[]> {
    return [];
  }

  async create(data: any): Promise<any> {
    return data;
  }

  async findById(id: string): Promise<any> {
    return null;
  }
}

export const messageRepository = new MessageRepository();
export default messageRepository;
