import React, { useState, useEffect } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Line, Bar, Doughnut } from 'react-chartjs-2';
import {
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  ChatBubbleLeftRightIcon,
  ClockIcon,
  UserGroupIcon,
  FaceSmileIcon,
} from '@heroicons/react/24/outline';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface MetricCardProps {
  title: string;
  value: string | number;
  change: number;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}

const MetricCard: React.FC<MetricCardProps> = ({ title, value, change, icon: Icon, color }) => (
  <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm text-gray-500">{title}</p>
        <p className="text-3xl font-bold text-gray-900 mt-1">{value}</p>
        <div className={`flex items-center mt-2 text-sm ${change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
          {change >= 0 ? (
            <ArrowTrendingUpIcon className="w-4 h-4 mr-1" />
          ) : (
            <ArrowTrendingDownIcon className="w-4 h-4 mr-1" />
          )}
          <span>{Math.abs(change)}% vs last period</span>
        </div>
      </div>
      <div className={`p-4 rounded-xl ${color}`}>
        <Icon className="w-8 h-8 text-white" />
      </div>
    </div>
  </div>
);

export const AnalyticsPage: React.FC = () => {
  const [dateRange, setDateRange] = useState('7d');
  const [loading, setLoading] = useState(false);

  // Mock data for charts
  const conversationTrendData = {
    labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    datasets: [
      {
        label: 'Conversations',
        data: [45, 52, 49, 63, 58, 42, 38],
        borderColor: 'rgb(14, 165, 233)',
        backgroundColor: 'rgba(14, 165, 233, 0.1)',
        fill: true,
        tension: 0.4,
      },
    ],
  };

  const responseTimeData = {
    labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    datasets: [
      {
        label: 'First Response Time (min)',
        data: [12, 15, 11, 8, 10, 14, 9],
        backgroundColor: 'rgba(34, 197, 94, 0.8)',
      },
      {
        label: 'Resolution Time (hours)',
        data: [4.2, 5.1, 3.8, 3.2, 4.0, 5.5, 3.5],
        backgroundColor: 'rgba(168, 85, 247, 0.8)',
      },
    ],
  };

  const channelData = {
    labels: ['Email', 'Web Chat', 'WhatsApp', 'SMS', 'Voice'],
    datasets: [
      {
        data: [35, 28, 20, 10, 7],
        backgroundColor: [
          'rgba(59, 130, 246, 0.8)',
          'rgba(34, 197, 94, 0.8)',
          'rgba(37, 211, 102, 0.8)',
          'rgba(251, 191, 36, 0.8)',
          'rgba(168, 85, 247, 0.8)',
        ],
        borderWidth: 0,
      },
    ],
  };

  const satisfactionData = {
    labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    datasets: [
      {
        label: 'CSAT Score',
        data: [4.5, 4.3, 4.7, 4.6, 4.8, 4.4, 4.6],
        borderColor: 'rgb(251, 191, 36)',
        backgroundColor: 'rgba(251, 191, 36, 0.1)',
        fill: true,
        tension: 0.4,
      },
    ],
  };

  const agentPerformanceData = [
    { name: 'John Doe', resolved: 45, avgTime: '3.2h', csat: 4.8, capacity: 85 },
    { name: 'Jane Smith', resolved: 38, avgTime: '2.8h', csat: 4.9, capacity: 72 },
    { name: 'Mike Johnson', resolved: 42, avgTime: '4.1h', csat: 4.5, capacity: 90 },
    { name: 'Sarah Wilson', resolved: 35, avgTime: '3.5h', csat: 4.7, capacity: 65 },
  ];

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        grid: {
          color: 'rgba(0, 0, 0, 0.05)',
        },
      },
      x: {
        grid: {
          display: false,
        },
      },
    },
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
          <p className="text-gray-500 mt-1">Performance metrics and insights</p>
        </div>
        <div className="flex gap-2">
          {['24h', '7d', '30d', '90d'].map(range => (
            <button
              key={range}
              onClick={() => setDateRange(range)}
              className={`px-4 py-2 rounded-lg text-sm font-medium ${
                dateRange === range
                  ? 'bg-primary-100 text-primary-700'
                  : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {range}
            </button>
          ))}
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Total Conversations"
          value="347"
          change={12}
          icon={ChatBubbleLeftRightIcon}
          color="bg-blue-500"
        />
        <MetricCard
          title="Avg. First Response"
          value="11min"
          change={-8}
          icon={ClockIcon}
          color="bg-green-500"
        />
        <MetricCard
          title="Resolution Rate"
          value="94%"
          change={5}
          icon={UserGroupIcon}
          color="bg-purple-500"
        />
        <MetricCard
          title="CSAT Score"
          value="4.6"
          change={3}
          icon={FaceSmileIcon}
          color="bg-yellow-500"
        />
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Conversation Trend */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="font-semibold text-gray-900 mb-4">Conversation Volume</h2>
          <div className="h-64">
            <Line data={conversationTrendData} options={chartOptions} />
          </div>
        </div>

        {/* Response Times */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="font-semibold text-gray-900 mb-4">Response Times</h2>
          <div className="h-64">
            <Bar data={responseTimeData} options={{
              ...chartOptions,
              plugins: { legend: { display: true, position: 'top' as const } },
            }} />
          </div>
        </div>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Channel Distribution */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="font-semibold text-gray-900 mb-4">Channel Distribution</h2>
          <div className="h-64 flex items-center justify-center">
            <Doughnut data={channelData} options={{
              responsive: true,
              maintainAspectRatio: false,
              plugins: { legend: { position: 'bottom' as const } },
            }} />
          </div>
        </div>

        {/* Satisfaction Trend */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 lg:col-span-2">
          <h2 className="font-semibold text-gray-900 mb-4">Customer Satisfaction Trend</h2>
          <div className="h-64">
            <Line data={satisfactionData} options={{
              ...chartOptions,
              scales: {
                ...chartOptions.scales,
                y: { ...chartOptions.scales.y, min: 0, max: 5 },
              },
            }} />
          </div>
        </div>
      </div>

      {/* Agent Performance Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="p-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Agent Performance</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Agent</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Resolved</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Avg. Handle Time</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">CSAT</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Capacity</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {agentPerformanceData.map((agent, i) => (
                <tr key={i} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center text-primary-700 font-semibold text-sm">
                        {agent.name.charAt(0)}
                      </div>
                      <span className="font-medium text-gray-900">{agent.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{agent.resolved}</td>
                  <td className="px-4 py-3 text-gray-600">{agent.avgTime}</td>
                  <td className="px-4 py-3">
                    <span className={`font-medium ${agent.csat >= 4.5 ? 'text-green-600' : 'text-yellow-600'}`}>
                      {agent.csat}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-24 bg-gray-100 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full ${
                            agent.capacity > 80 ? 'bg-red-500' : agent.capacity > 60 ? 'bg-yellow-500' : 'bg-green-500'
                          }`}
                          style={{ width: `${agent.capacity}%` }}
                        />
                      </div>
                      <span className="text-sm text-gray-500">{agent.capacity}%</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Top Issues */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h2 className="font-semibold text-gray-900 mb-4">Top Issue Categories</h2>
        <div className="space-y-4">
          {[
            { category: 'Billing & Payments', count: 89, percentage: 26 },
            { category: 'Technical Issues', count: 76, percentage: 22 },
            { category: 'Account Access', count: 58, percentage: 17 },
            { category: 'Product Questions', count: 52, percentage: 15 },
            { category: 'Shipping & Delivery', count: 45, percentage: 13 },
            { category: 'Other', count: 27, percentage: 7 },
          ].map((issue, i) => (
            <div key={i}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium text-gray-700">{issue.category}</span>
                <span className="text-sm text-gray-500">{issue.count} ({issue.percentage}%)</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2">
                <div
                  className="bg-primary-500 h-2 rounded-full"
                  style={{ width: `${issue.percentage}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AnalyticsPage;
