import { ErrorCode } from './error-codes.js';
import { ERROR_TEMPLATES } from './error-templates.js';
import type { AppError, FormattedError } from './types.js';

export class ErrorHandler {
  format(error: AppError): FormattedError {
    const template =
      ERROR_TEMPLATES[error.code] || ERROR_TEMPLATES[ErrorCode.UNKNOWN_ERROR];

    return {
      title: template.title,
      description: this.replaceVariables(template.description, error.context),
      reason: template.reason,
      suggestions: template.suggestions.map((s: string) =>
        this.replaceVariables(s, error.context)
      ),
      exitCode: template.exitCode,
    };
  }

  private replaceVariables(
    text: string,
    context?: Record<string, unknown>
  ): string {
    if (!context) {
      return text;
    }

    let result = text;
    for (const [key, value] of Object.entries(context)) {
      result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), String(value));
    }

    return result;
  }
}
