import React, { useState, useEffect } from 'react';
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
  ArrowPathIcon,
} from '@heroicons/react/24/outline';
import { knowledgeBaseApi } from '../services/api';
import type { KBArticle } from '../types';

const statusColors: Record<string, string> = {
  published: 'bg-green-100 text-green-700',
  draft: 'bg-yellow-100 text-yellow-700',
  archived: 'bg-gray-100 text-gray-700',
};

const defaultCategories = [
  { id: 'getting-started', name: 'Getting Started' },
  { id: 'billing', name: 'Billing & Payments' },
  { id: 'technical', name: 'Technical Support' },
  { id: 'account', name: 'Account Management' },
  { id: 'integrations', name: 'Integrations' },
  { id: 'api', name: 'API Documentation' },
  { id: 'general', name: 'General' },
];

export const KnowledgeBasePage: React.FC = () => {
  const [articles, setArticles] = useState<KBArticle[]>([]);
  const [categories, setCategories] = useState<{ id: string; name: string; count: number }[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingArticle, setEditingArticle] = useState<KBArticle | null>(null);

  // Form state
  const [formTitle, setFormTitle] = useState('');
  const [formContent, setFormContent] = useState('');
  const [formCategory, setFormCategory] = useState('general');
  const [formTags, setFormTags] = useState('');
  const [saving, setSaving] = useState(false);

  // Fetch data on mount and when filters change
  useEffect(() => {
    fetchData();
  }, [selectedCategory]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [articlesRes, categoriesRes, statsRes] = await Promise.all([
        knowledgeBaseApi.getArticles({ category: selectedCategory || undefined }),
        knowledgeBaseApi.getCategories(),
        knowledgeBaseApi.getStats()
      ]);

      setArticles(articlesRes.data || []);
      setCategories(categoriesRes.data || []);
      setStats(statsRes.data || null);
    } catch (error) {
      console.error('[KB] Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      fetchData();
      return;
    }
    setLoading(true);
    try {
      const result = await knowledgeBaseApi.search(searchQuery, 50);
      setArticles(result.data || []);
    } catch (error) {
      console.error('[KB] Search error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateArticle = async (status: string) => {
    if (!formTitle.trim() || !formContent.trim()) return;

    setSaving(true);
    try {
      const tags = formTags.split(',').map(t => t.trim()).filter(Boolean);

      if (editingArticle) {
        await knowledgeBaseApi.updateArticle(editingArticle.id, {
          title: formTitle,
          content: formContent,
          category: formCategory,
          tags,
          status
        });
      } else {
        await knowledgeBaseApi.createArticle({
          title: formTitle,
          content: formContent,
          category: formCategory,
          tags,
          status
        });
      }

      setShowCreateModal(false);
      setEditingArticle(null);
      resetForm();
      fetchData();
    } catch (error) {
      console.error('[KB] Save error:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteArticle = async (id: string) => {
    if (!confirm('Are you sure you want to delete this article?')) return;

    try {
      await knowledgeBaseApi.deleteArticle(id);
      fetchData();
    } catch (error) {
      console.error('[KB] Delete error:', error);
    }
  };

  const handleEditArticle = (article: KBArticle) => {
    setEditingArticle(article);
    setFormTitle(article.title);
    setFormContent(article.content);
    setFormCategory(article.category);
    setFormTags(article.tags?.join(', ') || '');
    setShowCreateModal(true);
  };

  const resetForm = () => {
    setFormTitle('');
    setFormContent('');
    setFormCategory('general');
    setFormTags('');
    setEditingArticle(null);
  };

  const filteredArticles = articles.filter(article => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      article.title.toLowerCase().includes(query) ||
      article.tags?.some(t => t.toLowerCase().includes(query))
    );
  });

  const displayCategories = categories.length > 0 ? categories : defaultCategories.map(c => ({ ...c, count: 0 }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Knowledge Base</h1>
          <p className="text-gray-500 mt-1">Manage help articles and documentation for AI training</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={fetchData}
            className="px-3 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 flex items-center gap-2"
          >
            <ArrowPathIcon className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={() => { resetForm(); setShowCreateModal(true); }}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 flex items-center gap-2"
          >
            <PlusIcon className="w-5 h-5" />
            New Article
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="relative flex gap-2">
        <div className="relative flex-1">
          <MagnifyingGlassIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search articles by title or tags..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            className="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 bg-white"
          />
        </div>
        <button
          onClick={handleSearch}
          className="px-6 py-3 bg-gray-100 hover:bg-gray-200 rounded-xl"
        >
          Search
        </button>
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
                <span className="text-sm">{stats?.totalArticles || articles.length}</span>
              </button>
              {displayCategories.map(cat => (
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
                  <span className="text-sm">{cat.count || 0}</span>
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
                <span className="font-medium">{stats?.totalArticles || 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Published</span>
                <span className="font-medium text-green-600">{stats?.published || 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Drafts</span>
                <span className="font-medium text-yellow-600">{stats?.drafts || 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Total Views</span>
                <span className="font-medium">{stats?.totalViews?.toLocaleString() || 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Helpful Rate</span>
                <span className="font-medium text-green-600">{stats?.helpfulRate || 0}%</span>
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
                  ? displayCategories.find(c => c.id === selectedCategory)?.name
                  : 'All Articles'}
                {' '}
                <span className="text-gray-500 font-normal">({filteredArticles.length})</span>
              </h2>
            </div>

            {loading ? (
              <div className="p-8 text-center text-gray-500">
                <ArrowPathIcon className="w-8 h-8 animate-spin mx-auto mb-2" />
                Loading articles...
              </div>
            ) : filteredArticles.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <DocumentTextIcon className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>No articles found</p>
                <button
                  onClick={() => { resetForm(); setShowCreateModal(true); }}
                  className="mt-4 text-primary-600 hover:text-primary-700"
                >
                  Create your first article
                </button>
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
                            <h3
                              className="font-medium text-gray-900 hover:text-primary-600 cursor-pointer"
                              onClick={() => handleEditArticle(article)}
                            >
                              {article.title}
                            </h3>
                            <span className={`px-2 py-0.5 text-xs rounded-full ${statusColors[article.status] || 'bg-gray-100 text-gray-800'}`}>
                              {article.status}
                            </span>
                          </div>
                          <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
                            <span className="capitalize">{article.category?.replace('-', ' ') || 'general'}</span>
                            <span>By {article.author || 'Unknown'}</span>
                            <span>Updated {new Date(article.updatedAt).toLocaleDateString()}</span>
                          </div>
                          <div className="flex items-center gap-2 mt-2">
                            {article.tags?.map(tag => (
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
                            <span className="text-sm">{(article.views || 0).toLocaleString()}</span>
                          </div>
                        </div>
                        <div className="text-center">
                          <div className="flex items-center gap-1 text-green-600">
                            <HandThumbUpIcon className="w-4 h-4" />
                            <span className="text-sm">{article.helpful || 0}</span>
                          </div>
                        </div>
                        <div className="text-center">
                          <div className="flex items-center gap-1 text-red-500">
                            <HandThumbDownIcon className="w-4 h-4" />
                            <span className="text-sm">{article.notHelpful || 0}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleEditArticle(article)}
                            className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-lg"
                          >
                            <PencilSquareIcon className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteArticle(article.id)}
                            className="p-1.5 text-gray-500 hover:bg-red-50 hover:text-red-500 rounded-lg"
                          >
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

      {/* Create/Edit Article Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-semibold text-gray-900">
                {editingArticle ? 'Edit Article' : 'Create Article'}
              </h2>
              <button
                onClick={() => { setShowCreateModal(false); resetForm(); }}
                className="text-gray-500 hover:text-gray-700 text-2xl"
              >
                ×
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
                <input
                  type="text"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500"
                  placeholder="Enter article title"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                <select
                  value={formCategory}
                  onChange={(e) => setFormCategory(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500"
                >
                  {defaultCategories.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Content *</label>
                <textarea
                  rows={12}
                  value={formContent}
                  onChange={(e) => setFormContent(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 font-mono text-sm"
                  placeholder="Write your article content (Markdown supported)..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tags (comma separated)</label>
                <input
                  type="text"
                  value={formTags}
                  onChange={(e) => setFormTags(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500"
                  placeholder="e.g., billing, payments, refund"
                />
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <button
                  onClick={() => { setShowCreateModal(false); resetForm(); }}
                  className="px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50"
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleCreateArticle('draft')}
                  className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50"
                  disabled={saving || !formTitle.trim() || !formContent.trim()}
                >
                  {saving ? 'Saving...' : 'Save as Draft'}
                </button>
                <button
                  onClick={() => handleCreateArticle('published')}
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
                  disabled={saving || !formTitle.trim() || !formContent.trim()}
                >
                  {saving ? 'Publishing...' : 'Publish'}
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
