# 库存进销存智能管理看板系统 · GitHub Pages 云同步版

## 功能
- 7 大模块：总览 / 库存管理 / 销售汇总 / 业务员分析 / 预测分析 / 年度汇总 / 数据上传
- 智能识别 4 种 Excel 格式（购进/销售汇总/业务员明细/现存量）
- 17 类产品分类体系，全模块分类筛选
- GitHub Gist API 多端实时云同步（房间制）
- 离线缓存 + 跨 Tab 广播同步

## 部署
纯静态站点，直接部署到 GitHub Pages / Netlify / Vercel 等任意静态托管。

## 云同步配置
1. 创建 GitHub Personal Access Token（需 `gist` 权限）
2. 打开系统 → 右上角「🏠 房间」→ 输入 Token → 保存
3. 创建房间 → 复制房间 ID 分享给其他设备
4. 其他设备输入同一 Gist ID + 各自 Token 即可同步
