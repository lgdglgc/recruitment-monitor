# 招聘信息自动监控推送系统 (Recruitment Monitor)

基于 **Next.js (App Router)** + **TypeScript** + **Upstash Redis** + **Server酱** 的轻量级自动招聘信息监控推送系统。

---

## 🌟 核心特性

1. **多数据源适配**：
   - 支持 **RSS 订阅**（原生支持微信公众号通过 RSSHub / WeRss 转换的 RSS 源）。
   - 支持 **HTML 通用网页爬取**（支持自定义 Cheerio CSS 选择器提取）。
   - 支持 **自定义 API 适配器**（针对复杂 JSON 接口或加密网站）。
2. **智能关键词过滤**：
   - 支持年份规则（如 `2026`, `2027`）。
   - 支持关键词过滤（如 `校招`, `春招`, `秋招`, `应届`, `招聘`, `岗位`）。
   - 支持 `AND` / `OR` 多种逻辑组合匹配。
3. **Upstash Redis 云端高效去重**：
   - 自动生成文章链接 MD5 哈希作为唯一标识。
   - 保存在 Upstash Redis（开箱即用免费额度），支持自定义 30 天 TTL 过期自动清理。
4. **防刷屏汇总推送**：
   - 单次运行自动收集所有新匹配的招聘，格式化为整洁优雅的 Markdown 摘要合并成一条，通过 **Server酱** 实时推送给微信。
5. **双重定时任务**：
   - **Vercel Cron**：原生支持每日定时监控。
   - **GitHub Actions**：打破免费限制，提供 15~30 分钟的高频高实时性监控。

---

## 📂 项目文件树结构

```
.
├── .github/
│   └── workflows/
│       └── monitor.yml           # GitHub Actions 高频定时监控工作流
├── app/
│   └── api/
│       └── cron/
│           └── route.ts          # Cron 触发的主入口 API 路由
├── lib/
│   ├── config.ts                 # 监控源配置、关键词配置、系统阈值
│   ├── redis.ts                  # Upstash Redis 去重服务
│   ├── notify.ts                 # Server酱 消息推送模块 (Markdown 格式化)
│   ├── filter.ts                 # 关键词与年份过滤逻辑
│   ├── scraper.ts                # 爬虫主引擎与调度
│   ├── types.ts                  # TypeScript 类型定义
│   └── adapters/
│       ├── base.ts               # 适配器基类 (带超时、请求重试、自定义 User-Agent)
│       ├── rss.ts                # RSS / 微信公众号 RSS 适配器
│       ├── html.ts               # 通用 HTML 页面选择器适配器
│       └── custom-example.ts     # 自定义 JSON API 适配器模板
├── .env.example                  # 环境变量模板
├── vercel.json                   # Vercel Cron 配置
├── package.json
└── tsconfig.json
```

---

## 🛠️ 快速开始与本地测试

### 1. 安装依赖

```bash
npm install
```

### 2. 配置本地环境变量

复制 `.env.example` 并重命名为 `.env.local`：

```bash
cp .env.example .env.local
```

修改 `.env.local` 中的关键配置：

- `SERVERCHAN_SENDKEY`：在 [Server酱官网](https://sct.ftqq.com/) 登录后获取的 SendKey。
- `UPSTASH_REDIS_REST_URL` & `UPSTASH_REDIS_REST_TOKEN`：在 [Upstash Console](https://console.upstash.com/) 创建免费 Redis 数据库后获取。*(如暂未配置，系统会自动降级为本地内存去重)*
- `CRON_SECRET`：自定义的触发安全密钥（如 `my_super_secret_123`）。

### 3. 本地运行与测试

启动开发服务器：

```bash
npm run dev
```

在浏览器或终端调用触发接口（包含密钥）：

```bash
curl "http://localhost:3000/api/cron?secret=your_custom_secure_cron_secret"
```

你将在控制台看到抓取与过滤日志，如果匹配到新招聘且配置了 `SERVERCHAN_SENDKEY`，微信将收到包含招聘详情的推送！

---

## 🚀 部署指南 (Vercel + Upstash + Server酱)

### 第一步：创建 Upstash Redis 数据库 (免费)
1. 访问 [Upstash 官网](https://console.upstash.com/) 并使用 GitHub 账号登录。
2. 点击 **Create Database**，选择 **Redis**，地区选择离你最近的节点（如 AWS ap-northeast-1 节点）。
3. 创建完成后，在数据库 Details 页面找到 **REST API** 部分。
4. 复制 `UPSTASH_REDIS_REST_URL` 和 `UPSTASH_REDIS_REST_TOKEN` 的值。

### 第二步：获取 Server酱 推送 SendKey
1. 访问 [Server酱 Turbo 版官网](https://sct.ftqq.com/)。
2. 扫码登录后，点击 **SendKey** 页面获取你的密钥（格式如 `SCTxxxxxxxxxx`）。
3. 在【消息通道】中选择配置你接收提醒的微信通道。

### 第三步：部署到 Vercel
1. 将本项目代码 Push 到你的 GitHub 个人仓库。
2. 登录 [Vercel 官网](https://vercel.com/)，点击 **Add New... -> Project**。
3. 导入你的 GitHub 仓库。
4. 在 **Environment Variables** 选项卡中添加以下环境变量：

| 环境变量名 | 说明 | 示例值 |
| :--- | :--- | :--- |
| `UPSTASH_REDIS_REST_URL` | Upstash Redis API URL | `https://xxx.upstash.io` |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash Redis API Token | `AXXXxxxxxxx` |
| `SERVERCHAN_SENDKEY` | Server酱 SendKey | `SCTxxxxxxxxxxxx` |
| `CRON_SECRET` | 接口鉴权密钥 | `your_secure_cron_secret` |

5. 点击 **Deploy** 部署完成。

---

## ⏰ 高频监控方案 (GitHub Actions 15-30 分钟轮询)

由于 Vercel Hobby 免费套餐的 Vercel Cron 每天最多只能触发 1 次，系统已内置了 **GitHub Actions** 自动化工作流 `.github/workflows/monitor.yml`。

### 配置 GitHub Actions 密钥：
1. 打开你项目在 GitHub 上的仓库页面，进入 **Settings -> Secrets and variables -> Actions**。
2. 点击 **New repository secret**，添加以下两个 Secret：
   - `VERCEL_PROJECT_URL`：在 Vercel 部署完成后分配的域名（例如 `https://your-app-name.vercel.app`）。
   - `CRON_SECRET`：你在 Vercel 环境变量中配置的相同 `CRON_SECRET`。
3. 配置完成后，GitHub Actions 将默认每 30 分钟定期调用你的 Vercel API 执行数据监控！你也可以在 Actions 标签页手动点击 **Run workflow** 立即测试。

---

## ➕ 如何添加新网站监控源与自定义适配器

所有监控数据源与关键词配置均放在 [lib/config.ts](file:///e%3A/vsc/%E4%BF%A1%E6%81%AF%E7%88%AC%E5%8F%96/lib/config.ts) 文件中。

### 1. 添加微信公众号 RSS 源
微信公众号不建议直接硬爬，优先推荐将其转为 RSS 订阅源（如使用自建的 RSSHub 或 WeRss）：

```typescript
// lib/config.ts 中的 SOURCES_CONFIG
{
  id: 'my-wechat-rss',
  name: '微信公众号「XX招聘」',
  type: 'rss',
  url: 'https://your-rsshub-domain/wechat/officialaccounts/your_account_id',
}
```

### 2. 添加通用 HTML 网站爬取源
如果目标网站是静态 HTML 页面，使用 `type: 'html'` 并配好 CSS 选择器：

```typescript
{
  id: 'my-univ-career',
  name: 'XX大学就业网',
  type: 'html',
  url: 'https://career.xxx.edu.cn/jobs',
  selector: {
    container: '.job-item',       // 包含每条招聘信息的 HTML 节点选择器
    title: '.job-title a',        // 标题选择器
    link: '.job-title a',         // 链接选择器
    date: '.job-date',            // 发布日期选择器 (可选)
    summary: '.job-desc',         // 描述选择器 (可选)
  },
}
```

### 3. 添加自定义复杂 API 适配器模板
如果目标网站是加密接口或复杂的异步 JSON API，可按以下步骤新建适配器：

1. 在 `lib/adapters/` 下新增适配器文件（参考 [lib/adapters/custom-example.ts](file:///e%3A/vsc/%E4%BF%A1%E6%81%AF%E7%88%AC%E5%8F%96/lib/adapters/custom-example.ts)）：

```typescript
import { BaseAdapter } from './base';
import { JobItem } from '../types';
import { generateJobHash } from '../redis';

export class MyCustomSiteAdapter extends BaseAdapter {
  async fetchItems(): Promise<JobItem[]> {
    const res = await this.fetchWithRetry(this.config.url);
    const json = await res.json();
    
    return json.data.map((item: any) => ({
      id: generateJobHash(item.detailUrl),
      title: item.title,
      link: item.detailUrl,
      date: item.publishDate,
      sourceName: this.config.name,
    }));
  }
}
```

2. 在 [lib/scraper.ts](file:///e%3A/vsc/%E4%BF%A1%E6%81%AF%E7%88%AC%E5%8F%96/lib/scraper.ts) 中的 `createAdapter` 工厂方法里注册新类即可。

---

## 🔒 异常处理与防刷屏机制

1. **超时与自动重试**：每次网络请求均带有 `10000ms` 超时保护，支持最多 2 次指数退避重试，防止由于单接口超时导致整个 Serverless 崩溃。
2. **智能消息合并**：当单次检测到多条新招聘时，自动拼接为标准的 Markdown 合并列表，只调用一次 Server酱 接口，绝刷屏。
3. **容错机制**：单个抓取源失败不会阻塞其他源的抓取与推送，错误信息将记录在 API 响应日志中。
