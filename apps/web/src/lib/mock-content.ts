// Mock node content and papers. Imported ONLY by api.ts.
// Paper descriptions are our own words (not copied abstracts); PDFs stay on arXiv.
import type { ExercisePreview, Implementation, Paper, Resource } from "@/lib/types";

const yt = (query: string): Resource => ({
  title: `YouTube: ${query}`,
  url: `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`,
  kind: "search",
  is_free: true,
});

const docs = (title: string, url: string): Resource => ({
  title,
  url,
  kind: "docs",
  is_free: true,
});

export interface MockNodeContent {
  content_md: string;
  resources: Resource[];
  exercise?: ExercisePreview;
}

export const mockNodeContent: Record<string, MockNodeContent> = {
  "py-basics": {
    content_md: `## Why this matters
Every ML library you'll use (NumPy, Pandas, PyTorch) is driven from Python. You don't need to be an expert, but you need to read and write simple scripts without friction.

## What to learn
- Installing Python 3.12 and running a \`.py\` file
- Variables, numbers, strings and \`print()\`
- Reading error messages (tracebacks) calmly

## You're done when
You can write a script that asks for two numbers and prints their sum and average.`,
    resources: [
      docs("The Python Tutorial (official)", "https://docs.python.org/3/tutorial/"),
      yt("python basics for beginners"),
    ],
  },
  "py-types": {
    content_md: `## What to learn
- Lists, tuples, dicts and sets, and when to use each
- \`if\` / \`elif\` / \`else\`, \`for\` and \`while\` loops
- List comprehensions: \`[x * 2 for x in nums if x > 0]\`

## Tip
Dicts are everywhere in ML code (configs, JSON, model outputs). Get comfortable with them.`,
    resources: [
      docs(
        "More control flow tools (official)",
        "https://docs.python.org/3/tutorial/controlflow.html",
      ),
      yt("python lists dicts loops"),
    ],
  },
  "py-functions": {
    content_md: `## What to learn
- Defining functions with default and keyword arguments
- Splitting code into modules and importing them
- Writing small functions that do one thing

## Practice
The exercise below asks you to write a function that normalises a list of numbers.`,
    resources: [
      docs("Modules (official)", "https://docs.python.org/3/tutorial/modules.html"),
      yt("python functions and modules"),
    ],
    exercise: {
      id: "ex-normalise",
      title: "Normalise a list",
      language: "python",
      starter_code: `def normalise(values):
    """Scale values so the smallest becomes 0 and the largest becomes 1."""
    # TODO: handle the case where all values are equal
    pass
`,
    },
  },
  "py-envs": {
    content_md: `## Why this matters
Different projects need different library versions. Virtual environments keep them separate so one project can't break another.

## What to learn
- \`python -m venv .venv\` and activating it
- \`pip install\`, \`pip freeze > requirements.txt\`
- Why you never install packages globally for a project`,
    resources: [
      docs(
        "Virtual environments and packages (official)",
        "https://docs.python.org/3/tutorial/venv.html",
      ),
      yt("python venv pip tutorial"),
    ],
  },
  "py-numpy": {
    content_md: `## Why this matters
NumPy arrays are the data structure underneath almost all of Python ML. Vectorised operations replace slow Python loops.

## What to learn
- Creating arrays, \`shape\`, \`dtype\`, \`reshape\`
- Indexing, slicing and boolean masks
- Broadcasting: adding a \`(3,)\` array to a \`(4, 3)\` array

## Go deeper
The linked paper explains how NumPy's design became the foundation of scientific Python.`,
    resources: [
      docs(
        "NumPy: the absolute basics (official)",
        "https://numpy.org/doc/stable/user/absolute_beginners.html",
      ),
      yt("numpy tutorial for machine learning"),
    ],
    exercise: {
      id: "ex-numpy-zscore",
      title: "Z-score with NumPy",
      language: "python",
      starter_code: `import numpy as np

def zscore(x: np.ndarray) -> np.ndarray:
    """Return (x - mean) / std, computed per column, without Python loops."""
    # TODO
    raise NotImplementedError
`,
    },
  },
  "py-pandas": {
    content_md: `## What to learn
- \`DataFrame\` and \`Series\`, reading CSV files
- Selecting rows and columns, filtering, \`groupby\`
- Handling missing values`,
    resources: [
      docs(
        "Pandas getting-started tutorials (official)",
        "https://pandas.pydata.org/docs/getting_started/intro_tutorials/index.html",
      ),
      yt("pandas tutorial for beginners"),
    ],
  },
  "py-matplotlib": {
    content_md: `## What to learn
- Line, bar and scatter plots
- Labels, titles and legends that make a chart readable
- Plotting directly from a Pandas DataFrame`,
    resources: [
      docs("Pyplot tutorial (official)", "https://matplotlib.org/stable/tutorials/pyplot.html"),
      yt("matplotlib tutorial"),
    ],
  },
  "py-jupyter": {
    content_md: `## What to learn
- Running notebooks locally or in Google Colab
- Keeping notebooks reproducible: restart and run all before sharing`,
    resources: [
      docs("Project Jupyter documentation", "https://docs.jupyter.org/en/latest/"),
      yt("jupyter notebook tutorial"),
    ],
  },
};

/** Fallback when a node has no hand-written content yet (mirrors what AI nodes get). */
export function fallbackContent(title: string, summary: string): MockNodeContent {
  return {
    content_md: `## Overview\n${summary}\n\n## Suggested approach\nStart with the official documentation, then watch one short video and try a small example of your own.`,
    resources: [yt(title)],
  };
}

const arxiv = (id: string) => ({
  external_id: id,
  pdf_url: `https://arxiv.org/pdf/${id}`,
  abs_url: `https://arxiv.org/abs/${id}`,
});

export const mockPapers: Paper[] = [
  {
    id: "paper-attention",
    source: "arxiv",
    ...arxiv("1706.03762"),
    title: "Attention Is All You Need",
    authors: [
      "Ashish Vaswani",
      "Noam Shazeer",
      "Niki Parmar",
      "Jakob Uszkoreit",
      "Llion Jones",
      "Aidan N. Gomez",
      "Łukasz Kaiser",
      "Illia Polosukhin",
    ],
    published_at: "2017-06-12",
    categories: ["cs.CL", "cs.LG"],
    short_description:
      "Introduces the Transformer, a model built entirely on attention instead of recurrence, which became the basis of modern LLMs.",
    has_implementation: true,
    summary_md: `Before this paper, sequence models mostly processed text one token at a time (RNNs). The Transformer lets every token look at every other token in parallel using **attention**, which made training much faster and scaled far better.

The core building block is *scaled dot-product attention*: compare queries with keys, turn the scores into weights with softmax, and use those weights to mix the values.`,
    key_ideas: [
      "Attention replaces recurrence, so a whole sequence is processed in parallel.",
      "Scores are divided by √d_k to keep softmax from saturating.",
      "Multi-head attention lets the model attend to different patterns at once.",
      "Positional encodings add word-order information the attention itself lacks.",
    ],
    implementations: [
      {
        id: "impl-attention",
        title: "Scaled dot-product attention in NumPy",
        status: "reviewed",
        difficulty: "intermediate",
        language: "python",
        step_count: 4,
        estimated_minutes: 30,
      },
    ],
  },
  {
    id: "paper-resnet",
    source: "arxiv",
    ...arxiv("1512.03385"),
    title: "Deep Residual Learning for Image Recognition",
    authors: ["Kaiming He", "Xiangyu Zhang", "Shaoqing Ren", "Jian Sun"],
    published_at: "2015-12-10",
    categories: ["cs.CV"],
    short_description:
      "Introduces ResNet: skip connections let very deep networks train, making 100+ layer image models practical.",
    has_implementation: false,
    summary_md: null,
    key_ideas: [
      "Layers learn a residual F(x) and output F(x) + x.",
      "Skip connections keep gradients flowing in deep networks.",
    ],
    implementations: [],
  },
  {
    id: "paper-adam",
    source: "arxiv",
    ...arxiv("1412.6980"),
    title: "Adam: A Method for Stochastic Optimization",
    authors: ["Diederik P. Kingma", "Jimmy Ba"],
    published_at: "2014-12-22",
    categories: ["cs.LG"],
    short_description:
      "An optimiser that adapts each parameter's step size using running averages of gradients; still the default in deep learning.",
    has_implementation: false,
    summary_md: null,
    key_ideas: [
      "Tracks a running mean and running variance of gradients.",
      "Bias correction fixes the zero-initialised averages early in training.",
    ],
    implementations: [],
  },
  {
    id: "paper-bert",
    source: "arxiv",
    ...arxiv("1810.04805"),
    title: "BERT: Pre-training of Deep Bidirectional Transformers for Language Understanding",
    authors: ["Jacob Devlin", "Ming-Wei Chang", "Kenton Lee", "Kristina Toutanova"],
    published_at: "2018-10-11",
    categories: ["cs.CL"],
    short_description:
      "Pre-trains a Transformer encoder by predicting masked words, then fine-tunes it for many language tasks.",
    has_implementation: false,
    summary_md: null,
    key_ideas: [
      "Masked language modelling gives bidirectional context.",
      "One pre-trained model fine-tunes to many tasks.",
    ],
    implementations: [],
  },
  {
    id: "paper-numpy-001",
    source: "arxiv",
    ...arxiv("2006.10256"),
    title: "Array programming with NumPy",
    authors: [
      "Charles R. Harris",
      "K. Jarrod Millman",
      "Stéfan J. van der Walt",
      "Ralf Gommers",
      "et al.",
    ],
    published_at: "2020-06-18",
    categories: ["cs.MS"],
    short_description:
      "Explains NumPy's array model (shapes, strides, broadcasting) and why it became the foundation of scientific Python.",
    has_implementation: false,
    summary_md: null,
    key_ideas: [
      "Arrays are typed, strided blocks of memory.",
      "Vectorisation and broadcasting replace explicit loops.",
    ],
    implementations: [],
  },
];

export const mockImplementations: Implementation[] = [
  {
    id: "impl-attention",
    paper_id: "paper-attention",
    paper_title: "Attention Is All You Need",
    title: "Scaled dot-product attention in NumPy",
    status: "reviewed",
    difficulty: "intermediate",
    language: "python",
    step_count: 4,
    estimated_minutes: 30,
    steps: [
      {
        position: 1,
        title: "A numerically stable softmax",
        explanation_md: `Attention turns raw scores into weights with **softmax**. A naive \`np.exp(x)\` overflows for large scores, so subtract the row maximum first. This doesn't change the result, because softmax is unchanged when you shift all inputs by the same amount.`,
        starter_code: `import numpy as np

def softmax(x: np.ndarray, axis: int = -1) -> np.ndarray:
    # TODO: subtract the max along \`axis\`, exponentiate, then normalise
    raise NotImplementedError
`,
        checks: [
          "Each row sums to 1",
          "Works for values like 1000 without overflow",
          "Keeps the input shape",
        ],
        hints: [
          "Use keepdims=True so the max broadcasts back over the row.",
          "np.exp(x - x.max(axis=axis, keepdims=True))",
        ],
      },
      {
        position: 2,
        title: "Attention scores",
        explanation_md: `Each query is compared with every key using a dot product. For queries \`Q\` of shape \`(n_q, d_k)\` and keys \`K\` of shape \`(n_k, d_k)\`, the scores are \`Q · Kᵀ\`, shape \`(n_q, n_k)\`.

The paper divides by \`√d_k\`. Without it, dot products grow with dimension and push softmax into regions with tiny gradients.`,
        starter_code: `import numpy as np

def attention_scores(Q: np.ndarray, K: np.ndarray) -> np.ndarray:
    # TODO: return Q @ K.T scaled by 1 / sqrt(d_k)
    raise NotImplementedError
`,
        checks: ["Output shape is (n_q, n_k)", "Scores are scaled by 1/√d_k"],
        hints: ["d_k is Q.shape[-1].", "Q @ K.T / np.sqrt(d_k)"],
      },
      {
        position: 3,
        title: "Masking",
        explanation_md: `Sometimes a query must not see some keys, for example future tokens in a decoder. Set those scores to a very large negative number before softmax so their weights become 0.`,
        starter_code: `import numpy as np

def apply_mask(scores: np.ndarray, mask: np.ndarray) -> np.ndarray:
    """mask is True where attention is ALLOWED."""
    # TODO
    raise NotImplementedError
`,
        checks: [
          "Masked positions get weight ≈ 0 after softmax",
          "Allowed positions are unchanged",
        ],
        hints: ["np.where(mask, scores, -1e9)"],
      },
      {
        position: 4,
        title: "Put it together",
        explanation_md: `Combine the pieces: scores → optional mask → softmax → weighted sum of values. Return both the output and the weights so you can inspect what each query attended to.`,
        starter_code: `import numpy as np

def attention(Q, K, V, mask=None):
    # TODO: use attention_scores, apply_mask, softmax
    # return output (n_q, d_v) and weights (n_q, n_k)
    raise NotImplementedError
`,
        checks: [
          "Output shape is (n_q, d_v)",
          "Weights rows sum to 1",
          "Matches a reference implementation on random inputs",
        ],
        hints: ["output = weights @ V"],
      },
    ],
  },
];
