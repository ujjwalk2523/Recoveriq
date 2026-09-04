import { SegmentMetric, SegmentReport } from './observability-types';

export interface SliceSample {
  paymentMethod: string;
  failureCategory: string;
  amount: number;
  customerSegment?: string;
  predictedProbability: number;
  actualRecovered: number; // 0 or 1
}

export class SegmentEvaluator {
  /**
   * Evaluates granular segment performance to identify model weaknesses
   */
  static evaluateSegments(samples: SliceSample[]): SegmentReport {
    const N = samples.length;
    if (N === 0) throw new Error('Cannot evaluate segments on empty sample array.');

    // Helper to evaluate slice metrics
    const evaluateSlice = (
      sliceDimension: string,
      sliceValue: string,
      sliceSamples: SliceSample[]
    ): SegmentMetric => {
      const count = sliceSamples.length;
      if (count === 0) {
        return {
          segmentKey: `${sliceDimension}:${sliceValue}`,
          sliceDimension,
          sliceValue,
          sampleCount: 0,
          actualRecoveryRate: 0,
          meanPredictedProbability: 0,
          accuracy: 0,
          precision: 0,
          recall: 0,
          f1: 0,
          rocAuc: 0.5,
          isWeakSegment: false,
        };
      }

      let tp = 0;
      let fp = 0;
      let fn = 0;
      let tn = 0;
      let posCount = 0;
      let negCount = 0;
      let sumProb = 0;

      for (const s of sliceSamples) {
        sumProb += s.predictedProbability;
        const pred = s.predictedProbability >= 0.5 ? 1 : 0;
        const act = s.actualRecovered;

        if (act === 1) posCount++;
        else negCount++;

        if (pred === 1 && act === 1) tp++;
        else if (pred === 1 && act === 0) fp++;
        else if (pred === 0 && act === 1) fn++;
        else if (pred === 0 && act === 0) tn++;
      }

      const actualRecoveryRate = Number((posCount / count).toFixed(4));
      const meanPredictedProbability = Number((sumProb / count).toFixed(4));
      const accuracy = Number(((tp + tn) / count).toFixed(4));
      const precision = tp + fp > 0 ? Number((tp / (tp + fp)).toFixed(4)) : 0;
      const recall = tp + fn > 0 ? Number((tp / (tp + fn)).toFixed(4)) : 0;
      const f1 = precision + recall > 0 ? Number(((2 * precision * recall) / (precision + recall)).toFixed(4)) : 0;

      // ROC-AUC
      let rocAuc = 0.5;
      if (posCount > 0 && negCount > 0) {
        const paired = sliceSamples.map(s => ({ act: s.actualRecovered, prob: s.predictedProbability }));
        paired.sort((a, b) => b.prob - a.prob);
        let auc = 0;
        let accumNeg = 0;
        for (let i = 0; i < count; i++) {
          if (paired[i]!.act === 0) accumNeg++;
          else auc += (negCount - accumNeg);
        }
        rocAuc = Number((auc / (posCount * negCount)).toFixed(4));
      }

      const isWeakSegment = count >= 20 && (rocAuc < 0.70 || accuracy < 0.65);

      return {
        segmentKey: `${sliceDimension}:${sliceValue}`,
        sliceDimension,
        sliceValue,
        sampleCount: count,
        actualRecoveryRate,
        meanPredictedProbability,
        accuracy,
        precision,
        recall,
        f1,
        rocAuc,
        isWeakSegment,
      };
    };

    // Amount Bins
    const getAmountBand = (amount: number): string => {
      if (amount < 1000) return 'MICRO (<₹1k)';
      if (amount < 5000) return 'LOW (₹1k-5k)';
      if (amount < 25000) return 'MID (₹5k-25k)';
      return 'HIGH (>₹25k)';
    };

    // Grouping by dimensions
    const byMethod: Record<string, SliceSample[]> = {};
    const byCategory: Record<string, SliceSample[]> = {};
    const byAmountBand: Record<string, SliceSample[]> = {};
    const byCustomerSegment: Record<string, SliceSample[]> = {};

    for (const s of samples) {
      const m = s.paymentMethod || 'OTHER';
      const c = s.failureCategory || 'OTHER';
      const a = getAmountBand(s.amount);
      const seg = s.customerSegment || 'CONSUMER';

      if (!byMethod[m]) byMethod[m] = [];
      byMethod[m]!.push(s);

      if (!byCategory[c]) byCategory[c] = [];
      byCategory[c]!.push(s);

      if (!byAmountBand[a]) byAmountBand[a] = [];
      byAmountBand[a]!.push(s);

      if (!byCustomerSegment[seg]) byCustomerSegment[seg] = [];
      byCustomerSegment[seg]!.push(s);
    }

    const segmentMetrics: Record<string, SegmentMetric[]> = {
      payment_method: Object.keys(byMethod).map(m => evaluateSlice('payment_method', m, byMethod[m]!)),
      failure_category: Object.keys(byCategory).map(c => evaluateSlice('failure_category', c, byCategory[c]!)),
      amount_band: Object.keys(byAmountBand).map(a => evaluateSlice('amount_band', a, byAmountBand[a]!)),
      customer_segment: Object.keys(byCustomerSegment).map(seg => evaluateSlice('customer_segment', seg, byCustomerSegment[seg]!)),
    };

    // Extract weakest segments
    const allMetrics = Object.values(segmentMetrics).flat();
    const weakestSegments = allMetrics
      .filter(m => m.isWeakSegment)
      .sort((a, b) => a.rocAuc - b.rocAuc);

    return {
      slicesEvaluated: allMetrics.length,
      weakestSegments,
      segmentMetrics,
      generatedAt: new Date().toISOString(),
    };
  }
}
