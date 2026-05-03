class SessionManager {
  constructor({
    sessionTimeoutMs,
    autoGenerateEnabled,
    autoGenerateTimeoutMs,
    onSessionTimeout,
    onAutoGenerate
  }) {
    this.sessionTimeoutMs = sessionTimeoutMs;
    this.autoGenerateEnabled = autoGenerateEnabled;
    this.autoGenerateTimeoutMs = autoGenerateTimeoutMs;
    this.onSessionTimeout = onSessionTimeout;
    this.onAutoGenerate = onAutoGenerate;
    this.sessions = new Map();
  }

  getSession(userId) {
    if (!this.sessions.has(userId)) {
      this.sessions.set(userId, {
        images: [],
        active: false,
        updatedAt: Date.now(),
        timeoutTimer: null,
        autoGenerateTimer: null,
        isGenerating: false
      });
    }

    return this.sessions.get(userId);
  }

  start(userId) {
    const session = this.getSession(userId);
    session.active = true;
    session.images = [];
    session.updatedAt = Date.now();
    this.refreshTimers(userId);
  }

  isActive(userId) {
    const session = this.sessions.get(userId);
    return Boolean(session && session.active);
  }

  addImage(userId, image) {
    const session = this.getSession(userId);
    if (!session.active) {
      return 0;
    }

    session.images.push(image);
    session.updatedAt = Date.now();
    this.refreshTimers(userId);
    return session.images.length;
  }

  count(userId) {
    const session = this.sessions.get(userId);
    return session ? session.images.length : 0;
  }

  getImages(userId) {
    const session = this.sessions.get(userId);
    return session ? [...session.images] : [];
  }

  hasImages(userId) {
    return this.count(userId) > 0;
  }

  setGenerating(userId, isGenerating) {
    const session = this.sessions.get(userId);
    if (session) session.isGenerating = isGenerating;
  }

  isGenerating(userId) {
    const session = this.sessions.get(userId);
    return Boolean(session && session.isGenerating);
  }

  clear(userId) {
    const session = this.sessions.get(userId);
    if (!session) return 0;

    const count = session.images.length;
    this.clearTimers(session);
    session.images = [];
    this.sessions.delete(userId);
    return count;
  }

  clearAll() {
    for (const userId of this.sessions.keys()) {
      this.clear(userId);
    }
  }

  refreshTimers(userId) {
    const session = this.sessions.get(userId);
    if (!session) return;

    if (session.timeoutTimer) clearTimeout(session.timeoutTimer);
    session.timeoutTimer = setTimeout(() => {
      const count = this.clear(userId);
      if (count > 0 && typeof this.onSessionTimeout === 'function') {
        this.onSessionTimeout(userId, count);
      }
    }, this.sessionTimeoutMs);

    if (session.autoGenerateTimer) clearTimeout(session.autoGenerateTimer);
    if (this.autoGenerateEnabled) {
      session.autoGenerateTimer = setTimeout(() => {
        if (typeof this.onAutoGenerate === 'function') {
          this.onAutoGenerate(userId).catch(() => {});
        }
      }, this.autoGenerateTimeoutMs);
    }
  }

  clearTimers(session) {
    if (session.timeoutTimer) clearTimeout(session.timeoutTimer);
    if (session.autoGenerateTimer) clearTimeout(session.autoGenerateTimer);
  }
}

module.exports = SessionManager;
