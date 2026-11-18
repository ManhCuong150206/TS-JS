# Tổng hợp Performance Testing — 2026-11-18

## Môi trường và ngưỡng

- Backend: `http://localhost:3000`; health preflight trả HTTP 200.
- MongoDB: `127.0.0.1:27017/hoi-quy-3d`, người dùng xác nhận là database test cô lập.
- Threshold k6: request failures <1%, p95 <500 ms, p99 <1000 ms, checks >99%.
- Không chạy production. Các mutation chỉ dùng tài khoản/dataset tạm do lượt test tạo và cleanup qua API.
- CPU/RAM và MongoDB metrics không được k6 thu trực tiếp; chỉ số Windows/Mongo ghi riêng kèm giới hạn đo.

## Smoke, baseline và tải thấp chỉ đọc

Run-all chỉ gọi `GET /api/v1` và `GET /api/v1/health`; không có truy vấn collection hay dữ liệu ghi/xóa.

| Test          |        VUs | Duration | Requests |     Avg |     P95 |     P99 | Error Rate | Status |
| ------------- | ---------: | -------: | -------: | ------: | ------: | ------: | ---------: | ------ |
| Smoke         |          1 |   5.25 s |       50 | 0.83 ms | 1.51 ms | 1.61 ms |         0% | PASS   |
| Baseline      | 1 → 5 → 10 |  20.32 s |      794 | 1.52 ms | 3.76 ms | 6.38 ms |         0% | PASS   |
| API read-only |          1 |   5.27 s |       50 | 0.99 ms | 2.07 ms | 2.58 ms |         0% | PASS   |
| Load thấp     |      1 → 5 |  10.28 s |      276 | 1.04 ms | 2.08 ms | 3.16 ms |         0% | PASS   |

Smoke xác minh cuối (1 VU, 5 giây): 50 requests, p95 2.19 ms, p99 2.91 ms, error rate 0%.

## Thăm dò stress/spike/soak giới hạn

Các lượt này chỉ gọi root/health public. Mức tải/thời gian thấp nên không đại diện stress test đầy đủ, soak 30 phút hoặc giới hạn chịu tải.

| Test            | VUs tối đa | Duration | Requests |     Avg |     P95 |     P99 | Error Rate | Status          |
| --------------- | ---------: | -------: | -------: | ------: | ------: | ------: | ---------: | --------------- |
| Stress giới hạn |         10 |   7.34 s |      476 | 1.38 ms | 4.00 ms | 6.30 ms |         0% | PASS thresholds |
| Spike giới hạn  |         10 |  27.36 s |    1,580 | 0.82 ms | 1.93 ms | 3.29 ms |         0% | PASS thresholds |
| Soak ngắn       |          5 |  30.35 s |    1,484 | 0.92 ms | 1.75 ms | 2.46 ms |         0% | PASS thresholds |

## Auth và database qua API bằng k6

Profile database tạo email/password ngẫu nhiên, đăng ký và bootstrap login bằng PowerShell, sau đó login trong k6 và đo API session/dataset. Mỗi iteration GET user, đọc trang datasets, tạo dataset metadata với clientId duy nhất, đọc detail và soft-delete chính dataset đó. Logout chạy trong k6 teardown. Wrapper xóa tài khoản tạm bằng `DELETE /api/v1/users/me`; account deletion soft-delete các tài liệu sở hữu còn sót. Cleanup được xác nhận PASS ở cả hai lượt.

| Test                   | VUs | Duration | Requests |     Avg |     P95 |      P99 | Error Rate | Checks | Status             |
| ---------------------- | --: | -------: | -------: | ------: | ------: | -------: | ---------: | -----: | ------------------ |
| DB API monitored smoke |   1 |   5.54 s |      117 | 5.91 ms | 6.26 ms |  7.52 ms |         0% |   100% | PASS; cleanup PASS |
| DB API concurrency     |   3 |  15.57 s |    1,007 | 5.04 ms | 7.98 ms | 10.10 ms |         0% |   100% | PASS; cleanup PASS |

Lượt concurrency tạo và soft-delete 201 datasets; có một login/logout k6 sample. Login đo được 280.39 ms ở lượt concurrency, nhưng chỉ một mẫu nên không đủ kết luận p95/p99 riêng cho auth. Registration và bootstrap login là một request setup mỗi loại, đo riêng bởi PowerShell. Dataset list p95 là 7.16 ms; mức tải/dữ liệu nhỏ chưa cho thấy bottleneck. Một lượt 3 VU trước đó (992 requests) cũng PASS và có báo cáo riêng.

Audit events do register/login/logout/account deletion tạo có thể còn trong audit collection theo nghiệp vụ backend. Không xóa collection hoặc thao tác trực tiếp lên MongoDB.

## Giám sát tài nguyên và MongoDB

Trong lượt soak public 5 VU/30 giây (`20261118-013756-soak/`), 20 mẫu Windows Performance Counter ghi nhận CPU tổng trung bình 12.53%, cực đại 28.97%, RAM khả dụng thấp nhất 2,889 MB. Có 12 tiến trình Node tổng working set 302.8 MB (không thể quy riêng cho backend); tiến trình `mongod` working set 49.7 MB.

Snapshot MongoDB 9.0.4 sau lượt public ghi nhận 12 connections, 3 active, 204,829 available, 0 rejected và resident memory 49 MB. Các giá trị này không phải time series, và lượt public root/health không truy vấn collection.

Trong lượt database concurrency cùng thời gian đo, 8 mẫu Windows ghi nhận CPU tổng trung bình 11.82%, đỉnh 20.20%; RAM khả dụng thấp nhất 1,878 MB. Tổng working set của các tiến trình Node là 605.4–612.9 MB (không thể tách riêng backend); `mongod` là 59.6–60.2 MB. MongoDB serverStatus trước/sau ghi nhận connections 15/active 3 ổn định, rejected 0, resident memory 59→60 MB. Cumulative counters tăng: insert +203, query +2,616, update +1,208, delete +2, command +12, aggregate +201. Đây là counters toàn mongod trong khoảng đo, có thể gồm lệnh serverStatus và hoạt động local khác; không quy đổi thành chính xác số query API.

Các lượt soak public trước đó ghi nhận snapshot khác (xem artifact); không trộn số liệu giữa hai tải. Dù có resource samples đồng thời ở đây, chưa có event-loop delay, disk I/O hoặc query profiler; không thể kết luận CPU saturation, pool pressure hay query bottleneck từ lượt 3 VU ngắn. HTTP response time không phải thời gian query MongoDB. Để xác định query chậm, dùng MongoDB profiler/monitoring hoặc `explain('executionStats')` trên môi trường test.

## Phạm vi chưa chạy

- Experiment, training-run, sync; upload/download file; profile/password update; API dữ liệu khác ngoài dataset chưa được đo trong k6.
- Stress/spike/soak đủ tải/thời gian chưa chạy; các kết quả ở trên là thăm dò có giới hạn.
- Không thu event-loop delay, disk I/O hoặc MongoDB profiler/explain query timings.
- Không kết luận throughput hoặc query performance ở quy mô production.

## Artifacts

- Run-all: `20261118-010504-smoke/`, `20261118-010509-baseline/`, `20261118-010530-api/`, `20261118-010535-load/`.
- Stress/spike/soak giới hạn: `20261118-013135-stress/`, `20261118-013144-spike/`, `20261118-013200-soak/`, `20261118-013756-soak/`.
- Auth/database: `20261118-015249-database/`, `20261118-015404-database/`, `20261118-020420-database/`, `20261118-020453-database/`, `20261118-020946-database/`.
- K6 summary ban đầu có trường `setup_data.cookie`; đã redacted artifact đầu và thêm redaction tự động vào runner. Đã quét tất cả report artifacts, không còn cookie/password. Summary giữ giá trị `[REDACTED]`.
