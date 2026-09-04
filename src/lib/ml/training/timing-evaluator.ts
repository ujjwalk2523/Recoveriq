import {
  ALL_TIME_BUCKETS,
  TimeBucket,
  TimingEvaluationMetrics,
} from '../timing/timing-types';

export class TimingEvaluator {
  /**
   * Evaluates multiclass timing bucket predictions across all 7 time windows
   */
  static evaluate(
    yTrueIndices: number[],
    predictedDistribution: Record<TimeBucket, number>[]
  ): TimingEvaluationMetrics {
    const N = yTrueIndices.length;
    if (N === 0) throw new Error('Cannot evaluate empty timing predictions.');

    const classes = ALL_TIME_BUCKETS;
    const K = classes.length;

    let top1Matches = 0;
    let top3Matches = 0;
    let logLossSum = 0;
    const eps = 1e-7;

    const tp = new Array(K).fill(0);
    const fp = new Array(K).fill(0);
    const fn = new Array(K).fill(0);
    const support = new Array(K).fill(0);

    for (let i = 0; i < N; i++) {
      const actualIdx = yTrueIndices[i]!;
      const actualBucket = classes[actualIdx]!;
      const probMap = predictedDistribution[i]!;

      support[actualIdx] += 1;

      // Sort predictions descending
      const sortedClasses = Object.entries(probMap)
        .sort((a, b) => b[1] - a[1])
        .map(entry => entry[0] as TimeBucket);

      const top1 = sortedClasses[0]!;
      const top3 = sortedClasses.slice(0, 3);

      if (top1 === actualBucket) top1Matches++;
      if (top3.includes(actualBucket)) top3Matches++;

      const predIdx = classes.indexOf(top1);
      if (predIdx === actualIdx) {
        tp[actualIdx] += 1;
      } else {
        fp[predIdx] += 1;
        fn[actualIdx] += 1;
      }

      const trueProb = Math.max(eps, probMap[actualBucket] ?? eps);
      logLossSum += -Math.log(trueProb);
    }

    const classMetrics: TimingEvaluationMetrics['classMetrics'] = {} as any;
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
