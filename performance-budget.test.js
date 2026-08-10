const fs = require('fs');
const path = require('path');

const read = file => fs.readFileSync(path.join(__dirname, file), 'utf8');

describe('PERF-01 mobile performance contract', () => {
  test('defines the five critical mobile scenarios', () => {
    const config = JSON.parse(read('config/performance-budgets.json'));
    expect(Object.keys(config.budgets)).toEqual([
      'homepage',
      'discovery',
      'trail-detail',
      'download-flow',
      'active-hike',
    ]);
    expect(config.conditions.cpuSlowdown).toBe(4);
    expect(config.conditions.runs).toBe(3);
  });

  test('budgets cover the required metrics after baselining', () => {
    const config = JSON.parse(read('config/performance-budgets.json'));
    const required = ['transferredKb', 'lcpMs', 'inpMs', 'cls', 'jsExecutionMs'];
    Object.values(config.budgets).forEach(budget => {
      if(!Object.keys(budget).length) return;
      expect(Object.keys(budget)).toEqual(required);
      required.forEach(metric => expect(budget[metric]).toBeGreaterThan(0));
    });
  });

  test('runner uses network, CPU and mobile viewport emulation', () => {
    const runner = read('scripts/run-mobile-performance.mjs');
    expect(runner).toContain("width: 390, height: 844");
    expect(runner).toContain("latency: 150");
    expect(runner).toContain("downloadThroughput: 200 * 1024");
    expect(runner).toContain("Emulation.setCPUThrottlingRate");
    expect(runner).toContain("rate: 4");
  });
});
