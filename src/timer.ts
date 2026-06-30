import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from "@tauri-apps/plugin-notification";
import { loadSettings } from "./settings";
import { playWarningSound, playCompletionSound } from "./sound";

export type TimerStatus =
  | "IDLE"
  | "RUNNING"
  | "WARNING"
  | "PAUSED"
  | "COMPLETED"
  | "OVERTIME"
  | "STOPPED";

export interface TimerState {
  status: TimerStatus;
  startedAt: number | null;
  durationSeconds: number;
  warningBeforeEndSeconds: number;
  endsAt: number | null;
  warningAt: number | null;
  pausedAt: number | null;
  totalPausedMs: number;
  warningSent: boolean;
  completionSent: boolean;
  /** Whole seconds remaining (negative when in overtime). */
  remainingSeconds: number;
}

const TICK_MS = 200;

function initialState(): TimerState {
  return {
    status: "IDLE",
    startedAt: null,
    durationSeconds: 360,
    warningBeforeEndSeconds: 15,
    endsAt: null,
    warningAt: null,
    pausedAt: null,
    totalPausedMs: 0,
    warningSent: false,
    completionSent: false,
    remainingSeconds: 360,
  };
}

type Listener = (state: TimerState) => void;

class TimerEngine {
  private state: TimerState = initialState();
  private listeners = new Set<Listener>();
  private interval: ReturnType<typeof setInterval> | null = null;
  private notificationsAllowed = false;
  private notificationsEnabled = true;
  private soundsEnabled = true;
  private overtimeEnabled = true;

  getState(): TimerState {
    return this.state;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => this.listeners.delete(listener);
  }

  private emit() {
    for (const l of this.listeners) l(this.state);
  }

  private setState(patch: Partial<TimerState>) {
    this.state = { ...this.state, ...patch };
    this.emit();
  }

  /** Pull the latest alert-related preferences from the store. */
  private async refreshPrefs() {
    const s = await loadSettings();
    this.notificationsEnabled = s.showNotifications;
    this.soundsEnabled = s.playSounds;
    this.overtimeEnabled = s.overtimeMode;
  }

  async ensureNotificationPermission(): Promise<boolean> {
    try {
      let granted = await isPermissionGranted();
      if (!granted) {
        const result = await requestPermission();
        granted = result === "granted";
      }
      this.notificationsAllowed = granted;
      return granted;
    } catch {
      this.notificationsAllowed = false;
      return false;
    }
  }

  private notify(title: string, body: string) {
    if (!this.notificationsEnabled || !this.notificationsAllowed) return;
    try {
      sendNotification({ title, body });
    } catch {
      // Swallow — the panel's visual state is the fallback.
    }
  }

  /**
   * Start (or restart) the timer. Uses timestamp anchors so that lag,
   * background throttling, and sleep/wake all self-correct on the next tick.
   */
  async start(durationSeconds?: number, warningSeconds?: number) {
    await this.refreshPrefs();
    await this.ensureNotificationPermission();

    const settings = await loadSettings();
    const duration = durationSeconds ?? settings.defaultDurationSeconds;
    let warning = warningSeconds ?? settings.warningBeforeEndSeconds;
    // Guard: a warning offset >= duration would fire immediately; clamp it.
    if (warning >= duration) warning = Math.max(0, Math.min(warning, duration - 1));

    const now = Date.now();
    this.setState({
      status: "RUNNING",
      startedAt: now,
      durationSeconds: duration,
      warningBeforeEndSeconds: warning,
      endsAt: now + duration * 1000,
      warningAt: now + (duration - warning) * 1000,
      pausedAt: null,
      totalPausedMs: 0,
      warningSent: false,
      completionSent: false,
      remainingSeconds: duration,
    });

    this.startTicking();
    this.tick();
  }

  pause() {
    if (this.state.status !== "RUNNING" && this.state.status !== "WARNING") {
      return;
    }
    this.stopTicking();
    this.setState({ status: "PAUSED", pausedAt: Date.now() });
  }

  resume() {
    if (this.state.status !== "PAUSED" || this.state.pausedAt == null) return;
    const pausedFor = Date.now() - this.state.pausedAt;
    this.setState({
      status: "RUNNING",
      pausedAt: null,
      totalPausedMs: this.state.totalPausedMs + pausedFor,
      endsAt: (this.state.endsAt ?? Date.now()) + pausedFor,
      warningAt: (this.state.warningAt ?? Date.now()) + pausedFor,
    });
    this.startTicking();
    this.tick();
  }

  /** Restart the countdown from the full configured duration. */
  reset() {
    void this.start(this.state.durationSeconds, this.state.warningBeforeEndSeconds);
  }

  stop() {
    this.stopTicking();
    this.setState({
      status: "STOPPED",
      pausedAt: null,
      remainingSeconds: this.state.durationSeconds,
    });
  }

  private startTicking() {
    if (this.interval != null) return;
    this.interval = setInterval(() => this.tick(), TICK_MS);
  }

  private stopTicking() {
    if (this.interval != null) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  private tick() {
    const { endsAt, warningAt, status } = this.state;
    if (endsAt == null || warningAt == null) return;
    if (status === "PAUSED" || status === "IDLE" || status === "STOPPED") return;

    const now = Date.now();
    const remainingMs = endsAt - now;
    const remainingSeconds = Math.ceil(remainingMs / 1000);

    if (remainingMs <= 0) {
      // Timer reached zero (possibly while asleep — caught on first wake tick).
      if (!this.state.completionSent) {
        this.notify("QuikTimer", "Timer ended.");
        if (this.soundsEnabled) playCompletionSound();
        this.setState({ completionSent: true });
      }
      if (this.overtimeEnabled) {
        this.setState({ status: "OVERTIME", remainingSeconds });
      } else {
        this.setState({ status: "COMPLETED", remainingSeconds: 0 });
        this.stopTicking();
      }
      return;
    }

    if (now >= warningAt) {
      if (!this.state.warningSent) {
        this.notify(
          "QuikTimer",
          `${this.state.warningBeforeEndSeconds} seconds left — wrap up your task.`
        );
        if (this.soundsEnabled) playWarningSound();
        this.setState({ warningSent: true });
      }
      this.setState({ status: "WARNING", remainingSeconds });
      return;
    }

    this.setState({ status: "RUNNING", remainingSeconds });
  }
}

export const timer = new TimerEngine();
