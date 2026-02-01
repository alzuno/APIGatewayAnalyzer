# Scoring Algorithm Documentation (v2.0)

This document explains how the **Quality Score** is calculated for each device (IMEI) in the GPS Telemetry Analyzer. The score is a weighted average of several key performance indicators (KPIs), normalized to a 0-100 scale.

## 1. Weighted Components

| Component | Weight | Description |
| :--- | :--- | :--- |
| **CAN Bus Completeness** | 35% | Evaluates if the device is sending all 6 core CAN Bus fields. |
| **Odometer Quality** | 25% | Checks for data integrity (decreases or frozen values). |
| **GPS Integrity** | 20% | Measures the percentage of records with `quality: 'Good'`. |
| **Latency (Delay)** | 10% | Penalizes high delays between generation and receipt. |
| **Event Consistency** | 10% | Checks for balance between Ignition On and Off events. |

---

## 2. Component Details

### A. CAN Bus Completeness (35%)
We track 6 specific fields defined in the API:
1. `engineRPM`
2. `vehicleSpeed`
3. `engineCoolantTemperature`
4. `totalDistance`
5. `totalFuelUsed`
6. `fuelLevelInput`

**Calculation**: `% of these 6 fields present in the reports.`

### B. Odometer Quality (25%)
The odometer (`mileage`) is strictly monitored:
*   **Decreasing Values**: Any instance where the current mileage is lower than the previous one (excluding clear reset scenarios) is flagged as an error.
*   **Frozen Odometer**: If `lat/lng` changes significantly but `mileage` remains exactly the same, the odometer is considered "frozen".

**Calculation**: `(1 - (Errors / Total Reports)) * 100`

### C. GPS Integrity (20%)
Based on the `quality` field provided by the device.
**Calculation**: `% of reports where quality == 'Good'`.

### D. Latency / Delay (10%)
Measures the average `delay_seconds` (Receipt Time - Generation Time).
*   **Penalty**: If Average Delay > 30 seconds, the score for this component starts decreasing linearly.
*   **Threshold**: Delays over 300 seconds result in 0 points for this component.

### E. Event Consistency (10%)
Analyzes `IgnitionOn` and `IgnitionOff` events.
*   **Ideal**: A balanced count (difference of ≤ 1).
*   **Penalty**: Significant imbalances (e.g., only ON events) indicate a reporting logic failure.

---

## 3. Final Calculation
The total score is the sum of these weighted components, clipped between 0 and 100. Anomalies like extreme RPM (> 8000) also subtract a small penalty from the final result.
