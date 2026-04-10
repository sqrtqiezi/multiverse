import { ErrorCode } from './error-codes.js';
import type { ErrorTemplate } from './types.js';

/**
 * 错误信息模板
 *
 * 为每个错误码提供中文错误模板，包含标题、描述、原因和建议。
 */
export const ERROR_TEMPLATES: Record<ErrorCode, ErrorTemplate> = {
  [ErrorCode.DOCKER_NOT_AVAILABLE]: {
    title: 'Docker 不可用',
    description: '无法连接到 Docker 守护进程。Multiverse 需要 Docker 来运行 Verse 容器。',
    reason: 'Docker 未安装或未启动',
    suggestions: [
      '检查 Docker 是否已安装：docker --version',
      '启动 Docker 服务：sudo systemctl start docker（Linux）或启动 Docker Desktop（macOS/Windows）',
      '验证 Docker 是否运行：docker ps',
    ],
    exitCode: 1,
  },

  [ErrorCode.DOCKER_PERMISSION_DENIED]: {
    title: 'Docker 权限不足',
    description: '当前用户没有权限访问 Docker。需要将用户添加到 docker 组或使用 sudo。',
    reason: '用户不在 docker 组中',
    suggestions: [
      '将当前用户添加到 docker 组：sudo usermod -aG docker $USER',
      '重新登录以使组权限生效',
      '或使用 sudo 运行命令：sudo multiverse start',
    ],
    exitCode: 1,
  },

  [ErrorCode.CREDENTIALS_NOT_FOUND]: {
    title: 'Claude 凭证未找到',
    description: '未找到 Claude API 凭证。需要配置 ANTHROPIC_API_KEY 环境变量或 .env 文件。',
    reason: '未配置 API 密钥',
    suggestions: [
      '设置环境变量：export ANTHROPIC_API_KEY=your_api_key',
      '或在项目根目录创建 .env 文件并添加：ANTHROPIC_API_KEY=your_api_key',
      '从 Anthropic Console 获取 API 密钥：https://console.anthropic.com/',
    ],
    exitCode: 1,
  },

  [ErrorCode.CREDENTIALS_INVALID]: {
    title: 'Claude 凭证无效',
    description: '提供的 Claude API 凭证无效或已过期。请检查密钥是否正确。',
    reason: 'API 密钥格式错误或已失效',
    suggestions: [
      '验证 API 密钥格式是否正确（应以 sk-ant- 开头）',
      '检查密钥是否已过期或被撤销',
      '从 Anthropic Console 重新生成密钥：https://console.anthropic.com/',
    ],
    exitCode: 1,
  },

  [ErrorCode.CONTAINER_START_FAILED]: {
    title: '容器启动失败',
    description: 'Docker 容器启动失败。可能是端口冲突、资源不足或配置错误。',
    reason: '容器启动时遇到错误',
    suggestions: [
      '检查端口是否被占用：lsof -i :端口号',
      '查看容器日志：docker logs 容器ID',
      '检查系统资源是否充足：docker stats',
    ],
    exitCode: 1,
  },

  [ErrorCode.IMAGE_PULL_FAILED]: {
    title: '镜像拉取失败',
    description: '无法从 Docker Hub 拉取所需镜像。可能是网络问题或镜像不存在。',
    reason: '网络连接问题或镜像不可用',
    suggestions: [
      '检查网络连接：ping docker.io',
      '配置 Docker 镜像加速器（中国大陆用户）',
      '手动拉取镜像：docker pull 镜像名',
    ],
    exitCode: 1,
  },

  [ErrorCode.WORKSPACE_NOT_WRITABLE]: {
    title: '工作区不可写',
    description: '无法写入工作区目录。需要检查目录权限。',
    reason: '目录权限不足或磁盘只读',
    suggestions: [
      '检查目录权限：ls -la 工作区路径',
      '修改目录权限：chmod u+w 工作区路径',
      '确认磁盘未被挂载为只读：mount | grep 工作区路径',
    ],
    exitCode: 1,
  },

  [ErrorCode.DISK_SPACE_INSUFFICIENT]: {
    title: '磁盘空间不足',
    description: '磁盘剩余空间不足以创建或运行 Verse。建议至少保留 1GB 可用空间。',
    reason: '磁盘空间已满或接近满',
    suggestions: [
      '检查磁盘使用情况：df -h',
      '清理 Docker 未使用的资源：docker system prune -a',
      '删除不需要的文件或移动数据到其他磁盘',
    ],
    exitCode: 1,
  },

  [ErrorCode.VERSE_FILE_CORRUPTED]: {
    title: 'Verse 文件损坏',
    description: 'Verse 配置文件损坏或格式不正确，无法解析。',
    reason: '文件内容被破坏或格式错误',
    suggestions: [
      '检查 .verse.json 文件内容是否为有效 JSON',
      '从备份恢复文件（如果有）',
      '删除损坏的文件并重新创建 Verse：multiverse create',
    ],
    exitCode: 1,
  },

  [ErrorCode.UNKNOWN_ERROR]: {
    title: '未知错误',
    description: '发生了未预期的错误。这可能是程序 bug 或环境问题。',
    reason: '未知原因',
    suggestions: [
      '查看完整错误日志以获取更多信息',
      '尝试重新运行命令',
      '如果问题持续，请在 GitHub 提交 issue 并附上错误信息',
    ],
    exitCode: 1,
  },

  [ErrorCode.START_CANCELLED]: {
    title: '启动已取消',
    description: '用户选择取消启动。',
    reason: '用户在 drift 检测提示中选择了取消',
    suggestions: [
      '重新运行 multiverse start 并选择其他选项',
    ],
    exitCode: 0,
  },
};
