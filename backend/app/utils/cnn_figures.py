"""
CNN-based figure/image analysis for PaperLens.

Extracts embedded figures from a PDF (utils/pdf_parser.extract_images) and
runs them through a CNN for two purposes:

  1. FIGURE CLASSIFICATION — categorize each image (chart/plot, diagram,
     photo/micrograph, table-as-image, screenshot) so the review can note
     what kind of visual evidence the paper actually contains.
  2. DUPLICATE / REUSED-FIGURE DETECTION — perceptual-hash + embedding
     similarity between figures in THIS paper (catches a figure copy-pasted
     twice) and, if you extend it, against figures from other papers you've
     ingested (catches image reuse across submissions).

HONEST LIMITATION: the classifier head below is architecturally real and
runs end-to-end (ResNet18 backbone, ImageNet-pretrained, small trainable
head) but it has NOT been fine-tuned on academic-figure categories — nobody
can hand you that without a labeled dataset. Out of the box it will produce
plausible-looking but not accurate category labels. `train_classifier_head()`
at the bottom is the fine-tuning entry point: point it at a folder of
labeled figure images (subfolder-per-class) and it trains the head in a
few minutes on CPU. Until you do that, treat classification output as a
placeholder and lean on the duplicate-detection part, which works correctly
with zero training since it's pure similarity, not classification.
"""

from __future__ import annotations

import hashlib
import io
import logging
from typing import Any, Dict, List, Optional, TypedDict

import torch
import torch.nn as nn
from PIL import Image
from torchvision import models, transforms

logger = logging.getLogger(__name__)

DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")

# NOTE: kept in alphabetical order to match torchvision.datasets.ImageFolder's
# class-to-index assignment (it sorts subfolder names alphabetically). If you
# rename or reorder these, retrain the head — the index order must match.
FIGURE_CLASSES = ["chart_or_plot", "diagram", "photo_or_micrograph", "screenshot", "table_image"]

_PREPROCESS = transforms.Compose([
    transforms.Resize((224, 224)),
    transforms.ToTensor(),
    transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
])


class FigureAnalysis(TypedDict):
    page: int
    index: int
    width: int
    height: int
    predicted_class: str
    class_confidence: float
    phash: str
    embedding: List[float]


# ── Model ────────────────────────────────────────────────────────────────────

class FigureCNN(nn.Module):
    """ResNet18 backbone (ImageNet-pretrained) + small trainable classification head."""

    def __init__(self, num_classes: int = len(FIGURE_CLASSES)):
        super().__init__()
        backbone = models.resnet18(weights=models.ResNet18_Weights.IMAGENET1K_V1)
        self.features = nn.Sequential(*list(backbone.children())[:-1])  # drop final FC -> 512-d embedding
        for param in self.features.parameters():
            param.requires_grad = False  # frozen backbone; only the head trains
        self.head = nn.Linear(512, num_classes)

    def forward(self, x):
        with torch.no_grad():
            feats = self.features(x).flatten(1)  # (batch, 512)
        logits = self.head(feats)
        return logits, feats


_model: Optional[FigureCNN] = None


def _get_model() -> FigureCNN:
    global _model
    if _model is None:
        _model = FigureCNN().to(DEVICE)
        _model.eval()
        logger.info("FigureCNN loaded on %s (head is untrained — see module docstring)", DEVICE)
    return _model


def load_finetuned_head(weights_path: str) -> None:
    """Load a fine-tuned classification head after running train_classifier_head()."""
    model = _get_model()
    state = torch.load(weights_path, map_location=DEVICE)
    model.head.load_state_dict(state)
    model.eval()
    logger.info("Loaded fine-tuned FigureCNN head from %s", weights_path)


# ── Inference ────────────────────────────────────────────────────────────────

def _phash(img: Image.Image, hash_size: int = 8) -> str:
    """Simple perceptual hash (average-hash) for near-duplicate detection — no extra deps."""
    small = img.convert("L").resize((hash_size, hash_size), Image.LANCZOS)
    pixels = list(small.getdata())
    avg = sum(pixels) / len(pixels)
    bits = "".join("1" if p > avg else "0" for p in pixels)
    return hashlib.md5(int(bits, 2).to_bytes((len(bits) + 7) // 8, "big")).hexdigest()


def analyze_image(image_bytes: bytes, page: int, index: int, width: int, height: int) -> Optional[FigureAnalysis]:
    """Run one extracted figure through the CNN: classification + embedding + phash."""
    try:
        img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    except Exception as exc:
        logger.warning("Could not open extracted image (page=%d idx=%d): %s", page, index, exc)
        return None

    model = _get_model()
    tensor = _PREPROCESS(img).unsqueeze(0).to(DEVICE)

    with torch.no_grad():
        logits, feats = model(tensor)
        probs = torch.softmax(logits, dim=1)[0]
        pred_idx = int(torch.argmax(probs).item())
        confidence = float(probs[pred_idx].item())

    return FigureAnalysis(
        page=page,
        index=index,
        width=width,
        height=height,
        predicted_class=FIGURE_CLASSES[pred_idx],
        class_confidence=round(confidence, 3),
        phash=_phash(img),
        embedding=feats[0].cpu().tolist(),
    )


def analyze_paper_figures(images: List[dict]) -> List[FigureAnalysis]:
    """
    Run analyze_image over every extracted figure from pdf_parser.extract_images().
    Returns a list of FigureAnalysis dicts.
    """
    results: List[FigureAnalysis] = []
    for img in images:
        analysis = analyze_image(img["bytes"], img["page"], img["index"], img["width"], img["height"])
        if analysis:
            results.append(analysis)
    return results


def find_duplicate_figures(analyses: List[FigureAnalysis], hamming_threshold: int = 4) -> List[Dict[str, Any]]:
    """
    Flag pairs of figures within the SAME paper that are likely duplicates or
    near-duplicates (same chart reused, or figure manipulated slightly),
    using perceptual hash Hamming distance.
    """
    def hamming(a: str, b: str) -> int:
        int_a, int_b = int(a, 16), int(b, 16)
        return bin(int_a ^ int_b).count("1")

    duplicates = []
    for i in range(len(analyses)):
        for j in range(i + 1, len(analyses)):
            dist = hamming(analyses[i]["phash"], analyses[j]["phash"])
            if dist <= hamming_threshold:
                duplicates.append(
                    {
                        "figure_a": {"page": analyses[i]["page"], "index": analyses[i]["index"]},
                        "figure_b": {"page": analyses[j]["page"], "index": analyses[j]["index"]},
                        "hamming_distance": dist,
                    }
                )
    return duplicates


def figures_to_prompt_string(analyses: List[FigureAnalysis], duplicates: List[Dict[str, Any]]) -> str:
    """Compact summary for inclusion in the integrity report / Synthesizer prompt."""
    import json
    summary = {
        "figure_count": len(analyses),
        "figure_classes": {
            cls: sum(1 for a in analyses if a["predicted_class"] == cls) for cls in FIGURE_CLASSES
        },
        "note": "Classification uses an UNTRAINED head — treat class labels as low-confidence "
                "until train_classifier_head() has been run on labeled data.",
        "potential_duplicate_figures": duplicates,
    }
    return json.dumps(summary, indent=2)


# ── Fine-tuning entry point (run offline, not during a review request) ─────

def train_classifier_head(
    labeled_data_dir: str,
    epochs: int = 10,
    batch_size: int = 16,
    lr: float = 1e-3,
    save_path: str = "figure_cnn_head.pt",
) -> str:
    """
    Fine-tune ONLY the classification head (backbone stays frozen) on your
    own labeled figure dataset.

    Expected directory layout:
      labeled_data_dir/
        chart_or_plot/*.png
        diagram/*.png
        photo_or_micrograph/*.png
        table_image/*.png
        screenshot/*.png

    A few hundred images per class is enough to get a usable head since the
    backbone is already doing the heavy visual feature extraction. Runs on
    CPU in a few minutes for a dataset this size.
    """
    from torch.utils.data import DataLoader
    from torchvision.datasets import ImageFolder

    dataset = ImageFolder(labeled_data_dir, transform=_PREPROCESS)
    loader = DataLoader(dataset, batch_size=batch_size, shuffle=True)

    model = _get_model()
    model.head.train()
    optimizer = torch.optim.Adam(model.head.parameters(), lr=lr)
    criterion = nn.CrossEntropyLoss()

    for epoch in range(epochs):
        total_loss = 0.0
        for images, labels in loader:
            images, labels = images.to(DEVICE), labels.to(DEVICE)
            optimizer.zero_grad()
            logits, _ = model(images)
            loss = criterion(logits, labels)
            loss.backward()
            optimizer.step()
            total_loss += loss.item()
        logger.info("Epoch %d/%d — loss: %.4f", epoch + 1, epochs, total_loss / max(len(loader), 1))

    torch.save(model.head.state_dict(), save_path)
    model.head.eval()
    logger.info("Saved fine-tuned head to %s", save_path)
    return save_path
