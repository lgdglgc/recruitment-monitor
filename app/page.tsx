'use client';

import { FilterConfig, JobItem, SourceConfig } from '@/lib/types';
import { useEffect, useState } from 'react';

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState<'jobs' | 'sources' | 'filter' | 'tester'>('jobs');
  const [sources, setSources] = useState<SourceConfig[]>([]);
  const [filter, setFilter] = useState<FilterConfig>({
    years: ['2026', '2027'],
    keywords: ['校招', '春招', '秋招', '应届', '招聘', '岗位', '实习'],
    excludeKeywords: ['体检', '拟聘', '拟录用', '结果公示', '递补', '资格复审', '真题', '网校培训', '冲刺班'],
    mode: 'AND',
  });

  // Recent jobs state
  const [recentJobs, setRecentJobs] = useState<JobItem[]>([]);
  const [jobsLoading, setJobsLoading] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedSourceFilter, setSelectedSourceFilter] = useState<string>('');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize = 15;

  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Admin Secret / Auth Token state
  const [adminSecret, setAdminSecret] = useState<string>('');
  const [secretInput, setSecretInput] = useState<string>('');
  const [showSecretModal, setShowSecretModal] = useState<boolean>(false);

  // Modals state
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [showEditModal, setShowEditModal] = useState<boolean>(false);
  const [showBatchModal, setShowBatchModal] = useState<boolean>(false);
  const [showTestModal, setShowTestModal] = useState<boolean>(false);

  // New Source Form state
  const [newSource, setNewSource] = useState<Partial<SourceConfig>>({
    name: '',
    type: 'html',
    enabled: true,
    url: '',
    selector: {
      container: 'ul li:has(a[title])',
      title: 'a',
      link: 'a',
      date: '.time',
      summary: '',
    },
  });

  // Editing Source Form state
  const [editingSource, setEditingSource] = useState<SourceConfig | null>(null);

  // Batch import text
  const [batchText, setBatchText] = useState<string>('');

  // Year & Keyword & Exclude input states
  const [newYearInput, setNewYearInput] = useState<string>('');
  const [newKeywordInput, setNewKeywordInput] = useState<string>('');
  const [newExcludeInput, setNewExcludeInput] = useState<string>('');

  // Testing Single Source state
  const [testResult, setTestResult] = useState<{
    sourceName?: string;
    totalFetched?: number;
    matchedCount?: number;
    rawItems?: JobItem[];
    matchedItems?: JobItem[];
    error?: string;
    loading?: boolean;
  }>({});

  // Full workflow test state
  const [fullWorkflowRunning, setFullWorkflowRunning] = useState<boolean>(false);
  const [fullWorkflowResult, setFullWorkflowResult] = useState<any>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // 构造带有认证 Token 的请求头
  const getAuthHeaders = () => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (adminSecret) {
      headers['Authorization'] = `Bearer ${adminSecret}`;
    }
    return headers;
  };

  // 从 LocalStorage 初始化 Admin Secret
  useEffect(() => {
    const saved = localStorage.getItem('recruitment_monitor_admin_secret') || '';
    setAdminSecret(saved);
    setSecretInput(saved);
  }, []);

  const handleSaveSecret = () => {
    const trimmed = secretInput.trim();
    localStorage.setItem('recruitment_monitor_admin_secret', trimmed);
    setAdminSecret(trimmed);
    setShowSecretModal(false);
    showToast(trimmed ? '🔑 管理员密钥已保存至本地' : 'ℹ️ 已清除本地管理员密钥');
  };

  // Fetch initial configs
  const fetchConfig = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/config');
      const data = await res.json();
      if (data.success) {
        setSources(data.sources || []);
        if (data.filter) {
          setFilter({
            ...data.filter,
            excludeKeywords: data.filter.excludeKeywords || [
              '体检',
              '拟聘',
              '拟录用',
              '结果公示',
              '递补',
              '资格复审',
              '真题',
              '网校培训',
              '冲刺班',
            ],
          });
        }
      }
    } catch (err) {
      showToast('⚠️ 加载配置失败，使用本地缓存');
    } finally {
      setLoading(false);
    }
  };

  // Fetch recent saved jobs
  const fetchRecentJobs = async () => {
    setJobsLoading(true);
    try {
      const res = await fetch('/api/jobs');
      const data = await res.json();
      if (data.success) {
        setRecentJobs(data.jobs || []);
      }
    } catch (err) {
      console.error('获取最新岗位失败', err);
    } finally {
      setJobsLoading(false);
    }
  };

  useEffect(() => {
    fetchConfig();
    fetchRecentJobs();
  }, []);

  // Save configs to backend
  const saveConfigToBackend = async (newSources?: SourceConfig[], newFilter?: FilterConfig) => {
    setSaving(true);
    try {
      const res = await fetch('/api/config', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          sources: newSources || sources,
          filter: newFilter || filter,
        }),
      });
      const data = await res.json();
      if (data.success) {
        showToast('✅ 配置保存成功，已存储至 Redis！');
        if (newSources) setSources(newSources);
        if (newFilter) setFilter(newFilter);
      } else {
        if (res.status === 401) {
          setShowSecretModal(true);
          showToast(`🔒 未授权: 请点击右上角设置正确的管理密钥`);
        } else {
          showToast(`❌ 保存失败: ${data.error}`);
        }
      }
    } catch (err: any) {
      showToast(`❌ 请求异常: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  // Add Single Source
  const handleAddSource = () => {
    if (!newSource.name || !newSource.url) {
      showToast('⚠️ 请填写完整的数据源名称和 URL 地址！');
      return;
    }

    const item: SourceConfig = {
      id: `src-${Date.now()}`,
      name: newSource.name,
      type: newSource.type || 'html',
      enabled: true,
      url: newSource.url,
      selector: newSource.type === 'html' ? newSource.selector : undefined,
    };

    const updated = [...sources, item];
    saveConfigToBackend(updated, undefined);
    setShowAddModal(false);
    setNewSource({
      name: '',
      type: 'html',
      enabled: true,
      url: '',
      selector: {
        container: 'ul li:has(a[title])',
        title: 'a',
        link: 'a',
        date: '.time',
      },
    });
  };

  // Open Edit Modal
  const handleOpenEditModal = (source: SourceConfig) => {
    setEditingSource({
      ...source,
      selector: source.selector || {
        container: 'ul li:has(a[title])',
        title: 'a',
        link: 'a',
      },
    });
    setShowEditModal(true);
  };

  // Save Edited Source
  const handleSaveEditedSource = () => {
    if (!editingSource || !editingSource.name || !editingSource.url) {
      showToast('⚠️ 请填写完整的数据源名称和 URL 地址！');
      return;
    }

    const updated = sources.map((s) => (s.id === editingSource.id ? editingSource : s));
    saveConfigToBackend(updated, undefined);
    setShowEditModal(false);
    setEditingSource(null);
  };

  // Toggle Source Enabled/Disabled
  const handleToggleSource = (id: string) => {
    const updated = sources.map((s) => {
      if (s.id === id) {
        return { ...s, enabled: s.enabled === false ? true : false };
      }
      return s;
    });
    saveConfigToBackend(updated, undefined);
  };

  // Delete Source
  const handleDeleteSource = (id: string) => {
    if (confirm('确定要删除该数据源吗？')) {
      const updated = sources.filter((s) => s.id !== id);
      saveConfigToBackend(updated, undefined);
    }
  };

  // Batch Import
  const handleBatchImport = () => {
    if (!batchText.trim()) return;

    const lines = batchText.split('\n').map((l) => l.trim()).filter(Boolean);
    const newItems: SourceConfig[] = [];

    lines.forEach((line, idx) => {
      if (line.startsWith('{')) {
        try {
          const obj = JSON.parse(line);
          if (obj.url) {
            newItems.push({
              id: `src-${Date.now()}-${idx}`,
              name: obj.name || `导入数据源 ${idx + 1}`,
              type: obj.type || (obj.url.includes('.xml') || obj.url.includes('rss') ? 'rss' : 'html'),
              enabled: obj.enabled !== false,
              url: obj.url,
              selector: obj.selector,
            });
          }
        } catch (e) {}
      } else if (line.startsWith('http')) {
        const isRss = line.includes('.xml') || line.includes('rss') || line.includes('feed');
        newItems.push({
          id: `src-${Date.now()}-${idx}`,
          name: isRss ? `微信/RSS 订阅源 ${idx + 1}` : `招聘网页 ${idx + 1}`,
          type: isRss ? 'rss' : 'html',
          enabled: true,
          url: line,
          selector: isRss ? undefined : { container: 'ul li:has(a[title])', title: 'a', link: 'a' },
        });
      }
    });

    if (newItems.length > 0) {
      const updated = [...sources, ...newItems];
      saveConfigToBackend(updated, undefined);
      setShowBatchModal(false);
      setBatchText('');
      showToast(`✅ 成功导入 ${newItems.length} 个数据源！`);
    } else {
      showToast('⚠️ 未识别到有效的 URL 或 JSON 数据！');
    }
  };

  // Test Single Source
  const handleTestSource = async (source: SourceConfig) => {
    setShowTestModal(true);
    setTestResult({ loading: true, sourceName: source.name });

    try {
      const res = await fetch('/api/test-source', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ source }),
      });
      const data = await res.json();
      if (data.success) {
        setTestResult({
          loading: false,
          sourceName: source.name,
          totalFetched: data.totalFetched,
          matchedCount: data.matchedCount,
          rawItems: data.rawItems,
          matchedItems: data.matchedItems,
        });
      } else {
        if (res.status === 401) {
          setShowSecretModal(true);
          setTestResult({ loading: false, sourceName: source.name, error: '未授权：请先配置管理密钥' });
        } else {
          setTestResult({ loading: false, sourceName: source.name, error: data.error });
        }
      }
    } catch (err: any) {
      setTestResult({ loading: false, sourceName: source.name, error: err.message });
    }
  };

  // Trigger full workflow manually
  const handleRunFullWorkflow = async () => {
    setFullWorkflowRunning(true);
    setFullWorkflowResult(null);

    try {
      const res = await fetch('/api/cron', {
        method: 'POST',
        headers: getAuthHeaders(),
      });
      const data = await res.json();
      setFullWorkflowResult(data);
      if (data.success) {
        showToast(`✅ 抓取推送完成！新增推送 ${data.summary?.newPushedCount || 0} 条。`);
        await fetchRecentJobs();
      } else {
        if (res.status === 401) {
          setShowSecretModal(true);
          showToast(`🔒 未授权: 请点击右上角设置正确的管理密钥`);
        } else {
          showToast(`❌ 执行中断: ${data.message || data.error}`);
        }
      }
    } catch (err: any) {
      showToast(`❌ 请求异常: ${err.message}`);
    } finally {
      setFullWorkflowRunning(false);
    }
  };

  // Tag helper
  const addTag = (type: 'years' | 'keywords' | 'excludeKeywords', val: string) => {
    if (!val.trim()) return;
    const v = val.trim();
    const currentList = filter[type] || [];
    if (!currentList.includes(v)) {
      setFilter({
        ...filter,
        [type]: [...currentList, v],
      });
    }
    if (type === 'years') setNewYearInput('');
    if (type === 'keywords') setNewKeywordInput('');
    if (type === 'excludeKeywords') setNewExcludeInput('');
  };

  const removeTag = (type: 'years' | 'keywords' | 'excludeKeywords', tag: string) => {
    const currentList = filter[type] || [];
    setFilter({
      ...filter,
      [type]: currentList.filter((t) => t !== tag),
    });
  };

  // Filter jobs for Jobs Tab
  const filteredJobs = recentJobs.filter((job) => {
    const matchQuery =
      !searchQuery.trim() ||
      job.title.toLowerCase().includes(searchQuery.toLowerCase().trim()) ||
      (job.summary && job.summary.toLowerCase().includes(searchQuery.toLowerCase().trim()));
    const matchSource = !selectedSourceFilter || job.sourceName === selectedSourceFilter;
    return matchQuery && matchSource;
  });

  // Pagination for Jobs Tab
  const totalPages = Math.ceil(filteredJobs.length / pageSize) || 1;
  const paginatedJobs = filteredJobs.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  return (
    <div>
      {/* Toast */}
      {toastMessage && (
        <div
          style={{
            position: 'fixed',
            top: '20px',
            right: '20px',
            background: '#334155',
            color: '#fff',
            padding: '0.75rem 1.25rem',
            borderRadius: '0.5rem',
            boxShadow: '0 10px 15px -3px rgba(0,0,0,0.5)',
            zIndex: 999,
            border: '1px solid #6366f1',
            fontSize: '0.9rem',
            fontWeight: 600,
          }}
        >
          {toastMessage}
        </div>
      )}

      {/* Navbar Header */}
      <header className="navbar">
        <div className="brand">
          <span>🎯</span>
          <span>招聘监控推送系统 (Recruitment Monitor)</span>
        </div>
        <div className="navbar-right">
          <button
            className="btn btn-secondary"
            onClick={() => setShowSecretModal(true)}
            title="设置用于保护公网 API 接口的管理密钥"
          >
            {adminSecret ? '🔒 密钥已配置' : '🔑 设置管理密钥'}
          </button>
          <span className="status-badge">
            <span className="dot"></span>
            Redis 同步中
          </span>
          <button
            className="btn btn-primary"
            onClick={handleRunFullWorkflow}
            disabled={fullWorkflowRunning}
          >
            {fullWorkflowRunning ? '⚡ 正在抓取推送中...' : '🚀 立即触发全量抓取推送'}
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="container">
        {/* Nav Tabs */}
        <nav className="tabs-nav">
          <button
            className={`tab-btn ${activeTab === 'jobs' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('jobs');
              setCurrentPage(1);
            }}
          >
            📋 最新招聘大厅 ({recentJobs.length})
          </button>
          <button
            className={`tab-btn ${activeTab === 'sources' ? 'active' : ''}`}
            onClick={() => setActiveTab('sources')}
          >
            📱 数据源管理 ({sources.length})
          </button>
          <button
            className={`tab-btn ${activeTab === 'filter' ? 'active' : ''}`}
            onClick={() => setActiveTab('filter')}
          >
            🎯 关键词与过滤规则
          </button>
          <button
            className={`tab-btn ${activeTab === 'tester' ? 'active' : ''}`}
            onClick={() => setActiveTab('tester')}
          >
            🔍 全量抓取实时测试
          </button>
        </nav>

        {/* TAB 0: Recent Jobs */}
        {activeTab === 'jobs' && (
          <div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginBottom: '1.25rem',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '1rem',
              }}
            >
              <div>
                <h2 style={{ fontSize: '1.2rem', fontWeight: 700 }}>📋 最新抓取招聘信息大厅</h2>
                <p className="tab-desc">
                  查看并检索系统中已保存和抓取的最新相关招聘岗位条目 (最多保留 200 条)
                </p>
              </div>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button className="btn btn-secondary" onClick={fetchRecentJobs} disabled={jobsLoading}>
                  {jobsLoading ? '刷新中...' : '🔄 刷新岗位列表'}
                </button>
              </div>
            </div>

            {/* Filter Bar */}
            <div className="card" style={{ marginBottom: '1.5rem', padding: '1rem' }}>
              <div className="filter-bar-grid">
                <input
                  type="text"
                  className="form-input filter-input"
                  placeholder="🔍 搜索招聘标题、岗位关键词、专业或摘要..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setCurrentPage(1);
                  }}
                />
                <select
                  className="form-select filter-select"
                  value={selectedSourceFilter}
                  onChange={(e) => {
                    setSelectedSourceFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                >
                  <option value="">全部监控数据源</option>
                  {Array.from(new Set(recentJobs.map((j) => j.sourceName))).map((src) => (
                    <option key={src} value={src}>
                      {src}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Jobs List */}
            {jobsLoading ? (
              <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
                正在加载招聘岗位列表...
              </div>
            ) : filteredJobs.length === 0 ? (
              <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
                {recentJobs.length === 0 ? (
                  <div>
                    <p style={{ marginBottom: '1rem', color: 'var(--text-muted)' }}>
                      尚无已抓取的历史招聘岗位记录。
                    </p>
                    <button
                      className="btn btn-primary"
                      onClick={handleRunFullWorkflow}
                      disabled={fullWorkflowRunning}
                    >
                      🚀 立即触发全量抓取
                    </button>
                  </div>
                ) : (
                  <p style={{ color: 'var(--text-muted)' }}>没有找到匹配搜索条件的招聘岗位。</p>
                )}
              </div>
            ) : (
              <div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {paginatedJobs.map((item, idx) => (
                    <div
                      key={item.id || idx}
                      className="card"
                      style={{
                        padding: '1.25rem',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.65rem',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'flex-start',
                          gap: '1rem',
                        }}
                      >
                        <a
                          href={item.link}
                          target="_blank"
                          rel="noreferrer"
                          style={{
                            fontSize: '1.05rem',
                            fontWeight: 700,
                            color: '#60a5fa',
                            lineHeight: '1.4',
                          }}
                        >
                          {item.title}
                        </a>
                        <span className="type-tag type-rss" style={{ flexShrink: 0 }}>
                          {item.sourceName}
                        </span>
                      </div>

                      {item.summary && (
                        <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', lineHeight: '1.5' }}>
                          {item.summary}
                        </p>
                      )}

                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          marginTop: '0.25rem',
                          fontSize: '0.8rem',
                          color: '#94a3b8',
                        }}
                      >
                        <span>📅 发布时间: {item.date || '未知'}</span>
                        <a
                          href={item.link}
                          target="_blank"
                          rel="noreferrer"
                          className="btn btn-secondary"
                          style={{ fontSize: '0.8rem', padding: '0.25rem 0.65rem' }}
                        >
                          👉 查看原文 ↗
                        </a>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="pagination-container">
                    <button
                      className="btn btn-secondary"
                      onClick={() => handlePageChange(currentPage - 1)}
                      disabled={currentPage === 1}
                      style={{ fontSize: '0.85rem' }}
                    >
                      ◀ 上一页
                    </button>
                    <span className="pagination-info">
                      第 <strong>{currentPage}</strong> / {totalPages} 页 (共 {filteredJobs.length} 条)
                    </span>
                    <button
                      className="btn btn-secondary"
                      onClick={() => handlePageChange(currentPage + 1)}
                      disabled={currentPage === totalPages}
                      style={{ fontSize: '0.85rem' }}
                    >
                      下一页 ▶
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* TAB 1: Sources */}
        {activeTab === 'sources' && (
          <div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginBottom: '1.25rem',
                alignItems: 'center',
              }}
            >
              <div>
                <h2 style={{ fontSize: '1.2rem', fontWeight: 700 }}>监控源清单</h2>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  管理你需要定时监控的微信公众号 RSS 订阅源与招聘网页爬虫
                </p>
              </div>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button className="btn btn-secondary" onClick={() => setShowBatchModal(true)}>
                  📥 批量导入
                </button>
                <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>
                  ➕ 添加新数据源
                </button>
              </div>
            </div>

            {loading ? (
              <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
                加载数据源中...
              </div>
            ) : sources.length === 0 ? (
              <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
                暂无监控数据源，点击上方按钮添加你的第一个公众号 RSS 或网页！
              </div>
            ) : (
              <div className="grid-cols-2">
                {sources.map((item) => (
                  <div key={item.id} className="source-item">
                    <div>
                      <div className="source-header">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span className="source-title">{item.name}</span>
                          <span className={item.enabled !== false ? 'badge-enabled' : 'badge-disabled'}>
                            {item.enabled !== false ? '🟢 抓取中' : '⏸️ 已暂停'}
                          </span>
                        </div>
                        <span className={`type-tag ${item.type === 'rss' ? 'type-rss' : 'type-html'}`}>
                          {item.type.toUpperCase()}
                        </span>
                      </div>
                      <div className="url-text" style={{ marginTop: '0.5rem' }}>
                        {item.url}
                      </div>

                      {item.selector && (
                        <div
                          style={{
                            fontSize: '0.75rem',
                            color: '#94a3b8',
                            marginTop: '0.5rem',
                            background: '#0f172a',
                            padding: '0.5rem',
                            borderRadius: '0.35rem',
                          }}
                        >
                          容器: <code>{item.selector.container}</code> | 标题: <code>{item.selector.title}</code>
                          {item.selector.date && <span> | 日期: <code>{item.selector.date}</code></span>}
                        </div>
                      )}
                    </div>

                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginTop: '0.75rem',
                      }}
                    >
                      <button
                        className="btn btn-secondary"
                        style={{ fontSize: '0.8rem', padding: '0.35rem 0.65rem' }}
                        onClick={() => handleToggleSource(item.id)}
                      >
                        {item.enabled !== false ? '⏸️ 暂停' : '▶️ 启用'}
                      </button>

                      <div style={{ display: 'flex', gap: '0.4rem' }}>
                        <button
                          className="btn btn-secondary"
                          style={{ fontSize: '0.8rem', padding: '0.35rem 0.65rem' }}
                          onClick={() => handleTestSource(item)}
                        >
                          🔍 测试
                        </button>
                        <button
                          className="btn btn-secondary"
                          style={{ fontSize: '0.8rem', padding: '0.35rem 0.65rem' }}
                          onClick={() => handleOpenEditModal(item)}
                        >
                          ✏️ 编辑
                        </button>
                        <button
                          className="btn btn-danger"
                          style={{ fontSize: '0.8rem', padding: '0.35rem 0.65rem' }}
                          onClick={() => handleDeleteSource(item.id)}
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: Filter */}
        {activeTab === 'filter' && (
          <div>
            <div className="card">
              <h2 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '1.25rem' }}>
                🎯 关键词、年份与黑名单排除规则
              </h2>

              {/* Years */}
              <div className="form-group">
                <label className="form-label">关注年份词 (例如: 2026, 2027)</label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="输入年份回车添加..."
                    value={newYearInput}
                    onChange={(e) => setNewYearInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addTag('years', newYearInput)}
                  />
                  <button className="btn btn-secondary" onClick={() => addTag('years', newYearInput)}>
                    添加
                  </button>
                </div>
                <div className="tag-container">
                  {filter.years.map((y) => (
                    <span key={y} className="tag">
                      {y}
                      <span className="tag-remove" onClick={() => removeTag('years', y)}>
                        ×
                      </span>
                    </span>
                  ))}
                </div>
              </div>

              {/* Keywords */}
              <div className="form-group" style={{ marginTop: '1.5rem' }}>
                <label className="form-label">
                  招聘目标核心关键词 (标题或摘要包含任意一个即匹配，如: 校招, 春招, 工程师, 招聘)
                </label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="输入关键词回车添加..."
                    value={newKeywordInput}
                    onChange={(e) => setNewKeywordInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addTag('keywords', newKeywordInput)}
                  />
                  <button className="btn btn-secondary" onClick={() => addTag('keywords', newKeywordInput)}>
                    添加
                  </button>
                </div>
                <div className="tag-container">
                  {filter.keywords.map((kw) => (
                    <span key={kw} className="tag" style={{ background: '#3b82f6', color: '#fff' }}>
                      {kw}
                      <span className="tag-remove" style={{ color: '#fff' }} onClick={() => removeTag('keywords', kw)}>
                        ×
                      </span>
                    </span>
                  ))}
                </div>
              </div>

              {/* Exclude Keywords (Blacklist) */}
              <div className="form-group" style={{ marginTop: '1.5rem' }}>
                <label className="form-label" style={{ color: '#fca5a5' }}>
                  🛡️ 排除词黑名单 (命中任意词直接丢弃，过滤体检公告、结果公示、辅导广告等干扰)
                </label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="输入排除词回车添加 (例如: 体检, 递补, 拟聘用, 培训班)..."
                    value={newExcludeInput}
                    onChange={(e) => setNewExcludeInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addTag('excludeKeywords', newExcludeInput)}
                  />
                  <button className="btn btn-secondary" onClick={() => addTag('excludeKeywords', newExcludeInput)}>
                    添加排除词
                  </button>
                </div>
                <div className="tag-container">
                  {(filter.excludeKeywords || []).map((ex) => (
                    <span key={ex} className="tag tag-exclude">
                      🚫 {ex}
                      <span className="tag-remove" onClick={() => removeTag('excludeKeywords', ex)}>
                        ×
                      </span>
                    </span>
                  ))}
                </div>
              </div>

              {/* Mode */}
              <div className="form-group" style={{ marginTop: '1.5rem' }}>
                <label className="form-label">匹配逻辑规则</label>
                <select
                  className="form-select"
                  value={filter.mode}
                  onChange={(e) => setFilter({ ...filter, mode: e.target.value as any })}
                >
                  <option value="AND">
                    AND 模式：必须包含目标年份或核心关键词之一，且排除过时历史与黑名单 (推荐)
                  </option>
                  <option value="OR">OR 模式：满足年份或关键词中任意一个即可推送</option>
                </select>
              </div>

              <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  className="btn btn-primary"
                  onClick={() => saveConfigToBackend(undefined, filter)}
                  disabled={saving}
                >
                  {saving ? '保存中...' : '💾 保存关键词与排除规则至 Redis'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: Tester */}
        {activeTab === 'tester' && (
          <div>
            <div className="card">
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '1.5rem',
                }}
              >
                <div>
                  <h2 style={{ fontSize: '1.2rem', fontWeight: 700 }}>🔍 全量数据源抓取测试与实时匹配结果</h2>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                    在线执行全部启用的数据源拉取与关键词过滤，预览推送到微信/企微/飞书的 Markdown 条目（含 AI 提炼）
                  </p>
                </div>
                <button className="btn btn-primary" onClick={handleRunFullWorkflow} disabled={fullWorkflowRunning}>
                  {fullWorkflowRunning ? '⚡ 抓取测试中...' : '🚀 开始执行测试'}
                </button>
              </div>

              {fullWorkflowResult && (
                <div>
                  <div
                    style={{
                      background: '#0f172a',
                      padding: '1rem',
                      borderRadius: '0.5rem',
                      marginBottom: '1.5rem',
                      display: 'flex',
                      gap: '1.5rem',
                      flexWrap: 'wrap',
                    }}
                  >
                    <div>
                      监控源总数: <strong>{fullWorkflowResult.summary?.totalSources}</strong> (启用:{' '}
                      {fullWorkflowResult.summary?.activeSources})
                    </div>
                    <div>
                      抓取总条目数: <strong>{fullWorkflowResult.summary?.totalFetched}</strong>
                    </div>
                    <div>
                      符合关键词匹配数:{' '}
                      <strong style={{ color: '#10b981' }}>{fullWorkflowResult.summary?.totalMatched}</strong>
                    </div>
                    <div>
                      实际全新推送数:{' '}
                      <strong style={{ color: '#8b5cf6' }}>{fullWorkflowResult.summary?.newPushedCount}</strong>
                    </div>
                  </div>

                  <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.75rem' }}>
                    匹配的招聘岗位明细：
                  </h3>
                  {fullWorkflowResult.results?.flatMap((r: any) => r.items).length === 0 ? (
                    <p style={{ color: 'var(--text-muted)' }}>没有找到符合当前关键词规则的招考招聘信息。</p>
                  ) : (
                    <div className="table-responsive">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>数据来源</th>
                            <th>标题与 AI 提炼</th>
                            <th>发布时间</th>
                            <th>详情链接</th>
                          </tr>
                        </thead>
                        <tbody>
                          {fullWorkflowResult.results?.flatMap((r: any) => r.items).map((item: JobItem, idx: number) => (
                            <tr key={idx}>
                              <td>
                                <span className="type-tag type-rss">{item.sourceName}</span>
                              </td>
                              <td>
                                <strong>{item.title}</strong>
                              </td>
                              <td>{item.date || '-'}</td>
                              <td>
                                <a href={item.link} target="_blank" rel="noreferrer" style={{ color: '#60a5fa' }}>
                                  查看原文 ↗
                                </a>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Modal: Admin Secret */}
      {showSecretModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '1rem' }}>
              🔑 管理员访问密钥设置
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
              若生产环境配置了 <code>ADMIN_SECRET</code> 或 <code>CRON_SECRET</code> 环境变量，请在此输入对应的密码以获得修改配置与手工触发权限。密钥将保存在当前浏览器的本地存储中。
            </p>

            <div className="form-group">
              <label className="form-label">管理员密钥 (Token / Secret)</label>
              <input
                type="password"
                className="form-input"
                placeholder="输入你的 ADMIN_SECRET 或 CRON_SECRET..."
                value={secretInput}
                onChange={(e) => setSecretInput(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
              <button className="btn btn-secondary" onClick={() => setShowSecretModal(false)}>
                取消
              </button>
              <button className="btn btn-primary" onClick={handleSaveSecret}>
                保存密钥
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Add Source */}
      {showAddModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '1.25rem' }}>➕ 添加新监控数据源</h3>

            <div className="form-group">
              <label className="form-label">数据源名称 (例如: 南阳人事考试网 或 微信公众号「名企校招」)</label>
              <input
                type="text"
                className="form-input"
                placeholder="请输入便于识别的名字"
                value={newSource.name}
                onChange={(e) => setNewSource({ ...newSource, name: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label className="form-label">类型选择</label>
              <select
                className="form-select"
                value={newSource.type}
                onChange={(e) => setNewSource({ ...newSource, type: e.target.value as any })}
              >
                <option value="html">网页爬虫 (HTML 页面 CSS 选择器)</option>
                <option value="rss">RSS / 微信公众号 RSS 源</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">URL 目标地址</label>
              <input
                type="text"
                className="form-input"
                placeholder="http://www.nysrsksw.cn/ (注意是否支持 https)"
                value={newSource.url}
                onChange={(e) => setNewSource({ ...newSource, url: e.target.value })}
              />
            </div>

            {newSource.type === 'html' && (
              <div
                style={{
                  background: '#0f172a',
                  padding: '1rem',
                  borderRadius: '0.5rem',
                  marginBottom: '1.25rem',
                }}
              >
                <h4 style={{ fontSize: '0.9rem', marginBottom: '0.75rem', color: '#c084fc' }}>
                  HTML CSS 选择器配置：
                </h4>
                <div className="form-group">
                  <label className="form-label">列表项容器选择器 (container)</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="如: ul li:has(a[title]) 或 ul li"
                    value={newSource.selector?.container}
                    onChange={(e) =>
                      setNewSource({
                        ...newSource,
                        selector: { ...newSource.selector!, container: e.target.value },
                      })
                    }
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">标题/链接选择器 (title & link)</label>
                  <input
                    type="text"
                    className="form-input"
                    value={newSource.selector?.title}
                    onChange={(e) =>
                      setNewSource({
                        ...newSource,
                        selector: { ...newSource.selector!, title: e.target.value, link: e.target.value },
                      })
                    }
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">发布日期选择器 (date，可选)</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="如: .time 或 .date"
                    value={newSource.selector?.date || ''}
                    onChange={(e) =>
                      setNewSource({
                        ...newSource,
                        selector: { ...newSource.selector!, date: e.target.value },
                      })
                    }
                  />
                </div>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
              <button className="btn btn-secondary" onClick={() => setShowAddModal(false)}>
                取消
              </button>
              <button className="btn btn-primary" onClick={handleAddSource}>
                保存数据源
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Edit Source */}
      {showEditModal && editingSource && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '1.25rem' }}>
              ✏️ 编辑监控数据源: {editingSource.name}
            </h3>

            <div className="form-group">
              <label className="form-label">数据源名称</label>
              <input
                type="text"
                className="form-input"
                value={editingSource.name}
                onChange={(e) => setEditingSource({ ...editingSource, name: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label className="form-label">数据源类型</label>
              <select
                className="form-select"
                value={editingSource.type}
                onChange={(e) => setEditingSource({ ...editingSource, type: e.target.value as any })}
              >
                <option value="html">网页爬虫 (HTML 页面 CSS 选择器)</option>
                <option value="rss">RSS / 微信公众号 RSS 源</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">URL 目标地址</label>
              <input
                type="text"
                className="form-input"
                value={editingSource.url}
                onChange={(e) => setEditingSource({ ...editingSource, url: e.target.value })}
              />
            </div>

            {editingSource.type === 'html' && (
              <div
                style={{
                  background: '#0f172a',
                  padding: '1rem',
                  borderRadius: '0.5rem',
                  marginBottom: '1.25rem',
                }}
              >
                <h4 style={{ fontSize: '0.9rem', marginBottom: '0.75rem', color: '#c084fc' }}>
                  HTML CSS 选择器配置：
                </h4>
                <div className="form-group">
                  <label className="form-label">列表项容器选择器 (container)</label>
                  <input
                    type="text"
                    className="form-input"
                    value={editingSource.selector?.container || ''}
                    onChange={(e) =>
                      setEditingSource({
                        ...editingSource,
                        selector: { ...editingSource.selector!, container: e.target.value },
                      })
                    }
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">标题选择器 (title)</label>
                  <input
                    type="text"
                    className="form-input"
                    value={editingSource.selector?.title || ''}
                    onChange={(e) =>
                      setEditingSource({
                        ...editingSource,
                        selector: { ...editingSource.selector!, title: e.target.value },
                      })
                    }
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">详情链接选择器 (link)</label>
                  <input
                    type="text"
                    className="form-input"
                    value={editingSource.selector?.link || ''}
                    onChange={(e) =>
                      setEditingSource({
                        ...editingSource,
                        selector: { ...editingSource.selector!, link: e.target.value },
                      })
                    }
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">发布日期选择器 (date，可选)</label>
                  <input
                    type="text"
                    className="form-input"
                    value={editingSource.selector?.date || ''}
                    onChange={(e) =>
                      setEditingSource({
                        ...editingSource,
                        selector: { ...editingSource.selector!, date: e.target.value },
                      })
                    }
                  />
                </div>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
              <button className="btn btn-secondary" onClick={() => setShowEditModal(false)}>
                取消
              </button>
              <button className="btn btn-primary" onClick={handleSaveEditedSource}>
                保存更改
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Batch Import */}
      {showBatchModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '1.25rem' }}>📥 批量导入数据源</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1rem' }}>
              每行填入一个 URL 地址 (自动识别 RSS 或网页)；或直接粘贴 JSON 格式数据。
            </p>
            <textarea
              className="form-textarea"
              rows={8}
              placeholder="http://www.nysrsksw.cn/&#10;https://xxx/rss.xml"
              value={batchText}
              onChange={(e) => setBatchText(e.target.value)}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
              <button className="btn btn-secondary" onClick={() => setShowBatchModal(false)}>
                取消
              </button>
              <button className="btn btn-primary" onClick={handleBatchImport}>
                确认导入
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Test Source Result */}
      {showTestModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '720px' }}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '1rem' }}>
              🔍 单源抓取测试: {testResult.sourceName}
            </h3>

            {testResult.loading ? (
              <div style={{ padding: '2rem', textAlign: 'center' }}>正在连接网络抓取中，请稍候...</div>
            ) : testResult.error ? (
              <div
                style={{
                  color: '#f87171',
                  background: 'rgba(239, 68, 68, 0.1)',
                  padding: '1rem',
                  borderRadius: '0.5rem',
                }}
              >
                抓取失败: {testResult.error}
              </div>
            ) : (
              <div>
                <p style={{ marginBottom: '1rem', fontSize: '0.9rem' }}>
                  成功抓取到总量 <strong>{testResult.totalFetched}</strong> 条，其中符合当前关键词匹配的条目:{' '}
                  <strong style={{ color: '#10b981' }}>{testResult.matchedCount}</strong> 条。
                </p>

                <div style={{ maxHeight: '350px', overflowY: 'auto' }}>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>标题</th>
                        <th>时间</th>
                        <th>链接</th>
                      </tr>
                    </thead>
                    <tbody>
                      {testResult.matchedItems?.map((item, idx) => (
                        <tr key={idx}>
                          <td>{item.title}</td>
                          <td>{item.date || '-'}</td>
                          <td>
                            <a href={item.link} target="_blank" rel="noreferrer" style={{ color: '#60a5fa' }}>
                              打开 ↗
                            </a>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
              <button className="btn btn-secondary" onClick={() => setShowTestModal(false)}>
                关闭
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
