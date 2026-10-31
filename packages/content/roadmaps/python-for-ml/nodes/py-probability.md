## Why this matters
ML models make guesses under uncertainty. Probability tells you how confident to be; statistics tells you whether a result is real or just noise.

## What to learn
- Mean, median, variance, standard deviation
- Common distributions: uniform, normal, binomial
- Conditional probability and Bayes' rule (intuition first)
- Sampling, why bigger samples are more reliable, and the idea of a confidence interval

## Try this
Use `np.random.default_rng(0)` to simulate 1,000 coin flips. Plot the running average of heads with Matplotlib and watch it settle near 0.5. Repeat with 10 flips and compare.

## Common mistakes
- Reporting a single average without its spread
- Confusing P(A given B) with P(B given A)
