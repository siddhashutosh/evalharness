import logging

from evalharness.log import configure, get_logger


def test_get_logger_is_namespaced():
    log = get_logger("evalharness.thing")
    assert log.name.startswith("evalharness")


def test_get_logger_normalizes_dunder_main():
    log = get_logger("__main__")
    assert log.name.startswith("evalharness.")


def test_configure_sets_level_and_is_idempotent():
    configure("debug")
    root = logging.getLogger("evalharness")
    assert root.level == logging.DEBUG
    handlers_before = len(root.handlers)
    configure("info")  # second call only adjusts level
    assert root.level == logging.INFO
    assert len(root.handlers) == handlers_before


def test_logging_emits(caplog):
    log = get_logger("evalharness.test")
    with caplog.at_level(logging.INFO, logger="evalharness"):
        log.info("hello %s", "world")
    assert any("hello world" in r.message for r in caplog.records)
