## Why this matters
A model in a notebook helps no one. Serving it behind an API is what turns it into a product, and it's a skill many ML candidates can't show.

## What to learn
- Saving and loading a trained model (e.g. `joblib` for scikit-learn)
- Wrapping it in a FastAPI endpoint with Pydantic input validation
- Packaging with Docker so it runs the same everywhere
- Basics: batching, latency, and returning helpful errors

## Try this
Train a small scikit-learn model, save it, and build a FastAPI app with `POST /predict`. Validate the input with a Pydantic model, return the prediction plus a version string, and test it from the `/docs` page.

## Common mistakes
- Training-time preprocessing that isn't repeated at prediction time (save the whole `Pipeline`)
- Loading the model on every request instead of once at startup
