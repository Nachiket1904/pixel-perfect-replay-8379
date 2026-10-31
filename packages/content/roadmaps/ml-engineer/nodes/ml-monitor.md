## Why this matters
Models get worse silently. The world changes (new users, new prices, new slang) and yesterday's model drifts away from today's data.

## What to learn
- Data drift vs concept drift
- What to log: inputs, predictions, latency, and outcomes when they arrive
- Simple drift checks: compare feature distributions over time
- When and how to retrain, and how to compare a new model with the old one safely

## Try this
Split a dataset by date (or randomly into "old" and "new"). Shift one feature in the "new" part, then compare its distribution with the old part using histograms and a summary statistic. Would you have noticed in production?

## Tip
Start simple: a daily log plus a dashboard of a few key numbers beats an elaborate system you never look at.
