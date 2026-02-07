// Stub file for KnowledgeBaseService
export class KnowledgeBaseService {
  async search(query: string): Promise<any[]> {
    return [];
  }

  async getArticle(id: string): Promise<any> {
    return null;
  }
}

export const knowledgeBaseService = new KnowledgeBaseService();
export default knowledgeBaseService;
