import pytest

from evalharness.config import ConfigError, load_suite
from evalharness.dataset import DatasetError, load_golden_set


def write(tmp_path, name, text):
    p = tmp_path / name
    p.write_text(text, encoding="utf-8")
    return str(p)


def test_load_yaml_golden_set(tmp_path):
    path = write(
        tmp_path,
        "g.yaml",
        "name: g\nversion: '1'\ncases:\n  - {id: a, input: hi, expected: yo}\n",
    )
    gs = load_golden_set(path)
    assert gs.name == "g"
    assert gs.cases[0].id == "a"


def test_load_jsonl_golden_set(tmp_path):
    path = write(
        tmp_path,
        "g.jsonl",
        '{"id": "a", "input": "hi"}\n{"id": "b", "input": "yo"}\n',
    )
    gs = load_golden_set(path)
    assert [c.id for c in gs.cases] == ["a", "b"]


def test_duplicate_ids_rejected(tmp_path):
    path = write(
        tmp_path,
        "g.yaml",
        "cases:\n  - {id: a, input: x}\n  - {id: a, input: y}\n",
    )
    with pytest.raises(DatasetError, match="duplicate"):
        load_golden_set(path)


def test_empty_input_rejected(tmp_path):
    path = write(tmp_path, "g.yaml", "cases:\n  - {id: a, input: ''}\n")
    with pytest.raises(DatasetError):
        load_golden_set(path)


def test_missing_golden_set(tmp_path):
    with pytest.raises(DatasetError, match="not found"):
        load_golden_set(str(tmp_path / "nope.yaml"))


def test_suite_requires_input_placeholder(tmp_path):
    path = write(
        tmp_path,
        "s.yaml",
        "name: s\ngolden_set: g.yaml\nprompt_template: 'no placeholder'\n"
        "scorers:\n  - {type: contains}\n",
    )
    with pytest.raises(ConfigError, match="input"):
        load_suite(path)


def test_suite_requires_scorers(tmp_path):
    path = write(tmp_path, "s.yaml", "name: s\ngolden_set: g.yaml\nscorers: []\n")
    with pytest.raises(ConfigError):
        load_suite(path)


def test_golden_set_path_resolves_relative_to_config(tmp_path):
    path = write(
        tmp_path,
        "s.yaml",
        "name: s\ngolden_set: g.yaml\nscorers:\n  - {type: contains}\n",
    )
    cfg = load_suite(path)
    assert cfg.golden_set_path().endswith("g.yaml")
    assert str(tmp_path) in cfg.golden_set_path()
