'use client';

import { DEFAULT_FILTER_CONFIG, DEFAULT_TARGET_PREFERENCE } from '@/lib/config';
import { copyToClipboard, exportJobsToCSV, generateMarkdownReport } from '@/lib/export';
import { FilterConfig, JobItem, SourceConfig, TargetPreference } from '@/lib/types';
import { useEffect, useState } from 'react';

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState<'jobs' | 'sources' | 'filter' | 'tester'>('jobs');
  const [sources, setSources] = useState<SourceConfig[]>([]);
  const [filter, setFilter] = useState<FilterConfig>({
    years: ['2026', '2027'],
    keywords: DEFAULT_FILTER_CONFIG.keywords,
    excludeKeywords: DEFAULT_FILTER_CONFIG.excludeKeywords,
    mode: 'AND',
    preferences: DEFAULT_TARGET_PREFERENCE,
  });

  // Recent jobs state
  const [recentJobs, setRecentJobs] = useState<JobItem[]>([]);
  const [jobsLoading, setJobsLoading] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedSourceFilter, setSelectedSourceFilter] = useState<string>('');
  const [selectedDateFilter, setSelectedDateFilter] = useState<string>('');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize = 15;

  // View Mode: 'list' (平铺列表) or 'grouped' (按日期归档折叠)
  const [viewMode, setViewMode] = useState<'list' | 'grouped'>('list');
  // 意向专属过滤: 只看适合我的岗位
  const [onlyMatched, setOnlyMatched] = useState<boolean>(false);
  // 日期归档折叠状态
  const [collapsedDates, setCollapsedDates] = useState<Record<string, boolean>>({});

  // 偏好标签新增输入项
  const [prefRegionInput, setPrefRegionInput] = useState<string>('');
  const [prefRoleInput, setPrefRoleInput] = useState<string>('');
  const [prefNatureInput, setPrefNatureInput] = useState<string>('');

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
            excludeKeywords: data.filter.excludeKeywords || DEFAULT_FILTER_CONFIG.excludeKeywords,
            preferences: data.filter.preferences || DEFAULT_TARGET_PREFERENCE,
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
        } catch (e) { }
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

  const todayStr = (() => {
    try {
      return new Intl.DateTimeFormat('zh-CN', {
        timeZone: 'Asia/Shanghai',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      })
        .format(new Date())
        .replace(/\//g, '-');
    } catch (e) {
      return new Date().toISOString().split('T')[0];
    }
  })();

  const activePref = filter.preferences || DEFAULT_TARGET_PREFERENCE;

  // 统计全部岗位中命中个人意向的条数
  const totalMatchedJobsCount = recentJobs.filter((j) => j.matchInfo?.isMatched).length;

  // 导出 CSV 处理函数
  const handleExportCSV = (itemsToExport?: JobItem[], customFilename?: string) => {
    const list = itemsToExport || filteredJobs;
    if (!list || list.length === 0) {
      showToast('⚠️ 暂无符合条件的招聘数据可供导出');
      return;
    }
    exportJobsToCSV(list, customFilename);
    showToast(`📥 已成功导出 ${list.length} 条岗位数据为 CSV (Excel / WPS 兼容)`);
  };

  // 复制 Markdown 简报处理函数
  const handleCopyMarkdown = async (itemsToReport?: JobItem[], customTitle?: string) => {
    const list = itemsToReport || filteredJobs;
    if (!list || list.length === 0) {
      showToast('⚠️ 暂无符合条件的招聘数据');
      return;
    }
    const md = generateMarkdownReport(list, customTitle);
    const success = await copyToClipboard(md);
    if (success) {
      showToast(`📋 已将 ${list.length} 条岗位简报复制至剪贴板，可直接发送！`);
    } else {
      showToast('❌ 复制失败，请手工选中复制');
    }
  };

  // 折叠/展开指定日期
  const toggleDateCollapse = (dateKey: string) => {
    setCollapsedDates((prev) => ({
      ...prev,
      [dateKey]: !prev[dateKey],
    }));
  };

  // 添加意向偏好标签 (地区 / 角色 / 编制)
  const addPrefTag = (category: 'regions' | 'roles' | 'natures', val: string) => {
    if (!val.trim()) return;
    const v = val.trim();
    const currentPref = filter.preferences || DEFAULT_TARGET_PREFERENCE;
    const currentList = currentPref[category] || [];
    if (!currentList.includes(v)) {
      const updatedPref = {
        ...currentPref,
        [category]: [...currentList, v],
      };
      const updatedFilter = {
        ...filter,
        preferences: updatedPref,
      };
      setFilter(updatedFilter);
      saveConfigToBackend(undefined, updatedFilter);
      showToast(`✅ 已将「${v}」加入关注画像并保存`);
    }
    if (category === 'regions') setPrefRegionInput('');
    if (category === 'roles') setPrefRoleInput('');
    if (category === 'natures') setPrefNatureInput('');
  };

  // 移除意向偏好标签
  const removePrefTag = (category: 'regions' | 'roles' | 'natures', tag: string) => {
    const currentPref = filter.preferences || DEFAULT_TARGET_PREFERENCE;
    const currentList = currentPref[category] || [];
    const updatedPref = {
      ...currentPref,
      [category]: currentList.filter((t) => t !== tag),
    };
    const updatedFilter = {
      ...filter,
      preferences: updatedPref,
    };
    setFilter(updatedFilter);
    saveConfigToBackend(undefined, updatedFilter);
    showToast(`🗑️ 已从关注画像中移除「${tag}」`);
  };

  const availableDates = Array.from(
    new Set(recentJobs.map((j) => j.crawledDate || j.date || '').filter(Boolean))
  ).sort((a, b) => b.localeCompare(a));

  // Filter jobs for Jobs Tab
  const filteredJobs = recentJobs.filter((job) => {
    // 仅查看适合我的意向岗位
    if (onlyMatched && !job.matchInfo?.isMatched) {
      return false;
    }

    const matchQuery =
      !searchQuery.trim() ||
      job.title.toLowerCase().includes(searchQuery.toLowerCase().trim()) ||
      (job.summary && job.summary.toLowerCase().includes(searchQuery.toLowerCase().trim()));
    const matchSource = !selectedSourceFilter || job.sourceName === selectedSourceFilter;
    const jobDate = job.crawledDate || job.date || '';
    const matchDate = !selectedDateFilter || jobDate === selectedDateFilter;
    return matchQuery && matchSource && matchDate;
  });

  // 按日期分组归档数据
  const groupedByDate = availableDates
    .map((d) => {
      const itemsForDate = filteredJobs.filter((j) => (j.crawledDate || j.date) === d);
      const matchedCountForDate = itemsForDate.filter((j) => j.matchInfo?.isMatched).length;
      return {
        date: d,
        items: itemsForDate,
        matchedCount: matchedCountForDate,
      };
    })
    .filter((g) => g.items.length > 0);

  // Pagination for Jobs Tab (列表视图使用)
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
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  南阳市直及邓州、淅川、西峡医疗卫生事业编制专属监控，按收录日期每日分类归档
                </p>
              </div>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button className="btn btn-secondary" onClick={fetchRecentJobs} disabled={jobsLoading}>
                  {jobsLoading ? '刷新中...' : '🔄 刷新岗位列表'}
                </button>
              </div>
            </div>

            {/* 1. 意向画像监控横幅 */}
            <div className="preference-banner">
              <div className="preference-banner-header">
                <div className="preference-banner-title">
                  <span>🩺</span>
                  <span>我的专属求职意向监控画像（主治医师 · 邓州/淅川/西峡 · 医疗事业编）</span>
                </div>
                <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
                  <button
                    className={`btn-matched-toggle ${onlyMatched ? 'active' : ''}`}
                    onClick={() => {
                      setOnlyMatched(!onlyMatched);
                      setCurrentPage(1);
                    }}
                    title="点击切换：只查看命中意向标签的招聘岗位"
                  >
                    {onlyMatched ? '⭐ 正在筛选：只看适合我的岗位' : `🎯 只看适合我的岗位 (${totalMatchedJobsCount}条已匹配)`}
                  </button>
                  <button
                    className="btn btn-secondary"
                    style={{ fontSize: '0.8rem', padding: '0.4rem 0.75rem' }}
                    onClick={() => setActiveTab('filter')}
                  >
                    ⚙️ 调整画像
                  </button>
                </div>
              </div>
              <div className="preference-tags-row">
                <span style={{ color: '#94a3b8' }}>📍 关注地区：</span>
                {(activePref.regions || []).map((r) => (
                  <span key={r} className="pill-tag pill-region">
                    {r}
                  </span>
                ))}
                <span style={{ color: '#94a3b8', marginLeft: '0.5rem' }}>🩺 岗位专业：</span>
                {(activePref.roles || []).slice(0, 5).map((role) => (
                  <span key={role} className="pill-tag pill-role">
                    {role}
                  </span>
                ))}
                {(activePref.roles || []).length > 5 && (
                  <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>+{activePref.roles.length - 5}个</span>
                )}
                <span style={{ color: '#94a3b8', marginLeft: '0.5rem' }}>🏛️ 编制性质：</span>
                {(activePref.natures || []).slice(0, 4).map((n) => (
                  <span key={n} className="pill-tag pill-nature">
                    {n}
                  </span>
                ))}
              </div>
            </div>

            {/* 2. 下载导出与视图切换工具条 */}
            <div className="export-toolbar">
              <div className="btn-group-actions">
                <button
                  className="btn btn-secondary"
                  style={{ fontSize: '0.82rem', padding: '0.35rem 0.75rem' }}
                  onClick={() => handleExportCSV()}
                  title="导出当前界面筛选出的全部招聘数据为 CSV (可用 Excel / WPS 打开)"
                >
                  📥 导出当前筛选 ({filteredJobs.length}条 CSV)
                </button>
                <button
                  className="btn btn-secondary"
                  style={{ fontSize: '0.82rem', padding: '0.35rem 0.75rem' }}
                  onClick={() => {
                    const todayJobs = recentJobs.filter((j) => (j.crawledDate || j.date) === todayStr);
                    handleExportCSV(todayJobs, `南阳医疗招聘_今日新增_${todayStr}.csv`);
                  }}
                  title="单独导出今天最新抓取收录的岗位"
                >
                  🌟 导出今日新增 CSV
                </button>
                <button
                  className="btn btn-secondary"
                  style={{ fontSize: '0.82rem', padding: '0.35rem 0.75rem', color: '#fde047' }}
                  onClick={() => {
                    const matchedList = recentJobs.filter((j) => j.matchInfo?.isMatched);
                    handleExportCSV(matchedList, `南阳医疗事业编_高匹配岗位_${todayStr}.csv`);
                  }}
                  title="仅导出命中主治医师、南阳邓州淅川西峡医疗编制的岗位"
                >
                  ⭐ 仅导出高匹配岗位 CSV
                </button>
                <button
                  className="btn btn-secondary"
                  style={{ fontSize: '0.82rem', padding: '0.35rem 0.75rem' }}
                  onClick={() => handleCopyMarkdown()}
                  title="一键复制排版整洁的 Markdown 简报文本，方便发到微信/群/笔记"
                >
                  📋 复制 Markdown 简报
                </button>
              </div>

              {/* 视图切换：平铺列表 vs 按日归档 */}
              <div className="view-switcher">
                <button
                  className={`view-switch-btn ${viewMode === 'list' ? 'active' : ''}`}
                  onClick={() => setViewMode('list')}
                >
                  📋 详细列表 ({filteredJobs.length})
                </button>
                <button
                  className={`view-switch-btn ${viewMode === 'grouped' ? 'active' : ''}`}
                  onClick={() => setViewMode('grouped')}
                >
                  📅 按日分类归档 ({groupedByDate.length}天)
                </button>
              </div>
            </div>

            {/* 3. 搜索与筛选输入栏 */}
            <div className="card" style={{ marginBottom: '1.5rem', padding: '1rem' }}>
              <div className="filter-bar-grid">
                <input
                  type="text"
                  className="form-input filter-input"
                  placeholder="🔍 搜索标题、邓州/淅川/西峡、主治、专科方向、编制..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setCurrentPage(1);
                  }}
                />
                <select
                  className="form-select filter-select"
                  value={selectedDateFilter}
                  onChange={(e) => {
                    setSelectedDateFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                >
                  <option value="">📅 全部收录日期 ({recentJobs.length} 条)</option>
                  {availableDates.map((d) => {
                    const count = recentJobs.filter((j) => (j.crawledDate || j.date) === d).length;
                    const isToday = d === todayStr;
                    return (
                      <option key={d} value={d}>
                        {isToday ? `🌟 今日新增 (${d})` : `📅 ${d}`} ({count} 条)
                      </option>
                    );
                  })}
                </select>
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

            {/* 4. 数据展示区 */}
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
                  <div>
                    <p style={{ color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
                      {onlyMatched ? '没有找到符合当前【适合我】意向画像的招聘岗位。' : '没有找到匹配搜索条件的招聘岗位。'}
                    </p>
                    {onlyMatched && (
                      <button className="btn btn-secondary" onClick={() => setOnlyMatched(false)}>
                        取消「只看适合我」，查看全部岗位
                      </button>
                    )}
                  </div>
                )}
              </div>
            ) : viewMode === 'list' ? (
              /* A: 平铺详细列表视图 */
              <div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {paginatedJobs.map((item, idx) => {
                    const isExact = item.matchInfo?.level === 'exact';
                    const isHigh = item.matchInfo?.level === 'high';

                    return (
                      <div
                        key={item.id || idx}
                        className={`card ${isExact ? 'card-exact-match' : isHigh ? 'card-high-match' : ''}`}
                        style={{
                          padding: '1.25rem',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '0.65rem',
                          transition: 'all 0.2s ease',
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
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                              {isExact && <span className="match-badge-exact">⭐ 极度匹配 (主治/医疗/编制)</span>}
                              {isHigh && <span className="match-badge-high">🔥 高度匹配</span>}
                              <a
                                href={item.link}
                                target="_blank"
                                rel="noreferrer"
                                style={{
                                  fontSize: '1.05rem',
                                  fontWeight: 700,
                                  color: isExact ? '#fef08a' : isHigh ? '#a7f3d0' : '#60a5fa',
                                  lineHeight: '1.4',
                                }}
                              >
                                {item.title}
                              </a>
                            </div>

                            {/* 命中标签条 */}
                            {item.matchInfo &&
                              (item.matchInfo.matchedRegions.length > 0 ||
                                item.matchInfo.matchedRoles.length > 0 ||
                                item.matchInfo.matchedNatures.length > 0) && (
                                <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', alignItems: 'center' }}>
                                  <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>🎯 意向命中:</span>
                                  {item.matchInfo.matchedRegions.map((r) => (
                                    <span key={r} className="pill-tag pill-region">
                                      📍 {r}
                                    </span>
                                  ))}
                                  {item.matchInfo.matchedRoles.map((role) => (
                                    <span key={role} className="pill-tag pill-role">
                                      🩺 {role}
                                    </span>
                                  ))}
                                  {item.matchInfo.matchedNatures.map((n) => (
                                    <span key={n} className="pill-tag pill-nature">
                                      🏛️ {n}
                                    </span>
                                  ))}
                                </div>
                              )}
                          </div>

                          <span className="type-tag type-rss" style={{ flexShrink: 0 }}>
                            {item.sourceName}
                          </span>
                        </div>

                        {/* 收录日期与官方发布日期标识 */}
                        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                          {item.crawledDate === todayStr ? (
                            <span className="date-badge-today">
                              <span>🟢</span> 今日新增收录: {item.crawledDate}
                            </span>
                          ) : item.crawledDate ? (
                            <span className="date-badge-history">
                              <span>📅</span> 历史收录: {item.crawledDate}
                            </span>
                          ) : null}
                          {item.date && (
                            <span
                              className="date-badge-history"
                              style={{
                                background: 'rgba(59, 130, 246, 0.12)',
                                color: '#93c5fd',
                                borderColor: 'rgba(59, 130, 246, 0.25)',
                              }}
                            >
                              <span>📰</span> 官方发布日期: {item.date}
                            </span>
                          )}
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
                          <span>🔗 数据源: {item.sourceName}</span>
                          <a
                            href={item.link}
                            target="_blank"
                            rel="noreferrer"
                            className="btn btn-secondary"
                            style={{ fontSize: '0.8rem', padding: '0.25rem 0.65rem' }}
                          >
                            👉 查看官方公告原文 ↗
                          </a>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* 分页控制器 */}
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
            ) : (
              /* B: 按日期归档折叠分组视图 */
              <div>
                {groupedByDate.map((group) => {
                  const isCollapsed = collapsedDates[group.date];
                  const isToday = group.date === todayStr;

                  return (
                    <div key={group.date} className="date-group-card">
                      <div className="date-group-header" onClick={() => toggleDateCollapse(group.date)}>
                        <div className="date-group-title">
                          <span>{isToday ? '🌟' : '📅'}</span>
                          <span>{isToday ? `今日新增收录 (${group.date})` : `收录日期：${group.date}`}</span>
                          <span
                            className="type-tag type-rss"
                            style={{ fontSize: '0.78rem', padding: '0.15rem 0.5rem' }}
                          >
                            共 {group.items.length} 条
                          </span>
                          {group.matchedCount > 0 && (
                            <span className="match-badge-exact" style={{ fontSize: '0.75rem' }}>
                              ⭐ {group.matchedCount} 条符合主治/医疗编制
                            </span>
                          )}
                        </div>

                        <div className="date-group-actions">
                          <button
                            className="btn btn-secondary"
                            style={{ fontSize: '0.75rem', padding: '0.2rem 0.6rem' }}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleExportCSV(group.items, `南阳医疗招聘_${group.date}.csv`);
                            }}
                          >
                            📥 下载当天 CSV
                          </button>
                          <button
                            className="btn btn-secondary"
                            style={{ fontSize: '0.75rem', padding: '0.2rem 0.6rem' }}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCopyMarkdown(group.items, `🩺 南阳医疗招聘简报 (${group.date})`);
                            }}
                          >
                            📋 复制简报
                          </button>
                          <span style={{ fontSize: '0.85rem', color: '#94a3b8', marginLeft: '0.5rem' }}>
                            {isCollapsed ? '▶ 展开' : '▼ 折叠'}
                          </span>
                        </div>
                      </div>

                      {!isCollapsed && (
                        <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                          {group.items.map((item, idx) => {
                            const isExact = item.matchInfo?.level === 'exact';
                            const isHigh = item.matchInfo?.level === 'high';

                            return (
                              <div
                                key={item.id || idx}
                                className={`card ${isExact ? 'card-exact-match' : isHigh ? 'card-high-match' : ''}`}
                                style={{
                                  padding: '1rem',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  gap: '0.5rem',
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
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', flex: 1 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                                      {isExact && <span className="match-badge-exact">⭐ 极度匹配</span>}
                                      {isHigh && <span className="match-badge-high">🔥 高度匹配</span>}
                                      <a
                                        href={item.link}
                                        target="_blank"
                                        rel="noreferrer"
                                        style={{
                                          fontSize: '1rem',
                                          fontWeight: 700,
                                          color: isExact ? '#fef08a' : isHigh ? '#a7f3d0' : '#60a5fa',
                                        }}
                                      >
                                        {item.title}
                                      </a>
                                    </div>

                                    {item.matchInfo &&
                                      (item.matchInfo.matchedRegions.length > 0 ||
                                        item.matchInfo.matchedRoles.length > 0 ||
                                        item.matchInfo.matchedNatures.length > 0) && (
                                        <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                                          {item.matchInfo.matchedRegions.map((r) => (
                                            <span key={r} className="pill-tag pill-region">
                                              📍 {r}
                                            </span>
                                          ))}
                                          {item.matchInfo.matchedRoles.map((role) => (
                                            <span key={role} className="pill-tag pill-role">
                                              🩺 {role}
                                            </span>
                                          ))}
                                          {item.matchInfo.matchedNatures.map((n) => (
                                            <span key={n} className="pill-tag pill-nature">
                                              🏛️ {n}
                                            </span>
                                          ))}
                                        </div>
                                      )}
                                  </div>

                                  <span className="type-tag type-rss" style={{ flexShrink: 0 }}>
                                    {item.sourceName}
                                  </span>
                                </div>

                                {item.summary && (
                                  <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                    {item.summary}
                                  </p>
                                )}

                                <div
                                  style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    fontSize: '0.78rem',
                                    color: '#94a3b8',
                                  }}
                                >
                                  <span>{item.date ? `发布时间: ${item.date}` : `收录: ${item.crawledDate}`}</span>
                                  <a
                                    href={item.link}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="btn btn-secondary"
                                    style={{ fontSize: '0.75rem', padding: '0.2rem 0.55rem' }}
                                  >
                                    查看原文 ↗
                                  </a>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* 专属求职画像配置卡片 */}
            <div className="card" style={{ border: '1px solid rgba(234, 179, 8, 0.4)', background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.9) 0%, rgba(15, 23, 42, 0.95) 100%)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                <div>
                  <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#fef08a', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span>🩺</span>
                    <span>我的专属求职意向画像设置（主治医师 · 邓州/淅川/西峡 · 医疗事业编）</span>
                  </h2>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.25rem' }}>
                    配置后系统将自动为同时命中「地区+医疗岗位+事业编制」的公告打上金牌徽章，并支持在招聘大厅一键【只看适合我】及微信/飞书置顶推送。
                  </p>
                </div>
              </div>

              {/* 1. 关注地区 (Regions) */}
              <div className="form-group" style={{ marginTop: '1rem' }}>
                <label className="form-label" style={{ color: '#fdba74' }}>
                  📍 关注地区 (命中即打上地区标签，默认覆盖南阳及下辖三地)
                </label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="输入地区名称回车添加 (例如: 邓州, 淅川, 西峡, 南阳, 新野)..."
                    value={prefRegionInput}
                    onChange={(e) => setPrefRegionInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addPrefTag('regions', prefRegionInput)}
                  />
                  <button className="btn btn-secondary" onClick={() => addPrefTag('regions', prefRegionInput)}>
                    添加地区
                  </button>
                </div>
                <div className="tag-container">
                  {(filter.preferences?.regions || []).map((r) => (
                    <span key={r} className="tag" style={{ background: 'rgba(234, 88, 12, 0.25)', color: '#fdba74', borderColor: 'rgba(234, 88, 12, 0.5)' }}>
                      📍 {r}
                      <span className="tag-remove" onClick={() => removePrefTag('regions', r)}>
                        ×
                      </span>
                    </span>
                  ))}
                </div>
              </div>

              {/* 2. 意向岗位与专业 (Roles) */}
              <div className="form-group" style={{ marginTop: '1.25rem' }}>
                <label className="form-label" style={{ color: '#93c5fd' }}>
                  🩺 意向岗位 / 科室 / 专业方向 (包含主治医师、临床及各类医学岗位)
                </label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="输入岗位/专业词回车添加 (例如: 主治医师, 内科, 外科, 妇产, 急诊)..."
                    value={prefRoleInput}
                    onChange={(e) => setPrefRoleInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addPrefTag('roles', prefRoleInput)}
                  />
                  <button className="btn btn-secondary" onClick={() => addPrefTag('roles', prefRoleInput)}>
                    添加岗位
                  </button>
                </div>
                <div className="tag-container">
                  {(filter.preferences?.roles || []).map((role) => (
                    <span key={role} className="tag" style={{ background: 'rgba(59, 130, 246, 0.25)', color: '#93c5fd', borderColor: 'rgba(59, 130, 246, 0.5)' }}>
                      🩺 {role}
                      <span className="tag-remove" onClick={() => removePrefTag('roles', role)}>
                        ×
                      </span>
                    </span>
                  ))}
                </div>
              </div>

              {/* 3. 编制与招考性质 (Natures) */}
              <div className="form-group" style={{ marginTop: '1.25rem' }}>
                <label className="form-label" style={{ color: '#d8b4fe' }}>
                  🏛️ 招考属性 / 事业编制偏好 (事业编制、人才引进、高层次紧缺人才绿色通道)
                </label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="输入编制性质词回车添加 (例如: 事业编, 绿色通道, 人才引进)..."
                    value={prefNatureInput}
                    onChange={(e) => setPrefNatureInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addPrefTag('natures', prefNatureInput)}
                  />
                  <button className="btn btn-secondary" onClick={() => addPrefTag('natures', prefNatureInput)}>
                    添加编制词
                  </button>
                </div>
                <div className="tag-container">
                  {(filter.preferences?.natures || []).map((n) => (
                    <span key={n} className="tag" style={{ background: 'rgba(168, 85, 247, 0.25)', color: '#d8b4fe', borderColor: 'rgba(168, 85, 247, 0.5)' }}>
                      🏛️ {n}
                      <span className="tag-remove" onClick={() => removePrefTag('natures', n)}>
                        ×
                      </span>
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* 常规爬虫抓取关键词配置 */}
            <div className="card">
              <h2 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '1.25rem' }}>
                🎯 通用抓取关键词、年份与黑名单排除规则
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
                  招聘目标核心关键词 (标题或摘要包含任意一个即进入候选池，如: 招聘, 主治, 医师, 医疗, 卫生, 事业编)
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
                  🛡️ 排除词黑名单 (命中任意词直接丢弃，过滤体检公告、拟录用公示、培训辅导班广告等干扰)
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
                  {saving ? '保存中...' : '💾 保存全部求职画像与过滤规则至 Redis'}
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
