## Why this matters
A model with 95% accuracy can be useless, for example when 95% of the data belongs to one class. Choosing the right metric is how you know if a model is good.

## What to learn
- Classification: accuracy, precision, recall, F1, confusion matrix, ROC-AUC
- Regression: MAE, RMSE, R²
- Cross-validation, and why one train/test split can mislead you
- Overfitting vs underfitting; learning curves

## Try this
Train a classifier on an imbalanced dataset. Compare its accuracy with a model that always predicts the majority class. Then look at precision and recall to see the real difference.

## Common mistakes
- Tuning on the test set (keep it untouched until the very end)
- Reporting one number without saying which metric or why
