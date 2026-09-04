import { StrategyModelArtifact } from '../models/model-types';
import { ModelArtifact as BinaryModelArtifact } from '../model-types';
import { TimingModelArtifact } from '../timing/timing-types';

export class ArtifactManager {
  private static strategyArtifactStore = new Map<string, StrategyModelArtifact>();
  private static binaryArtifactStore = new Map<string, BinaryModelArtifact>();
  private static timingArtifactStore = new Map<string, TimingModelArtifact>();

  /**
   * Saves strategy prediction artifact
   */
  static saveStrategyArtifact(artifact: StrategyModelArtifact): void {
    this.strategyArtifactStore.set(artifact.modelVersion, JSON.parse(JSON.stringify(artifact)));
    console.log(`[ArtifactManager] Stored StrategyModelArtifact version: ${artifact.modelVersion}`);
  }

  /**
   * Loads strategy prediction artifact
   */
  static loadStrategyArtifact(version = 'RecoverIQ-StrategyPrediction-v1.0'): StrategyModelArtifact | null {
    const art = this.strategyArtifactStore.get(version);
    return art ? JSON.parse(JSON.stringify(art)) : null;
  }

  /**
   * Saves binary recovery probability artifact
   */
  static saveBinaryArtifact(artifact: BinaryModelArtifact): void {
    this.binaryArtifactStore.set(artifact.modelVersion, JSON.parse(JSON.stringify(artifact)));
  }

  /**
   * Loads binary recovery probability artifact
   */
  static loadBinaryArtifact(version = 'RecoverIQ-RecoveryProbability-v1.0'): BinaryModelArtifact | null {
    const art = this.binaryArtifactStore.get(version);
    return art ? JSON.parse(JSON.stringify(art)) : null;
  }

  /**
   * Saves timing prediction artifact
   */
  static saveTimingArtifact(artifact: TimingModelArtifact): void {
    this.timingArtifactStore.set(artifact.modelVersion, JSON.parse(JSON.stringify(artifact)));
    console.log(`[ArtifactManager] Stored TimingModelArtifact version: ${artifact.modelVersion}`);
  }

  /**
   * Loads timing prediction artifact
   */
  static loadTimingArtifact(version = 'RecoverIQ-TimingIntelligence-v1.0'): TimingModelArtifact | null {
    const art = this.timingArtifactStore.get(version);
    return art ? JSON.parse(JSON.stringify(art)) : null;
  }

  static clear(): void {
    this.strategyArtifactStore.clear();
    this.binaryArtifactStore.clear();
    this.timingArtifactStore.clear();
  }
}
