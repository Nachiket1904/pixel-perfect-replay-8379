## Why this matters
"Garbage in, garbage out." A simple model on clean data usually beats a fancy model on messy data.

## What to learn
- Finding and handling missing values, duplicates and outliers
- Encoding categories (one-hot), scaling numeric features
- Train/validation/test splits, and why you split **before** you look too closely
- Data leakage: when information from the answer sneaks into the inputs

## Try this
Take a dataset with missing values. Build a scikit-learn `Pipeline` with `SimpleImputer`, `StandardScaler` and a model, so the same steps run identically on training and test data.

## Common mistakes
- Scaling or imputing using the whole dataset before splitting (leakage)
- Dropping every row with a missing value without checking how many you lose
