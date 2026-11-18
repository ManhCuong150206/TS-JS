# Kiểm thử Backend

Bộ kiểm thử được chia theo mục tiêu:

- `unit/`: kiểm tra logic controller/service/helper bằng Jest, mock Mongoose; không cần MongoDB thật.
- `performance/`: kịch bản hiệu năng API qua Grafana k6. `run-all.ps1` mặc định chỉ gọi GET public; profile database opt-in tạo tài khoản/dataset tạm và cleanup qua API.

## Module Backend được khảo sát

`datasets`, `experiments`, `training-runs`, `sync`, `login/auth`, `users`, cùng `AppController`, `AppService`, cấu hình, guard và shared helpers. Route và trạng thái kiểm thử API được liệt kê tại `performance/docs/API-INVENTORY.md`.

## Lệnh

```powershell
# Jest unit tests trong `test/unit/`
npm.cmd run test:unit

# Jest coverage cho source được import/thu thập
npm.cmd run test:unit:cov

# Bộ Vitest sẵn có trong src/**/*.spec.ts
npm.cmd test

# k6 smoke (GET root/health trên localhost)
.\test\performance\scripts\run-smoke.ps1

# Baseline/load an toàn; xem tham số trong performance/README.md
.\test\performance\scripts\run-baseline.ps1
.\test\performance\scripts\run-load.ps1

# Stress, spike, soak chỉ chạy riêng sau khi kiểm tra môi trường
.\test\performance\scripts\run-stress.ps1 -ConfirmHighLoad
.\test\performance\scripts\run-spike.ps1 -ConfirmHighLoad
.\test\performance\scripts\run-soak.ps1 -ConfirmHighLoad

# Auth + MongoDB qua API; chỉ dùng DB test localhost đã xác nhận cô lập
.\test\performance\scripts\run-database.ps1 -VUs 1 -Duration 15s -ConfirmTestDataWrites
```

## Trạng thái

Jest: 15/15 suites và 64/64 tests PASS; coverage Statements 57.81%, Branches 46.65%, Functions 49.30%, Lines 59.69% (các mục tiêu tham khảo chưa đạt). k6 smoke/baseline/low-load và database profile 1–3 VU đều PASS ở localhost; xem [báo cáo tổng hợp](performance/reports/2026-11-18-run-all-summary.md), từng báo cáo tại `performance/reports/` và [API inventory](performance/docs/API-INVENTORY.md). Database profile mới đo auth/session và dataset metadata; các API module khác cùng stress/soak đầy đủ vẫn chưa chạy.
