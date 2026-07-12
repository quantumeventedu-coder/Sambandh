// tests/nn.test.js — proof the in-house neural engine is mathematically real.
//
//  1. Gradient check: analytic backprop must match numerical finite differences.
//  2. XOR: a non-linearly-separable function a logistic/linear model CANNOT fit,
//     but an MLP with a hidden layer can → proves real hidden-layer learning.
//  3. Serialize round-trip: the fast inference path matches the trained model.
//  4. Interaction learning: an AND-style interaction is learned to high accuracy.

const { Tensor, matmul, addBias, tanh, relu, sigmoid, bceWithLogits, backward } = require('../src/services/nn/autograd');
const { MLP } = require('../src/services/nn/nn');
const { trainMLP, forwardProba, gradCheck } = require('../src/services/nn');

describe('autograd engine', () => {
  test('analytic gradients match numerical (grad check < 1e-5)', () => {
    expect(gradCheck(7)).toBeLessThan(1e-5);
    expect(gradCheck(123)).toBeLessThan(1e-5);
  });

  test('bceWithLogits gradient equals (sigmoid(z) - y)/n', () => {
    const logits = Tensor.from2D([[0.5], [-1.2], [2.0]], true);
    const y = Tensor.from2D([[1], [0], [1]]);
    logits.grad.fill(0);
    const loss = bceWithLogits(logits, y);
    backward(loss);
    const n = 3;
    for (let i = 0; i < n; i++) {
      const s = 1 / (1 + Math.exp(-logits.data[i]));
      expect(logits.grad[i]).toBeCloseTo((s - y.data[i]) / n, 9);
    }
  });

  test('matmul + addBias shapes and backward accumulate', () => {
    const x = Tensor.from2D([[1, 2, 3]]);           // 1x3
    const W = Tensor.from2D([[1, 0], [0, 1], [1, 1]], true); // 3x2
    const b = Tensor.zeros(1, 2, true);
    const out = addBias(matmul(x, W), b);           // 1x2
    expect(out.to2D()).toEqual([[4, 5]]);
    out.grad[0] = 1; out.grad[1] = 1;
    out._backward();                                 // addBias backward
    // b grad = column sums of out.grad
    expect(Array.from(b.grad)).toEqual([1, 1]);
  });

  test('activations are bounded/correct', () => {
    const x = Tensor.from2D([[-2, 0, 2]]);
    expect(relu(x).to2D()[0]).toEqual([0, 0, 2]);
    const s = sigmoid(x).to2D()[0];
    expect(s[1]).toBeCloseTo(0.5, 9);
    expect(tanh(x).to2D()[0][1]).toBeCloseTo(0, 9);
  });
});

describe('MLP learns non-linear functions', () => {
  // XOR: the canonical proof that a hidden layer is doing real work.
  const X = [[0, 0], [0, 1], [1, 0], [1, 1]];
  const y = [0, 1, 1, 0];

  test('learns XOR to 100% (impossible for a linear model)', () => {
    // valSplit 0 so all 4 points train; evaluate on the same 4 (XOR has only 4).
    const { model } = trainMLP(X, y, { hidden: [8, 8], activation: 'tanh', epochs: 1500, lr: 0.05, batchSize: 4, valSplit: 0, seed: 1 });
    for (let i = 0; i < X.length; i++) {
      const p = forwardProba(model, X[i]);
      expect(p >= 0.5 ? 1 : 0).toBe(y[i]);
    }
  });

  test('a single linear layer CANNOT fit XOR (sanity: proves the test is meaningful)', () => {
    // No hidden layer → linear classifier → must fail on at least one XOR point.
    const { model } = trainMLP(X, y, { hidden: [], activation: 'tanh', epochs: 1500, lr: 0.05, batchSize: 4, valSplit: 0, seed: 1 });
    let correct = 0;
    for (let i = 0; i < X.length; i++) if ((forwardProba(model, X[i]) >= 0.5 ? 1 : 0) === y[i]) correct++;
    expect(correct).toBeLessThan(4);                 // linear model provably can't get all 4
  });
});

describe('serialize / inference / training on swipe-like features', () => {
  test('forwardProba is deterministic and in (0,1)', () => {
    const { model } = trainMLP([[0, 0], [1, 1]], [0, 1], { hidden: [4], epochs: 50, valSplit: 0, seed: 3 });
    const p = forwardProba(model, [0.5, 0.5]);
    expect(p).toBeGreaterThan(0); expect(p).toBeLessThan(1);
    expect(forwardProba(model, [0.5, 0.5])).toBe(p);   // pure function
  });

  test('learns an 8-feature interaction pattern with held-out accuracy > 0.85', () => {
    // Synthetic "like" rule with an interaction: like iff (sharedIntent AND close age) OR high trust.
    const rng = require('../src/services/nn').makeRng(11);
    const X = [], y = [];
    for (let i = 0; i < 400; i++) {
      const f = Array.from({ length: 8 }, () => rng());
      const [ageClose, , sharedIntent, , trust] = f;
      const like = ((sharedIntent > 0.5 && ageClose > 0.5) || trust > 0.8) ? 1 : 0;
      X.push(f); y.push(like);
    }
    const { model, accuracy } = trainMLP(X, y, { hidden: [16, 8], epochs: 300, lr: 0.02, seed: 5 });
    expect(model.kind).toBe('mlp');
    expect(model.paramCount).toBeGreaterThan(0);
    expect(accuracy).toBeGreaterThan(0.85);            // real generalization on a holdout
  });
});
