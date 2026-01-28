import React, { useState } from 'react';
import {
  MagnifyingGlassIcon,
  PlusIcon,
  FolderIcon,
  DocumentTextIcon,
  PencilSquareIcon,
  TrashIcon,
  EyeIcon,
  HandThumbUpIcon,
  HandThumbDownIcon,
} from '@heroicons/react/24/outline';
import type { KBArticle } from '../types';

const categories = [
  { id: 'getting-started', name: 'Getting Started', count: 12 },
  { id: 'billing', name: 'Billing & Payments', count: 8 },
  { id: 'technical', name: 'Technical Support', count: 15 },
  { id: 'account', name: 'Account Management', count: 6 },
  { id: 'integrations', name: 'Integrations', count: 9 },
  { id: 'api', name: 'API Documentation', count: 11 },
];

const mockArticles: KBArticle[] = [
  {
    id: 'kb_1', title: 'How to reset your password', content: '...',
    category: 'account', tags: ['password', 'security', 'login'],
    status: 'published', author: 'John Doe', views: 1234, helpful: 89, notHelpful: 5,
    createdAt: new Date(Date.now() - 30 * 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 7 * 86400000).toISOString(),
  },
  {
    id: 'kb_2', title: 'Understanding your billing cycle', content: '...',
    category: 'billing', tags: ['billing', 'payments', 'subscription'],
    status: 'published', author: 'Jane Smith', views: 856, helpful: 67, notHelpful: 12,
    createdAt: new Date(Date.now() - 60 * 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 14 * 86400000).toISOString(),
  },
  {
    id: 'kb_3', title: 'Connecting to the API', content: '...',
    category: 'api', tags: ['api', 'integration', 'developers'],
    status: 'published', author: 'Mike Johnson', views: 2341, helpful: 156, notHelpful: 8,
    createdAt: new Date(Date.now() - 90 * 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 3 * 86400000).toISOString(),
  },
  {
    id: 'kb_4', title: 'Troubleshooting common errors', content: '...',
    category: 'technical', tags: ['errors', 'troubleshooting', 'support'],
    status: 'published', author: 'Sarah Wilson', views: 1567, helpful: 98, notHelpful: 15,
    createdAt: new Date(Date.now() - 45 * 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 1 * 86400000).toISOString(),
  },
  {
    id: 'kb_5', title: 'Getting started with webhooks', content: '...',
    category: 'integrations', tags: ['webhooks', 'integration', 'automation'],
    status: 'draft', author: 'John Doe', views: 0, helpful: 0, notHelpful: 0,
    createdAt: new Date(Date.now() - 2 * 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 86400000).toISOString(),
  },
];

const statusColors: Record<string, string> = {
  published: 'bg-green-100 text-green-700',
  draft: 'bg-yellow-100 text-yellow-700',
  archived: 'bg-gray-100 text-gray-700',
};

export const KnowledgeBasePage: React.FC = () => {
  const [articles, setArticles] = useState(mockArticles);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const filteredArticles = articles.filter(article => {
    const matchesSearch = !searchQuery ||
      article.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      article.tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesCategory = !selectedCategory || article.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Knowledge Base</h1>
          <p className="text-gray-500 mt-1">Manage help articles and documentation</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 flex items-center gap-2"
        >
          <PlusIcon className="w-5 h-5" />
          New Article
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <MagnifyingGlassIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          type="text"
          placeholder="Search articles by title or tags..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 bg-white"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Categories Sidebar */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
            <h2 className="font-semibold text-gray-900 mb-4">Categories</h2>
            <div className="space-y-1">
              <button
                onClick={() => setSelectedCategory(null)}
                className={`w-full text-left px-3 py-2 rounded-lg flex items-center justify-between ${
                  !selectedCategory ? 'bg-primary-50 text-primary-700' : 'hover:bg-gray-50 text-gray-700'
                }`}
              >
                <span className="flex items-center gap-2">
                  <FolderIcon className="w-5 h-5" />
                  All Articles
                </span>
                <span className="text-sm">{articles.length}</span>
              </button>
              {categories.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`w-full text-left px-3 py-2 rounded-lg flex items-center justify-between ${
                    selectedCategory === cat.id ? 'bg-primary-50 text-primary-700' : 'hover:bg-gray-50 text-gray-700'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <FolderIcon className="w-5 h-5" />
                    {cat.name}
                  </span>
                  <span className="text-sm">{cat.count}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Quick Stats */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mt-4">
            <h2 className="font-semibold text-gray-900 mb-4">Statistics</h2>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-500">Total Articles</span>
                <span className="font-medium">{articles.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Published</span>
                <span className="font-medium text-green-600">
                  {articles.filter(a => a.status === 'published').length}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Drafts</span>
                <span className="font-medium text-yellow-600">
                  {articles.filter(a => a.status === 'draft').length}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Total Views</span>
                <span className="font-medium">{articles.reduce((a, b) => a + b.views, 0).toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Articles List */}
        <div className="lg:col-span-3">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-semibold text-gray-900">
                {selectedCategory
                  ? categories.find(c => c.id === selectedCategory)?.name
                  : 'All Articles'}
                {' '}
                <span className="text-gray-500 font-normal">({filteredArticles.length})</span>
              </h2>
              <select className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm">
                <option>Sort by: Recent</option>
                <option>Sort by: Views</option>
                <option>Sort by: Helpful</option>
              </select>
            </div>

            {filteredArticles.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                No articles found
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {filteredArticles.map(article => (
                  <div key={article.id} className="p-4 hover:bg-gray-50 transition-colors">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3 flex-1">
                        <DocumentTextIcon className="w-5 h-5 text-gray-400 mt-0.5" />
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h3 className="font-medium text-gray-900 hover:text-primary-600 cursor-pointer">
                              {article.title}
                            </h3>
                            <span className={`px-2 py-0.5 text-xs rounded-full ${(statusColors[article.status] || "bg-gray-100 text-gray-800")}`}>
                              {article.status}
                            </span>
                          </div>
                          <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
                            <span className="capitalize">{article.category.replace('-', ' ')}</span>
                            <span>By {article.author}</span>
                            <span>Updated {new Date(article.updatedAt).toLocaleDateString()}</span>
                          </div>
                          <div className="flex items-center gap-2 mt-2">
                            {article.tags.map(tag => (
                              <span key={tag} className="px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded">
                                {tag}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 ml-4">
                        <div className="text-center">
                          <div className="flex items-center gap-1 text-gray-500">
                            <EyeIcon className="w-4 h-4" />
                            <span className="text-sm">{article.views.toLocaleString()}</span>
                          </div>
                        </div>
                        <div className="text-center">
                          <div className="flex items-center gap-1 text-green-600">
                            <HandThumbUpIcon className="w-4 h-4" />
                            <span className="text-sm">{article.helpful}</span>
                          </div>
                        </div>
                        <div className="text-center">
                          <div className="flex items-center gap-1 text-red-500">
                            <HandThumbDownIcon className="w-4 h-4" />
                            <span className="text-sm">{article.notHelpful}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <button className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-lg">
                            <PencilSquareIcon className="w-4 h-4" />
                          </button>
                          <button className="p-1.5 text-gray-500 hover:bg-red-50 hover:text-red-500 rounded-lg">
                            <TrashIcon className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Create Article Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-semibold text-gray-900">Create Article</h2>
              <button onClick={() => setShowCreateModal(false)} className="text-gray-500 hover:text-gray-700 text-2xl">
                ×
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                <input
                  type="text"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500"
                  placeholder="Enter article title"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                <select className="w-full border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500">
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Content</label>
                <textarea
                  rows={10}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500"
                  placeholder="Write your article content (Markdown supported)..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tags (comma separated)</label>
                <input
                  type="text"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500"
                  placeholder="e.g., billing, payments, refund"
                />
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700">
                  Save as Draft
                </button>
                <button className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700">
                  Publish
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default KnowledgeBasePage;
