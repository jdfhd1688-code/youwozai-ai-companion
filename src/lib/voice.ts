export type VoiceScene = "normal" | "chat" | "weekly_letter" | "comforting" | "safety";
export type VoiceSpeed = "slow" | "natural" | "fast";

export class VoiceCoordinator {
  private activeId: string | null = null;
  private stopPrevious: ((id: string) => void) | null = null;

  play(id: string, stopPrevious: (id: string) => void): boolean {
    if (this.activeId && this.activeId !== id && this.stopPrevious) {
      this.stopPrevious(this.activeId);
    }
    this.activeId = id;
    this.stopPrevious = stopPrevious;
    return true;
  }

  stop(): void {
    if (this.activeId && this.stopPrevious) this.stopPrevious(this.activeId);
    this.activeId = null;
  }

  getActiveId(): string | null {
    return this.activeId;
  }
}

export function speechRate(speed: VoiceSpeed): number {
  if (speed === "slow") return 0.85;
  if (speed === "fast") return 1.15;
  return 1;
}
