import {
  ALL_STRATEGY_CLASSES,
  BinaryEvaluationMetrics,
  MulticlassEvaluationMetrics,
  RecoveryStrategyClass,
} from '../models/model-types';

export class MLEvaluator {
  /**
   * Evaluates binary classification predictions
   */
  static evaluateBinary(yTrue: number[], yPredProbs: number[], threshold = 0.5): BinaryEvaluationMetrics {
    const N = yTrue.length;
    if (N === 0) throw new Error('Cannot evaluate empty predictions array.');

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
      const pred = prob >= threshold ? 1 : 0;

      if (actual === 1) positiveCount++;
      else negativeCount++;

      if (pred === 1 && actual === 1) tp++;
      else if (pred === 1 && actual === 0) fp++;
      else if (pred === 0 && actual === 1) fn++;
      else if (pred === 0 && actual === 0) tn++;

      brierSum += Math.pow(prob - actual, 2);
      const p = Math.max(eps, Math.min(1.0 - eps, prob));
      logLossSum += -(actual * Math.log(p) + (1.0 - actual) * Math.log(1.0 - p));
    }

    const accuracy = (tp + tn) / N;
    const precision = tp + fp > 0 ? tp / (tp + fp) : 0;
    const recall = tp + fn > 0 ? tp / (tp + fn) : 0;
    const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;

    // ROC-AUC
    let rocAuc = 0.5;
    if (positiveCount > 0 && negativeCount > 0) {
      const paired = yTrue.map((act, idx) => ({ act, prob: yPredProbs[idx]! }));
      paired.sort((a, b) => b.prob - a.prob);
      let auc = 0;
      let accumNeg = 0;
      for (let i = 0; i < N; i++) {
        if (paired[i]!.act === 0) accumNeg++;
        else auc += (negativeCount - accumNeg);
      }
      rocAuc = auc / (positiveCount * negativeCount);
    }

    return {
      accuracy: Number(accuracy.toFixed(4)),
      precision: Number(precision.toFixed(4)),
      recall: Number(recall.toFixed(4)),
      f1: Number(f1.toFixed(4)),
      rocAuc: Number(rocAuc.toFixed(4)),
      logLoss: Number((logLossSum / N).toFixed(4)),
      brierScore: Number((brierSum / N).toFixed(4)),
      sampleCount: N,
      positiveCount,
      negativeCount,
    };
  }

  /**
   * Evaluates multiclass strategy predictions across all 7 strategy classes
   */
  static evaluateMulticlass(
    yTrueIndices: number[],
    predictedDistribution: Record<RecoveryStrategyClass, number>[]
  ): MulticlassEvaluationMetrics {
    const N = yTrueIndices.length;
    if (N === 0) throw new Error('Cannot evaluate empty multiclass predictions.');

    const classes = ALL_STRATEGY_CLASSES;
    const K = classes.length;

    let top1Matches = 0;
    let top3Matches = 0;
    let logLossSum = 0;
    const eps = 1e-7;

    // Per-class metrics counters
    const tp = new Array(K).fill(0);
    const fp = new Array(K).fill(0);
    const fn = new Array(K).fill(0);
    const support = new Array(K).fill(0);

    for (let i = 0; i < N; i++) {
      const actualIdx = yTrueIndices[i]!;
      const actualClass = classes[actualIdx]!;
      const probMap = predictedDistribution[i]!;

      support[actualIdx] += 1;

      // Sort predictions descending
      const sortedClasses = Object.entries(probMap)
        .sort((a, b) => b[1] - a[1])
        .map(entry => entry[0] as RecoveryStrategyClass);

      const top1 = sortedClasses[0]!;
      const top3 = sortedClasses.slice(0, 3);

      if (top1 === actualClass) {
        top1Matches++;
      }
      if (top3.includes(actualClass)) {
        top3Matches++;
      }

      // Update per-class stats
      const predIdx = classes.indexOf(top1);
      if (predIdx === actualIdx) {
        tp[actualIdx] += 1;
      } else {
        fp[predIdx] += 1;
        fn[actualIdx] += 1;
      }

      // Cross-entropy log loss
      const trueProb = Math.max(eps, probMap[actualClass] ?? eps);
      logLossSum += -Math.log(trueProb);
    }

    const classMetrics: MulticlassEvaluationMetrics['classMetrics'] = {} as any;
    let macroPrecSum = 0;
    let macroRecSum = 0;
    let macroF1Sum = 0;

    for (let k = 0; k < K; k++) {
      const c = classes[k]!;
      const prec = tp[k]! + fp[k]! > 0 ? tp[k]! / (tp[k]! + fp[k]!) : 0;
      const rec = tp[k]! + fn[k]! > 0 ? tp[k]! / (tp[k]! + fn[k]!) : 0;
      const f1 = prec + rec > 0 ? (2 * prec * rec) / (prec + rec) : 0;

      classMetrics[c] = {
        precision: Number(prec.toFixed(4)),
        recall: Number(rec.toFixed(4)),
        f1: Number(f1.toFixed(4)),
        support: support[k]!,
      };

      macroPrecSum += prec;
      macroRecSum += rec;
      macroF1Sum += f1;
    }

    return {
      sampleCount: N,
      top1Accuracy: Number((top1Matches / N).toFixed(4)),
      top3Accuracy: Number((top3Matches / N).toFixed(4)),
      macroPrecision: Number((macroPrecSum / K).toFixed(4)),
      macroRecall: Number((macroRecSum / K).toFixed(4)),
      macroF1: Number((macroF1Sum / K).toFixed(4)),
      multiclassLogLoss: Number((logLossSum / N).toFixed(4)),
      classMetrics,
    };
  }
}
