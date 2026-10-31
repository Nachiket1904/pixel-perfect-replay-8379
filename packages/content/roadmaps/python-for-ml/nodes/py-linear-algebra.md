## Why this matters
Every dataset is a matrix (rows = examples, columns = features) and every model is a set of matrix operations. You don't need proofs, but you need to read `X @ w + b` and know what it means.

## What to learn
- Vectors: addition, scaling, dot product, length (norm)
- Matrices: shape, transpose, matrix–vector and matrix–matrix multiplication
- Why shapes must line up: `(m, n) @ (n, k) -> (m, k)`
- Intuition for linear transformations (stretch, rotate, project)

## Try this
In NumPy, create a `(4, 3)` matrix `X` and a `(3,)` vector `w`. Predict the shape of `X @ w` before running it. Then compute the same result with a Python loop and check they match.

## Common mistakes
- Using `*` (element-wise) when you meant `@` (matrix multiply)
- Ignoring shapes until an error appears. Print `.shape` often.
