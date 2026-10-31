## Why this matters
Most data has no labels. Unsupervised methods find structure on their own: customer segments, unusual transactions, or a 2D picture of high-dimensional data.

## What to learn
- Clustering: k-means, and how to choose k
- Dimensionality reduction: PCA, and what "explained variance" means
- Anomaly detection basics
- Why scaling features matters even more here

## Try this
Run PCA on a dataset with many numeric columns, reduce it to 2 components, and plot it. Then run k-means on the result and colour the points by cluster. Do the clusters make sense?

## Common mistakes
- Forgetting to scale features, so one large-valued column dominates the distances
- Treating clusters as ground truth instead of a hypothesis to check
