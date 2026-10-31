## Why this matters
You can train models without math, but you can't debug them. When a model won't learn or overfits, the explanation is almost always in linear algebra, calculus or statistics.

## What to learn
- **Linear algebra:** vectors, matrices, dot products, matrix multiplication
- **Calculus:** derivatives, the chain rule, gradients as "which way is downhill"
- **Statistics:** mean, variance, distributions, correlation vs causation

## Try this
Write gradient descent by hand for `f(x) = (x - 3)^2`. Start at `x = 0`, use the derivative `2(x - 3)`, and update `x -= 0.1 * grad` for 50 steps. Print `x` every 10 steps and watch it approach 3.

## Tip
If the Python for ML roadmap is done, you've already covered the linear algebra and statistics basics. Focus on gradients here.
