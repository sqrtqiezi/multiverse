import { type AppError, ErrorCode, type FormattedError } from '@multiverse/core';
import chalk from 'chalk';

const validErrorCodes: string[] = Object.values(ErrorCode);

/**
 * 将 FormattedError 格式化为带颜色和图标的终端输出
 */
export function formatErrorOutput(formatted: FormattedError): string {
  const lines: string[] = [];

  // 标题行
  lines.push(chalk.red.bold(`❌ ${formatted.title}`));
  lines.push('');

  // 描述
  lines.push(chalk.white(formatted.description));
  lines.push('');

  // 原因（可选）
  if (formatted.reason) {
    lines.push(chalk.yellow(formatted.reason));
    lines.push('');
  }

  // 建议（仅在有建议时显示标题）
  if (formatted.suggestions.length > 0) {
    lines.push(chalk.cyan('💡 解决建议：'));
    formatted.suggestions.forEach((suggestion, index) => {
      lines.push(chalk.cyan(`  ${index + 1}. ${suggestion}`));
    });
  }

  return lines.join('\n');
}

/**
 * 将任意错误转换为 AppError
 */
export function toAppError(error: unknown): AppError {
  // 如果已经是 AppError，验证 code 为有效的 ErrorCode 枚举值
  if (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof error.code === 'string' &&
    validErrorCodes.includes(error.code)
  ) {
    return error as AppError;
  }

  // 如果是 Error 对象，保留为 cause
  if (error instanceof Error) {
    return {
      code: 'UNKNOWN_ERROR',
      cause: error,
    };
  }

  // 如果是字符串，作为 message
  if (typeof error === 'string') {
    return {
      code: 'UNKNOWN_ERROR',
      message: error,
    };
  }

  // 其他类型
  return {
    code: 'UNKNOWN_ERROR',
    message: `Unknown error: ${String(error)}`,
  };
}
