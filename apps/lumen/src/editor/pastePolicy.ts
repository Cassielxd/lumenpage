import {
  normalizePastedText as normalizePastedTextImpl,
  sanitizePastedHtml as sanitizePastedHtmlImpl,
  setSecurityPolicy,
  type SecurityAuditEvent,
} from "lumenpage-link";

const SECURITY_AUDIT_LOGS_KEY = "__lumenSecurityAuditLogs";
const MAX_SECURITY_AUDIT_LOGS = 300;

const pushSecurityAuditLog = (event: SecurityAuditEvent) => {
  const globalObj = globalThis as any;
  if (!Array.isArray(globalObj[SECURITY_AUDIT_LOGS_KEY])) {
    globalObj[SECURITY_AUDIT_LOGS_KEY] = [];
  }
  const logs = globalObj[SECURITY_AUDIT_LOGS_KEY] as SecurityAuditEvent[];
  logs.push(event);
  if (logs.length > MAX_SECURITY_AUDIT_LOGS) {
    logs.splice(0, logs.length - MAX_SECURITY_AUDIT_LOGS);
  }
};

export const configurePlaygroundSecurityPolicy = (options: { enableAudit?: boolean } = {}) => {
  const enableAudit = options.enableAudit === true;
  setSecurityPolicy({
    onAudit: enableAudit ? pushSecurityAuditLog : null,
  });
  if (!enableAudit) {
    const globalObj = globalThis as any;
    globalObj[SECURITY_AUDIT_LOGS_KEY] = [];
  }
};

export const consumePlaygroundSecurityAuditLogs = (): SecurityAuditEvent[] => {
  const globalObj = globalThis as any;
  const logs = Array.isArray(globalObj[SECURITY_AUDIT_LOGS_KEY])
    ? [...globalObj[SECURITY_AUDIT_LOGS_KEY]]
    : [];
  globalObj[SECURITY_AUDIT_LOGS_KEY] = [];
  return logs;
};

export const normalizePastedText = (text: string) => normalizePastedTextImpl(text);

export const sanitizePastedHtml = (html: string) =>
  sanitizePastedHtmlImpl(html, {
    source: "paste-html",
  });


