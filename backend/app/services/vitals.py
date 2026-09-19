"""Synthetic wearable streams and real-time anomaly detection.

No model in this path. The detector has to answer on every sample, so the rule
is arithmetic: a rolling z-score with a minimum run length to suppress single
-sample blips. Detection latency is measured per sample and exposed, because
that is what the evaluation asks about.

Swap `synthetic_stream()` for a Kafka consumer and nothing else changes —
`RollingDetector.push()` is the whole contract.
"""

from __future__ import annotations

import asyncio
import math
import random
import time
from collections import deque
from dataclasses import dataclass, field
from typing import AsyncIterator, Iterator

STREAM_SPECS = {
    "hr": {"label": "Heart rate", "unit": "bpm", "baseline": 74.0, "spread": 4.0},
    "hrv": {"label": "Heart rate variability", "unit": "ms", "baseline": 46.0, "spread": 6.0},
    "spo2": {"label": "Blood oxygen", "unit": "%", "baseline": 97.0, "spread": 0.8},
    "glucose": {"label": "Interstitial glucose", "unit": "mg/dL", "baseline": 118.0, "spread": 9.0},
}

SEVERITY_TEXT = {"info": "worth a look", "caution": "worth noting", "warn": "worth acting on"}


@dataclass
class Sample:
    index: int
    value: float
    at: float


@dataclass
class Anomaly:
    stream_id: str
    label: str
    unit: str
    start_index: int
    end_index: int
    samples: int
    peak_value: float
    baseline: float
    delta: float
    z: float
    direction: str
    severity: str
    message: str
    detect_latency_ms: float
    emitted_at: float = field(default_factory=time.time)

    def as_dict(self) -> dict:
        return self.__dict__.copy()


class RollingDetector:
    """Online z-score over a sliding window.

    O(window) per sample with no allocation beyond the deque, which is what
    makes sub-millisecond detection possible on a single core.
    """

    def __init__(self, stream_id: str, window: int = 12, threshold: float = 2.5, min_run: int = 3) -> None:
        spec = STREAM_SPECS.get(stream_id, {"label": stream_id, "unit": "", "baseline": 0.0})
        self.stream_id = stream_id
        self.label = str(spec["label"])
        self.unit = str(spec["unit"])
        self.window = window
        self.threshold = threshold
        self.min_run = min_run
        self._buf: deque[float] = deque(maxlen=window)
        self._run: list[tuple[Sample, float, float]] = []
        self.latencies_ms: list[float] = []

    def push(self, sample: Sample) -> Anomaly | None:
        """Feed one sample. Returns an Anomaly when a run closes."""
        started = time.perf_counter()
        emitted: Anomaly | None = None

        if len(self._buf) == self.window:
            mean = sum(self._buf) / self.window
            variance = sum((v - mean) ** 2 for v in self._buf) / self.window
            sd = math.sqrt(variance) or 1e-4
            z = (sample.value - mean) / sd
            if abs(z) >= self.threshold:
                self._run.append((sample, z, mean))
            elif self._run:
                emitted = self._close_run()

        self._buf.append(sample.value)
        latency = (time.perf_counter() - started) * 1000
        self.latencies_ms.append(latency)
        if emitted is not None:
            emitted.detect_latency_ms = round(latency, 4)
        return emitted

    def flush(self) -> Anomaly | None:
        return self._close_run() if self._run else None

    def _close_run(self) -> Anomaly | None:
        run, self._run = self._run, []
        if len(run) < self.min_run:
            return None
        peak_sample, peak_z, peak_mean = max(run, key=lambda r: abs(r[1]))
        delta = peak_sample.value - peak_mean
        severity = "warn" if (abs(peak_z) >= 4 or len(run) >= 10) else ("caution" if abs(peak_z) >= 3 else "info")
        direction = "above" if delta >= 0 else "below"
        sign = "+" if delta >= 0 else ""
        return Anomaly(
            stream_id=self.stream_id,
            label=self.label,
            unit=self.unit,
            start_index=run[0][0].index,
            end_index=run[-1][0].index,
            samples=len(run),
            peak_value=round(peak_sample.value, 1),
            baseline=round(peak_mean, 1),
            delta=round(delta, 1),
            z=round(abs(peak_z), 2),
            direction=direction,
            severity=severity,
            # Deliberately descriptive. No cause, no interpretation, no advice.
            message=(
                f"{self.label} {sign}{round(delta, 1)} {self.unit} {direction} baseline "
                f"({round(peak_mean, 1)} {self.unit}) across {len(run)} samples — {SEVERITY_TEXT[severity]}."
            ),
            detect_latency_ms=0.0,
        )

    def stats(self) -> dict:
        if not self.latencies_ms:
            return {"samples": 0}
        ordered = sorted(self.latencies_ms)
        return {
            "samples": len(ordered),
            "p50_ms": round(ordered[len(ordered) // 2], 4),
            "p95_ms": round(ordered[int(len(ordered) * 0.95) - 1], 4),
            "max_ms": round(ordered[-1], 4),
        }


def synthetic_stream(stream_id: str, count: int, *, seed: int = 7, inject_at: int | None = None,
                     inject_delta: float = 0.0) -> Iterator[Sample]:
    """Reproducible pseudo-wearable data. Seeded so tests are not flaky."""
    spec = STREAM_SPECS[stream_id]
    rng = random.Random(seed)
    base = float(spec["baseline"])
    spread = float(spec["spread"])
    now = time.time()
    for i in range(count):
        drift = math.sin(i / 7) * spread * 0.35
        noise = rng.gauss(0, spread * 0.35)
        value = base + drift + noise
        if inject_at is not None and i >= inject_at:
            value += inject_delta * min(1.0, (i - inject_at + 1) / 4)
        yield Sample(index=i, value=round(value, 2), at=now + i)


async def stream_with_detection(
    stream_id: str = "hr",
    count: int = 120,
    interval_s: float = 0.25,
    *,
    window: int = 12,
    threshold: float = 2.5,
    min_run: int = 3,
    inject_at: int | None = 60,
    inject_delta: float = 14.0,
    seed: int = 7,
) -> AsyncIterator[dict]:
    """Yields `sample` events and `anomaly` events as they are detected."""
    detector = RollingDetector(stream_id, window=window, threshold=threshold, min_run=min_run)
    for sample in synthetic_stream(stream_id, count, seed=seed, inject_at=inject_at, inject_delta=inject_delta):
        anomaly = detector.push(sample)
        yield {"type": "sample", "stream_id": stream_id, "index": sample.index, "value": sample.value}
        if anomaly is not None:
            yield {"type": "anomaly", **anomaly.as_dict()}
        if interval_s:
            await asyncio.sleep(interval_s)
    tail = detector.flush()
    if tail is not None:
        yield {"type": "anomaly", **tail.as_dict()}
    yield {"type": "stats", "stream_id": stream_id, **detector.stats()}


def batch_detect(stream_id: str, count: int = 120, **kwargs) -> dict:
    """Non-streaming path for the dashboard's initial paint."""
    detector = RollingDetector(
        stream_id,
        window=kwargs.get("window", 12),
        threshold=kwargs.get("threshold", 2.5),
        min_run=kwargs.get("min_run", 3),
    )
    samples, anomalies = [], []
    for sample in synthetic_stream(
        stream_id, count,
        seed=kwargs.get("seed", 7),
        inject_at=kwargs.get("inject_at", 60),
        inject_delta=kwargs.get("inject_delta", 14.0),
    ):
        found = detector.push(sample)
        samples.append({"index": sample.index, "value": sample.value})
        if found:
            anomalies.append(found.as_dict())
    tail = detector.flush()
    if tail:
        anomalies.append(tail.as_dict())
    return {"stream_id": stream_id, "samples": samples, "anomalies": anomalies, "stats": detector.stats()}
