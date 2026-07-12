// services/nn/nn.js — neural layers composed from the autograd primitives.
// A Linear layer owns a weight matrix W[in,out] and bias b[1,out]; an MLP chains
// Linear layers with a non-linearity between them and emits raw logits from the
// last layer (the loss applies the sigmoid). All parameters are leaf Tensors with
// requiresGrad=true, so the optimizer can read their .grad after backward().

const { Tensor, matmul, addBias, relu, tanh } = require('./autograd');

const ACT = { relu, tanh };

class Linear {
  // Xavier/Glorot init: std = sqrt(2/(in+out)) — sensible for tanh and fine for relu here.
  constructor(inF, outF, rng) {
    this.inF = inF; this.outF = outF;
    const std = Math.sqrt(2 / (inF + outF));
    this.W = Tensor.randn(inF, outF, std, rng, true);
    this.b = Tensor.zeros(1, outF, true);
  }
  forward(x) { return addBias(matmul(x, this.W), this.b); }
  parameters() { return [this.W, this.b]; }
}

class MLP {
  // sizes e.g. [8,16,8,1]: hidden layers get the activation, the final layer is
  // linear (produces logits). activation ∈ {'tanh','relu'}.
  constructor(sizes, activation = 'tanh', rng = Math.random) {
    if (!Array.isArray(sizes) || sizes.length < 2) throw new Error('MLP needs ≥2 sizes');
    this.sizes = sizes.slice();
    this.activation = activation;
    this.act = ACT[activation] || tanh;
    this.layers = [];
    for (let i = 0; i < sizes.length - 1; i++) this.layers.push(new Linear(sizes[i], sizes[i + 1], rng));
  }

  // Forward a batch X[n, sizes[0]] → logits[n, sizes[last]].
  forward(x) {
    let h = x;
    for (let i = 0; i < this.layers.length; i++) {
      const z = this.layers[i].forward(h);
      h = (i < this.layers.length - 1) ? this.act(z) : z;   // no activation on the output layer
    }
    return h;
  }

  parameters() { return this.layers.flatMap(l => l.parameters()); }
  zeroGrad() { for (const p of this.parameters()) p.grad.fill(0); }
  paramCount() { return this.parameters().reduce((s, p) => s + p.data.length, 0); }
}

module.exports = { Linear, MLP };
