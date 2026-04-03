import type { ErrorCode } from './error-codes.js';

export interface AppError {
  code: ErrorCode;
  message?: string;
  cause?: Error;
  context?: Record<string, unknown>;
}

/**
 * 格式化后的错误对象，由 ErrorHandler.format() 返回
 *
 * 用于向用户展示错误信息，包含完整的错误详情和建议。
 * 与 ErrorTemplate 结构相同但语义不同：这是运行时生成的最终输出。
 */
export interface FormattedError {
  title: string;
  description: string;
  reason?: string;
  suggestions: string[];
  exitCode: number;
}

/**
 * 错误模板定义，存储在 ERROR_TEMPLATES 常量中
 *
 * 用于定义每种错误码对应的静态模板，包含标题、描述、原因和建议。
 * 与 FormattedError 结构相同但语义不同：这是预定义的模板配置。
 */
export interface ErrorTemplate {
  title: string;
  description: string;
  reason?: string;
  suggestions: string[];
  exitCode: number;
}
