import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { extractCheckpoints, computeSectorDeltas, PRESET_BENCHMARKS } from '../utils/splitDeltaAnalysis.js';

describe('Integration Test: Athletic Split Telemetry & Benchmark Engine', () => {
  it('correctly processes a multi-split sprint run and computes checkpoints', () => {
    const mockRun = {
      id: 'run-test-01',
      name: 'Test Sprinter',
      time: 4.85,
      distance: 40,
      testType: 'sprint',
      splits: [
        { distance: 10, time: 1.82 },
        { distance: 20, time: 2.95 },
        { distance: 30, time: 3.92 }
      ]
    };

    const checkpoints = extractCheckpoints(mockRun, 40);
    assert.ok(Array.isArray(checkpoints));
    assert.equal(checkpoints.length, 4); // 10m, 20m, 30m, and 40m finish

    // Verify distance progression
    assert.equal(checkpoints[0].distance, 10);
    assert.equal(checkpoints[1].distance, 20);
    assert.equal(checkpoints[2].distance, 30);
    assert.equal(checkpoints[3].distance, 40);

    // Verify finish time integrity
    assert.equal(checkpoints[3].time, 4.85);
    assert.ok(checkpoints[0].velocity > 0);
  });

  it('computes accurate sector deltas against combine benchmark', () => {
    const mockRunA = {
      id: 'run-a',
      time: 4.55,
      distance: 40,
      testType: 'sprint',
      splits: [
        { distance: 10, time: 1.70 },
        { distance: 20, time: 2.75 },
        { distance: 30, time: 3.65 }
      ]
    };

    const benchmark = PRESET_BENCHMARKS.combine_elite;
    const result = computeSectorDeltas(mockRunA, benchmark);
    assert.ok(result);
    assert.ok(Array.isArray(result.sectors));
    assert.equal(result.sectors.length, 4);

    // Verify sector structure and calculations
    assert.equal(result.sectors[0].endDist, 10);
    assert.equal(result.sectors[0].startDist, 0);
    assert.ok(typeof result.cumulativeDelta === 'number');
    assert.ok(typeof result.sectors[0].sectorTimeDelta === 'number');
  });
});
