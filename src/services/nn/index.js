// services/nn/index.js — public API for the in-house neural engine.
// Trains a small MLP classifier on (X, y) with mini-batch Adam + BCE loss, using
// only the autograd engine in this folder. Produces a serializable model with an
// input standardizer baked in, plus a fast pure-JS inference path (no graph build)
// for serving. Everything here runs on CPU in milliseconds for Sambandh's scale.

const { Tensor, bceWithLogits, backward, sum, matmul, tanh } = require('./autograd');
const { MLP } = require('./nn');
const { Adam } = require('./optim');

// Deterministic RNG (mulberry32) so training is reproducible from a seed.
function makeRng(seed = 1) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Column-wise standardization: (x−mean)/std. Returned so serving applies the same.
function fitStandardizer(X) {
  const d = X[0].length, n = X.length;
  const mean = new Array(d).fill(0), std = new Array(d).fill(0);
  for (const row of X) for (let j = 0; j < d; j++) mean[j] += row[j];
  for (let j = 0; j < d; j++) mean[j] /= n;
  for (const row of X) for (let j = 0; j < d; j++) std[j] += (row[j] - mean[j]) ** 2;
  for (let j = 0; j < d; j++) std[j] = Math.sqrt(std[j] / n) || 1;   // guard against zero-variance
  return { mean, std };
}
function applyStd(row, s) { return row.map((v, j) => (v - s.mean[j]) / s.std[j]); }

function shuffleInPlace(arr, rng) {
  for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; }
}

// Fast inference forward from a serialized model → probability in (0,1).
function forwardProba(model, rawRow) {
  const x = applyStd(rawRow, model.standardizer);
  let h = x;
  for (let li = 0; li < model.layers.length; li++) {
    const { W, b } = model.layers[li];               // W: in×out, b: out
    const inF = W.length, outF = b.length;
    const z = new Array(outF).fill(0);
    for (let o = 0; o < outF; o++) {
      let s = b[o];
      for (let i = 0; i < inF; i++) s += h[i] * W[i][o];
      z[o] = s;
    }
    h = (li < model.layers.length - 1)
      ? z.map(v => (model.activation === 'relu' ? Math.max(0, v) : Math.tanh(v)))
      : z;                                            // last layer: raw logit
  }
  return 1 / (1 + Math.exp(-h[0]));
}

function serialize(mlp, standardizer, meta) {
  return {
    kind: 'mlp',
    sizes: mlp.sizes,
    activation: mlp.activation,
    standardizer,
    layers: mlp.layers.map(l => ({ W: l.W.to2D(), b: Array.from(l.b.data) })),
    ...meta
  };
}

// Train an MLP. X: n×d numbers, y: n of {0,1}.
function trainMLP(X, y, opts = {}) {
  const {
    hidden = [16, 8], activation = 'tanh', epochs = 200,
    lr = 0.02, batchSize = 32, seed = 42, valSplit = 0.2
  } = opts;
  if (!X.length) throw new Error('trainMLP: empty dataset');
  const d = X[0].length;
  const rng = makeRng(seed);

  // Shuffle + split.
  const idx = X.map((_, i) => i);
  shuffleInPlace(idx, rng);
  const nVal = Math.min(Math.max(Math.floor(X.length * valSplit), 0), X.length - 1);
  const valIdx = idx.slice(0, nVal), trIdx = idx.slice(nVal);

  const standardizer = fitStandardizer(trIdx.map(i => X[i]));
  const Xtr = trIdx.map(i => applyStd(X[i], standardizer));
  const ytr = trIdx.map(i => y[i]);

  const model = new MLP([d, ...hidden, 1], activation, rng);
  const opt = new Adam(model.parameters(), { lr });

  const history = [];
  const order = Xtr.map((_, i) => i);
  for (let e = 0; e < epochs; e++) {
    shuffleInPlace(order, rng);
    let epochLoss = 0, batches = 0;
    for (let b = 0; b < order.length; b += batchSize) {
      const bi = order.slice(b, b + batchSize);
      const bx = Tensor.from2D(bi.map(i => Xtr[i]));
      const by = Tensor.from2D(bi.map(i => [ytr[i]]));
      model.zeroGrad();
      const logits = model.forward(bx);
      const loss = bceWithLogits(logits, by);
      backward(loss);
      opt.step();
      epochLoss += loss.data[0]; batches++;
    }
    history.push(epochLoss / batches);
  }

  const ser = serialize(model, standardizer, {
    featureCount: d, epochs, trainedAt: new Date(), examples: X.length,
    paramCount: model.paramCount()
  });

  // Honest holdout accuracy (falls back to train set if valSplit=0).
  const evalIdx = valIdx.length ? valIdx : trIdx;
  let correct = 0;
  for (const i of evalIdx) if ((forwardProba(ser, X[i]) >= 0.5 ? 1 : 0) === y[i]) correct++;
  ser.accuracy = +(correct / evalIdx.length).toFixed(4);
  ser.trainLoss = +history[history.length - 1].toFixed(4);
  return { model: ser, accuracy: ser.accuracy, history };
}

// --- gradient checker (used by tests): numerical vs analytic grad of sum(tanh(X·W)) ---
// Returns the max absolute difference; a correct autograd engine keeps this ~1e-6.
function gradCheck(seed = 7) {
  const rng = makeRng(seed);
  const X = Tensor.randn(3, 4, 1, rng, false);
  const W = Tensor.randn(4, 2, 1, rng, true);
  const loss = () => sum(tanh(matmul(X, W)));
  W.grad.fill(0);
  const out = loss(); backward(out);
  const analytic = Float64Array.from(W.grad);
  const eps = 1e-6;
  let maxDiff = 0;
  for (let k = 0; k < W.data.length; k++) {
    const orig = W.data[k];
    W.data[k] = orig + eps; const lp = loss().data[0];
    W.data[k] = orig - eps; const lm = loss().data[0];
    W.data[k] = orig;
    const num = (lp - lm) / (2 * eps);
    maxDiff = Math.max(maxDiff, Math.abs(num - analytic[k]));
  }
  return maxDiff;
}

module.exports = { trainMLP, forwardProba, serialize, makeRng, gradCheck };
