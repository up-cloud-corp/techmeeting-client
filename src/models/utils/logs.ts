// config.js
type LogLevel = "debug" | "info" | "warn" | "error";
type FeatureTag = "connection" | "content" | "event" | "form" | "position" | "priority" | "send" | "usermedia" | "render" | "misc";

/**
 * Refactored version of the previous logging mechanism.
 * Aims to provide intuitive and flexible configuration of the console logger.
 *
 * @since v1.5.0
 */
export class UCLogger {
  private static LOG_FEATURES: { [key in FeatureTag]: boolean } = {
    "connection": true,
    "content": true,
    "event": true,
    "form": true,
    "position": true,
    "priority": true,
    "send": true,
    "usermedia": true,
    "render": false,
    "misc": true,
  }
  private static LEVELS_ALLOWED: { [key in LogLevel]: boolean } = {
    "debug": false,
    "info": true,
    "warn": true,
    "error": true,
  };

  private feature: FeatureTag;
  private static instances: Map<FeatureTag, UCLogger> = new Map();

  private constructor(feature: FeatureTag) {
    this.feature = feature;
  }

  public static getByFeature(feature: FeatureTag): UCLogger {
    const existing = UCLogger.instances.get(feature);
    if (existing !== undefined) {
      return existing;
    }

    const logger = new UCLogger(feature);
    UCLogger.instances.set(feature, logger);
    return logger;
  }

  private canLog(level: LogLevel): boolean {
    return this.featureEnabled() && UCLogger.LEVELS_ALLOWED[level];
  }

  private log(level: LogLevel, ...data: any[]) {
    if (this.canLog(level)) {
      console[level](`[${this.feature}:${level}]`, ...data);
    }
  }

  public info = (...data: any[]) => this.log("info", ...data);
  public debug = (...data: any[]) => this.log("debug", ...data);
  public warn = (...data: any[]) => this.log("warn", ...data);
  public error = (...data: any[]) => this.log("error", ...data);

  public featureEnabled(): boolean {
    return UCLogger.LOG_FEATURES[this.feature];
  }
}
