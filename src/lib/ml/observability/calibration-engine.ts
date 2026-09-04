import { CalibrationBin, CalibrationReport } from './observability-types';

export class CalibrationEngine {
  /**
   * Computes 10-bin probability calibration, ECE, MCE, and reliability diagram curves
   */
  static computeCalibration(
    yTrue: number[],
    yPredProbs: number[],
    binCount = 10
  ): CalibrationReport {
    const N = yTrue.length;
    if (N === 0) throw new Error('Cannot compute calibration on an empty dataset.');

    const binSize = 1.0 / binCount;
    const bins: CalibrationBin[] = Array.from({ length: binCount }, (_, idx) => {
      const lower = Number((idx * binSize).toFixed(2));
      const upper = Number(((idx + 1) * binSize).toFixed(2));
      return {
        binIndex: idx + 1,
        binRange: [lower, upper],
        sampleCount: 0,
        positiveCount: 0,
        meanPredictedProbability: 0,
        actualFractionPositives: 0,
        calibrationError: 0,
      };
    });

    const sumPredProbs = new Array(binCount).fill(0);
    let brierSum = 0;

    for (let i = 0; i < N; i++) {
      const prob = yPredProbs[i]!;
      const actual = yTrue[i]!;

      brierSum += Math.pow(prob - actual, 2);

      // Find bin index (clamp 1.0 to the last bin)
      let binIdx = Math.min(binCount - 1, Math.floor(prob / binSize));
      if (prob >= 1.0) binIdx = binCount - 1;

      bins[binIdx]!.sampleCount += 1;
      if (actual === 1) {
        bins[binIdx]!.positiveCount += 1;
      }
      sumPredProbs[binIdx] += prob;
    }

    let weightedEceSum = 0;
    let maxMce = 0;

    for (let idx = 0; idx < binCount; idx++) {
      const b = bins[idx]!;
      if (b.sampleCount > 0) {
        b.meanPredictedProbability = Number((sumPredProbs[idx] / b.sampleCount).toFixed(4));
        b.actualFractionPositives = Number((b.positiveCount / b.sampleCount).toFixed(4));
        b.calibrationError = Number(
          Math.abs(b.meanPredictedProbability - b.actualFractionPositives).toFixed(4)
        );

        weightedEceSum += (b.sampleCount / N) * b.calibrationError;
        if (b.calibrationError > maxMce) {
          maxMce = b.calibrationError;
        }
      } else {
        const midPoint = (b.binRange[0] + b.binRange[1]) / 2;
        b.meanPredictedProbability = Number(midPoint.toFixed(4));
        b.actualFractionPositives = 0;
        b.calibrationError = 0;
      }
    }

    const ece = Number(weightedEceSum.toFixed(4));
    const mce = Number(maxMce.toFixed(4));
    const brierScore = Number((brierSum / N).toFixed(4));

    return {
      binCount,
      totalSamples: N,
      expectedCalibrationError: ece,
      maximumCalibrationError: mce,
      brierScore,
      bins,
      isWellCalibrated: ece <= 0.10,
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * Generates a readable ASCII reliability diagram
   */
  static formatReliabilityDiagram(report: CalibrationReport): string[] {
    const lines: string[] = [];
    lines.push(`Calibration Reliability Diagram (ECE: ${(report.expectedCalibrationError * 100).toFixed(2)}%, MCE: ${(report.maximumCalibrationError * 100).toFixed(2)}%, Brier: ${report.brierScore.toFixed(4)}):`);
    lines.push('  Bin Range   | Samples | Mean Pred | Actual Pos | Error   | Curve');
    lines.push('  ------------+---------+-----------+------------+---------+--------------------');

    for (const b of report.bins) {
      const rangeStr = `[${b.binRange[0].toFixed(1)}, ${b.binRange[1].toFixed(1)})`.padEnd(11);
      const countStr = String(b.sampleCount).padStart(7);
      const predStr = `${(b.meanPredictedProbability * 100).toFixed(1)}%`.padStart(9);
      const actStr = `${(b.actualFractionPositives * 100).toFixed(1)}%`.padStart(10);
      const errStr = `${(b.calibrationError * 100).toFixed(1)}%`.padStart(7);

      // ASCII bar
      const barLen = Math.round(b.actualFractionPositives * 20);
      const bar = '#'.repeat(barLen).padEnd(20);

      lines.push(`  ${rangeStr} | ${countStr} | ${predStr} | ${actStr} | ${errStr} | [${bar}]`);
    }

    return lines;
  }
}
