// services/nn/optim.js — gradient-descent optimizers operating on the leaf-parameter
// Tensors of a model. Each reads param.grad (populated by autograd.backward) and
// updates param.data in place. Real implementations of SGD (with momentum) and Adam
// (with bias-corrected first/second moments) — the same update rules used by
// mainstream frameworks, written from scratch.

class SGD {
  constructor(params, { lr = 0.1, momentum = 0.9 } = {}) {
    this.params = params;
    this.lr = lr;
    this.momentum = momentum;
    this.v = params.map(p => new Float64Array(p.data.length));
  }
  step() {
    for (let i = 0; i < this.params.length; i++) {
      const p = this.params[i], v = this.v[i];
      for (let k = 0; k < p.data.length; k++) {
        v[k] = this.momentum * v[k] - this.lr * p.grad[k];
        p.data[k] += v[k];
      }
    }
  }
  zeroGrad() { for (const p of this.params) p.grad.fill(0); }
}

class Adam {
  constructor(params, { lr = 0.01, beta1 = 0.9, beta2 = 0.999, eps = 1e-8, weightDecay = 0 } = {}) {
    this.params = params;
    this.lr = lr; this.b1 = beta1; this.b2 = beta2; this.eps = eps; this.wd = weightDecay;
    this.m = params.map(p => new Float64Array(p.data.length));
    this.v = params.map(p => new Float64Array(p.data.length));
    this.t = 0;
  }
  step() {
    this.t++;
    const bc1 = 1 - Math.pow(this.b1, this.t);
    const bc2 = 1 - Math.pow(this.b2, this.t);
    for (let i = 0; i < this.params.length; i++) {
      const p = this.params[i], m = this.m[i], v = this.v[i];
      for (let k = 0; k < p.data.length; k++) {
        let g = p.grad[k];
        if (this.wd) g += this.wd * p.data[k];            // decoupled-ish L2
        m[k] = this.b1 * m[k] + (1 - this.b1) * g;
        v[k] = this.b2 * v[k] + (1 - this.b2) * g * g;
        const mHat = m[k] / bc1, vHat = v[k] / bc2;
        p.data[k] -= this.lr * mHat / (Math.sqrt(vHat) + this.eps);
      }
    }
  }
  zeroGrad() { for (const p of this.params) p.grad.fill(0); }
}

module.exports = { SGD, Adam };
