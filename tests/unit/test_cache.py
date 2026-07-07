from evalharness.cache import Cache, NullCache, ResponseCache
from evalharness.models import ProviderResponse, Usage


def test_cache_round_trip_marks_cached(tmp_path):
    cache = ResponseCache(root=str(tmp_path / "c"))
    key = cache.key("anthropic", "claude-opus-4-8", "hello", None, {"max_tokens": 10})
    assert cache.get(key) is None

    resp = ProviderResponse(
        text="hi", model="claude-opus-4-8", usage=Usage(input_tokens=3, output_tokens=1)
    )
    cache.put(key, resp)

    got = cache.get(key)
    assert got is not None
    assert got.text == "hi"
    assert got.cached is True  # served-from-cache flag set on read


def test_cache_key_changes_with_prompt(tmp_path):
    cache = ResponseCache(root=str(tmp_path / "c"))
    k1 = cache.key("p", "m", "prompt A", None, {})
    k2 = cache.key("p", "m", "prompt B", None, {})
    assert k1 != k2  # prompt is part of the key -> a change never masks a change


def test_cache_disabled_is_noop(tmp_path):
    cache = ResponseCache(root=str(tmp_path / "c"), enabled=False)
    key = cache.key("p", "m", "x", None, {})
    cache.put(key, ProviderResponse(text="y", model="m"))
    assert cache.get(key) is None


def test_cache_clear(tmp_path):
    cache = ResponseCache(root=str(tmp_path / "c"))
    for i in range(3):
        cache.put(f"k{i}", ProviderResponse(text=str(i), model="m"))
    assert cache.clear() == 3
    assert cache.clear() == 0


def test_corrupt_entry_is_ignored(tmp_path):
    cache = ResponseCache(root=str(tmp_path / "c"))
    key = cache.key("p", "m", "x", None, {})
    cache._path(key).write_text("not json", encoding="utf-8")
    assert cache.get(key) is None  # returns None instead of raising


def test_both_caches_satisfy_protocol(tmp_path):
    assert isinstance(ResponseCache(root=str(tmp_path / "c")), Cache)
    assert isinstance(NullCache(), Cache)


def test_null_cache_never_stores():
    cache = NullCache()
    key = cache.key("p", "m", "x", None, {})
    cache.put(key, ProviderResponse(text="y", model="m"))
    assert cache.get(key) is None
    assert cache.clear() == 0
