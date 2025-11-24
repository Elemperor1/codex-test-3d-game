const LEVELS = ['debug', 'info', 'warn', 'error'];
const MAX_BREADCRUMBS = 12;

class Logger {
  constructor() {
    this.sinks = [];
    this.handlersAttached = false;
    this.consoleSink = this.createConsoleSink();
    this.overlaySink = null;
    this.sessionId = this.generateSessionId();
    this.levelName = 'bootstrap';
    this.breadcrumbs = [];
    this.registerSink(this.consoleSink);
  }

  generateSessionId() {
    const globalCrypto = typeof crypto !== 'undefined' ? crypto : undefined;
    if (globalCrypto?.randomUUID) {
      return globalCrypto.randomUUID();
    }

    return `session-${Math.random().toString(36).slice(2)}-${Date.now()}`;
  }

  createConsoleSink() {
    const consoleMap = {
      debug: console.debug || console.log,
      info: console.info || console.log,
      warn: console.warn || console.log,
      error: console.error || console.log
    };

    return ({ level, message, timestamp, context }) => {
      const formatted = `[${timestamp}] [${level.toUpperCase()}] ${message}`;
      const writer = consoleMap[level] || console.log;
      if (context) {
        writer(formatted, context);
      } else {
        writer(formatted);
      }
    };
  }

  createOverlaySink(options = {}) {
    const maxEntries = options.maxEntries || 5;
    const overlay = document.createElement('div');
    overlay.className = 'logger-overlay';
    overlay.style.position = 'fixed';
    overlay.style.right = '16px';
    overlay.style.bottom = '16px';
    overlay.style.maxWidth = '420px';
    overlay.style.zIndex = '9999';
    overlay.style.display = 'flex';
    overlay.style.flexDirection = 'column';
    overlay.style.gap = '8px';
    overlay.style.pointerEvents = 'none';
    document.body.appendChild(overlay);

    const entries = [];

    return ({ level, message, timestamp }) => {
      const entry = document.createElement('div');
      entry.className = `logger-overlay__entry logger-overlay__entry--${level}`;
      entry.textContent = `[${timestamp}] ${message}`;
      entry.style.padding = '8px 12px';
      entry.style.borderRadius = '6px';
      entry.style.color = '#ffffff';
      entry.style.fontSize = '12px';
      entry.style.fontFamily = 'monospace';
      entry.style.background =
        level === 'error'
          ? 'rgba(220, 38, 38, 0.85)'
          : level === 'warn'
            ? 'rgba(234, 179, 8, 0.9)'
            : 'rgba(30, 41, 59, 0.9)';

      entries.push(entry);
      overlay.appendChild(entry);

      if (entries.length > maxEntries) {
        const oldEntry = entries.shift();
        if (oldEntry && oldEntry.parentNode) {
          oldEntry.parentNode.removeChild(oldEntry);
        }
      }

      setTimeout(() => {
        entry.style.opacity = '0';
        entry.style.transition = 'opacity 0.5s ease';
        setTimeout(() => {
          const index = entries.indexOf(entry);
          if (index !== -1) entries.splice(index, 1);
          if (entry.parentNode) entry.parentNode.removeChild(entry);
        }, 500);
      }, options.ttl || 6000);
    };
  }

  createNetworkSink(endpoint, fetchOptions = {}) {
    return async (entry) => {
      try {
        await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...(fetchOptions.headers || {}) },
          body: JSON.stringify(entry),
          keepalive: true,
          ...fetchOptions
        });
      } catch (err) {
        // Fallback to console to avoid silent failures
        this.consoleSink({
          level: 'warn',
          message: `Logger network sink failed: ${err?.message || err}`,
          timestamp: new Date().toISOString(),
          context: { entry, endpoint }
        });
      }
    };
  }

  registerSink(sink) {
    if (typeof sink === 'function') {
      this.sinks.push(sink);
    }
  }

  enableOverlaySink(options) {
    if (!this.overlaySink) {
      this.overlaySink = this.createOverlaySink(options);
      this.registerSink(this.overlaySink);
    }
    return this.overlaySink;
  }

  registerNetworkSink(endpoint, fetchOptions) {
    const sink = this.createNetworkSink(endpoint, fetchOptions);
    this.registerSink(sink);
    return sink;
  }

  startSession(levelName = 'unknown') {
    this.sessionId = this.generateSessionId();
    this.levelName = levelName;
    this.breadcrumbs = [];
    this.info('Session context initialized.', {
      module: 'logger',
      sessionId: this.sessionId,
      levelName: this.levelName
    });
  }

  setLevelName(levelName) {
    this.levelName = levelName;
  }

  addBreadcrumb(event, metadata = {}) {
    const breadcrumb = {
      event,
      timestamp: new Date().toISOString(),
      ...metadata
    };
    this.breadcrumbs.push(breadcrumb);
    if (this.breadcrumbs.length > MAX_BREADCRUMBS) {
      this.breadcrumbs.shift();
    }
    return breadcrumb;
  }

  getBreadcrumbSummary() {
    if (!this.breadcrumbs.length) return 'No breadcrumbs recorded.';

    const latest = this.breadcrumbs.slice(-5).map((crumb) => {
      const details = { ...crumb };
      delete details.timestamp;
      return `${crumb.event} (${Object.keys(details).length ? JSON.stringify(details) : 'no-details'})`;
    });

    return latest.join(' > ');
  }

  withContext(baseContext = {}) {
    const bindContext = (fn) => (message, context = {}) => fn.call(this, message, { ...baseContext, ...context });
    return {
      debug: bindContext(this.debug),
      info: bindContext(this.info),
      warn: bindContext(this.warn),
      error: bindContext(this.error),
      breadcrumb: (event, metadata = {}) => this.addBreadcrumb(event, { ...baseContext, ...metadata })
    };
  }

  log(level, message, context) {
    if (!LEVELS.includes(level)) {
      throw new Error(`Unknown log level: ${level}`);
    }

    const baseContext = {
      sessionId: this.sessionId,
      levelName: this.levelName,
      breadcrumbs: this.breadcrumbs.slice(-5),
      breadcrumbTrail: this.getBreadcrumbSummary()
    };

    const mergedContext = { ...baseContext, ...(context || {}) };

    const entry = {
      level,
      message,
      timestamp: new Date().toISOString(),
      context: Object.keys(mergedContext).length > 0 ? mergedContext : undefined
    };

    this.sinks.forEach((sink) => {
      try {
        sink(entry);
      } catch (err) {
        // Prevent sink failures from stopping logging entirely
        this.consoleSink({
          level: 'warn',
          message: `Logger sink error: ${err?.message || err}`,
          timestamp: new Date().toISOString(),
          context: { failedEntry: entry }
        });
      }
    });
  }

  debug(message, context) {
    this.log('debug', message, context);
  }

  info(message, context) {
    this.log('info', message, context);
  }

  warn(message, context) {
    this.log('warn', message, context);
  }

  error(message, context) {
    this.log('error', message, context);
  }

  attachGlobalErrorHandlers() {
    if (this.handlersAttached) return;

    window.addEventListener('error', (event) => {
      this.error('An unexpected error interrupted the game.', {
        message: event.message,
        source: event.filename,
        line: event.lineno,
        column: event.colno,
        error: event.error,
        nextSteps: 'Reload the page. If the issue persists, clear your cache or report the error.',
        breadcrumbTrail: this.getBreadcrumbSummary(),
        sessionId: this.sessionId
      });
    });

    window.addEventListener('unhandledrejection', (event) => {
      this.error('An unhandled promise rejection occurred.', {
        reason: event.reason,
        nextSteps: 'Retry the last action or reload the page to continue playing.',
        breadcrumbTrail: this.getBreadcrumbSummary(),
        sessionId: this.sessionId
      });
    });

    this.handlersAttached = true;
  }
}

export const logger = new Logger();

// Attach global handlers by default for safety.
logger.attachGlobalErrorHandlers();

export function enableHudLogging(options) {
  return logger.enableOverlaySink(options);
}

export function registerNetworkLogger(endpoint, fetchOptions) {
  return logger.registerNetworkSink(endpoint, fetchOptions);
}
