---
title: Interpreting consumer wearable signals
source: Digital health measurement notes
tags: [wearable, anomaly, vitals]
---

Consumer wearable measurements are estimates from optical and motion sensors, not clinical instruments. They are most useful as trends against a person's own baseline, and least useful as absolute single readings.

Resting heart rate varies with sleep quality, alcohol, hydration, ambient temperature, recent activity, acute illness, and stress. A single morning elevated above baseline is common and usually unremarkable. Sustained elevation across several days more often reflects something worth noting.

Heart rate variability is highly individual. Comparing an individual's values against population norms is rarely meaningful; comparing against their own rolling baseline is.

Optical blood oxygen readings are sensitive to fit, movement, skin perfusion, and temperature. Isolated low readings on a wrist device without symptoms are frequently artefact.

Automated anomaly detection on these streams should be framed as a prompt to look, not as a finding. Alert text should state the measured deviation and the baseline it was measured against, avoid clinical interpretation, and avoid implying a cause.

Detection thresholds involve a trade-off: tighter thresholds raise sensitivity and alert volume together, and alert fatigue reduces the value of every subsequent alert.
