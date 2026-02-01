# Scoring Algorithm Documentation (v2.1)

This document explains how the **Quality Score** is calculated for each device (IMEI) in the GPS Telemetry Analyzer. The score is a weighted average of several key performance indicators (KPIs), normalized to a 0-100 scale.

## 1. Weighted Components

| Component | Weight | Description |
| :--- | :--- | :--- |
| **CAN Bus Completeness** | 35% | Evaluates if the device is sending all 6 core CAN Bus fields. |
| **Odometer Quality** | 25% | Checks for data integrity (decreases or frozen values). |
| **GPS Integrity** | 20% | Measures the percentage of records with `quality: 'Good'`. |
| **Latency (Delay)** | 10% | Penalizes high delays between generation and receipt. |
| **Event Consistency** | 10% | Checks for balance between Ignition On and Off events. |
| **Forensic Penalty** | Dynamic | Penalties for frozen sensors (RPM, Temp, Speed). |

---

## 2. Component Details

### A. CAN Bus Completeness (35%)
We track 6 specific fields:
1. `engineRPM`
2. `vehicleSpeed`
3. `engineCoolantTemperature`
4. `totalDistance`
5. `totalFuelUsed`
6. `fuelLevelInput`

**Calculation**: `% of these 6 fields present in the reports.`

### B. Odometer Quality (25%)
*   **Decreasing Values**: Any instance where the current mileage is lower than the previous one is flagged.
*   **Frozen Odometer**: If `lat/lng` changes significantly but `mileage` remains static, it is considered frozen.

### C. GPS Integrity (20%)
Based on the `quality` field provided by the device. Percentage of reports where quality == 'Good'.

### D. Latency / Delay (10%)
Measures the average delay between generation and receipt. Penalties start after 30 seconds.

### E. Event Consistency (10%)
Analyzes `Ignition On` and `Ignition Off` events. Ideal is a balanced count (diff <= 1).

---

## 3. Forensic Sensor Validation (v2.1)
detects "unrealistic" static data that indicates sensor failure or bypass.

### A. Frozen RPM Check
*   **Trigger**: If the device reports `Ignition ON` and `Speed > 0`, but the `engineRPM` value is exactly `0` or does not change over a series of reports.
*   **Penalty**: Subtracts **15 points** from the final score.

### B. Sensor Variation Check (Temp & Speed)
*   **Trigger**: If the device provides data for `engineCoolantTemperature` or `vehicleSpeed`, but these values never change over a session of 10+ reports.
*   **Penalty**: Subtracts **10 points** per static sensor.

---

## 4. Final Calculation
The total score is the sum of these weighted components (0-100), followed by the subtraction of forensic penalties. The result is clipped at 0.
