## Why this matters
Neural networks power modern vision, language and speech models. Understanding the basics makes papers like *Attention Is All You Need* readable.

## What to learn
- Neurons, layers, activations (ReLU, sigmoid, softmax)
- Loss functions and backpropagation (the chain rule in action)
- Training loops: batches, epochs, optimisers (SGD, Adam), learning rate
- Overfitting tools: validation sets, dropout, early stopping

## Try this
In PyTorch, train a small fully-connected network on MNIST or Fashion-MNIST. Write the training loop yourself (no high-level trainer) and plot training vs validation loss.

## Tip
Train on a tiny subset first (say 100 examples). If the model can't overfit 100 examples, there's a bug.
