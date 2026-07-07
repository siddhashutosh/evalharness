"""Semantic-similarity scorer.

Cosine similarity between sentence-transformer embeddings of the output and the
expected reference, mapped to [0, 1]. Runs locally (Anthropic has no first-party
embeddings endpoint), so this scorer is offline, free, and deterministic.

The model is loaded lazily and cached per-name so importing the package (and the
offline test suite) never pulls in torch.
"""

from __future__ import annotations

from evalharness.models import ScoreResult, TestCase
from evalharness.scorers.base import ScorerError

_MODEL_CACHE: dict[str, object] = {}


def _get_model(name: str) -> object:
    if name in _MODEL_CACHE:
        return _MODEL_CACHE[name]
    try:
        from sentence_transformers import SentenceTransformer
    except ImportError as exc:  # pragma: no cover
        raise ScorerError(
            "the 'sentence-transformers' package is required for the embedding scorer; "
            "install with: pip install 'evalharness[embedding]'"
        ) from exc
    model = SentenceTransformer(name)
    _MODEL_CACHE[name] = model
    return model


def _cosine(a: list[float], b: list[float]) -> float:
    dot = sum(x * y for x, y in zip(a, b))
    na = sum(x * x for x in a) ** 0.5
    nb = sum(y * y for y in b) ** 0.5
    if na == 0 or nb == 0:
        return 0.0
    return dot / (na * nb)


class EmbeddingScorer:
    name = "embedding"

    def __init__(
        self,
        threshold: float = 0.7,
        required: bool = False,
        *,
        model: str = "all-MiniLM-L6-v2",
        encode_fn: object | None = None,
    ) -> None:
        self.threshold = threshold
        self.required = required
        self.model_name = model
        # Injectable encoder for testing: (list[str]) -> list[list[float]].
        self._encode_fn = encode_fn

    def _encode(self, texts: list[str]) -> list[list[float]]:
        if self._encode_fn is not None:
            return self._encode_fn(texts)  # type: ignore[operator]
        model = _get_model(self.model_name)
        vectors = model.encode(texts, normalize_embeddings=False)  # type: ignore[attr-defined]
        return [list(map(float, v)) for v in vectors]

    def score(self, case: TestCase, output: str) -> ScoreResult:
        if case.expected is None:
            raise ScorerError(
                f"case {case.id!r} has no 'expected' for embedding scorer"
            )
        out_vec, exp_vec = self._encode([output, case.expected])
        sim = _cosine(out_vec, exp_vec)
        # Cosine is in [-1, 1]; clamp negatives to 0 for a [0, 1] score.
        s = max(0.0, sim)
        return ScoreResult(
            scorer=self.name,
            score=s,
            passed=s >= self.threshold,
            detail=f"cosine similarity {s:.3f}",
        )
