import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  MagnifyingGlassIcon,
  PlusIcon,
  EnvelopeIcon,
  PhoneIcon,
  BuildingOfficeIcon,
  MapPinIcon,
  ChatBubbleLeftRightIcon,
} from '@heroicons/react/24/outline';
import { customersApi } from '../services/api';
import type { Customer } from '../types';

const slaTierColors: Record<string, string> = {
  standard: 'bg-gray-100 text-gray-700',
  premium: 'bg-blue-100 text-blue-700',
  enterprise: 'bg-purple-100 text-purple-700',
};

export const CustomersPage: React.FC = () => {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [segmentFilter, setSegmentFilter] = useState('');
  const [view, setView] = useState<'grid' | 'list'>('grid');

  useEffect(() => {
    fetchCustomers();
  }, [segmentFilter]);

  const fetchCustomers = async () => {
    setLoading(true);
    try {
      const params: Record<string, any> = {};
      if (segmentFilter) params.segment = segmentFilter;

      const response = await customersApi.list(params);
      if (response.success && response.data) {
        setCustomers(response.data);
      } else {
        setCustomers(mockCustomers);
      }
    } catch (error) {
      setCustomers(mockCustomers);
    } finally {
      setLoading(false);
    }
  };

  const filteredCustomers = customers.filter(customer => {
    if (searchQuery) {
      const search = searchQuery.toLowerCase();
      return (
        customer.profile.name?.toLowerCase().includes(search) ||
        customer.identityGraph.emails.some(e => e.toLowerCase().includes(search)) ||
        customer.profile.company?.toLowerCase().includes(search)
      );
    }
    return true;
  });

  const openCustomer = (customer: Customer) => {
    navigate(`/customers/${customer.id}`);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Customers</h1>
          <p className="text-gray-500 mt-1">Manage customer profiles and data</p>
        </div>
        <button className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 flex items-center gap-2">
          <PlusIcon className="w-5 h-5" />
          Add Customer
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <p className="text-sm text-gray-500">Total Customers</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{customers.length}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <p className="text-sm text-gray-500">Enterprise</p>
          <p className="text-2xl font-bold text-purple-600 mt-1">
            {customers.filter(c => c.slaTier === 'enterprise').length}
          </p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <p className="text-sm text-gray-500">Premium</p>
          <p className="text-2xl font-bold text-blue-600 mt-1">
            {customers.filter(c => c.slaTier === 'premium').length}
          </p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <p className="text-sm text-gray-500">Active Conversations</p>
          <p className="text-2xl font-bold text-green-600 mt-1">
            {customers.reduce((acc, c) => acc + (c.stats?.openConversations || 0), 0)}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <MagnifyingGlassIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search customers by name, email, or company..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 bg-white"
          />
        </div>
        <select
          value={segmentFilter}
          onChange={(e) => setSegmentFilter(e.target.value)}
          className="border border-gray-200 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-primary-500 bg-white"
        >
          <option value="">All Segments</option>
          <option value="active">Active</option>
          <option value="churned">Churned</option>
          <option value="vip">VIP</option>
          <option value="new">New</option>
        </select>
        <div className="flex border border-gray-200 rounded-xl overflow-hidden">
          <button
            onClick={() => setView('grid')}
            className={`px-4 py-2 ${view === 'grid' ? 'bg-primary-50 text-primary-700' : 'bg-white text-gray-600'}`}
          >
            Grid
          </button>
          <button
            onClick={() => setView('list')}
            className={`px-4 py-2 ${view === 'list' ? 'bg-primary-50 text-primary-700' : 'bg-white text-gray-600'}`}
          >
            List
          </button>
        </div>
      </div>

      {/* Customer Grid/List */}
      {loading ? (
        <div className="text-center py-12 text-gray-500">Loading customers...</div>
      ) : filteredCustomers.length === 0 ? (
        <div className="text-center py-12 text-gray-500">No customers found</div>
      ) : view === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredCustomers.map(customer => (
            <div
              key={customer.id}
              onClick={() => openCustomer(customer)}
              className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 hover:shadow-md transition-shadow cursor-pointer"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center text-primary-700 font-semibold text-lg">
                    {customer.profile.name?.charAt(0).toUpperCase() || '?'}
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">{customer.profile.name || 'Unknown'}</h3>
                    {customer.profile.company && (
                      <p className="text-sm text-gray-500 flex items-center gap-1">
                        <BuildingOfficeIcon className="w-4 h-4" />
                        {customer.profile.company}
                      </p>
                    )}
                  </div>
                </div>
                <span className={`px-2 py-1 text-xs font-medium rounded-full ${slaTierColors[customer.slaTier]}`}>
                  {customer.slaTier}
                </span>
              </div>

              <div className="mt-4 space-y-2">
                {customer.identityGraph.emails[0] && (
                  <p className="text-sm text-gray-600 flex items-center gap-2">
                    <EnvelopeIcon className="w-4 h-4 text-gray-400" />
                    {customer.identityGraph.emails[0]}
                  </p>
                )}
                {customer.identityGraph.phoneNumbers[0] && (
                  <p className="text-sm text-gray-600 flex items-center gap-2">
                    <PhoneIcon className="w-4 h-4 text-gray-400" />
                    {customer.identityGraph.phoneNumbers[0]}
                  </p>
                )}
                {customer.profile.location && (
                  <p className="text-sm text-gray-600 flex items-center gap-2">
                    <MapPinIcon className="w-4 h-4 text-gray-400" />
                    {customer.profile.location}
                  </p>
                )}
              </div>

              <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between">
                <div className="flex gap-1">
                  {customer.tags.slice(0, 3).map(tag => (
                    <span key={tag} className="px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded">
                      {tag}
                    </span>
                  ))}
                </div>
                <div className="flex items-center gap-1 text-sm text-gray-500">
                  <ChatBubbleLeftRightIcon className="w-4 h-4" />
                  {customer.stats?.totalConversations || 0}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Customer</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Contact</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">SLA Tier</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Conversations</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Tags</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredCustomers.map(customer => (
                <tr
                  key={customer.id}
                  onClick={() => openCustomer(customer)}
                  className="hover:bg-gray-50 cursor-pointer transition-colors"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center text-primary-700 font-semibold">
                        {customer.profile.name?.charAt(0).toUpperCase() || '?'}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{customer.profile.name || 'Unknown'}</p>
                        {customer.profile.company && (
                          <p className="text-sm text-gray-500">{customer.profile.company}</p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-sm text-gray-600">{customer.identityGraph.emails[0] || '-'}</p>
                    <p className="text-sm text-gray-500">{customer.identityGraph.phoneNumbers[0] || '-'}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${slaTierColors[customer.slaTier]}`}>
                      {customer.slaTier}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-sm text-gray-600">
                      {customer.stats?.openConversations || 0} open / {customer.stats?.totalConversations || 0} total
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      {customer.tags.slice(0, 2).map(tag => (
                        <span key={tag} className="px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

// Mock data
const mockCustomers: Customer[] = [
  {
    id: 'cust_1',
    identityGraph: { emails: ['john@acmecorp.com'], phoneNumbers: ['+1-555-0123'], socialIds: {} },
    profile: { name: 'John Smith', company: 'Acme Corporation', title: 'CTO', location: 'San Francisco, CA' },
    slaTier: 'enterprise',
    tags: ['vip', 'tech'],
    segments: ['enterprise', 'active'],
    customFields: {},
    stats: { totalConversations: 24, openConversations: 2, avgResolutionTime: 4.2, satisfaction: 4.8 },
    createdAt: new Date(Date.now() - 365 * 86400000).toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'cust_2',
    identityGraph: { emails: ['sarah@startup.io'], phoneNumbers: ['+1-555-0456'], socialIds: {} },
    profile: { name: 'Sarah Johnson', company: 'TechStartup Inc', title: 'Founder', location: 'Austin, TX' },
    slaTier: 'premium',
    tags: ['startup', 'growth'],
    segments: ['premium', 'active'],
    customFields: {},
    stats: { totalConversations: 12, openConversations: 1, avgResolutionTime: 2.5, satisfaction: 4.9 },
    createdAt: new Date(Date.now() - 180 * 86400000).toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'cust_3',
    identityGraph: { emails: ['mike@retail.com'], phoneNumbers: [], socialIds: {} },
    profile: { name: 'Mike Chen', company: 'RetailMax', location: 'New York, NY' },
    slaTier: 'standard',
    tags: ['retail'],
    segments: ['standard'],
    customFields: {},
    stats: { totalConversations: 5, openConversations: 0, avgResolutionTime: 6.0, satisfaction: 4.2 },
    createdAt: new Date(Date.now() - 90 * 86400000).toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'cust_4',
    identityGraph: { emails: ['emma@enterprise.co'], phoneNumbers: ['+1-555-0789'], socialIds: {} },
    profile: { name: 'Emma Wilson', company: 'Global Enterprise Ltd', title: 'VP Operations', location: 'London, UK' },
    slaTier: 'enterprise',
    tags: ['vip', 'international'],
    segments: ['enterprise', 'vip'],
    customFields: {},
    stats: { totalConversations: 45, openConversations: 3, avgResolutionTime: 3.1, satisfaction: 4.7 },
    createdAt: new Date(Date.now() - 500 * 86400000).toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'cust_5',
    identityGraph: { emails: ['alex@agency.com'], phoneNumbers: [], socialIds: {} },
    profile: { name: 'Alex Rodriguez', company: 'Creative Agency', title: 'Director' },
    slaTier: 'premium',
    tags: ['agency', 'creative'],
    segments: ['premium'],
    customFields: {},
    stats: { totalConversations: 8, openConversations: 1, avgResolutionTime: 4.0, satisfaction: 4.5 },
    createdAt: new Date(Date.now() - 60 * 86400000).toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

export default CustomersPage;
