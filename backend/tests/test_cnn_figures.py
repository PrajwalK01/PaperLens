"""
Unit tests for the duplicate-figure detection logic in app/utils/cnn_figures.py.

find_duplicate_figures() only needs perceptual hashes (strings) as input —
it doesn't touch the CNN model itself — so these tests construct fake
FigureAnalysis-shaped dicts directly rather than running real images through
the model. This means they run WITHOUT torch/torchvision installed, which
matters a lot given how large that dependency is.

Run: cd backend && pytest tests/test_cnn_figures.py -v
"""

import sys
import os
import types

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


def _install_torch_stub():
    """cnn_figures.py imports torch/torchvision/PIL at module level — stub
    them out so we can test find_duplicate_figures() (pure hashing logic)
    without installing the full ~1GB+ CNN dependency stack."""
    for name in ["torch", "torch.nn", "torchvision", "torchvision.models", "torchvision.transforms", "PIL", "PIL.Image"]:
        if name not in sys.modules:
            sys.modules[name] = types.ModuleType(name)

    # torch.nn.Module needs to exist as a subclassable base class (FigureCNN inherits it)
    class _FakeModule:
        def __init__(self, *a, **kw):
            pass

        def __call__(self, *a, **kw):
            raise NotImplementedError("Stub — install real torch for CNN inference tests")

    sys.modules["torch.nn"].Module = _FakeModule
    sys.modules["torch.nn"].Linear = lambda *a, **kw: _FakeModule()
    sys.modules["torch.nn"].Sequential = lambda *a, **kw: _FakeModule()
    sys.modules["torch"].nn = sys.modules["torch.nn"]
    sys.modules["torch"].no_grad = lambda: _NullContext()
    sys.modules["torch"].device = lambda *a, **kw: "cpu"
    sys.modules["torch"].cuda = types.SimpleNamespace(is_available=lambda: False)
    sys.modules["torchvision"].models = sys.modules["torchvision.models"]
    sys.modules["torchvision"].transforms = sys.modules["torchvision.transforms"]
    sys.modules["torchvision.transforms"].Compose = lambda *a, **kw: None
    sys.modules["torchvision.transforms"].Resize = lambda *a, **kw: None
    sys.modules["torchvision.transforms"].ToTensor = lambda *a, **kw: None
    sys.modules["torchvision.transforms"].Normalize = lambda *a, **kw: None


class _NullContext:
    def __enter__(self):
        return self

    def __exit__(self, *a):
        return False


_install_torch_stub()

from app.utils.cnn_figures import find_duplicate_figures  # noqa: E402


def _fake_analysis(page, index, phash):
    return {"page": page, "index": index, "width": 400, "height": 300, "predicted_class": "chart_or_plot", "class_confidence": 0.5, "phash": phash, "embedding": []}


def test_identical_phashes_are_flagged_as_duplicates():
    analyses = [
        _fake_analysis(1, 0, "a1b2c3d4"),
        _fake_analysis(3, 1, "a1b2c3d4"),  # exact same hash, different page — reused figure
    ]
    duplicates = find_duplicate_figures(analyses, hamming_threshold=4)
    assert len(duplicates) == 1
    assert duplicates[0]["hamming_distance"] == 0


def test_very_different_phashes_are_not_flagged():
    analyses = [
        _fake_analysis(1, 0, "00000000"),
        _fake_analysis(2, 0, "ffffffff"),  # maximally different
    ]
    duplicates = find_duplicate_figures(analyses, hamming_threshold=4)
    assert len(duplicates) == 0


def test_near_duplicate_within_threshold_is_flagged():
    # "a1b2c3d4" vs "a1b2c3d5" differ by a small hamming distance (last hex digit only)
    analyses = [
        _fake_analysis(1, 0, "a1b2c3d4"),
        _fake_analysis(1, 1, "a1b2c3d5"),
    ]
    duplicates = find_duplicate_figures(analyses, hamming_threshold=4)
    assert len(duplicates) == 1


def test_no_duplicates_with_single_figure():
    analyses = [_fake_analysis(1, 0, "a1b2c3d4")]
    duplicates = find_duplicate_figures(analyses)
    assert duplicates == []


def test_no_duplicates_with_empty_list():
    assert find_duplicate_figures([]) == []


def test_duplicate_result_references_correct_page_and_index():
    analyses = [
        _fake_analysis(5, 2, "aaaaaaaa"),
        _fake_analysis(9, 0, "aaaaaaaa"),
    ]
    duplicates = find_duplicate_figures(analyses, hamming_threshold=0)
    assert duplicates[0]["figure_a"] == {"page": 5, "index": 2}
    assert duplicates[0]["figure_b"] == {"page": 9, "index": 0}


if __name__ == "__main__":
    import traceback
    tests = [v for k, v in list(globals().items()) if k.startswith("test_")]
    passed, failed = 0, 0
    for t in tests:
        try:
            t()
            print(f"PASS: {t.__name__}")
            passed += 1
        except AssertionError:
            print(f"FAIL: {t.__name__}")
            traceback.print_exc()
            failed += 1
    print(f"\n{passed} passed, {failed} failed")
