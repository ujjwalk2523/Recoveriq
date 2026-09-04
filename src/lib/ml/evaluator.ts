import { EvaluationMetrics } from './model-types';

export class MLEvaluator {
  /**
   * Evaluates binary classification predictions against actual ground-truth labels
   */
  static evaluate(yTrue: number[], yPredProbs: number[], threshold = 0.5): EvaluationMetrics {
    const N = yTrue.length;
    if (N === 0) {
      throw new Error('Cannot evaluate empty predictions array.');
    }

    let tp = 0;
    let fp = 0;
    let fn = 0;
    let tn = 0;
    let positiveCount = 0;
    let negativeCount = 0;

    let brierSum = 0;
    let logLossSum = 0;
    const eps = 1e-7;

    for (let i = 0; i < N; i++) {
      const actual = yTrue[i]!;
      const prob = yPredProbs[i]!;
      const predictedBinary = prob >= threshold ? 1 : 0;

      if (actual === 1) positiveCount++;
      else negativeCount++;

      if (predictedBinary === 1 && actual === 1) tp++;
      else if (predictedBinary === 1 && actual === 0) fp++;
      else if (predictedBinary === 0 && actual === 1) fn++;
      else if (predictedBinary === 0 && actual === 0) tn++;

      // Brier score: (p - y)^2
      brierSum += Math.pow(prob - actual, 2);

      // Log loss / cross-entropy
      const clampedProb = Math.max(eps, Math.min(1.0 - eps, prob));
      logLossSum += -(actual * Math.log(clampedProb) + (1.0 - actual) * Math.log(1.0 - clampedProb));
    }

    const accuracy = (tp + tn) / N;
    const precision = tp + fp > 0 ? tp / (tp + fp) : 0;
    const recall = tp + fn > 0 ? tp / (tp + fn) : 0;
    const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;
    const brierScore = brierSum / N;
    const logLoss = logLossSum / N;

    // Compute ROC-AUC using trapezoidal rule over sorted probability thresholds
    const rocAuc = this.computeRocAuc(yTrue, yPredProbs);

    return {
      accuracy: Number(accuracy.toFixed(4)),
      precision: Number(precision.toFixed(4)),
      recall: Number(recall.toFixed(4)),
      f1: Number(f1.toFixed(4)),
      rocAuc: Number(rocAuc.toFixed(4)),
      logLoss: Number(logLoss.toFixed(4)),
      brierScore: Number(brierScore.toFixed(4)),
      sampleCount: N,
      positiveCount,
      negativeCount,
    };
  }

  /**
   * Computes the Area Under the Receiver Operating Characteristic Curve (ROC-AUC)
   */
  private static computeRocAuc(yTrue: number[], yPredProbs: number[]): number {
    const N = yTrue.length;
    let posCount = 0;
    let negCount = 0;

    const paired = new Array<{ actual: number; prob: number }>(N);
    for (let i = 0; i < N; i++) {
      const actual = yTrue[i]!;
      if (actual === 1) posCount++;
      else negCount++;
      paired[i] = { actual, prob: yPredProbs[i]! };
    }

    if (posCount === 0 || negCount === 0) {
      return 0.5; // undefined/flat ROC curve
    }

    // Sort descending by predicted probability
    paired.sort((a, b) => b.prob - a.prob);

    let auc = 0;
    let accumulatedNegatives = 0;

    // Mann-Whitney U / Rank Sum trapezoidal formulation
    for (let i = 0; i < N; i++) {
      if (paired[i]!.actual === 0) {
        accumulatedNegatives += 1;
      } else {
        // For each positive, add how many negatives have a lower probability
        auc += (negCount - accumulatedNegatives);
      }
    }

    return auc / (posCount * negCount);
  }
}
