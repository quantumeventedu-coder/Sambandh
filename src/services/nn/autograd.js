// services/nn/autograd.js — a real reverse-mode automatic differentiation engine
// over 2-D matrices, in pure JS with no external ML library. Every op records a
// closure that accumulates gradients into its inputs; backward() runs them in
// reverse topological order. This is the genuine computational substrate a neural
// network is built from (Vol II of the architecture manual), not a mock.
//
// A Tensor holds row-major data + a same-shape grad buffer. Leaf tensors created
// with requiresGrad=true are the trainable parameters; the optimizer reads .grad.

class Tensor {
  constructor(data, rows, cols, requiresGrad = false) {
    if (data instanceof Float64Array) this.data = data;
    else { this.data = new Float64Array(rows * cols); if (data) this.data.set(data); }
    this.rows = rows;
    this.cols = cols;
    this.grad = new Float64Array(rows * cols);
    this.requiresGrad = requiresGrad;
    this._backward = () => {};
    this._prev = [];
  }

  static zeros(rows, cols, requiresGrad = false) {
    return new Tensor(new Float64Array(rows * cols), rows, cols, requiresGrad);
  }

  // Build from a JS 2-D array [[..],[..]].
  static from2D(arr, requiresGrad = false) {
    const rows = arr.length, cols = arr[0].length;
    const d = new Float64Array(rows * cols);
    for (let i = 0; i < rows; i++) for (let j = 0; j < cols; j++) d[i * cols + j] = arr[i][j];
    return new Tensor(d, rows, cols, requiresGrad);
  }

  // Random init ~ N(0, std^2) using a supplied rng() → [0,1).
  static randn(rows, cols, std, rng, requiresGrad = false) {
    const d = new Float64Array(rows * cols);
    for (let k = 0; k < d.length; k++) {
      // Box–Muller from two uniforms.
      const u1 = Math.max(rng(), 1e-12), u2 = rng();
      d[k] = std * Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    }
    return new Tensor(d, rows, cols, requiresGrad);
  }

  to2D() {
    const out = [];
    for (let i = 0; i < this.rows; i++) {
      const row = new Array(this.cols);
      for (let j = 0; j < this.cols; j++) row[j] = this.data[i * this.cols + j];
      out.push(row);
    }
    return out;
  }
}

// ---- matmul: A[n,k] · B[k,m] → [n,m] ----
function matmul(a, b) {
  if (a.cols !== b.rows) throw new Error(`matmul shape mismatch: ${a.rows}x${a.cols} · ${b.rows}x${b.cols}`);
  const n = a.rows, k = a.cols, m = b.cols;
  const out = Tensor.zeros(n, m);
  for (let i = 0; i < n; i++) {
    for (let p = 0; p < k; p++) {
      const av = a.data[i * k + p];
      if (av === 0) continue;
      for (let j = 0; j < m; j++) out.data[i * m + j] += av * b.data[p * m + j];
    }
  }
  out._prev = [a, b];
  out._backward = () => {
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < m; j++) {
        const g = out.grad[i * m + j];
        if (g === 0) continue;
        for (let p = 0; p < k; p++) {
          a.grad[i * k + p] += g * b.data[p * m + j];   // dA = dOut · Bᵀ
          b.grad[p * m + j] += a.data[i * k + p] * g;   // dB = Aᵀ · dOut
        }
      }
    }
  };
  return out;
}

// ---- addBias: X[n,m] + b[1,m] (broadcast over rows) → [n,m] ----
function addBias(x, b) {
  if (b.rows !== 1 || b.cols !== x.cols) throw new Error('addBias shape mismatch');
  const n = x.rows, m = x.cols;
  const out = Tensor.zeros(n, m);
  for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) out.data[i * m + j] = x.data[i * m + j] + b.data[j];
  out._prev = [x, b];
  out._backward = () => {
    for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) {
      const g = out.grad[i * m + j];
      x.grad[i * m + j] += g;
      b.grad[j] += g;                                    // bias grad = column sum
    }
  };
  return out;
}

// ---- element-wise activations ----
function elementwise(x, fwd, dfwd) {
  const out = Tensor.zeros(x.rows, x.cols);
  for (let k = 0; k < x.data.length; k++) out.data[k] = fwd(x.data[k]);
  out._prev = [x];
  out._backward = () => {
    for (let k = 0; k < x.data.length; k++) x.grad[k] += dfwd(x.data[k], out.data[k]) * out.grad[k];
  };
  return out;
}
const relu = x => elementwise(x, v => (v > 0 ? v : 0), (v) => (v > 0 ? 1 : 0));
const tanh = x => elementwise(x, v => Math.tanh(v), (_v, o) => 1 - o * o);
const sigmoidT = x => elementwise(x, v => 1 / (1 + Math.exp(-v)), (_v, o) => o * (1 - o));

// ---- reductions ----
// sum() → scalar [1,1]; used for gradient checking arbitrary graphs.
function sum(x) {
  const out = Tensor.zeros(1, 1);
  let s = 0;
  for (let k = 0; k < x.data.length; k++) s += x.data[k];
  out.data[0] = s;
  out._prev = [x];
  out._backward = () => { for (let k = 0; k < x.data.length; k++) x.grad[k] += out.grad[0]; };
  return out;
}

// ---- numerically-stable binary cross-entropy from logits ----
// logits[n,1], targets[n,1]∈{0,1} → mean loss scalar [1,1].
// L_i = max(z,0) − z·y + log(1+exp(−|z|)); dL/dz = (σ(z) − y)/n.
function bceWithLogits(logits, targets) {
  const n = logits.rows;
  const out = Tensor.zeros(1, 1);
  let loss = 0;
  for (let i = 0; i < n; i++) {
    const z = logits.data[i], y = targets.data[i];
    loss += Math.max(z, 0) - z * y + Math.log1p(Math.exp(-Math.abs(z)));
  }
  out.data[0] = loss / n;
  out._prev = [logits];
  out._backward = () => {
    for (let i = 0; i < n; i++) {
      const z = logits.data[i], y = targets.data[i];
      const s = 1 / (1 + Math.exp(-z));
      logits.grad[i] += (out.grad[0] * (s - y)) / n;
    }
  };
  return out;
}

// ---- backward driver: reverse-topological backprop from a scalar root ----
function backward(root) {
  const topo = [];
  const seen = new Set();
  (function build(t) {
    if (seen.has(t)) return;
    seen.add(t);
    for (const p of t._prev) build(p);
    topo.push(t);
  })(root);
  root.grad[0] = 1;                                      // d(root)/d(root) = 1
  for (let i = topo.length - 1; i >= 0; i--) topo[i]._backward();
}

module.exports = { Tensor, matmul, addBias, relu, tanh, sigmoid: sigmoidT, sum, bceWithLogits, backward };
